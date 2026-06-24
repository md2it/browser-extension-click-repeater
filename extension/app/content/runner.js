
let clickAudioContext = null;
let clickAudioBuffer = null;
let clickAudioKeepAlive = null;

function prepareClickSound() {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) return false;

  if (clickAudioContext && clickAudioContext.state !== "closed" && clickAudioBuffer) {
    if (clickAudioContext.state === "suspended") {
      void clickAudioContext.resume();
    }
    return true;
  }

  clickAudioContext = new AudioContextClass();
  const duration = 0.035;
  clickAudioBuffer = clickAudioContext.createBuffer(
    1,
    Math.ceil(clickAudioContext.sampleRate * duration),
    clickAudioContext.sampleRate
  );
  const data = clickAudioBuffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    const elapsed = index / clickAudioContext.sampleRate;
    const attack = Math.min(1, elapsed / 0.0004);
    const snap = (Math.random() * 2 - 1) * Math.exp(-elapsed / 0.003);
    const body = Math.sin(2 * Math.PI * 1600 * elapsed) * Math.exp(-elapsed / 0.005);
    const mechanism = Math.sin(2 * Math.PI * 850 * elapsed) * Math.exp(-elapsed / 0.012);
    data[index] = attack * (snap * 0.5 + body * 0.25 + mechanism * 0.25);
  }

  if (clickAudioContext.state === "suspended") {
    void clickAudioContext.resume();
  }

  const keepAlive = clickAudioContext.createOscillator();
  const keepAliveGain = clickAudioContext.createGain();
  keepAlive.frequency.value = 30;
  keepAliveGain.gain.value = 0.000001;
  keepAlive.connect(keepAliveGain).connect(clickAudioContext.destination);
  keepAlive.start();
  clickAudioKeepAlive = keepAlive;
  return true;
}

function playClickSound() {
  if (!prepareClickSound()) return;

  const source = clickAudioContext.createBufferSource();
  const gain = clickAudioContext.createGain();
  gain.gain.value = 0.18;
  source.buffer = clickAudioBuffer;
  source.connect(gain).connect(clickAudioContext.destination);
  source.start();
}

function releaseClickSound() {
  const context = clickAudioContext;
  const keepAlive = clickAudioKeepAlive;
  clickAudioContext = null;
  clickAudioBuffer = null;
  clickAudioKeepAlive = null;
  if (keepAlive) {
    keepAlive.stop();
  }
  if (context && context.state !== "closed") {
    window.setTimeout(() => void context.close(), 250);
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

function normalizeExecutionAction(step) {
  if (typeof step === "string") {
    const target = step.trim();
    return target ? target : null;
  }

  const keyboardAction = normalizeKeyboardAction(step);
  if (keyboardAction) {
    return keyboardAction;
  }

  if (!step || typeof step !== "object" || step.type !== "click") {
    return null;
  }

  const target = typeof step.target === "string" ? step.target.trim() : "";
  const targetMode = step.targetMode === "element" ? "element" : step.targetMode === "position" ? "position" : null;
  return target ? {
    type: "click",
    target,
    targetMode,
    frameId: Number.isInteger(step.frameId) ? step.frameId : null,
    documentId: typeof step.documentId === "string" ? step.documentId : null
  } : null;
}

function isKeyboardAction(action) {
  return action && typeof action === "object" && (action.type === "keydown" || action.type === "keyup");
}

function isClickAction(action) {
  return typeof action === "string" || (action && typeof action === "object" && action.type === "click");
}

function clickTargetNotFoundError(action) {
  if (action?.targetMode === "element") {
    return new Error("element_target_not_found");
  }
  if (action?.targetMode === "position") {
    return new Error("position_target_not_found");
  }
  return new Error("target_not_found");
}

function resolveClickTarget(point, action) {
  const target = getPointTarget(point);
  if (target) {
    return target;
  }

  return action?.targetMode === "position" ? document.documentElement : null;
}

async function runClickAction(token, fromPoint, action) {
  const profile = getExecutionSpeedProfile();
  const stepPoint = resolveStepPoint(action);
  if (!stepPoint) {
    throw clickTargetNotFoundError(action);
  }

  const clickPoint = applyClickOffset(stepPoint);
  const path = buildHumanPath(fromPoint, clickPoint);
  animateTrackerMovement(fromPoint, clickPoint, path.length * profile.moveIntervalMs);
  let previousPoint = fromPoint;

  for (const point of path) {
    if (shouldStop(token)) {
      throw new Error("stopped");
    }

    const moveResult = dispatchMouseMove(point, previousPoint);
    previousPoint = moveResult.point;
    await sleep(profile.moveIntervalMs);
  }

  if (shouldStop(token)) {
    throw new Error("stopped");
  }

  let clickTarget = resolveClickTarget(clickPoint, action);
  if (!clickTarget) {
    throw clickTargetNotFoundError(action);
  }

  if (clickTarget !== executionState.lastTarget) {
    transitionTarget(executionState.lastTarget, clickTarget, clickPoint);
    executionState.lastTarget = clickTarget;
  }

  await sleep(randomDelay(profile.beforeDownMinMs, profile.beforeDownMaxMs));
  if (shouldStop(token)) {
    throw new Error("stopped");
  }

  const stabilizedTarget = resolveClickTarget(clickPoint, action);
  if (!stabilizedTarget) {
    throw clickTargetNotFoundError(action);
  }
  if (stabilizedTarget !== clickTarget) {
    transitionTarget(clickTarget, stabilizedTarget, clickPoint);
    clickTarget = stabilizedTarget;
    executionState.lastTarget = stabilizedTarget;
  }

  await dispatchMouseClick(token, clickTarget, clickPoint);
  if (executionState.clickSound) {
    playClickSound();
  }
  if (!shouldStop(token)) {
    await sleep(randomDelay(profile.stepMinMs, profile.stepMaxMs));
  }
  if (shouldStop(token)) {
    throw new Error("stopped");
  }

  return clickPoint;
}

async function runKeyboardAction(token, fromPoint, action) {
  const profile = getExecutionSpeedProfile();
  if (shouldStop(token)) {
    throw new Error("stopped");
  }

  dispatchKeyboardAction(action);
  await sleep(randomDelay(profile.stepMinMs, profile.stepMaxMs));
  if (shouldStop(token)) {
    throw new Error("stopped");
  }

  return fromPoint;
}

function runAction(token, fromPoint, action) {
  if (isKeyboardAction(action)) {
    return runKeyboardAction(token, fromPoint, action);
  }

  return runClickAction(token, fromPoint, action);
}

async function runExecution(payload) {
  if (executionState.isRunning) {
    return { ok: false, error: "already_running" };
  }

  const clickId = typeof payload?.clickId === "string" ? payload.clickId : "";
  const clickName = typeof payload?.clickName === "string" && payload.clickName.trim() ? payload.clickName.trim() : "clicks";
  const repeats = Number.isFinite(Number(payload?.repeats)) && Number(payload.repeats) > 0 ? Math.floor(Number(payload.repeats)) : 1;
  const trackMoves = Boolean(payload?.trackMoves);
  const executionSpeed = normalizeExecutionSpeed(payload?.executionSpeed);
  const clickSound = payload?.clickSound !== false;
  const steps = Array.isArray(payload?.steps) ? payload.steps.map(normalizeExecutionAction).filter(Boolean) : [];
  if (steps.length === 0) {
    return { ok: false, error: "empty_steps" };
  }
  const hasClickActions = steps.some(isClickAction);

  executionState.isRunning = true;
  executionState.stopRequested = false;
  executionState.token += 1;
  const token = executionState.token;
  executionState.trackMoves = trackMoves;
  executionState.executionSpeed = executionSpeed;
  executionState.clickSound = clickSound;
  if (clickSound && hasClickActions) {
    prepareClickSound();
  }
  executionState.lastPoint = executionState.lastPoint ?? getInitialPoint();
  executionState.lastTarget = getPointTarget(executionState.lastPoint);
  executionState.lastDelayMs = null;
  if (hasClickActions) {
    moveTracker(executionState.lastPoint);
  }
  startExecutionClickListener();
  const totalSteps = repeats * steps.length;
  let completedSteps = 0;

  const profile = getExecutionSpeedProfile(executionSpeed);
  const estimatedMovementPointCount = 19;
  const msPerStep =
    estimatedMovementPointCount * profile.moveIntervalMs +
    (profile.beforeDownMinMs + profile.beforeDownMaxMs) / 2 +
    (profile.holdMinMs + profile.holdMaxMs) / 2 +
    (profile.afterUpMinMs + profile.afterUpMaxMs) / 2 +
    (profile.stepMinMs + profile.stepMaxMs) / 2;

  void chrome.runtime.sendMessage({
    type: "execution-progress",
    clickId,
    clickName,
    completedSteps,
    totalSteps,
    remainingMs: totalSteps * msPerStep
  });

  (async () => {
    try {
      for (let repeatIndex = 0; repeatIndex < repeats; repeatIndex += 1) {
        for (const step of steps) {
          if (shouldStop(token)) {
            throw new Error("stopped");
          }

          executionState.lastPoint = await runAction(token, executionState.lastPoint ?? getInitialPoint(), step);
          completedSteps += 1;
          const remainingSteps = Math.max(0, totalSteps - completedSteps);

          void chrome.runtime.sendMessage({
            type: "execution-progress",
            clickId,
            clickName,
            completedSteps,
            totalSteps,
            remainingMs: remainingSteps * msPerStep
          });

          if (isClickAction(step)) {
            executionState.lastTarget = getPointTarget(executionState.lastPoint) || executionState.lastTarget;
          }
        }
      }

      void chrome.runtime.sendMessage({
        type: "execution-completed",
        clickId,
        clickName
      });
    } catch (error) {
      const stopReason = error instanceof Error && error.message === "stopped"
        ? "user_stop"
        : error instanceof Error && (
          error.message === "target_not_found" ||
          error.message === "element_target_not_found" ||
          error.message === "position_target_not_found"
        )
          ? error.message
          : "execution_error";
      void chrome.runtime.sendMessage({
        type: "execution-stopped",
        clickId,
        clickName,
        reason: stopReason
      });
    } finally {
      if (executionState.token === token) {
        executionState.isRunning = false;
        executionState.stopRequested = false;
        executionState.trackMoves = false;
        executionState.executionSpeed = 1;
        executionState.clickSound = true;
        executionState.lastTarget = null;
        executionState.lastDelayMs = null;
      }
      stopExecutionClickListener();
      removeTrackerElement();
      releaseClickSound();
    }
  })();

  return { ok: true };
}
