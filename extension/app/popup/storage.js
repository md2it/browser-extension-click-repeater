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

function normalizeRepeatInput(input) {
  input.value = String(normalizeRepeats(input.value));
}

function setEditDisplayMoves(enabled) {
  const displayMovesEnabled = Boolean(enabled);
  refs.editDisplayMoves.checked = displayMovesEnabled;
  refs.editDisplayMovesIcon.innerHTML = displayMovesEnabled ? iconSet.eye : iconSet.eyeOff;
  refs.editDisplayMovesLabel.textContent = displayMovesEnabled ? "Visible" : "Stealth";
  refs.editDisplayMovesToggle.classList.toggle("display-moves-on", displayMovesEnabled);
  refs.editDisplayMovesToggle.classList.toggle("display-moves-off", !displayMovesEnabled);
  const displayMovesTitle = displayMovesEnabled ? "Visualisation: Visible" : "Visualisation: Stealth";
  refs.editDisplayMovesToggle.setAttribute("title", displayMovesTitle);
  refs.editDisplayMovesToggle.setAttribute("aria-label", displayMovesTitle);
  refs.editDisplayMovesToggle.setAttribute("aria-pressed", String(displayMovesEnabled));
}

function setEditMode(mode) {
  state.editMode = mode === "element" ? "element" : "position";
  refs.editModeIcon.innerHTML = state.editMode === "element" ? iconSet.code : iconSet.crosshair;
  refs.editModeLabel.textContent = state.editMode === "element" ? "Element" : "Position";
  const modeTitle = state.editMode === "element" ? "Mode: Element" : "Mode: Position";
  refs.editModeToggle.setAttribute("title", modeTitle);
  refs.editModeToggle.setAttribute("aria-label", modeTitle);
  refs.editModeToggle.setAttribute("aria-pressed", String(state.editMode === "element"));
}

function setEditDefault(enabled) {
  const isDefault = Boolean(enabled);
  refs.editDefault.checked = isDefault;
  refs.editDefaultIcon.innerHTML = iconSet.star;
  refs.editDefaultToggle.classList.toggle("active", isDefault);
  const defaultTitle = isDefault ? "Default: on" : "Default: off";
  refs.editDefaultToggle.setAttribute("title", defaultTitle);
  refs.editDefaultToggle.setAttribute("aria-label", defaultTitle);
  refs.editDefaultToggle.setAttribute("aria-pressed", String(isDefault));
}

function buildDefaultMacroName() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);
  return `Macro ${date} ${time}`;
}

function createMacroId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `macro-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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

async function readMacrosFromStorage() {
  try {
    const data = await ext.storage.local.get(STORAGE_KEY);
    const storedMacros = data?.[STORAGE_KEY];
    if (!Array.isArray(storedMacros)) {
      return [];
    }

    return storedMacros
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

async function readDefaultMacroIdFromStorage() {
  try {
    const data = await ext.storage.local.get(DEFAULT_MACRO_ID_KEY);
    return typeof data?.[DEFAULT_MACRO_ID_KEY] === "string" ? data[DEFAULT_MACRO_ID_KEY] : null;
  } catch {
    return null;
  }
}

async function persistMacros() {
  await ext.storage.local.set({ [STORAGE_KEY]: macros });
}

async function persistDefaultMacroId() {
  await ext.storage.local.set({ [DEFAULT_MACRO_ID_KEY]: defaultMacroId });
}

async function loadMacros() {
  const storedMacros = await readMacrosFromStorage();
  macros.length = 0;
  macros.push(...storedMacros);

  defaultMacroId = await readDefaultMacroIdFromStorage();
  if (defaultMacroId && !macros.some((macro) => macro.id === defaultMacroId)) {
    defaultMacroId = null;
    await persistDefaultMacroId();
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
      if (typeof stored.skipNewMacroExplanation === "boolean") {
        settings.skipNewMacroExplanation = stored.skipNewMacroExplanation;
      }
      if (typeof stored.skipDisplayMovesExplanation === "boolean") {
        settings.skipDisplayMovesExplanation = stored.skipDisplayMovesExplanation;
      }
      if (typeof stored.skipModeExplanation === "boolean") {
        settings.skipModeExplanation = stored.skipModeExplanation;
      }
    }
  } catch {}
}

async function persistSettings() {
  await ext.storage.local.set({ [SETTINGS_KEY]: { ...settings } });
}

function syncSettingsUI() {
  refs.settingExecutionSpeed.textContent = `${settings.executionSpeed}×`;
  refs.settingSkipNewMacro.checked = settings.skipNewMacroExplanation;
  refs.settingSkipDisplayMoves.checked = settings.skipDisplayMovesExplanation;
  refs.settingSkipMode.checked = settings.skipModeExplanation;
}

async function cleanupLegacyTrackMovesSetting() {
  await ext.storage.local.remove("track_moves_enabled");
}

async function setDefaultMacro(macroId, enabled = true) {
  const macro = macros.find((item) => item.id === macroId);
  if (!macro) {
    setStatus("Macros не найден.");
    return;
  }

  defaultMacroId = enabled ? macroId : null;
  await persistDefaultMacroId();
  render();
  setStatus(enabled ? `Дефолтный macros: ${macro.name}` : "Дефолтный macros не задан.");
}
