
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
