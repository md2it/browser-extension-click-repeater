function buildSelector(element) {
  if (!(element instanceof Element)) {
    return "";
  }

  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const parts = [];
  let current = element;

  while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 6) {
    const tagName = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (!parent) {
      parts.unshift(tagName);
      break;
    }

    const sameTagSiblings = Array.from(parent.children).filter(
      (child) => child.tagName === current.tagName
    );
    const index = sameTagSiblings.indexOf(current) + 1;
    const part = sameTagSiblings.length > 1 ? `${tagName}:nth-of-type(${index})` : tagName;
    parts.unshift(part);

    current = parent;
  }

  return parts.join(" > ");
}

function getEventElement(event) {
  if (event.target instanceof Element) {
    return event.target;
  }

  if (typeof event.composedPath === "function") {
    const path = event.composedPath();
    const firstElement = path.find((item) => item instanceof Element);
    if (firstElement instanceof Element) {
      return firstElement;
    }
  }

  return null;
}

const HUMAN_MM_IN_PX = 4;
const HUMAN_STEP_MIN_DELAY_MS = 500;
const HUMAN_STEP_MAX_DELAY_MS = 1000;
const HUMAN_MOVE_MIN_DELAY_MS = 8;
const HUMAN_MOVE_MAX_DELAY_MS = 22;
const HUMAN_BEFORE_DOWN_MIN_DELAY_MS = 80;
const HUMAN_BEFORE_DOWN_MAX_DELAY_MS = 250;
const HUMAN_HOLD_MIN_DELAY_MS = 50;
const HUMAN_HOLD_MAX_DELAY_MS = 150;
const HUMAN_AFTER_UP_MIN_DELAY_MS = 20;
const HUMAN_AFTER_UP_MAX_DELAY_MS = 120;
const VIEWPORT_EDGE_PADDING = 2;
const TRACKER_DEFAULT_SIZE = 24;
const TRACKER_ACTIVE_SIZE = 36;
const TRACKER_DEFAULT_COLOR = "#ff0000";
const TRACKER_ACTIVE_COLOR = "#ff0000";
const TRACKER_ACTIVE_DURATION_MS = 50;
const TRACKER_ELEMENT_ID = "__macros_repeater_tracker";
const SHORTCUT_PREFIX_CODE = "KeyX";
const SHORTCUT_RUN_DEFAULT_CODE = "KeyM";
const SHORTCUT_HINT_DURATION_MS = 3000;

const executionState = {
  isRunning: false,
  stopRequested: false,
  token: 0,
  lastPoint: null,
  lastTarget: null,
  lastDelayMs: null,
  trackMoves: false
};

const trackerState = {
  element: null,
  pulseTimerId: null
};

const shortcutState = {
  isPrefixDown: false,
  isWaitingForAction: false,
  hintTimerId: null
};

const recordingState = {
  isActive: false,
  mode: "coordinates"
};

let isRecordingClickListenerAttached = false;
let isExecutionClickListenerAttached = false;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  const previous = executionState.lastDelayMs;
  let delay = randomBetween(min, max);

  if (Number.isFinite(previous)) {
    for (let attempt = 0; attempt < 4 && Math.abs(delay - previous) < 12; attempt += 1) {
      delay = randomBetween(min, max);
    }
  }

  executionState.lastDelayMs = delay;
  return delay;
}

function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false });
        return;
      }

      resolve(response ?? { ok: false });
    });
  });
}

function isMacPlatform() {
  return /\bMac/.test(navigator.platform);
}

function isPrefixShortcut(event) {
  const hasPlatformModifier = isMacPlatform() ? event.metaKey : event.ctrlKey;
  return event.code === SHORTCUT_PREFIX_CODE && event.shiftKey && hasPlatformModifier;
}

function clearShortcutHintTimer() {
  if (shortcutState.hintTimerId !== null) {
    window.clearTimeout(shortcutState.hintTimerId);
    shortcutState.hintTimerId = null;
  }
}

function stopWaitingForShortcutAction() {
  clearShortcutHintTimer();
  shortcutState.isWaitingForAction = false;
}

function startWaitingForShortcutAction() {
  clearShortcutHintTimer();
  shortcutState.isWaitingForAction = true;
  shortcutState.hintTimerId = window.setTimeout(() => {
    shortcutState.isWaitingForAction = false;
    shortcutState.hintTimerId = null;
  }, SHORTCUT_HINT_DURATION_MS);
  void sendRuntimeMessage({ type: "shortcut-prefix-activated" });
}

function trackerDefaultIconSvg() {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 4 7.07 17 2.51-7.39L21 11.07z"/></svg>';
}

function trackerClickIconSvg() {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 9 5 12 1.8-5.2L21 14Z"/><path d="M7.2 2.2 8 5.1"/><path d="m5.1 8-2.9-.8"/><path d="M14 4.1 12 6"/></svg>';
}

function applyTrackerStyle({ size, color }) {
  if (!(trackerState.element instanceof HTMLElement)) {
    return;
  }

  trackerState.element.style.width = `${size}px`;
  trackerState.element.style.height = `${size}px`;
  trackerState.element.style.color = color;
}

function setTrackerDefaultState() {
  if (!(trackerState.element instanceof HTMLElement)) {
    return;
  }

  applyTrackerStyle({ size: TRACKER_DEFAULT_SIZE, color: TRACKER_DEFAULT_COLOR });
  trackerState.element.innerHTML = trackerDefaultIconSvg();
}

function ensureTrackerElement() {
  if (!executionState.trackMoves) {
    return;
  }

  if (trackerState.element instanceof HTMLElement) {
    return;
  }

  const existing = document.getElementById(TRACKER_ELEMENT_ID);
  if (existing instanceof HTMLElement) {
    trackerState.element = existing;
    setTrackerDefaultState();
    return;
  }

  const element = document.createElement("div");
  element.id = TRACKER_ELEMENT_ID;
  element.style.position = "fixed";
  element.style.left = "0px";
  element.style.top = "0px";
  element.style.width = `${TRACKER_DEFAULT_SIZE}px`;
  element.style.height = `${TRACKER_DEFAULT_SIZE}px`;
  element.style.color = TRACKER_DEFAULT_COLOR;
  element.style.pointerEvents = "none";
  element.style.userSelect = "none";
  element.style.zIndex = "2147483647";
  element.style.transform = "translate(-50%, -50%)";
  element.style.transition = "left 16ms linear, top 16ms linear, width 50ms linear, height 50ms linear, color 50ms linear";
  element.innerHTML = trackerDefaultIconSvg();
  document.documentElement.append(element);
  trackerState.element = element;
  setTrackerDefaultState();
}

function removeTrackerElement() {
  if (trackerState.pulseTimerId !== null) {
    window.clearTimeout(trackerState.pulseTimerId);
    trackerState.pulseTimerId = null;
  }

  if (trackerState.element instanceof HTMLElement) {
    trackerState.element.remove();
    trackerState.element = null;
  }
}

function moveTracker(point) {
  if (!executionState.trackMoves) {
    return;
  }

  ensureTrackerElement();
  if (!(trackerState.element instanceof HTMLElement)) {
    return;
  }

  const normalized = normalizeViewportPoint(point);
  trackerState.element.style.left = `${normalized.x}px`;
  trackerState.element.style.top = `${normalized.y}px`;
}

function pulseTracker() {
  if (!executionState.trackMoves || !(trackerState.element instanceof HTMLElement)) {
    return;
  }

  if (trackerState.pulseTimerId !== null) {
    window.clearTimeout(trackerState.pulseTimerId);
    trackerState.pulseTimerId = null;
  }

  applyTrackerStyle({ size: TRACKER_ACTIVE_SIZE, color: TRACKER_ACTIVE_COLOR });
  trackerState.element.innerHTML = trackerClickIconSvg();
  trackerState.pulseTimerId = window.setTimeout(() => {
    setTrackerDefaultState();
    trackerState.pulseTimerId = null;
  }, TRACKER_ACTIVE_DURATION_MS);
}

function normalizeViewportPoint(point) {
  const maxX = Math.max(VIEWPORT_EDGE_PADDING, window.innerWidth - VIEWPORT_EDGE_PADDING);
  const maxY = Math.max(VIEWPORT_EDGE_PADDING, window.innerHeight - VIEWPORT_EDGE_PADDING);
  return {
    x: clamp(point.x, VIEWPORT_EDGE_PADDING, maxX),
    y: clamp(point.y, VIEWPORT_EDGE_PADDING, maxY)
  };
}

function getInitialPoint() {
  return normalizeViewportPoint({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  });
}

function parseCoordinateStep(step) {
  if (typeof step !== "string") {
    return null;
  }

  const match = step.trim().match(/^(-?\d+)\s*,\s*(-?\d+)$/);
  if (!match) {
    return null;
  }

  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return normalizeViewportPoint({ x, y });
}

function getRandomPointInElement(element) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const minX = rect.left + Math.min(HUMAN_MM_IN_PX, rect.width / 2);
  const maxX = rect.right - Math.min(HUMAN_MM_IN_PX, rect.width / 2);
  const minY = rect.top + Math.min(HUMAN_MM_IN_PX, rect.height / 2);
  const maxY = rect.bottom - Math.min(HUMAN_MM_IN_PX, rect.height / 2);

  return normalizeViewportPoint({
    x: randomBetween(minX, maxX),
    y: randomBetween(minY, maxY)
  });
}

function resolveStepPoint(step) {
  const coordinatePoint = parseCoordinateStep(step);
  if (coordinatePoint) {
    return coordinatePoint;
  }

  if (typeof step !== "string" || !step.trim()) {
    return null;
  }

  let element = null;
  try {
    element = document.querySelector(step);
  } catch {
    return null;
  }

  if (!(element instanceof Element)) {
    return null;
  }

  return getRandomPointInElement(element);
}

function buildHumanPath(startPoint, endPoint) {
  const from = normalizeViewportPoint(startPoint);
  const to = normalizeViewportPoint(endPoint);
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const distance = Math.hypot(deltaX, deltaY);
  const segments = clamp(Math.round(distance / 16) + 8, 10, 48);
  const deviation = clamp(distance * 0.05, 1.5, 8);
  const path = [];

  for (let index = 1; index <= segments; index += 1) {
    const t = index / segments;
    const ease = t * t * (3 - 2 * t);
    const waveX = Math.sin(t * Math.PI * 2) * randomBetween(-deviation, deviation);
    const waveY = Math.cos(t * Math.PI * 2) * randomBetween(-deviation, deviation);
    path.push(
      normalizeViewportPoint({
        x: from.x + deltaX * ease + waveX,
        y: from.y + deltaY * ease + waveY
      })
    );
  }

  path[path.length - 1] = to;
  return path;
}

function getPointTarget(point) {
  const normalized = normalizeViewportPoint(point);
  const target = document.elementFromPoint(normalized.x, normalized.y);
  return target instanceof Element ? target : null;
}

function applyMovement(event, init) {
  if (!("movementX" in init) || !("movementY" in init)) {
    return event;
  }

  try {
    Object.defineProperty(event, "movementX", { value: init.movementX });
    Object.defineProperty(event, "movementY", { value: init.movementY });
  } catch {
    // Some browser event implementations expose read-only movement fields.
  }

  return event;
}

function buildPointerEvent(type, init) {
  const event = new PointerEvent(type, {
    ...init,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true
  });
  return applyMovement(event, init);
}

function buildMouseEvent(type, init) {
  return applyMovement(new MouseEvent(type, init), init);
}

function dispatchMouseMove(point, previousPoint) {
  const normalized = normalizeViewportPoint(point);
  const previous = previousPoint ? normalizeViewportPoint(previousPoint) : normalized;
  const target = getPointTarget(normalized) || document.documentElement;
  const init = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: normalized.x,
    clientY: normalized.y,
    screenX: window.screenX + normalized.x,
    screenY: window.screenY + normalized.y,
    movementX: normalized.x - previous.x,
    movementY: normalized.y - previous.y
  };

  target.dispatchEvent(buildPointerEvent("pointermove", { ...init, buttons: 0 }));
  target.dispatchEvent(
    buildMouseEvent("mousemove", {
      ...init,
      buttons: 0
    })
  );
  moveTracker(normalized);
  return { point: normalized, target };
}

function dispatchTargetEntry(target, point, relatedTarget) {
  const normalized = normalizeViewportPoint(point);
  const init = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: normalized.x,
    clientY: normalized.y,
    screenX: window.screenX + normalized.x,
    screenY: window.screenY + normalized.y,
    movementX: 0,
    movementY: 0,
    button: 0,
    buttons: 0,
    relatedTarget,
    detail: 1
  };

  target.dispatchEvent(buildPointerEvent("pointerover", init));
  target.dispatchEvent(buildPointerEvent("pointerenter", { ...init, bubbles: false }));
  target.dispatchEvent(buildMouseEvent("mouseover", init));
  target.dispatchEvent(buildMouseEvent("mouseenter", { ...init, bubbles: false }));
}

async function dispatchMouseClick(token, target, point) {
  const normalized = normalizeViewportPoint(point);
  const init = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: normalized.x,
    clientY: normalized.y,
    screenX: window.screenX + normalized.x,
    screenY: window.screenY + normalized.y,
    movementX: 0,
    movementY: 0,
    button: 0,
    buttons: 1,
    detail: 1
  };

  await sleep(randomDelay(HUMAN_BEFORE_DOWN_MIN_DELAY_MS, HUMAN_BEFORE_DOWN_MAX_DELAY_MS));
  if (shouldStop(token)) {
    throw new Error("stopped");
  }

  target.dispatchEvent(buildPointerEvent("pointerdown", init));
  target.dispatchEvent(buildMouseEvent("mousedown", init));

  await sleep(randomDelay(HUMAN_HOLD_MIN_DELAY_MS, HUMAN_HOLD_MAX_DELAY_MS));
  if (shouldStop(token)) {
    throw new Error("stopped");
  }

  target.dispatchEvent(buildPointerEvent("pointerup", { ...init, buttons: 0 }));
  target.dispatchEvent(buildMouseEvent("mouseup", { ...init, buttons: 0 }));

  await sleep(randomDelay(HUMAN_AFTER_UP_MIN_DELAY_MS, HUMAN_AFTER_UP_MAX_DELAY_MS));
  if (shouldStop(token)) {
    throw new Error("stopped");
  }

  target.dispatchEvent(buildMouseEvent("click", { ...init, buttons: 0 }));
  pulseTracker();
}

function applyClickOffset(point) {
  return normalizeViewportPoint({
    x: point.x + randomBetween(-HUMAN_MM_IN_PX, HUMAN_MM_IN_PX),
    y: point.y + randomBetween(-HUMAN_MM_IN_PX, HUMAN_MM_IN_PX)
  });
}

function shouldStop(token) {
  return !executionState.isRunning || executionState.stopRequested || executionState.token !== token;
}

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

  if (recordingState.mode === "selectors") {
    const target = getEventElement(event);
    const selector = target ? buildSelector(target) : "";
    void chrome.runtime.sendMessage({
      type: "recording-click",
      selector
    });
    return;
  }

  void chrome.runtime.sendMessage({
    type: "recording-click",
    x: event.clientX,
    y: event.clientY
  });
}

function startRecordingClickListener(mode) {
  recordingState.isActive = true;
  recordingState.mode = mode === "selectors" ? "selectors" : "coordinates";

  if (isRecordingClickListenerAttached) {
    return;
  }

  document.addEventListener("click", handleRecordingClick, true);
  isRecordingClickListenerAttached = true;
}

function stopRecordingClickListener() {
  recordingState.isActive = false;

  if (!isRecordingClickListenerAttached) {
    return;
  }

  document.removeEventListener("click", handleRecordingClick, true);
  isRecordingClickListenerAttached = false;
}

async function runStep(token, fromPoint, step) {
  const stepPoint = resolveStepPoint(step);
  if (!stepPoint) {
    throw new Error("target_not_found");
  }

  const clickPoint = applyClickOffset(stepPoint);
  const path = buildHumanPath(fromPoint, clickPoint);
  let previousPoint = fromPoint;

  for (const point of path) {
    if (shouldStop(token)) {
      throw new Error("stopped");
    }

    const moveResult = dispatchMouseMove(point, previousPoint);
    previousPoint = moveResult.point;
    await sleep(randomDelay(HUMAN_MOVE_MIN_DELAY_MS, HUMAN_MOVE_MAX_DELAY_MS));
  }

  if (shouldStop(token)) {
    throw new Error("stopped");
  }

  const clickTarget = getPointTarget(clickPoint);
  if (!clickTarget) {
    throw new Error("target_not_found");
  }

  if (clickTarget !== executionState.lastTarget) {
    dispatchTargetEntry(clickTarget, clickPoint, executionState.lastTarget);
    executionState.lastTarget = clickTarget;
  }

  await dispatchMouseClick(token, clickTarget, clickPoint);
  if (!shouldStop(token)) {
    await sleep(randomDelay(HUMAN_STEP_MIN_DELAY_MS, HUMAN_STEP_MAX_DELAY_MS));
  }
  if (shouldStop(token)) {
    throw new Error("stopped");
  }

  return clickPoint;
}

async function runExecution(payload) {
  if (executionState.isRunning) {
    return { ok: false, error: "already_running" };
  }

  const macroId = typeof payload?.macroId === "string" ? payload.macroId : "";
  const macroName = typeof payload?.macroName === "string" && payload.macroName.trim() ? payload.macroName.trim() : "macros";
  const repeats = Number.isFinite(Number(payload?.repeats)) && Number(payload.repeats) > 0 ? Math.floor(Number(payload.repeats)) : 1;
  const trackMoves = Boolean(payload?.trackMoves);
  const steps = Array.isArray(payload?.steps) ? payload.steps.filter((step) => typeof step === "string" && step.trim()) : [];
  if (steps.length === 0) {
    return { ok: false, error: "empty_steps" };
  }

  executionState.isRunning = true;
  executionState.stopRequested = false;
  executionState.token += 1;
  const token = executionState.token;
  executionState.trackMoves = trackMoves;
  executionState.lastPoint = executionState.lastPoint ?? getInitialPoint();
  executionState.lastTarget = getPointTarget(executionState.lastPoint);
  executionState.lastDelayMs = null;
  moveTracker(executionState.lastPoint);
  startExecutionClickListener();
  const totalSteps = repeats * steps.length;
  let completedSteps = 0;

  void chrome.runtime.sendMessage({
    type: "execution-progress",
    macroId,
    macroName,
    completedSteps,
    totalSteps,
    remainingMs: totalSteps * HUMAN_STEP_MAX_DELAY_MS
  });

  (async () => {
    try {
      for (let repeatIndex = 0; repeatIndex < repeats; repeatIndex += 1) {
        for (const step of steps) {
          if (shouldStop(token)) {
            throw new Error("stopped");
          }

          executionState.lastPoint = await runStep(token, executionState.lastPoint ?? getInitialPoint(), step);
          completedSteps += 1;
          const remainingSteps = Math.max(0, totalSteps - completedSteps);

          void chrome.runtime.sendMessage({
            type: "execution-progress",
            macroId,
            macroName,
            completedSteps,
            totalSteps,
            remainingMs: remainingSteps * HUMAN_STEP_MAX_DELAY_MS
          });

          executionState.lastTarget = getPointTarget(executionState.lastPoint) || executionState.lastTarget;
        }
      }

      void chrome.runtime.sendMessage({
        type: "execution-completed",
        macroId,
        macroName
      });
    } catch (error) {
      const stopReason = error instanceof Error && error.message === "stopped"
        ? "user_stop"
        : error instanceof Error && error.message === "target_not_found"
          ? "target_not_found"
          : "execution_error";
      void chrome.runtime.sendMessage({
        type: "execution-stopped",
        macroId,
        macroName,
        reason: stopReason
      });
    } finally {
      if (executionState.token === token) {
        executionState.isRunning = false;
        executionState.stopRequested = false;
        executionState.trackMoves = false;
        executionState.lastTarget = null;
        executionState.lastDelayMs = null;
      }
      stopExecutionClickListener();
      removeTrackerElement();
    }
  })();

  return { ok: true };
}

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
    startRecordingClickListener(message.mode);
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "recording-listener-stop") {
    stopRecordingClickListener();
    sendResponse({ ok: true });
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

    if (shortcutState.isWaitingForAction && event.code === SHORTCUT_RUN_DEFAULT_CODE) {
      stopWaitingForShortcutAction();
      void sendRuntimeMessage({ type: "shortcut-run-default" });
    }
  },
  true
);

void sendRuntimeMessage({ type: "recording-status" }).then((response) => {
  if (response?.ok && response.isActive) {
    startRecordingClickListener(response.mode);
  }
});

document.addEventListener(
  "keyup",
  (event) => {
    if (event.code === SHORTCUT_PREFIX_CODE && shortcutState.isPrefixDown) {
      shortcutState.isPrefixDown = false;
      startWaitingForShortcutAction();
    }
  },
  true
);
