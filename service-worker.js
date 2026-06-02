const RECORDING_SESSION_KEY = "recording_session";
const EXECUTION_STATE_KEY = "execution_state";
const EXECUTION_LAST_EVENT_KEY = "execution_last_event";
const MACROS_STORAGE_KEY = "macros_list";
const DEFAULT_MACRO_ID_KEY = "default_macro_id";
const BADGE_BACKGROUND_COLOR = "#012292";
const BADGE_TEXT_COLOR = "#ffffff";
const CREATE_BADGE_TEXT = "REC";
const RUN_BADGE_TEXT = "RUN";
const SHORTCUT_HINT_BADGE_TEXT = "M";
const SHORTCUT_HINT_BADGE_BACKGROUND_COLOR = "#ffffff";
const SHORTCUT_HINT_BADGE_TEXT_COLOR = "#000000";
const SHORTCUT_HINT_DURATION_MS = 3000;

let shortcutHintTimerId = null;

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

async function readMacros() {
  const data = await chrome.storage.local.get(MACROS_STORAGE_KEY);
  const storedMacros = data?.[MACROS_STORAGE_KEY];
  if (!Array.isArray(storedMacros)) {
    return [];
  }

  return storedMacros.filter((macro) => macro && typeof macro.id === "string");
}

async function readDefaultMacroId() {
  const data = await chrome.storage.local.get(DEFAULT_MACRO_ID_KEY);
  return typeof data?.[DEFAULT_MACRO_ID_KEY] === "string" ? data[DEFAULT_MACRO_ID_KEY] : null;
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

async function startExecutionOnTab({ tabId, macroId, macroName, repeats, trackMoves, steps }) {
  const currentState = await getRuntimeExecutionState();
  if (currentState?.isRunning) {
    return { ok: false, error: "already_running", state: currentState };
  }

  if (!Number.isInteger(tabId)) {
    return { ok: false, error: "tab_id_required" };
  }

  if (!Array.isArray(steps) || !steps.length) {
    return { ok: false, error: "empty_steps" };
  }

  const totalSteps = steps.length * repeats;
  const state = {
    isRunning: true,
    macroId,
    macroName,
    tabId,
    repeats,
    startedAt: Date.now(),
    completedSteps: 0,
    totalSteps,
    remainingMs: totalSteps * 1000
  };
  await writeExecutionState(state);
  await syncActionBadge();

  try {
    const tabResponse = await chrome.tabs.sendMessage(tabId, {
      type: "execution-run",
      macroId,
      macroName,
      repeats,
      steps,
      trackMoves
    });
    if (!tabResponse?.ok) {
      await clearExecutionState();
      await syncActionBadge();
      return { ok: false, error: tabResponse?.error ?? "execution_run_failed" };
    }
  } catch {
    await clearExecutionState();
    await syncActionBadge();
    return { ok: false, error: "tab_unreachable" };
  }

  return {
    ok: true,
    state: {
      isRunning: true,
      macroId: state.macroId,
      macroName: state.macroName,
      tabId: state.tabId,
      repeats: state.repeats,
      startedAt: state.startedAt,
      completedSteps: state.completedSteps,
      totalSteps: state.totalSteps,
      remainingMs: state.remainingMs
    }
  };
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

function clearShortcutHintTimer() {
  if (shortcutHintTimerId !== null) {
    clearTimeout(shortcutHintTimerId);
    shortcutHintTimerId = null;
  }
}

async function getRuntimeExecutionState() {
  const state = await readExecutionState();
  if (!state?.isRunning) {
    return null;
  }

  return {
    isRunning: true,
    macroId: state.macroId ?? null,
    macroName: typeof state.macroName === "string" ? state.macroName : "macros",
    tabId: Number.isInteger(state.tabId) ? state.tabId : null,
    repeats: Number.isFinite(Number(state.repeats)) ? Number(state.repeats) : 1,
    startedAt: Number(state.startedAt) || Date.now(),
    completedSteps: Number.isFinite(Number(state.completedSteps)) ? Number(state.completedSteps) : 0,
    totalSteps: Number.isFinite(Number(state.totalSteps)) ? Number(state.totalSteps) : 0,
    remainingMs: Number.isFinite(Number(state.remainingMs)) ? Number(state.remainingMs) : 0
  };
}

async function stopExecutionWithEvent(event) {
  await clearExecutionState();
  await writeExecutionLastEvent(event);
  await syncActionBadge();
}

async function sendRecordingListenerMessage(tabId, message) {
  if (!Number.isInteger(tabId)) {
    return { ok: false, error: "tab_id_required" };
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response?.ok ? { ok: true } : { ok: false, error: response?.error ?? "listener_message_failed" };
  } catch {
    return { ok: false, error: "tab_unreachable" };
  }
}

async function openPopupWithCompletionMessage() {
  if (!chrome.action || typeof chrome.action.openPopup !== "function") {
    return false;
  }

  try {
    await chrome.action.openPopup();
    return true;
  } catch {
    return false;
  }
}

async function syncActionBadge() {
  clearShortcutHintTimer();

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

async function showShortcutHintBadge() {
  const session = await readSession();
  const executionState = await getRuntimeExecutionState();
  if (session?.isActive || executionState?.isRunning) {
    await syncActionBadge();
    return;
  }

  clearShortcutHintTimer();
  await chrome.action.setBadgeText({ text: SHORTCUT_HINT_BADGE_TEXT });
  await chrome.action.setBadgeBackgroundColor({ color: SHORTCUT_HINT_BADGE_BACKGROUND_COLOR });
  if (typeof chrome.action.setBadgeTextColor === "function") {
    await chrome.action.setBadgeTextColor({ color: SHORTCUT_HINT_BADGE_TEXT_COLOR });
  }
  shortcutHintTimerId = setTimeout(() => {
    shortcutHintTimerId = null;
    void syncActionBadge();
  }, SHORTCUT_HINT_DURATION_MS);
}

async function startDefaultMacroFromTab(tabId) {
  if (!Number.isInteger(tabId)) {
    return { ok: false, error: "tab_id_required" };
  }

  const defaultMacroId = await readDefaultMacroId();
  if (!defaultMacroId) {
    return { ok: false, error: "default_macro_missing" };
  }

  const macros = await readMacros();
  const macro = macros.find((item) => item.id === defaultMacroId);
  if (!macro) {
    return { ok: false, error: "default_macro_missing" };
  }

  const steps = Array.isArray(macro.steps) ? macro.steps.filter((step) => typeof step === "string" && step.trim()) : [];
  const repeatsRaw = Number(macro.repeats);
  const repeats = Number.isFinite(repeatsRaw) && repeatsRaw > 0 ? Math.floor(repeatsRaw) : 1;
  return startExecutionOnTab({
    tabId,
    macroId: macro.id,
    macroName: typeof macro.name === "string" && macro.name.trim() ? macro.name.trim() : "macros",
    repeats,
    trackMoves: Boolean(macro.displayMoves ?? macro.trackMoves),
    steps
  });
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

      const previousSession = await readSession();
      if (previousSession?.isActive) {
        await sendRecordingListenerMessage(previousSession.tabId, { type: "recording-listener-stop" });
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
      const listenerResponse = await sendRecordingListenerMessage(tabId, {
        type: "recording-listener-start",
        mode
      });
      if (!listenerResponse.ok) {
        await clearSession();
        await syncActionBadge();
        sendResponse({ ok: false, error: listenerResponse.error });
        return;
      }

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
      await sendRecordingListenerMessage(session.tabId, { type: "recording-listener-stop" });
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
      const isSenderTab = Number.isInteger(sender?.tab?.id) && sender.tab.id === session?.tabId;
      sendResponse({
        ok: true,
        isActive: Boolean(session?.isActive && isSenderTab),
        mode: session?.mode === "selectors" ? "selectors" : "coordinates"
      });
    })().catch(() => sendResponse({ ok: false, isActive: false }));

    return true;
  }

  if (message.type === "execution-start") {
    (async () => {
      const macroId = typeof message.macroId === "string" ? message.macroId : "";
      const macroName = typeof message.macroName === "string" && message.macroName.trim() ? message.macroName.trim() : "macros";
      const repeatsRaw = Number(message.repeats);
      const repeats = Number.isFinite(repeatsRaw) && repeatsRaw > 0 ? Math.floor(repeatsRaw) : 1;
      const tabId = Number.isInteger(message.tabId) ? message.tabId : null;
      const trackMoves = Boolean(message.trackMoves);
      const steps = Array.isArray(message.steps) ? message.steps.filter((step) => typeof step === "string" && step.trim()) : [];
      const result = await startExecutionOnTab({ tabId, macroId, macroName, repeats, trackMoves, steps });
      sendResponse(result);
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

      if (Number.isInteger(currentState.tabId)) {
        try {
          await chrome.tabs.sendMessage(currentState.tabId, { type: "execution-stop" });
        } catch {
          // Ignore: tab may be closed or unavailable.
        }
      }

      await stopExecutionWithEvent({
        type: "stopped",
        macroId: currentState.macroId,
        macroName: currentState.macroName
      });
      sendResponse({ ok: true, wasRunning: true, stoppedMacroName: currentState.macroName });
    })().catch(() => sendResponse({ ok: false, error: "execution_stop_failed" }));

    return true;
  }

  if (message.type === "execution-progress") {
    (async () => {
      const currentState = await getRuntimeExecutionState();
      if (!currentState?.isRunning) {
        sendResponse({ ok: true, ignored: true, reason: "inactive" });
        return;
      }

      if (!sender?.tab || sender.tab.id !== currentState.tabId) {
        sendResponse({ ok: true, ignored: true, reason: "other_tab" });
        return;
      }

      const completedStepsRaw = Number(message.completedSteps);
      const totalStepsRaw = Number(message.totalSteps);
      const remainingMsRaw = Number(message.remainingMs);
      const nextState = {
        ...currentState,
        completedSteps: Number.isFinite(completedStepsRaw) ? Math.max(0, completedStepsRaw) : currentState.completedSteps,
        totalSteps: Number.isFinite(totalStepsRaw) ? Math.max(0, totalStepsRaw) : currentState.totalSteps,
        remainingMs: Number.isFinite(remainingMsRaw) ? Math.max(0, remainingMsRaw) : currentState.remainingMs
      };
      await writeExecutionState(nextState);
      sendResponse({ ok: true });
    })().catch(() => sendResponse({ ok: false, error: "execution_progress_failed" }));

    return true;
  }

  if (message.type === "execution-completed") {
    (async () => {
      const currentState = await getRuntimeExecutionState();
      if (!currentState?.isRunning) {
        sendResponse({ ok: true, ignored: true, reason: "inactive" });
        return;
      }

      if (!sender?.tab || sender.tab.id !== currentState.tabId) {
        sendResponse({ ok: true, ignored: true, reason: "other_tab" });
        return;
      }

      await stopExecutionWithEvent({
        type: "completed",
        macroId: currentState.macroId,
        macroName: currentState.macroName
      });
      const popupOpened = await openPopupWithCompletionMessage();
      sendResponse({ ok: true, popupOpened });
    })().catch(() => sendResponse({ ok: false, error: "execution_complete_failed" }));

    return true;
  }

  if (message.type === "execution-stopped" || message.type === "execution-user-click-interrupt") {
    (async () => {
      const currentState = await getRuntimeExecutionState();
      if (!currentState?.isRunning) {
        sendResponse({ ok: true, ignored: true, reason: "inactive" });
        return;
      }

      if (!sender?.tab || sender.tab.id !== currentState.tabId) {
        sendResponse({ ok: true, ignored: true, reason: "other_tab" });
        return;
      }

      await stopExecutionWithEvent({
        type: "stopped",
        macroId: currentState.macroId,
        macroName: currentState.macroName
      });
      sendResponse({ ok: true });
    })().catch(() => sendResponse({ ok: false, error: "execution_stopped_failed" }));

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
        stoppedMacroName: lastEvent?.type === "stopped" ? lastEvent.macroName : undefined,
        failedMacroName: lastEvent?.type === "failed" ? lastEvent.macroName : undefined
      });
    })().catch(() => sendResponse({ ok: false, state: { isRunning: false } }));

    return true;
  }

  if (message.type === "shortcut-prefix-activated") {
    (async () => {
      await showShortcutHintBadge();
      sendResponse({ ok: true, hint: SHORTCUT_HINT_BADGE_TEXT, timeoutMs: SHORTCUT_HINT_DURATION_MS });
    })().catch(() => sendResponse({ ok: false, error: "shortcut_hint_failed" }));

    return true;
  }

  if (message.type === "shortcut-run-default") {
    (async () => {
      clearShortcutHintTimer();
      const tabId = Number.isInteger(sender?.tab?.id) ? sender.tab.id : null;
      const result = await startDefaultMacroFromTab(tabId);
      if (!result?.ok) {
        await syncActionBadge();
      }
      sendResponse(result);
    })().catch(() => sendResponse({ ok: false, error: "shortcut_run_default_failed" }));

    return true;
  }

  if (message.type === "shortcut-stop-execution") {
    (async () => {
      const currentState = await getRuntimeExecutionState();
      if (!currentState?.isRunning) {
        await syncActionBadge();
        sendResponse({ ok: true, wasRunning: false });
        return;
      }

      if (Number.isInteger(currentState.tabId)) {
        try {
          await chrome.tabs.sendMessage(currentState.tabId, { type: "execution-stop" });
        } catch {
          // Ignore: tab may be closed or unavailable.
        }
      }

      await stopExecutionWithEvent({
        type: "stopped",
        macroId: currentState.macroId,
        macroName: currentState.macroName
      });
      sendResponse({ ok: true, wasRunning: true, stoppedMacroName: currentState.macroName });
    })().catch(() => sendResponse({ ok: false, error: "shortcut_stop_failed" }));

    return true;
  }

  sendResponse({ ok: false, error: "unknown_message_type" });
});
