void syncActionBadge();

ext.action.onClicked.addListener((tab) => {
  void handleActionClick(tab);
});

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    sendResponse({ ok: false, error: "invalid_message" });
    return;
  }
  if (isBlockedNoticeDismissedMessage(message)) {
    return;
  }
  if (message.type === "recording-start") {
    (async () => {
      const tabId = Number.isInteger(message.tabId) ? message.tabId : null;
      if (tabId === null) {
        sendResponse({ ok: false, error: "tab_id_required" });
        return;
      }
      // Recheck immediately before recording because the tab may have navigated.
      if (!(await canOperateOnTab(tabId))) {
        await showRestrictedNotice(tabId);
        sendResponse({ ok: false, error: "page_blocked" });
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
        clickName: buildClickName(session.domain),
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
      steps.push({
        type: "click",
        position,
        selector,
        frameId: Number.isInteger(sender.frameId) ? sender.frameId : null,
        documentId: typeof sender.documentId === "string" ? sender.documentId : null
      });
      await writeSession({ ...session, steps });
      sendResponse({ ok: true });
    })().catch(() => sendResponse({ ok: false, error: "record_failed" }));
    return true;
  }
  if (message.type === "recording-keyboard") {
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
      const actionType = message.actionType === "keyup" ? "keyup" : message.actionType === "keydown" ? "keydown" : "";
      const key = typeof message.key === "string" ? message.key : "";
      const code = typeof message.code === "string" ? message.code : "";
      if (!actionType || (!key && !code)) {
        sendResponse({ ok: true, ignored: true, reason: "invalid_data" });
        return;
      }
      const locationRaw = Number(message.location);
      const selector = typeof message.selector === "string" ? message.selector.trim() : "";
      const editState = message.editState && typeof message.editState === "object"
        ? {
          kind: message.editState.kind === "contenteditable" ? "contenteditable" : "form-field",
          value: typeof message.editState.value === "string" ? message.editState.value : "",
          selectionStart: Number.isInteger(message.editState.selectionStart) ? message.editState.selectionStart : null,
          selectionEnd: Number.isInteger(message.editState.selectionEnd) ? message.editState.selectionEnd : null
        }
        : null;
      const steps = Array.isArray(session.steps) ? session.steps : [];
      steps.push({
        type: actionType,
        key,
        code,
        altKey: Boolean(message.altKey),
        ctrlKey: Boolean(message.ctrlKey),
        metaKey: Boolean(message.metaKey),
        shiftKey: Boolean(message.shiftKey),
        location: Number.isFinite(locationRaw) ? locationRaw : 0,
        repeat: Boolean(message.repeat),
        isComposing: Boolean(message.isComposing),
        targetSelector: selector,
        editState,
        frameId: Number.isInteger(sender.frameId) ? sender.frameId : null,
        documentId: typeof sender.documentId === "string" ? sender.documentId : null
      });
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
      const clickId = typeof message.clickId === "string" ? message.clickId : "";
      const clickName = typeof message.clickName === "string" && message.clickName.trim() ? message.clickName.trim() : "clicks";
      const repeatsRaw = Number(message.repeats);
      const repeats = Number.isFinite(repeatsRaw) && repeatsRaw > 0 ? Math.floor(repeatsRaw) : 1;
      const tabId = Number.isInteger(message.tabId) ? message.tabId : null;
      const trackMoves = Boolean(message.trackMoves);
      const executionSpeed = normalizeExecutionSpeed(message.executionSpeed);
      const clickSound = message.clickSound !== false;
      const steps = Array.isArray(message.steps) ? message.steps.filter((step) => {
        if (typeof step === "string") {
          return Boolean(step.trim());
        }
        if (!step || typeof step !== "object") {
          return false;
        }
        if (step.type === "click") {
          return typeof step.target === "string" && Boolean(step.target.trim());
        }
        return Boolean(normalizeKeyboardAction(step));
      }) : [];
      const result = await startExecutionOnTab({ tabId, clickId, clickName, repeats, trackMoves, executionSpeed, clickSound, steps });
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
        kind: "stopped",
        clickName: currentState.clickName
      });
      sendResponse({ ok: true, wasRunning: true, stoppedClickName: currentState.clickName });
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
      await syncActionBadge();
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
        kind: "completed",
        clickName: currentState.clickName
      });
      const popupOpened = await openMainPopup(currentState.tabId);
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
      const kind = resolveStopEventKind(message);
      await stopExecutionWithEvent({ kind, clickName: currentState.clickName });
      void showExecutionErrorNotice(currentState.tabId, kind);
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
        lastEvent: lastEvent?.kind
          ? { kind: lastEvent.kind, clickName: lastEvent.clickName ?? null }
          : null
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
      const result = await startDefaultClickFromTab(tabId);
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
      await stopExecutionWithEvent({ kind: "stopped", clickName: currentState.clickName });
      void showExecutionErrorNotice(currentState.tabId, "stopped");
      sendResponse({ ok: true, wasRunning: true, stoppedClickName: currentState.clickName });
    })().catch(() => sendResponse({ ok: false, error: "shortcut_stop_failed" }));
    return true;
  }
  if (message.type === "WATCH_PIN_STATUS") {
    const tabId = sender?.tab?.id;
    if (Number.isInteger(tabId)) watchWelcomePinStatus2(tabId);
    return;
  }
  sendResponse({ ok: false, error: "unknown_message_type" });
});

ext.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    void showWelcome();
  }
});
