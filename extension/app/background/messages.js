void syncActionBadge();
ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    sendResponse({ ok: false, error: "invalid_message" });
    return;
  }
  if (message.type === "recording-start") {
    (async () => {
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
        tabId,
        domain: getDomainFromUrl(message.url),
        steps: []
      };
      await writeSession(session);
      await syncActionBadge();
      const listenerResponse = await sendRecordingListenerMessage(tabId, {
        type: "recording-listener-start"
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
      const x = Number(message.x);
      const y = Number(message.y);
      const position = Number.isFinite(x) && Number.isFinite(y) ? `${Math.round(x)},${Math.round(y)}` : "";
      const selector = typeof message.selector === "string" ? message.selector.trim() : "";
      if (!position && !selector) {
        sendResponse({ ok: true, ignored: true, reason: "invalid_data" });
        return;
      }
      steps.push({ position, selector });
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
        isActive: Boolean(session?.isActive && isSenderTab)
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
      const executionSpeedRaw = Number(message.executionSpeed);
      const executionSpeed = [0.25, 0.5, 1, 2].includes(executionSpeedRaw) ? executionSpeedRaw : 1;
      const steps = Array.isArray(message.steps) ? message.steps.filter((step) => typeof step === "string" && step.trim()) : [];
      const result = await startExecutionOnTab({ tabId, macroId, macroName, repeats, trackMoves, executionSpeed, steps });
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
          await ext.tabs.sendMessage(currentState.tabId, { type: "execution-stop" });
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
          await ext.tabs.sendMessage(currentState.tabId, { type: "execution-stop" });
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
