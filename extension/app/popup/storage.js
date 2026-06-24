function getDisplayMovesValue(macro) {
  return Boolean(macro?.displayMoves ?? macro?.trackMoves);
}

function normalizeRepeats(value) {
  const repeats = Number(value);
  if (!Number.isFinite(repeats)) {
    return 1;
  }

  return Math.min(999, Math.max(1, Math.floor(repeats)));
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

function normalizeRecordedStep(step) {
  const keyboardAction = normalizeKeyboardAction(step);
  if (keyboardAction) {
    return keyboardAction;
  }

  if (!step || typeof step !== "object") {
    return null;
  }

  const position = typeof step.position === "string" ? step.position.trim() : "";
  const selector = typeof step.selector === "string" ? step.selector.trim() : "";
  if (!position && !selector) {
    return null;
  }

  return {
    type: "click",
    position,
    selector,
    frameId: Number.isInteger(step.frameId) ? step.frameId : null,
    documentId: typeof step.documentId === "string" ? step.documentId : null
  };
}

function normalizeStepForExecution(step, clickMode) {
  if (typeof step === "string") {
    const target = step.trim();
    return target ? target : null;
  }

  const keyboardAction = normalizeKeyboardAction(step);
  if (keyboardAction) {
    return keyboardAction;
  }

  const clickStep = normalizeRecordedStep(step);
  if (!clickStep || clickStep.type !== "click") {
    return null;
  }

  const target = clickMode === "element" ? clickStep.selector : clickStep.position;
  return target ? {
    type: "click",
    target,
    targetMode: clickMode,
    frameId: Number.isInteger(clickStep.frameId) ? clickStep.frameId : null,
    documentId: typeof clickStep.documentId === "string" ? clickStep.documentId : null
  } : null;
}

function formatKeyboardIdentity(action) {
  if (action.key === "Meta" || action.code === "MetaLeft" || action.code === "MetaRight") {
    return "Cmd";
  }

  if (action.key === " " || action.code === "Space") {
    return "Space";
  }

  return action.code || action.key;
}

function formatStepLabel(step, clickMode) {
  const keyboardAction = normalizeKeyboardAction(step);
  if (keyboardAction) {
    const identity = formatKeyboardIdentity(keyboardAction);
    return `${keyboardAction.type}: ${identity}`;
  }

  if (typeof step === "string") {
    return step;
  }

  if (!step || typeof step !== "object") {
    return "";
  }

  return clickMode === "element" ? (step.selector ?? "") : (step.position ?? "");
}

function normalizeRepeatInput(input) {
  input.value = String(normalizeRepeats(input.value));
}

function setEditDisplayMoves(enabled) {
  const displayMovesEnabled = Boolean(enabled);
  refs.editDisplayMoves.checked = displayMovesEnabled;
  refs.editDisplayMovesIcon.innerHTML = displayMovesEnabled ? iconSet.eye : iconSet.eyeOff;
  refs.editDisplayMovesLabel.textContent = t(displayMovesEnabled ? "visible" : "stealth");
  refs.editDisplayMovesToggle.classList.toggle("display-moves-on", displayMovesEnabled);
  refs.editDisplayMovesToggle.classList.toggle("display-moves-off", !displayMovesEnabled);
  const displayMovesTitle = t(displayMovesEnabled ? "visualisationVisible" : "visualisationStealth");
  refs.editDisplayMovesToggle.setAttribute("title", displayMovesTitle);
  refs.editDisplayMovesToggle.setAttribute("aria-label", displayMovesTitle);
  refs.editDisplayMovesToggle.setAttribute("aria-pressed", String(displayMovesEnabled));
}

function setEditMode(mode) {
  state.editMode = mode === "element" ? "element" : "position";
  refs.editModeIcon.innerHTML = state.editMode === "element" ? iconSet.code : iconSet.crosshair;
  refs.editModeLabel.textContent = t(state.editMode === "element" ? "element" : "position");
  const modeTitle = t(state.editMode === "element" ? "modeElement" : "modePosition");
  refs.editModeToggle.setAttribute("title", modeTitle);
  refs.editModeToggle.setAttribute("aria-label", modeTitle);
  refs.editModeToggle.setAttribute("aria-pressed", String(state.editMode === "element"));
}

function setEditDefault(enabled) {
  const isDefault = Boolean(enabled);
  refs.editDefault.checked = isDefault;
  refs.editDefaultIcon.innerHTML = iconSet.star;
  refs.editDefaultToggle.classList.toggle("active", isDefault);
  const defaultTitle = t(isDefault ? "defaultOn" : "defaultOff");
  refs.editDefaultToggle.setAttribute("title", defaultTitle);
  refs.editDefaultToggle.setAttribute("aria-label", defaultTitle);
  refs.editDefaultToggle.setAttribute("aria-pressed", String(isDefault));
}

function buildDefaultClickName() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);
  return `Clicks ${date} ${time}`;
}

function createClickId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `click-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    ext.runtime.sendMessage(message, (response) => {
      if (ext.runtime.lastError) {
        resolve({ ok: false });
        return;
      }

      resolve(response ?? { ok: false });
    });
  });
}

async function getActiveTab() {
  const tabs = await ext.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

async function readClicksFromStorage() {
  try {
    const data = await ext.storage.local.get(STORAGE_KEY);
    const storedClicks = data?.[STORAGE_KEY];
    if (!Array.isArray(storedClicks)) {
      return [];
    }

    return storedClicks
      .filter((item) => item && typeof item.id === "string" && typeof item.name === "string")
      .map((item) => ({
        ...item,
        displayMoves: Boolean(item.displayMoves ?? item.trackMoves),
        trackMoves: Boolean(item.trackMoves)
      }));
  } catch {
    return [];
  }
}

async function readDefaultClickIdFromStorage() {
  try {
    const data = await ext.storage.local.get(DEFAULT_CLICK_ID_KEY);
    return typeof data?.[DEFAULT_CLICK_ID_KEY] === "string" ? data[DEFAULT_CLICK_ID_KEY] : null;
  } catch {
    return null;
  }
}

async function persistClicks() {
  await ext.storage.local.set({ [STORAGE_KEY]: clicks });
}

async function persistDefaultClickId() {
  await ext.storage.local.set({ [DEFAULT_CLICK_ID_KEY]: defaultClickId });
}

async function loadClicks() {
  const storedClicks = await readClicksFromStorage();
  clicks.length = 0;
  clicks.push(...storedClicks);

  defaultClickId = await readDefaultClickIdFromStorage();
  if (defaultClickId && !clicks.some((macro) => macro.id === defaultClickId)) {
    defaultClickId = null;
    await persistDefaultClickId();
  }

  if (defaultClickId) {
    const defaultIndex = clicks.findIndex((macro) => macro.id === defaultClickId);
    if (defaultIndex > 0) {
      const [defaultClick] = clicks.splice(defaultIndex, 1);
      clicks.unshift(defaultClick);
    }
  }
}

async function readSettingsFromStorage() {
  try {
    const data = await ext.storage.local.get(SETTINGS_KEY);
    const stored = data?.[SETTINGS_KEY];
    if (stored && typeof stored === "object") {
      if (EXECUTION_SPEED_VALUES.includes(stored.executionSpeed)) {
        settings.executionSpeed = stored.executionSpeed;
      }
      if (typeof stored.clickSound === "boolean") {
        settings.clickSound = stored.clickSound;
      }
      if (typeof stored.skipNewClickExplanation === "boolean") {
        settings.skipNewClickExplanation = stored.skipNewClickExplanation;
      }
      if (typeof stored.skipDisplayMovesExplanation === "boolean") {
        settings.skipDisplayMovesExplanation = stored.skipDisplayMovesExplanation;
      }
      if (typeof stored.skipModeExplanation === "boolean") {
        settings.skipModeExplanation = stored.skipModeExplanation;
      }
      if (typeof stored.darkTheme === "boolean") {
        settings.darkTheme = stored.darkTheme;
      }
    }
  } catch {}
}

async function persistSettings() {
  await ext.storage.local.set({ [SETTINGS_KEY]: { ...settings } });
}

function syncSettingsUI() {
  refs.settingExecutionSpeed.textContent = `${settings.executionSpeed}×`;
  refs.settingClickSound.checked = settings.clickSound;
  refs.settingSkipNewRecording.checked = settings.skipNewClickExplanation;
  refs.settingSkipDisplayMoves.checked = settings.skipDisplayMovesExplanation;
  refs.settingSkipMode.checked = settings.skipModeExplanation;
  refs.settingDarkTheme.checked = settings.darkTheme;
  document.documentElement.classList.toggle("dark-theme", settings.darkTheme);
}

async function cleanupLegacyTrackMovesSetting() {
  await ext.storage.local.remove("track_moves_enabled");
}

async function setDefaultClick(macroId, enabled = true) {
  const macro = clicks.find((item) => item.id === macroId);
  if (!macro) {
    setStatus(t("notFound"));
    return;
  }

  defaultClickId = enabled ? macroId : null;
  await persistDefaultClickId();
  render();
  setStatus(enabled ? t("defaultSet", { name: macro.name }) : t("defaultUnset"));
}
