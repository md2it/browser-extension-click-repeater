const STORAGE_KEY = "macros_list";
const DEFAULT_MACRO_ID_KEY = "default_macro_id";
const macros = [];
let defaultMacroId = null;

const state = {
  modalMode: null,
  editMacroId: null,
  deleteMacroId: null,
  executionPollTimer: null
};

const refs = {
  popup: document.querySelector(".popup"),
  list: document.getElementById("macros-list"),
  status: document.getElementById("status-line"),
  defaultName: document.getElementById("default-macro-name"),
  defaultEditBtn: document.getElementById("default-macro-edit-btn"),
  stopExecutionBtn: document.getElementById("stop-execution-btn"),
  newMacroBtn: document.getElementById("new-macro-btn"),
  editModal: document.getElementById("edit-modal"),
  editModalTitle: document.getElementById("edit-modal-title"),
  editName: document.getElementById("edit-name"),
  editRepeats: document.getElementById("edit-repeats"),
  editSteps: document.getElementById("edit-steps"),
  deleteModal: document.getElementById("delete-modal"),
  deleteMacroName: document.getElementById("delete-macro-name"),
  saveEditBtn: document.getElementById("save-edit-btn"),
  cancelEditBtn: document.getElementById("cancel-edit-btn"),
  confirmDeleteBtn: document.getElementById("confirm-delete-btn"),
  cancelDeleteBtn: document.getElementById("cancel-delete-btn"),
  recordModeModal: document.getElementById("record-mode-modal"),
  recordCoordsBtn: document.getElementById("record-coords-btn"),
  recordSelectorsBtn: document.getElementById("record-selectors-btn"),
  recordCancelBtn: document.getElementById("record-cancel-btn"),
  defaultModal: document.getElementById("default-modal"),
  defaultRadioList: document.getElementById("default-macro-radio-list"),
  saveDefaultBtn: document.getElementById("save-default-btn"),
  cancelDefaultBtn: document.getElementById("cancel-default-btn")
};

const iconSet = {
  // Icons copied from official Lucide repository.
  play: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" /></svg>',
  trash: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6" /><path d="M14 11v6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>',
  squarePen: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" /></svg>'
};

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
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false });
        return;
      }

      resolve(response ?? { ok: false });
    });
  });
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

async function readMacrosFromStorage() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const storedMacros = data?.[STORAGE_KEY];
    if (!Array.isArray(storedMacros)) {
      return [];
    }

    return storedMacros.filter((item) => item && typeof item.id === "string" && typeof item.name === "string");
  } catch {
    return [];
  }
}

async function readDefaultMacroIdFromStorage() {
  try {
    const data = await chrome.storage.local.get(DEFAULT_MACRO_ID_KEY);
    return typeof data?.[DEFAULT_MACRO_ID_KEY] === "string" ? data[DEFAULT_MACRO_ID_KEY] : null;
  } catch {
    return null;
  }
}

async function persistMacros() {
  await chrome.storage.local.set({ [STORAGE_KEY]: macros });
}

async function persistDefaultMacroId() {
  await chrome.storage.local.set({ [DEFAULT_MACRO_ID_KEY]: defaultMacroId });
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

function getDefaultMacro() {
  return defaultMacroId ? macros.find((macro) => macro.id === defaultMacroId) ?? null : null;
}

async function setDefaultMacro(macroId) {
  const macro = macros.find((item) => item.id === macroId);
  if (!macro) {
    setStatus("Macros не найден.");
    return;
  }

  defaultMacroId = macroId;
  await persistDefaultMacroId();
  render();
  setStatus(`Дефолтный macros: ${macro.name}`);
}

function syncPopupHeight() {
  const minHeightPx = parseFloat(window.getComputedStyle(document.body).minHeight) || 0;
  const popupHeight = refs.popup ? refs.popup.scrollHeight : 0;
  const editModalHeight = refs.editModal.classList.contains("hidden") ? 0 : refs.editModal.scrollHeight;
  const deleteModalHeight = refs.deleteModal.classList.contains("hidden") ? 0 : refs.deleteModal.scrollHeight;
  const recordModeModalHeight = refs.recordModeModal.classList.contains("hidden") ? 0 : refs.recordModeModal.scrollHeight;
  const defaultModalHeight = refs.defaultModal.classList.contains("hidden") ? 0 : refs.defaultModal.scrollHeight;
  const targetHeight = Math.max(
    minHeightPx,
    popupHeight,
    editModalHeight,
    deleteModalHeight,
    recordModeModalHeight,
    defaultModalHeight
  );

  if (!targetHeight) {
    return;
  }

  document.documentElement.style.height = `${targetHeight}px`;
  document.body.style.height = `${targetHeight}px`;
}

function clearExecutionPolling() {
  if (state.executionPollTimer !== null) {
    window.clearInterval(state.executionPollTimer);
    state.executionPollTimer = null;
  }
}

function formatRemainingMs(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderExecutionStatus(executionState) {
  if (!executionState?.isRunning) {
    refs.stopExecutionBtn.classList.add("hidden");
    syncPopupHeight();
    return;
  }

  refs.stopExecutionBtn.classList.remove("hidden");
  const remaining = formatRemainingMs(executionState.remainingMs ?? 0);
  setStatus(`Выполняется "${executionState.macroName}". Осталось: ${remaining}`);
}

async function refreshExecutionStatus({ silent = false } = {}) {
  const response = await sendRuntimeMessage({ type: "execution-status" });
  const executionState = response?.state ?? null;

  if (executionState?.isRunning) {
    renderExecutionStatus(executionState);
    if (state.executionPollTimer === null) {
      state.executionPollTimer = window.setInterval(() => {
        void refreshExecutionStatus({ silent: true });
      }, 1000);
    }
    return;
  }

  clearExecutionPolling();
  refs.stopExecutionBtn.classList.add("hidden");
  if (!silent) {
    if (response?.lastEvent === "completed" && response.completedMacroName) {
      setStatus(`Выполнение "${response.completedMacroName}" завершено.`);
    } else if (response?.lastEvent === "stopped" && response.stoppedMacroName) {
      setStatus(`Выполнение "${response.stoppedMacroName}" остановлено.`);
    }
  } else {
    syncPopupHeight();
  }
}

async function startExecution(macroId) {
  const macro = macros.find((item) => item.id === macroId);
  if (!macro) {
    setStatus("Macros не найден.");
    return;
  }

  const response = await sendRuntimeMessage({
    type: "execution-start",
    macroId: macro.id,
    macroName: macro.name,
    repeats: macro.repeats
  });

  if (!response?.ok) {
    if (response?.error === "already_running") {
      renderExecutionStatus(response.state);
      setStatus(`Уже выполняется "${response.state?.macroName ?? "макрос"}".`);
      return;
    }

    setStatus("Не удалось запустить выполнение macros.");
    return;
  }

  renderExecutionStatus(response.state);
  setStatus(`Запущено выполнение "${macro.name}".`);
  await refreshExecutionStatus({ silent: true });
}

async function stopExecution() {
  const response = await sendRuntimeMessage({ type: "execution-stop" });
  if (!response?.ok) {
    setStatus("Не удалось остановить выполнение.");
    return;
  }

  clearExecutionPolling();
  refs.stopExecutionBtn.classList.add("hidden");
  if (response.wasRunning && response.stoppedMacroName) {
    setStatus(`Выполнение "${response.stoppedMacroName}" остановлено.`);
  } else {
    setStatus("Активного выполнения нет.");
  }
}

function render() {
  refs.list.innerHTML = "";
  const defaultMacro = getDefaultMacro();
  refs.defaultName.textContent = defaultMacro ? defaultMacro.name : "Не задан";
  refs.defaultEditBtn.innerHTML = iconSet.squarePen;
  refs.defaultEditBtn.disabled = macros.length === 0;

  if (macros.length === 0) {
    const emptyRow = document.createElement("li");
    emptyRow.className = "macro-row";
    emptyRow.textContent = "Список пуст. Нажмите NEW macros, чтобы создать первый.";
    refs.list.append(emptyRow);
    syncPopupHeight();
    return;
  }

  for (const macro of macros) {
    const row = document.createElement("li");
    row.className = "macro-row";
    row.innerHTML = `
      <div class="macro-main">
        <button class="icon-btn" type="button" data-action="run" data-id="${macro.id}" title="Запуск режима исполнения">${iconSet.play}</button>
        <span class="macro-name ${macro.id === defaultMacroId ? "default" : ""}">${macro.name}</span>
      </div>
      <div class="macro-actions">
        <button class="icon-btn" type="button" data-action="edit" data-id="${macro.id}" title="Редактировать">${iconSet.squarePen}</button>
        <button class="icon-btn" type="button" data-action="delete" data-id="${macro.id}" title="Удалить">${iconSet.trash}</button>
      </div>
    `;
    refs.list.append(row);
  }

  syncPopupHeight();
}

function setStatus(text) {
  refs.status.textContent = text;
  syncPopupHeight();
}

function openEditModal(macroId) {
  if (macroId !== null) {
    const macro = macros.find((item) => item.id === macroId);
    if (!macro) {
      setStatus("Macros не найден.");
      return;
    }

    state.modalMode = "edit";
    state.editMacroId = macro.id;
    refs.editModalTitle.textContent = "Редактирование macros";
    refs.editName.value = macro.name;
    refs.editRepeats.value = String(macro.repeats ?? 1);
    renderEditSteps(Array.isArray(macro.steps) ? macro.steps : []);
    refs.editModal.classList.remove("hidden");
    syncPopupHeight();
    return;
  }

  state.modalMode = "create";
  state.editMacroId = null;
  refs.editModalTitle.textContent = "Создание macros";
  refs.editName.value = buildDefaultMacroName();
  refs.editRepeats.value = "1";
  renderEditSteps([]);
  refs.editModal.classList.remove("hidden");
  syncPopupHeight();
}

function closeEditModal() {
  state.modalMode = null;
  state.editMacroId = null;
  refs.editModal.classList.add("hidden");
  syncPopupHeight();
}

function openDeleteModal(macroId) {
  const macro = macros.find((item) => item.id === macroId);
  if (!macro) {
    return;
  }

  state.deleteMacroId = macroId;
  refs.deleteMacroName.textContent = macro.name;
  refs.deleteModal.classList.remove("hidden");
  syncPopupHeight();
}

function closeDeleteModal() {
  state.deleteMacroId = null;
  refs.deleteModal.classList.add("hidden");
  syncPopupHeight();
}

function openRecordModeModal() {
  refs.recordModeModal.classList.remove("hidden");
  syncPopupHeight();
}

function closeRecordModeModal() {
  refs.recordModeModal.classList.add("hidden");
  syncPopupHeight();
}

function openDefaultModal() {
  if (macros.length === 0) {
    setStatus("Список macros пуст.");
    return;
  }

  refs.defaultRadioList.innerHTML = "";
  for (const macro of macros) {
    const optionLabel = document.createElement("label");
    optionLabel.className = "default-radio-option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "default-macro-id";
    input.value = macro.id;
    input.className = "default-radio-input";

    const box = document.createElement("span");
    box.className = "default-radio-box";
    box.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.className = "default-radio-text";
    text.textContent = macro.name;

    optionLabel.append(input, box, text);
    refs.defaultRadioList.append(optionLabel);
  }

  const selectedId = defaultMacroId && macros.some((macro) => macro.id === defaultMacroId) ? defaultMacroId : macros[0].id;
  const radioInputs = refs.defaultRadioList.querySelectorAll("input[name='default-macro-id']");
  for (const input of radioInputs) {
    if (input.value === selectedId) {
      input.checked = true;
      break;
    }
  }
  refs.defaultModal.classList.remove("hidden");
  syncPopupHeight();
}

function closeDefaultModal() {
  refs.defaultModal.classList.add("hidden");
  syncPopupHeight();
}

function closeModalByEscape() {
  if (!refs.editModal.classList.contains("hidden")) {
    closeEditModal();
    setStatus("Редактирование отменено.");
    return true;
  }

  if (!refs.deleteModal.classList.contains("hidden")) {
    closeDeleteModal();
    setStatus("Удаление отменено.");
    return true;
  }

  if (!refs.defaultModal.classList.contains("hidden")) {
    closeDefaultModal();
    setStatus("Выбор дефолтного macros отменен.");
    return true;
  }

  if (!refs.recordModeModal.classList.contains("hidden")) {
    closeRecordModeModal();
    setStatus("Создание macros отменено.");
    return true;
  }

  return false;
}

async function startCreateMode(mode) {
  const activeTab = await getActiveTab();
  if (!activeTab || !Number.isInteger(activeTab.id)) {
    setStatus("Активная вкладка не найдена.");
    return;
  }

  const response = await sendRuntimeMessage({
    type: "recording-start",
    mode,
    tabId: activeTab.id,
    url: activeTab.url
  });

  if (!response?.ok) {
    setStatus("Не удалось запустить режим создания.");
    return;
  }

  closeRecordModeModal();
  window.close();
}

async function completeCreateModeIfNeeded() {
  const response = await sendRuntimeMessage({ type: "recording-stop" });
  if (!response?.ok || !response.hasSession) {
    return null;
  }

  const createdMacro = {
    id: createMacroId(),
    name: typeof response.macroName === "string" && response.macroName.trim() ? response.macroName : buildDefaultMacroName(),
    repeats: 1,
    steps: Array.isArray(response.steps) ? response.steps.filter((step) => typeof step === "string") : []
  };

  macros.unshift(createdMacro);
  await persistMacros();
  return createdMacro;
}

function renderEditSteps(steps) {
  refs.editSteps.innerHTML = "";

  if (steps.length === 0) {
    const li = document.createElement("li");
    li.className = "step-row";
    li.textContent = "Шаги отсутствуют.";
    refs.editSteps.append(li);
    syncPopupHeight();
    return;
  }

  steps.forEach((step, index) => {
    const li = document.createElement("li");
    li.className = "step-row";
    li.innerHTML = `
      <span>${step}</span>
      <span class="step-actions">
        <button class="icon-btn" type="button" data-step-action="up" data-step-index="${index}" title="Переместить выше">↑</button>
        <button class="icon-btn" type="button" data-step-action="down" data-step-index="${index}" title="Переместить ниже">↓</button>
        <button class="icon-btn" type="button" data-step-action="delete" data-step-index="${index}" title="Удалить шаг">✕</button>
      </span>
    `;
    refs.editSteps.append(li);
  });

  syncPopupHeight();
}

refs.list.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) {
    return;
  }

  const macroId = target.dataset.id;
  const action = target.dataset.action;
  if (!macroId || !action) {
    return;
  }

  if (action === "run") {
    void startExecution(macroId);
    return;
  }

  if (action === "edit") {
    openEditModal(macroId);
    return;
  }

  if (action === "delete") {
    openDeleteModal(macroId);
  }
});

refs.newMacroBtn.addEventListener("click", () => {
  openRecordModeModal();
});

refs.stopExecutionBtn.addEventListener("click", () => {
  void stopExecution();
});

refs.defaultEditBtn.addEventListener("click", () => {
  openDefaultModal();
});

refs.saveEditBtn.addEventListener("click", async () => {
  const name = refs.editName.value.trim();
  if (!name) {
    setStatus("Введите название macros.");
    return;
  }

  const repeats = Number(refs.editRepeats.value);
  const validRepeats = Number.isFinite(repeats) && repeats > 0 ? repeats : 1;

  if (state.modalMode === "edit" && state.editMacroId) {
    const macro = macros.find((item) => item.id === state.editMacroId);
    if (!macro) {
      setStatus("Macros не найден для сохранения.");
      closeEditModal();
      return;
    }

    macro.name = name;
    macro.repeats = validRepeats;
    if (!Array.isArray(macro.steps)) {
      macro.steps = [];
    }
    await persistMacros();
    closeEditModal();
    render();
    setStatus("Macros обновлен.");
    return;
  }

  if (state.modalMode !== "create") {
    setStatus("Сохранение недоступно: режим не выбран.");
    return;
  }

  macros.unshift({
    id: createMacroId(),
    name,
    repeats: validRepeats,
    steps: []
  });
  await persistMacros();
  closeEditModal();
  render();
  setStatus("Macros сохранен и добавлен в список.");
});

refs.cancelEditBtn.addEventListener("click", () => {
  closeEditModal();
  setStatus("Редактирование отменено.");
});

refs.confirmDeleteBtn.addEventListener("click", async () => {
  const idx = macros.findIndex((item) => item.id === state.deleteMacroId);
  if (idx < 0) {
    return;
  }

  const deletedMacro = macros[idx];
  macros.splice(idx, 1);
  if (deletedMacro && deletedMacro.id === defaultMacroId) {
    defaultMacroId = null;
    await persistDefaultMacroId();
  }
  await persistMacros();
  closeDeleteModal();
  render();
  setStatus("Macros удален.");
});

refs.cancelDeleteBtn.addEventListener("click", () => {
  closeDeleteModal();
  setStatus("Удаление отменено.");
});

refs.recordCoordsBtn.addEventListener("click", () => {
  void startCreateMode("coordinates");
});

refs.recordSelectorsBtn.addEventListener("click", () => {
  void startCreateMode("selectors");
});

refs.recordCancelBtn.addEventListener("click", () => {
  closeRecordModeModal();
  setStatus("Создание macros отменено.");
});

refs.saveDefaultBtn.addEventListener("click", async () => {
  const selectedInput = refs.defaultRadioList.querySelector("input[name='default-macro-id']:checked");
  const selectedId = selectedInput ? selectedInput.value : "";
  if (!selectedId) {
    setStatus("Выберите macros.");
    return;
  }

  await setDefaultMacro(selectedId);
  closeDefaultModal();
});

refs.cancelDefaultBtn.addEventListener("click", () => {
  closeDefaultModal();
  setStatus("Выбор дефолтного macros отменен.");
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  const didClose = closeModalByEscape();
  if (didClose) {
    event.preventDefault();
    event.stopPropagation();
  }
});

async function init() {
  await loadMacros();
  const createdMacro = await completeCreateModeIfNeeded();
  render();
  await refreshExecutionStatus({ silent: true });
  if (createdMacro) {
    openEditModal(createdMacro.id);
    setStatus("Создание завершено. Проверьте и сохраните параметры macros.");
    return;
  }

  setStatus("Нажмите NEW macros, чтобы запустить запись кликов.");
}

init();
