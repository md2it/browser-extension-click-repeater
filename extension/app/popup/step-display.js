function isKeyboardStep(step) {
  return Boolean(normalizeKeyboardAction(step));
}

function getKeyboardStep(step) {
  return normalizeKeyboardAction(step);
}

function isModifierAction(action) {
  if (!action) {
    return false;
  }

  return ["Alt", "AltGraph", "Control", "Meta", "Shift"].includes(action.key)
    || ["AltLeft", "AltRight", "ControlLeft", "ControlRight", "MetaLeft", "MetaRight", "ShiftLeft", "ShiftRight"].includes(action.code);
}

function isShiftAction(action) {
  if (!action) {
    return false;
  }

  return action.key === "Shift" || action.code === "ShiftLeft" || action.code === "ShiftRight";
}

function getModifierLabel(action) {
  if (action.key === "Control" || action.code === "ControlLeft" || action.code === "ControlRight") return "Ctrl";
  if (action.key === "Meta" || action.code === "MetaLeft" || action.code === "MetaRight") return "Cmd";
  if (action.key === "Alt" || action.key === "AltGraph" || action.code === "AltLeft" || action.code === "AltRight") return "Alt";
  if (isShiftAction(action)) return "Shift";
  return action.key || action.code;
}

function getModifierLabelsFromAction(action) {
  const labels = [];
  if (action.ctrlKey) labels.push("Ctrl");
  if (action.metaKey) labels.push("Cmd");
  if (action.altKey) labels.push("Alt");
  if (action.shiftKey) labels.push("Shift");
  return labels;
}

function getKeyLabel(action) {
  if (action.key === "Meta" || action.code === "MetaLeft" || action.code === "MetaRight") {
    return "Cmd";
  }

  if (action.key === " " || action.code === "Space") {
    return "Space";
  }

  if (action.key && action.key.length === 1) {
    return action.key.toUpperCase();
  }
  return action.key || action.code;
}

function isSameKeyAction(first, second) {
  return Boolean((first.code && first.code === second.code) || (first.key && first.key === second.key));
}

function readTypeUnit(steps, startIndex) {
  let index = startIndex;
  let action = getKeyboardStep(steps[index]);
  while (action?.type === "keydown" && isShiftAction(action)) {
    index += 1;
    action = getKeyboardStep(steps[index]);
  }

  if (!action || action.type !== "keydown" || action.key.length !== 1 || action.ctrlKey || action.metaKey || action.altKey) {
    return null;
  }

  index += 1;
  while (index < steps.length) {
    const next = getKeyboardStep(steps[index]);
    if (!next) {
      return null;
    }

    if (isShiftAction(next)) {
      index += 1;
      continue;
    }

    if (next.type === "keyup" && isSameKeyAction(action, next)) {
      index += 1;
      while (isShiftAction(getKeyboardStep(steps[index])) && getKeyboardStep(steps[index]).type === "keyup") {
        index += 1;
      }
      return { text: action.key, nextIndex: index };
    }

    return null;
  }

  return null;
}

function readTypeRun(steps, startIndex) {
  let index = startIndex;
  let text = "";

  while (index < steps.length) {
    const unit = readTypeUnit(steps, index);
    if (!unit) {
      break;
    }
    text += unit.text;
    index = unit.nextIndex;
  }

  return text ? { label: `${t("stepType")}: ${text}`, nextIndex: index } : null;
}

function readHotkey(steps, startIndex) {
  const pressedModifiers = new Set();
  const seenModifiers = [];
  let mainDown = null;
  let hasMainUp = false;
  let index = startIndex;

  while (index < steps.length) {
    const action = getKeyboardStep(steps[index]);
    if (!action) {
      return null;
    }

    if (isModifierAction(action)) {
      const label = getModifierLabel(action);
      if (action.type === "keydown") {
        if (hasMainUp) {
          return null;
        }
        pressedModifiers.add(label);
        if (!seenModifiers.includes(label)) {
          seenModifiers.push(label);
        }
      } else {
        pressedModifiers.delete(label);
      }
      index += 1;
      if (!mainDown && seenModifiers.length >= 2 && pressedModifiers.size === 0) {
        return { label: `${t("stepHotkey")}: ${seenModifiers.join("+")}`, nextIndex: index };
      }
      if (mainDown && hasMainUp && pressedModifiers.size === 0) {
        return {
          label: `${t("stepHotkey")}: ${[...mainDown.modifierLabels, getKeyLabel(mainDown.action)].join("+")}`,
          nextIndex: index
        };
      }
      if (!mainDown && pressedModifiers.size === 0) {
        return null;
      }
      continue;
    }

    if (action.type === "keydown") {
      if (mainDown) {
        return null;
      }
      const modifierLabels = Array.from(new Set([...seenModifiers, ...getModifierLabelsFromAction(action)]));
      if (!modifierLabels.length) {
        return null;
      }
      mainDown = { action, modifierLabels };
      index += 1;
      continue;
    }

    if (!mainDown || !isSameKeyAction(mainDown.action, action)) {
      return null;
    }

    hasMainUp = true;
    index += 1;
    if (pressedModifiers.size === 0) {
      break;
    }
  }

  while (index < steps.length && pressedModifiers.size > 0) {
    const action = getKeyboardStep(steps[index]);
    if (!action || !isModifierAction(action) || action.type !== "keyup") {
      return null;
    }
    pressedModifiers.delete(getModifierLabel(action));
    index += 1;
  }

  if (!mainDown || !hasMainUp || pressedModifiers.size > 0) {
    return null;
  }

  return {
    label: `${t("stepHotkey")}: ${[...mainDown.modifierLabels, getKeyLabel(mainDown.action)].join("+")}`,
    nextIndex: index
  };
}

function readModifierOnlyHotkey(steps, startIndex) {
  const pressedModifiers = new Set();
  const seenModifiers = [];
  let index = startIndex;

  while (index < steps.length) {
    const action = getKeyboardStep(steps[index]);
    if (!isModifierAction(action)) {
      return null;
    }

    const label = getModifierLabel(action);
    if (action.type === "keydown") {
      pressedModifiers.add(label);
      if (!seenModifiers.includes(label)) {
        seenModifiers.push(label);
      }
    } else {
      pressedModifiers.delete(label);
      if (pressedModifiers.size === 0) {
        return seenModifiers.length
          ? { label: `${t("stepHotkey")}: ${seenModifiers.join("+")}`, nextIndex: index + 1 }
          : null;
      }
    }

    index += 1;
  }

  return null;
}

function readKeyAction(steps, startIndex) {
  const action = getKeyboardStep(steps[startIndex]);
  const next = getKeyboardStep(steps[startIndex + 1]);
  if (!action || !next || action.type !== "keydown" || next.type !== "keyup" || !isSameKeyAction(action, next)) {
    return null;
  }

  if (action.key.length === 1 || action.ctrlKey || action.metaKey || action.altKey) {
    return null;
  }

  return { label: `${t("stepKey")}: ${getKeyLabel(action)}`, nextIndex: startIndex + 2 };
}

function formatCompactClickStep(step, clickMode) {
  return `${t("stepClick")}: ${formatStepLabel(step, clickMode)}`;
}

function createStepDisplayRows(steps, clickMode, showDetailedSteps) {
  if (!Array.isArray(steps)) {
    return [];
  }

  if (showDetailedSteps) {
    return steps.map((step) => formatStepLabel(step, clickMode)).filter(Boolean);
  }

  const rows = [];
  let index = 0;
  while (index < steps.length) {
    if (!isKeyboardStep(steps[index])) {
      const label = formatCompactClickStep(steps[index], clickMode);
      if (label.trim()) {
        rows.push(label);
      }
      index += 1;
      continue;
    }

    const compact = readTypeRun(steps, index) || readHotkey(steps, index) || readModifierOnlyHotkey(steps, index) || readKeyAction(steps, index);
    if (compact) {
      rows.push(compact.label);
      index = compact.nextIndex;
      continue;
    }

    const label = formatStepLabel(steps[index], clickMode);
    if (label) {
      rows.push(label);
    }
    index += 1;
  }

  return rows;
}
