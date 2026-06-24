
registerDocumentOperabilityProbeListener();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    sendResponse({ ok: false, error: "invalid_message" });
    return;
  }

  if (message.type === "execution-run") {
    void runExecution(message)
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ ok: false, error: "run_failed" }));
    return true;
  }

  if (message.type === "execution-stop") {
    if (!executionState.isRunning) {
      sendResponse({ ok: true, wasRunning: false });
      return;
    }

    executionState.stopRequested = true;
    stopExecutionClickListener();
    sendResponse({ ok: true, wasRunning: true });
    return;
  }

  if (message.type === "recording-listener-start") {
    startRecordingListeners();
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "recording-listener-stop") {
    stopRecordingListeners();
    sendResponse({ ok: true });
    return;
  }

  // A dedicated listener handles operability probes.
  if (message.type === PROBE_DOCUMENT_OPERABILITY) {
    return;
  }

  sendResponse({ ok: false, error: "unknown_message_type" });
});

document.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape") {
      if (executionState.isRunning) {
        executionState.stopRequested = true;
        void sendRuntimeMessage({ type: "shortcut-stop-execution" });
      }
      return;
    }

    if (isPrefixShortcut(event)) {
      shortcutState.isPrefixDown = true;
      return;
    }

    if (shortcutState.isWaitingForAction && isPrefixActionKey(event)) {
      stopWaitingForShortcutAction();
      void sendRuntimeMessage({ type: "shortcut-run-default" });
    }
  },
  true
);

void sendRuntimeMessage({ type: "recording-status" }).then((response) => {
  if (response?.ok && response.isActive) {
    startRecordingListeners();
  }
});

document.addEventListener(
  "keyup",
  (event) => {
    if (!shortcutState.isPrefixDown) {
      return;
    }
    // On macOS, keyup for the letter is suppressed while Cmd is held,
    // so wait for the modifiers to be released instead.
    if (isPrefixChordHeld(event)) {
      return;
    }
    shortcutState.isPrefixDown = false;
    startWaitingForShortcutAction();
  },
  true
);
