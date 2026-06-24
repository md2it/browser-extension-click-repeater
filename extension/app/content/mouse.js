
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
  const targetStep = step && typeof step === "object" && step.type === "click"
    ? step.target
    : step;
  const coordinatePoint = parseCoordinateStep(targetStep);
  if (coordinatePoint) {
    return coordinatePoint;
  }

  if (typeof targetStep !== "string" || !targetStep.trim()) {
    return null;
  }

  let element = null;
  try {
    element = document.querySelector(targetStep);
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

function getKeyboardEventTarget() {
  const activeElement = document.activeElement;
  return activeElement instanceof Element ? activeElement : document;
}

function getKeyboardTargetBySelector(selector) {
  if (typeof selector !== "string" || !selector.trim()) {
    return null;
  }

  try {
    const target = document.querySelector(selector);
    return target instanceof Element ? target : null;
  } catch {
    return null;
  }
}

function getKeyboardActionTarget(action) {
  return getKeyboardTargetBySelector(action.targetSelector) || getKeyboardEventTarget();
}

function isTextEditableElement(element) {
  if (element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly;
  }

  if (!(element instanceof HTMLInputElement) || element.disabled || element.readOnly) {
    return false;
  }

  const textTypes = new Set([
    "email",
    "number",
    "password",
    "search",
    "tel",
    "text",
    "url"
  ]);
  return textTypes.has(element.type);
}

function getEditableKeyboardTarget(target) {
  if (target instanceof Element && isTextEditableElement(target)) {
    return target;
  }

  if (target instanceof Element) {
    const editable = target.closest("[contenteditable]");
    if (editable instanceof HTMLElement && editable.isContentEditable) {
      return editable;
    }
  }

  return null;
}

function readEditableKeyboardState(target) {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return {
      kind: "form-field",
      value: target.value,
      selectionStart: Number.isInteger(target.selectionStart) ? target.selectionStart : target.value.length,
      selectionEnd: Number.isInteger(target.selectionEnd) ? target.selectionEnd : target.value.length
    };
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    return {
      kind: "contenteditable",
      value: target.textContent ?? ""
    };
  }

  return null;
}

function didEditableStateChange(target, previousState) {
  if (!previousState) {
    return false;
  }

  const currentState = readEditableKeyboardState(target);
  if (!currentState) {
    return false;
  }

  return currentState.value !== previousState.value ||
    currentState.selectionStart !== previousState.selectionStart ||
    currentState.selectionEnd !== previousState.selectionEnd;
}

function setFormFieldValue(target, value) {
  const prototype = target instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(target, value);
    return;
  }

  target.value = value;
}

function setFormFieldSelection(target, start, end = start) {
  if (typeof target.setSelectionRange !== "function") {
    return;
  }

  try {
    target.setSelectionRange(start, end);
  } catch {
    // Some input types, such as number, do not expose text selection.
  }
}

function restoreEditableSelection(target, editState) {
  if (!editState || editState.kind !== "form-field") {
    return;
  }
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return;
  }
  if (target.value !== editState.value) {
    return;
  }

  const selectionStart = Number.isInteger(editState.selectionStart) ? editState.selectionStart : target.value.length;
  const selectionEnd = Number.isInteger(editState.selectionEnd) ? editState.selectionEnd : selectionStart;
  setFormFieldSelection(target, selectionStart, selectionEnd);
}

function dispatchEditableBeforeInput(target, inputType, data) {
  const beforeInputEvent = new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    composed: true,
    inputType,
    data
  });

  if (!target.dispatchEvent(beforeInputEvent)) {
    return false;
  }

  return true;
}

function dispatchEditableInput(target, inputType, data) {
  target.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    cancelable: false,
    composed: true,
    inputType,
    data
  }));
  return true;
}

function replaceFormFieldSelection(target, replacement, inputType) {
  const value = target.value;
  const selectionStart = Number.isInteger(target.selectionStart) ? target.selectionStart : value.length;
  const selectionEnd = Number.isInteger(target.selectionEnd) ? target.selectionEnd : selectionStart;
  const nextValue = `${value.slice(0, selectionStart)}${replacement}${value.slice(selectionEnd)}`;
  setFormFieldValue(target, nextValue);
  const caret = selectionStart + replacement.length;
  setFormFieldSelection(target, caret);
  target.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    cancelable: false,
    composed: true,
    inputType,
    data: replacement || null
  }));
}

function insertTextIntoEditable(target, text) {
  if (!text) {
    return false;
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    if (!dispatchEditableBeforeInput(target, "insertText", text)) {
      return true;
    }
    replaceFormFieldSelection(target, text, "insertText");
    return true;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    if (!dispatchEditableBeforeInput(target, "insertText", text)) {
      return true;
    }
    document.execCommand("insertText", false, text);
    dispatchEditableInput(target, "insertText", text);
    return true;
  }

  return false;
}

function deleteBackwardFromEditable(target) {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const value = target.value;
    const selectionStart = Number.isInteger(target.selectionStart) ? target.selectionStart : value.length;
    const selectionEnd = Number.isInteger(target.selectionEnd) ? target.selectionEnd : selectionStart;
    if (selectionStart === 0 && selectionEnd === 0) {
      return true;
    }
    if (!dispatchEditableBeforeInput(target, "deleteContentBackward", null)) {
      return true;
    }
    const deleteStart = selectionStart === selectionEnd ? Math.max(0, selectionStart - 1) : selectionStart;
    const nextValue = `${value.slice(0, deleteStart)}${value.slice(selectionEnd)}`;
    setFormFieldValue(target, nextValue);
    setFormFieldSelection(target, deleteStart);
    target.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: false,
      composed: true,
      inputType: "deleteContentBackward",
      data: null
    }));
    return true;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    if (!dispatchEditableBeforeInput(target, "deleteContentBackward", null)) {
      return true;
    }
    document.execCommand("delete", false);
    dispatchEditableInput(target, "deleteContentBackward", null);
    return true;
  }

  return false;
}

function deleteForwardFromEditable(target) {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const value = target.value;
    const selectionStart = Number.isInteger(target.selectionStart) ? target.selectionStart : value.length;
    const selectionEnd = Number.isInteger(target.selectionEnd) ? target.selectionEnd : selectionStart;
    if (selectionStart === value.length && selectionEnd === value.length) {
      return true;
    }
    if (!dispatchEditableBeforeInput(target, "deleteContentForward", null)) {
      return true;
    }
    const deleteEnd = selectionStart === selectionEnd ? Math.min(value.length, selectionEnd + 1) : selectionEnd;
    const nextValue = `${value.slice(0, selectionStart)}${value.slice(deleteEnd)}`;
    setFormFieldValue(target, nextValue);
    setFormFieldSelection(target, selectionStart);
    target.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: false,
      composed: true,
      inputType: "deleteContentForward",
      data: null
    }));
    return true;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    if (!dispatchEditableBeforeInput(target, "deleteContentForward", null)) {
      return true;
    }
    document.execCommand("forwardDelete", false);
    dispatchEditableInput(target, "deleteContentForward", null);
    return true;
  }

  return false;
}

function focusNextElement(backward) {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
    "[contenteditable]"
  ].join(",");
  const elements = Array.from(document.querySelectorAll(selector))
    .filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
  if (!elements.length) {
    return false;
  }

  const activeElement = document.activeElement;
  const currentIndex = elements.indexOf(activeElement);
  const nextIndex = backward
    ? (currentIndex <= 0 ? elements.length - 1 : currentIndex - 1)
    : (currentIndex < 0 || currentIndex >= elements.length - 1 ? 0 : currentIndex + 1);
  elements[nextIndex].focus();
  return true;
}

function submitInputForm(target) {
  if (!(target instanceof HTMLInputElement) || !(target.form instanceof HTMLFormElement)) {
    return false;
  }

  if (typeof target.form.requestSubmit === "function") {
    target.form.requestSubmit();
    return true;
  }

  target.form.dispatchEvent(new Event("submit", {
    bubbles: true,
    cancelable: true
  }));
  return true;
}

function applyKeyboardDefaultEffect(action, target, keyboardEvent, previousEditState) {
  if (keyboardEvent.defaultPrevented || action.type !== "keydown" || action.ctrlKey || action.metaKey || action.altKey) {
    return;
  }

  if (action.key === "Tab") {
    focusNextElement(action.shiftKey);
    return;
  }

  if ((action.key === "Enter" || action.key === " ") && target instanceof HTMLElement && !getEditableKeyboardTarget(target)) {
    target.click();
    return;
  }

  const editableTarget = getEditableKeyboardTarget(target);
  if (!editableTarget) {
    return;
  }
  if (didEditableStateChange(editableTarget, previousEditState)) {
    return;
  }

  if (action.key === "Backspace") {
    deleteBackwardFromEditable(editableTarget);
    return;
  }

  if (action.key === "Delete") {
    deleteForwardFromEditable(editableTarget);
    return;
  }

  if (action.key === "Enter") {
    if (editableTarget instanceof HTMLTextAreaElement || editableTarget.isContentEditable) {
      insertTextIntoEditable(editableTarget, "\n");
      return;
    }
    submitInputForm(editableTarget);
    return;
  }

  if (action.key.length === 1) {
    insertTextIntoEditable(editableTarget, action.key);
  }
}

function dispatchKeyboardAction(action) {
  const target = getKeyboardActionTarget(action);
  if (target instanceof HTMLElement) {
    target.focus();
  }
  restoreEditableSelection(target, action.editState);
  const editableTarget = getEditableKeyboardTarget(target);
  const previousEditState = editableTarget ? readEditableKeyboardState(editableTarget) : null;
  const event = new KeyboardEvent(action.type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    key: action.key,
    code: action.code,
    altKey: action.altKey,
    ctrlKey: action.ctrlKey,
    metaKey: action.metaKey,
    shiftKey: action.shiftKey,
    location: action.location,
    repeat: action.repeat,
    isComposing: action.isComposing
  });
  target.dispatchEvent(event);
  applyKeyboardDefaultEffect(action, target, event, previousEditState);
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
