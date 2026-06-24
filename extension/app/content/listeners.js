
function handleExecutionClickInterrupt(event) {
  if (!event.isTrusted) {
    return;
  }

  executionState.stopRequested = true;
  stopExecutionClickListener();
  void chrome.runtime.sendMessage({ type: "execution-user-click-interrupt" });
}

function startExecutionClickListener() {
  if (isExecutionClickListenerAttached) {
    return;
  }

  document.addEventListener("click", handleExecutionClickInterrupt, true);
  isExecutionClickListenerAttached = true;
}

function stopExecutionClickListener() {
  if (!isExecutionClickListenerAttached) {
    return;
  }

  document.removeEventListener("click", handleExecutionClickInterrupt, true);
  isExecutionClickListenerAttached = false;
}

function handleRecordingClick(event) {
  if (!recordingState.isActive) {
    return;
  }

  const target = getEventElement(event);
  const selector = target ? buildSelector(target) : "";
  void chrome.runtime.sendMessage({
    type: "recording-click",
    x: event.clientX,
    y: event.clientY,
    selector
  });
}

function handleRecordingKeyboardEvent(event) {
  if (!recordingState.isActive) {
    return;
  }

  const target = getEventElement(event) || getKeyboardEventTarget();
  const editableTarget = getEditableKeyboardTarget(target);
  const selectorTarget = editableTarget || target;
  const selector = selectorTarget instanceof Element ? buildSelector(selectorTarget) : "";
  const editState = editableTarget ? readEditableKeyboardState(editableTarget) : null;

  void chrome.runtime.sendMessage({
    type: "recording-keyboard",
    actionType: event.type,
    key: event.key,
    code: event.code,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    location: event.location,
    repeat: event.repeat,
    isComposing: event.isComposing,
    selector,
    editState
  });
}

function startRecordingListeners() {
  recordingState.isActive = true;

  if (!isRecordingClickListenerAttached) {
    document.addEventListener("click", handleRecordingClick, true);
    isRecordingClickListenerAttached = true;
  }

  if (!isRecordingKeyboardListenerAttached) {
    window.addEventListener("keydown", handleRecordingKeyboardEvent, true);
    window.addEventListener("keyup", handleRecordingKeyboardEvent, true);
    isRecordingKeyboardListenerAttached = true;
  }
}

function stopRecordingListeners() {
  recordingState.isActive = false;

  if (isRecordingClickListenerAttached) {
    document.removeEventListener("click", handleRecordingClick, true);
    isRecordingClickListenerAttached = false;
  }

  if (isRecordingKeyboardListenerAttached) {
    window.removeEventListener("keydown", handleRecordingKeyboardEvent, true);
    window.removeEventListener("keyup", handleRecordingKeyboardEvent, true);
    isRecordingKeyboardListenerAttached = false;
  }
}
