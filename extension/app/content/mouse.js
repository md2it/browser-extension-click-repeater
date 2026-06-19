
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
  const pointCount = Math.round(2 + 5 * Math.log2(1 + distance / 10));
  const perpendicularX = distance > 0 ? -deltaY / distance : 0;
  const perpendicularY = distance > 0 ? deltaX / distance : 0;
  const curveOffset = randomBetween(-1, 1) * Math.min(distance * 0.08, 32);
  const controlPoint = {
    x: (from.x + to.x) / 2 + perpendicularX * curveOffset,
    y: (from.y + to.y) / 2 + perpendicularY * curveOffset
  };
  const sampleCount = Math.max(32, pointCount * 4);
  const samples = [{ point: from, length: 0 }];
  let totalLength = 0;
  let previousSample = from;

  for (let index = 1; index <= sampleCount; index += 1) {
    const t = index / sampleCount;
    const inverseT = 1 - t;
    const point = normalizeViewportPoint({
      x: inverseT * inverseT * from.x + 2 * inverseT * t * controlPoint.x + t * t * to.x,
      y: inverseT * inverseT * from.y + 2 * inverseT * t * controlPoint.y + t * t * to.y
    });
    totalLength += Math.hypot(point.x - previousSample.x, point.y - previousSample.y);
    samples.push({ point, length: totalLength });
    previousSample = point;
  }

  const path = [];
  let sampleIndex = 1;
  for (let index = 1; index <= pointCount; index += 1) {
    const targetLength = totalLength * (index / pointCount);
    while (sampleIndex < samples.length - 1 && samples[sampleIndex].length < targetLength) {
      sampleIndex += 1;
    }
    const current = samples[sampleIndex];
    const previous = samples[sampleIndex - 1];
    const lengthDelta = current.length - previous.length;
    const ratio = lengthDelta > 0 ? (targetLength - previous.length) / lengthDelta : 0;
    path.push(normalizeViewportPoint({
      x: previous.point.x + (current.point.x - previous.point.x) * ratio,
      y: previous.point.y + (current.point.y - previous.point.y) * ratio
    }));
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

function dispatchTargetExit(target, point, relatedTarget) {
  if (!(target instanceof Element)) {
    return;
  }

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

  target.dispatchEvent(buildPointerEvent("pointerout", init));
  target.dispatchEvent(buildMouseEvent("mouseout", init));
  target.dispatchEvent(buildPointerEvent("pointerleave", { ...init, bubbles: false }));
  target.dispatchEvent(buildMouseEvent("mouseleave", { ...init, bubbles: false }));
}

function transitionTarget(previousTarget, nextTarget, point) {
  if (previousTarget === nextTarget) {
    return;
  }
  dispatchTargetExit(previousTarget, point, nextTarget);
  dispatchTargetEntry(nextTarget, point, previousTarget);
}

async function dispatchMouseClick(token, target, point) {
  const profile = getExecutionSpeedProfile();
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

  target.dispatchEvent(buildPointerEvent("pointerdown", init));
  target.dispatchEvent(buildMouseEvent("mousedown", init));

  await sleep(randomDelay(profile.holdMinMs, profile.holdMaxMs));
  if (shouldStop(token)) {
    throw new Error("stopped");
  }

  target.dispatchEvent(buildPointerEvent("pointerup", { ...init, buttons: 0 }));
  target.dispatchEvent(buildMouseEvent("mouseup", { ...init, buttons: 0 }));

  await sleep(randomDelay(profile.afterUpMinMs, profile.afterUpMaxMs));
  if (shouldStop(token)) {
    throw new Error("stopped");
  }

  target.dispatchEvent(buildMouseEvent("click", { ...init, buttons: 0 }));
  pulseTracker(normalized);
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
