
const EXECUTION_SPEED_TEMPO_DELAYS_MS = { 0.25: 3500, 0.5: 1500, 1: 500, 2: 0 };

const HUMAN_MM_IN_PX = 0.75; // 0.2mm offset radius at 96 DPI
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
const TRACKER_DEFAULT_SIZE = 36;
const TRACKER_ACTIVE_SIZE = 54;
const TRACKER_DEFAULT_COLOR = "#012292";
const TRACKER_ACTIVE_COLOR = "#012292";
const TRACKER_ACTIVE_DURATION_MS = 50;
const TRACKER_ELEMENT_ID = "__click_repeater_tracker";
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
  trackMoves: false,
  executionSpeed: 1
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
  isActive: false
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
  return (
    /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ||
    navigator.platform.toUpperCase().includes("MAC")
  );
}

function isPrefixShortcut(event) {
  const hasPlatformModifier = isMacPlatform() ? event.metaKey : event.ctrlKey;
  return event.code === SHORTCUT_PREFIX_CODE && event.shiftKey && hasPlatformModifier;
}

function isPrefixChordHeld(event) {
  const hasPlatformModifier = isMacPlatform() ? event.metaKey : event.ctrlKey;
  return hasPlatformModifier && event.shiftKey;
}

function isPrefixActionKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  return event.code === SHORTCUT_RUN_DEFAULT_CODE;
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
