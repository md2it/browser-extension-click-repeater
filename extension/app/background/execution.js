
async function startExecutionOnTab({ tabId, macroId, macroName, repeats, trackMoves, executionSpeed, steps }) {
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
    const tabResponse = await ext.tabs.sendMessage(tabId, {
      type: "execution-run",
      macroId,
      macroName,
      repeats,
      steps,
      trackMoves,
      executionSpeed: executionSpeed ?? 1
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
  await ext.action.setBadgeText({ text });
  if (text) {
    await ext.action.setBadgeBackgroundColor({ color: BADGE_BACKGROUND_COLOR });
    if (typeof ext.action.setBadgeTextColor === "function") {
      await ext.action.setBadgeTextColor({ color: BADGE_TEXT_COLOR });
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
    const response = await ext.tabs.sendMessage(tabId, message);
    return response?.ok ? { ok: true } : { ok: false, error: response?.error ?? "listener_message_failed" };
  } catch {
    return { ok: false, error: "tab_unreachable" };
  }
}

async function openPopupWithCompletionMessage() {
  if (!ext.action || typeof ext.action.openPopup !== "function") {
    return false;
  }

  try {
    await ext.action.openPopup();
    return true;
  } catch {
    return false;
  }
}
