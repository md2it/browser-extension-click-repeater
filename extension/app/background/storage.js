
function buildClickName(domain) {
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

function normalizeKeyboardAction(step) {
  if (!step || typeof step !== "object" || (step.type !== "keydown" && step.type !== "keyup")) {
    return null;
  }

  const key = typeof step.key === "string" ? step.key : "";
  const code = typeof step.code === "string" ? step.code : "";
  if (!key && !code) {
    return null;
  }

  const locationRaw = Number(step.location);
  const editState = step.editState && typeof step.editState === "object"
    ? {
      kind: step.editState.kind === "contenteditable" ? "contenteditable" : "form-field",
      value: typeof step.editState.value === "string" ? step.editState.value : "",
      selectionStart: Number.isInteger(step.editState.selectionStart) ? step.editState.selectionStart : null,
      selectionEnd: Number.isInteger(step.editState.selectionEnd) ? step.editState.selectionEnd : null
    }
    : null;
  return {
    type: step.type,
    key,
    code,
    altKey: Boolean(step.altKey),
    ctrlKey: Boolean(step.ctrlKey),
    metaKey: Boolean(step.metaKey),
    shiftKey: Boolean(step.shiftKey),
    location: Number.isFinite(locationRaw) ? locationRaw : 0,
    repeat: Boolean(step.repeat),
    isComposing: Boolean(step.isComposing),
    targetSelector: typeof step.targetSelector === "string" ? step.targetSelector.trim() : "",
    editState,
    frameId: Number.isInteger(step.frameId) ? step.frameId : null,
    documentId: typeof step.documentId === "string" ? step.documentId : null
  };
}

function normalizeStepForExecution(step, clickMode) {
  if (typeof step === "string") {
    const target = step.trim();
    return target ? target : null;
  }

  const keyboardAction = normalizeKeyboardAction(step);
  if (keyboardAction) {
    return keyboardAction;
  }

  if (!step || typeof step !== "object") {
    return null;
  }

  const position = typeof step.position === "string" ? step.position.trim() : "";
  const selector = typeof step.selector === "string" ? step.selector.trim() : "";
  const target = clickMode === "element" ? selector : position;
  return target ? {
    type: "click",
    target,
    targetMode: clickMode,
    frameId: Number.isInteger(step.frameId) ? step.frameId : null,
    documentId: typeof step.documentId === "string" ? step.documentId : null
  } : null;
}

async function readSession() {
  const data = await ext.storage.local.get(RECORDING_SESSION_KEY);
  return data?.[RECORDING_SESSION_KEY] ?? null;
}

async function writeSession(session) {
  await ext.storage.local.set({ [RECORDING_SESSION_KEY]: session });
}

async function clearSession() {
  await ext.storage.local.remove(RECORDING_SESSION_KEY);
}

async function readExecutionState() {
  const data = await ext.storage.local.get(EXECUTION_STATE_KEY);
  return data?.[EXECUTION_STATE_KEY] ?? null;
}

async function readClicks() {
  const data = await ext.storage.local.get(CLICKS_STORAGE_KEY);
  const storedClicks = data?.[CLICKS_STORAGE_KEY];
  if (!Array.isArray(storedClicks)) {
    return [];
  }

  return storedClicks.filter((click) => click && typeof click.id === "string");
}

async function readDefaultClickId() {
  const data = await ext.storage.local.get(DEFAULT_CLICK_ID_KEY);
  return typeof data?.[DEFAULT_CLICK_ID_KEY] === "string" ? data[DEFAULT_CLICK_ID_KEY] : null;
}

async function writeExecutionState(state) {
  await ext.storage.local.set({ [EXECUTION_STATE_KEY]: state });
}

async function clearExecutionState() {
  await ext.storage.local.remove(EXECUTION_STATE_KEY);
}

async function writeExecutionLastEvent(event) {
  await ext.storage.local.set({ [EXECUTION_LAST_EVENT_KEY]: event });
}

async function takeExecutionLastEvent() {
  const data = await ext.storage.local.get(EXECUTION_LAST_EVENT_KEY);
  const event = data?.[EXECUTION_LAST_EVENT_KEY] ?? null;
  await ext.storage.local.remove(EXECUTION_LAST_EVENT_KEY);
  return event;
}
