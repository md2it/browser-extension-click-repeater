
function trackerDefaultIconSvg() {
  return globalThis.clickRepeaterLucideIcons.trackerDefault;
}

function trackerClickIconSvg() {
  return globalThis.clickRepeaterLucideIcons.trackerClick;
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
  element.style.transform = "translate(-16.67%, -16.67%)";
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

function spawnClickRipple(point) {
  const normalized = normalizeViewportPoint(point);
  const colors = ["#012292", "white"];
  for (let i = 0; i < colors.length; i += 1) {
    const circle = document.createElement("div");
    circle.style.cssText = [
      "position:fixed",
      `left:${normalized.x}px`,
      `top:${normalized.y}px`,
      "width:0px",
      "height:0px",
      "border-radius:50%",
      `border:2px solid ${colors[i]}`,
      "transform:translate(-50%,-50%)",
      "pointer-events:none",
      "user-select:none",
      `z-index:2147483647`,
      "box-sizing:border-box"
    ].join(";");
    document.documentElement.append(circle);
    const delay = i * 60;
    const size = 60 + i * 10;
    circle.animate(
      [
        { width: "0px", height: "0px", opacity: 0.7 },
        { width: `${size}px`, height: `${size}px`, opacity: 0 }
      ],
      { duration: 500, delay, easing: "ease-out", fill: "forwards" }
    ).finished.then(() => circle.remove());
  }
}

function pulseTracker(point) {
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

  if (point) {
    spawnClickRipple(point);
  }
}

function normalizeViewportPoint(point) {
  const maxX = Math.max(VIEWPORT_EDGE_PADDING, window.innerWidth - VIEWPORT_EDGE_PADDING);
  const maxY = Math.max(VIEWPORT_EDGE_PADDING, window.innerHeight - VIEWPORT_EDGE_PADDING);
  return {
    x: clamp(point.x, VIEWPORT_EDGE_PADDING, maxX),
    y: clamp(point.y, VIEWPORT_EDGE_PADDING, maxY)
  };
}
