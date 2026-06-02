const RECORDING_SESSION_KEY = "recording_session";
const EXECUTION_STATE_KEY = "execution_state";
const EXECUTION_LAST_EVENT_KEY = "execution_last_event";
const BADGE_BACKGROUND_COLOR = "#012292";
const BADGE_TEXT_COLOR = "#ffffff";
const CREATE_BADGE_TEXT = "REC";
const RUN_BADGE_TEXT = "RUN";

function buildMacroName(domain) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);
  return `${domain} ${date} ${time}`;
}

function getDomainFromUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl) {
    return "unknown";
  }

  try {
    const url = new URL(rawUrl);
    return url.hostname.replace(/^www\./, "") || "unknown";
  } catch {
    return "unknown";
  }
}

async function readSession() {
  const data = await chrome.storage.local.get(RECORDING_SESSION_KEY);
  return data?.[RECORDING_SESSION_KEY] ?? null;
}

async function writeSession(session) {
  await chrome.storage.local.set({ [RECORDING_SESSION_KEY]: session });
}

async function clearSession() {
  await chrome.storage.local.remove(RECORDING_SESSION_KEY);
}

async function readExecutionState() {
  const data = await chrome.storage.local.get(EXECUTION_STATE_KEY);
  return data?.[EXECUTION_STATE_KEY] ?? null;
}

async function writeExecutionState(state) {
  await chrome.storage.local.set({ [EXECUTION_STATE_KEY]: state });
}

async function clearExecutionState() {
  await chrome.storage.local.remove(EXECUTION_STATE_KEY);
}

async function writeExecutionLastEvent(event) {
  await chrome.storage.local.set({ [EXECUTION_LAST_EVENT_KEY]: event });
}

async function takeExecutionLastEvent() {
  const data = await chrome.storage.local.get(EXECUTION_LAST_EVENT_KEY);
  const event = data?.[EXECUTION_LAST_EVENT_KEY] ?? null;
  await chrome.storage.local.remove(EXECUTION_LAST_EVENT_KEY);
  return event;
}

async function setActionBadgeText(text) {
  await chrome.action.setBadgeText({ text });
  if (text) {
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_BACKGROUND_COLOR });
    if (typeof chrome.action.setBadgeTextColor === "function") {
      await chrome.action.setBadgeTextColor({ color: BADGE_TEXT_COLOR });
    }
  }
}

async function getRuntimeExecutionState() {
  const state = await readExecutionState();
  if (!state?.isRunning) {
    return null;
  }

  const now = Date.now();
  const startedAt = Number(state.startedAt) || now;
  const durationMs = Number(state.durationMs) || 0;
  const elapsedMs = Math.max(0, now - startedAt);
  const remainingMs = Math.max(0, durationMs - elapsedMs);

  if (remainingMs <= 0) {
    await clearExecutionState();
    await writeExecutionLastEvent({
      type: "completed",
      macroId: state.macroId ?? null,
      macroName: typeof state.macroName === "string" ? state.macroName : "macros"
    });
    return null;
  }

  return {
    isRunning: true,
    macroId: state.macroId ?? null,
    macroName: typeof state.macroName === "string" ? state.macroName : "macros",
    startedAt,
    durationMs,
    remainingMs
  };
}

async function syncActionBadge() {
  const session = await readSession();
  if (session?.isActive) {
    await setActionBadgeText(CREATE_BADGE_TEXT);
    return;
  }

  const executionState = await getRuntimeExecutionState();
  if (executionState?.isRunning) {
    await setActionBadgeText(RUN_BADGE_TEXT);
    return;
  }

  await setActionBadgeText("");
}

void syncActionBadge();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    sendResponse({ ok: false, error: "invalid_message" });
    return;
  }

  if (message.type === "recording-start") {
    (async () => {
      const mode = message.mode === "selectors" ? "selectors" : "coordinates";
      const tabId = Number.isInteger(message.tabId) ? message.tabId : null;
      if (tabId === null) {
        sendResponse({ ok: false, error: "tab_id_required" });
        return;
      }

      const session = {
        isActive: true,
        mode,
        tabId,
        domain: getDomainFromUrl(message.url),
        steps: []
      };

      await writeSession(session);
      await syncActionBadge();
      sendResponse({ ok: true });
    })().catch(() => sendResponse({ ok: false, error: "start_failed" }));

    return true;
  }

  if (message.type === "recording-stop") {
    (async () => {
      const session = await readSession();
      if (!session?.isActive) {
        await syncActionBadge();
        sendResponse({ ok: true, hasSession: false });
        return;
      }

      await clearSession();
      await syncActionBadge();
      sendResponse({
        ok: true,
        hasSession: true,
        mode: session.mode,
        macroName: buildMacroName(session.domain),
        steps: Array.isArray(session.steps) ? session.steps : []
      });
    })().catch(() => sendResponse({ ok: false, error: "stop_failed" }));

    return true;
  }

  if (message.type === "recording-click") {
    (async () => {
      const session = await readSession();
      if (!session?.isActive) {
        sendResponse({ ok: true, ignored: true, reason: "inactive" });
        return;
      }

      if (!sender?.tab || sender.tab.id !== session.tabId) {
        sendResponse({ ok: true, ignored: true, reason: "other_tab" });
        return;
      }

      const steps = Array.isArray(session.steps) ? session.steps : [];
      if (session.mode === "selectors") {
        if (typeof message.selector !== "string" || !message.selector.trim()) {
          sendResponse({ ok: true, ignored: true, reason: "invalid_selector" });
          return;
        }

        steps.push(message.selector.trim());
      } else {
        const x = Number(message.x);
        const y = Number(message.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          sendResponse({ ok: true, ignored: true, reason: "invalid_coords" });
          return;
        }

        steps.push(`${Math.round(x)},${Math.round(y)}`);
      }

      await writeSession({ ...session, steps });
      sendResponse({ ok: true });
    })().catch(() => sendResponse({ ok: false, error: "record_failed" }));

    return true;
  }

  if (message.type === "recording-status") {
    (async () => {
      const session = await readSession();
      sendResponse({ ok: true, isActive: Boolean(session?.isActive) });
    })().catch(() => sendResponse({ ok: false, isActive: false }));

    return true;
  }

  if (message.type === "execution-start") {
    (async () => {
      const currentState = await getRuntimeExecutionState();
      if (currentState?.isRunning) {
        sendResponse({ ok: false, error: "already_running", state: currentState });
        return;
      }

      const macroId = typeof message.macroId === "string" ? message.macroId : "";
      const macroName = typeof message.macroName === "string" && message.macroName.trim() ? message.macroName.trim() : "macros";
      const repeatsRaw = Number(message.repeats);
      const repeats = Number.isFinite(repeatsRaw) && repeatsRaw > 0 ? repeatsRaw : 1;
      const state = {
        isRunning: true,
        macroId,
        macroName,
        repeats,
        startedAt: Date.now(),
        durationMs: repeats * 1500
      };
      await writeExecutionState(state);
      await syncActionBadge();
      sendResponse({
        ok: true,
        state: {
          isRunning: true,
          macroId: state.macroId,
          macroName: state.macroName,
          startedAt: state.startedAt,
          durationMs: state.durationMs,
          remainingMs: state.durationMs
        }
      });
    })().catch(() => sendResponse({ ok: false, error: "execution_start_failed" }));

    return true;
  }

  if (message.type === "execution-stop") {
    (async () => {
      const currentState = await getRuntimeExecutionState();
      if (!currentState?.isRunning) {
        await syncActionBadge();
        sendResponse({ ok: true, wasRunning: false });
        return;
      }

      await clearExecutionState();
      await writeExecutionLastEvent({
        type: "stopped",
        macroId: currentState.macroId,
        macroName: currentState.macroName
      });
      await syncActionBadge();
      sendResponse({ ok: true, wasRunning: true, stoppedMacroName: currentState.macroName });
    })().catch(() => sendResponse({ ok: false, error: "execution_stop_failed" }));

    return true;
  }

  if (message.type === "execution-status") {
    (async () => {
      const currentState = await getRuntimeExecutionState();
      await syncActionBadge();
      if (currentState?.isRunning) {
        sendResponse({ ok: true, state: currentState });
        return;
      }

      const lastEvent = await takeExecutionLastEvent();
      sendResponse({
        ok: true,
        state: { isRunning: false },
        lastEvent: lastEvent?.type ?? null,
        completedMacroName: lastEvent?.type === "completed" ? lastEvent.macroName : undefined,
        stoppedMacroName: lastEvent?.type === "stopped" ? lastEvent.macroName : undefined
      });
    })().catch(() => sendResponse({ ok: false, state: { isRunning: false } }));

    return true;
  }

  sendResponse({ ok: false, error: "unknown_message_type" });
});
