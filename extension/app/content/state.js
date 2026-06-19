
const EXECUTION_SPEED_VALUES = [0.5, 1, 4, 10];
const EXECUTION_SPEED_PROFILES = {
  0.5: {
    moveIntervalMs: 24,
    beforeDownMinMs: 160,
    beforeDownMaxMs: 250,
    holdMinMs: 100,
    holdMaxMs: 150,
    afterUpMinMs: 80,
    afterUpMaxMs: 120,
    stepMinMs: 700,
    stepMaxMs: 1000
  },
  1: {
    moveIntervalMs: 12,
    beforeDownMinMs: 80,
    beforeDownMaxMs: 140,
    holdMinMs: 50,
    holdMaxMs: 90,
    afterUpMinMs: 25,
    afterUpMaxMs: 60,
    stepMinMs: 250,
    stepMaxMs: 450
  },
  4: {
    moveIntervalMs: 6,
    beforeDownMinMs: 30,
    beforeDownMaxMs: 60,
    holdMinMs: 20,
    holdMaxMs: 40,
    afterUpMinMs: 10,
    afterUpMaxMs: 25,
    stepMinMs: 70,
    stepMaxMs: 130
  },
  10: {
    moveIntervalMs: 4,
    beforeDownMinMs: 15,
    beforeDownMaxMs: 25,
    holdMinMs: 8,
    holdMaxMs: 14,
    afterUpMinMs: 5,
    afterUpMaxMs: 10,
    stepMinMs: 35,
    stepMaxMs: 50
  }
};

const HUMAN_MM_IN_PX = 0.75; // 0.2mm offset radius at 96 DPI
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
  executionSpeed: 1,
  clickSound: true
};

const trackerState = {
  motionElement: null,
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

function getExecutionSpeedProfile(speed = executionState.executionSpeed) {
  return EXECUTION_SPEED_PROFILES[speed] ?? EXECUTION_SPEED_PROFILES[1];
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
