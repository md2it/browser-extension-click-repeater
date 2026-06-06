
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
  if (!shouldStop(token)) {
    const tempoDelayMs = EXECUTION_SPEED_TEMPO_DELAYS_MS[executionState.executionSpeed] ?? 500;
    if (tempoDelayMs > 0) {
      await sleep(tempoDelayMs);
    }
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
  const executionSpeedRaw = Number(payload?.executionSpeed);
  const executionSpeed = [0.25, 0.5, 1, 2].includes(executionSpeedRaw) ? executionSpeedRaw : 1;
  const steps = Array.isArray(payload?.steps) ? payload.steps.filter((step) => typeof step === "string" && step.trim()) : [];
  if (steps.length === 0) {
    return { ok: false, error: "empty_steps" };
  }

  executionState.isRunning = true;
  executionState.stopRequested = false;
  executionState.token += 1;
  const token = executionState.token;
  executionState.trackMoves = trackMoves;
  executionState.executionSpeed = executionSpeed;
  executionState.lastPoint = executionState.lastPoint ?? getInitialPoint();
  executionState.lastTarget = getPointTarget(executionState.lastPoint);
  executionState.lastDelayMs = null;
  moveTracker(executionState.lastPoint);
  startExecutionClickListener();
  const totalSteps = repeats * steps.length;
  let completedSteps = 0;

  const tempoDelayMs = EXECUTION_SPEED_TEMPO_DELAYS_MS[executionSpeed] ?? 500;
  const msPerStep = HUMAN_STEP_MAX_DELAY_MS + tempoDelayMs;

  void chrome.runtime.sendMessage({
    type: "execution-progress",
    macroId,
    macroName,
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

          executionState.lastPoint = await runStep(token, executionState.lastPoint ?? getInitialPoint(), step);
          completedSteps += 1;
          const remainingSteps = Math.max(0, totalSteps - completedSteps);

          void chrome.runtime.sendMessage({
            type: "execution-progress",
            macroId,
            macroName,
            completedSteps,
            totalSteps,
            remainingMs: remainingSteps * msPerStep
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
        executionState.executionSpeed = 1;
        executionState.lastTarget = null;
        executionState.lastDelayMs = null;
      }
      stopExecutionClickListener();
      removeTrackerElement();
    }
  })();

  return { ok: true };
}
