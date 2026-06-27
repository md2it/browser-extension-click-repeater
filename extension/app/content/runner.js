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

  await sleep(profile.beforeDownMs);
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
    playClickSound(executionState.soundVolume);
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
  if (executionState.clickSound && action.type === "keydown") {
    playKeyPressSound(executionState.soundVolume);
  }
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
  const soundVolume = ["volume", "volume-1", "volume-2"].includes(payload?.soundVolume)
    ? payload.soundVolume
    : (clickSound ? "volume-2" : "volume");
  const steps = Array.isArray(payload?.steps) ? payload.steps.map(normalizeExecutionAction).filter(Boolean) : [];
  if (steps.length === 0) {
    return { ok: false, error: "empty_steps" };
  }
  const hasClickActions = steps.some(isClickAction);
  const hasSoundActions = steps.some((step) => isClickAction(step) || step?.type === "keydown");

  executionState.isRunning = true;
  executionState.stopRequested = false;
  executionState.token += 1;
  const token = executionState.token;
  executionState.trackMoves = trackMoves;
  executionState.executionSpeed = executionSpeed;
  executionState.soundVolume = soundVolume;
  executionState.clickSound = soundVolume !== "volume";
  if (soundVolume !== "volume" && hasSoundActions) {
    prepareSoundEffects();
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
    profile.beforeDownMs +
    profile.holdMs +
    profile.afterUpMs +
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
        executionState.soundVolume = "volume-2";
        executionState.clickSound = true;
        executionState.lastTarget = null;
        executionState.lastDelayMs = null;
      }
      stopExecutionClickListener();
      removeTrackerElement();
      releaseSoundEffects();
    }
  })();

  return { ok: true };
}
