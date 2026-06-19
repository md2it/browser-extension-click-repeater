
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
  if (executionState.clickSound) {
    playClickSound();
  }
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

  const clickId = typeof payload?.clickId === "string" ? payload.clickId : "";
  const clickName = typeof payload?.clickName === "string" && payload.clickName.trim() ? payload.clickName.trim() : "clicks";
  const repeats = Number.isFinite(Number(payload?.repeats)) && Number(payload.repeats) > 0 ? Math.floor(Number(payload.repeats)) : 1;
  const trackMoves = Boolean(payload?.trackMoves);
  const executionSpeedRaw = Number(payload?.executionSpeed);
  const executionSpeed = [0.25, 0.5, 1, 2].includes(executionSpeedRaw) ? executionSpeedRaw : 1;
  const clickSound = payload?.clickSound !== false;
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
  executionState.clickSound = clickSound;
  if (clickSound) {
    prepareClickSound();
  }
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

          executionState.lastPoint = await runStep(token, executionState.lastPoint ?? getInitialPoint(), step);
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

          executionState.lastTarget = getPointTarget(executionState.lastPoint) || executionState.lastTarget;
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
        : error instanceof Error && error.message === "target_not_found"
          ? "target_not_found"
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
