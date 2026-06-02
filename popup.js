const STORAGE_KEY = "macros_list";
const macros = [];

const state = {
  modalMode: null,
  editMacroId: null,
  deleteMacroId: null
};

const refs = {
  popup: document.querySelector(".popup"),
  list: document.getElementById("macros-list"),
  status: document.getElementById("status-line"),
  defaultName: document.getElementById("default-macro-name"),
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
  cancelDeleteBtn: document.getElementById("cancel-delete-btn")
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

async function persistMacros() {
  await chrome.storage.local.set({ [STORAGE_KEY]: macros });
}

async function loadMacros() {
  const storedMacros = await readMacrosFromStorage();
  macros.length = 0;
  macros.push(...storedMacros);
}

function syncPopupHeight() {
  const minHeightPx = parseFloat(window.getComputedStyle(document.body).minHeight) || 0;
  const popupHeight = refs.popup ? refs.popup.scrollHeight : 0;
  const editModalHeight = refs.editModal.classList.contains("hidden") ? 0 : refs.editModal.scrollHeight;
  const deleteModalHeight = refs.deleteModal.classList.contains("hidden") ? 0 : refs.deleteModal.scrollHeight;
  const targetHeight = Math.max(minHeightPx, popupHeight, editModalHeight, deleteModalHeight);

  if (!targetHeight) {
    return;
  }

  document.documentElement.style.height = `${targetHeight}px`;
  document.body.style.height = `${targetHeight}px`;
}

function render() {
  refs.list.innerHTML = "";
  refs.defaultName.textContent = "Не задан";

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
        <span class="macro-name">${macro.name}</span>
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
    setStatus("Исполнение macros будет в отдельной итерации.");
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
  openEditModal(null);
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

  macros.splice(idx, 1);
  await persistMacros();
  closeDeleteModal();
  render();
  setStatus("Macros удален.");
});

refs.cancelDeleteBtn.addEventListener("click", () => {
  closeDeleteModal();
  setStatus("Удаление отменено.");
});

async function init() {
  await loadMacros();
  render();
  setStatus("Нажмите NEW macros, чтобы создать первый макрос.");
}

init();
