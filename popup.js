const mockMacros = [
  {
    id: "macro-1",
    name: "Клик по карточкам",
    repeats: 3,
    steps: ["Открыть страницу", "Клик по карточке", "Вернуться назад"],
    isDefault: true
  },
  {
    id: "macro-2",
    name: "Проверка кнопок",
    repeats: 1,
    steps: ["Открыть раздел", "Кликнуть действие"]
  }
];

const state = {
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
  pencil: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" /></svg>',
  trash: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6" /><path d="M14 11v6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>',
  squarePen: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" /></svg>'
};

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

function getDefaultMacro() {
  return mockMacros.find((macro) => macro.isDefault) ?? null;
}

function render() {
  refs.list.innerHTML = "";

  const defaultMacro = getDefaultMacro();
  refs.defaultName.textContent = defaultMacro ? defaultMacro.name : "Не выбран";

  for (const macro of mockMacros) {
    const row = document.createElement("li");
    row.className = "macro-row";
    row.innerHTML = `
      <div class="macro-main">
        <button class="icon-btn" type="button" data-action="run" data-id="${macro.id}" title="Запуск режима исполнения">${iconSet.play}</button>
        <span class="macro-name ${macro.isDefault ? "default" : ""}">${macro.name}</span>
      </div>
      <div class="macro-actions">
        <button class="icon-btn" type="button" data-action="set-default" data-id="${macro.id}" title="Сделать дефолтным">${iconSet.squarePen}</button>
        <button class="icon-btn" type="button" data-action="edit" data-id="${macro.id}" title="Редактировать">${iconSet.pencil}</button>
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
  const macro = mockMacros.find((item) => item.id === macroId);
  if (!macro) {
    return;
  }

  state.editMacroId = macroId;
  refs.editName.value = macro.name;
  refs.editRepeats.value = String(macro.repeats);
  renderEditSteps(macro.steps);
  refs.editModal.classList.remove("hidden");
  syncPopupHeight();
}

function closeEditModal() {
  state.editMacroId = null;
  refs.editModal.classList.add("hidden");
  syncPopupHeight();
}

function openDeleteModal(macroId) {
  const macro = mockMacros.find((item) => item.id === macroId);
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

function setDefaultMacro(macroId) {
  for (const macro of mockMacros) {
    macro.isDefault = macro.id === macroId;
  }
  render();
  setStatus("Дефолтный macros обновлен (dev-заглушка).");
}

function renderEditSteps(steps) {
  refs.editSteps.innerHTML = "";

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

function mutateStep(stepAction, stepIndex) {
  const macro = mockMacros.find((item) => item.id === state.editMacroId);
  if (!macro) {
    return;
  }

  const steps = [...macro.steps];
  if (stepAction === "up" && stepIndex > 0) {
    [steps[stepIndex - 1], steps[stepIndex]] = [steps[stepIndex], steps[stepIndex - 1]];
  }
  if (stepAction === "down" && stepIndex < steps.length - 1) {
    [steps[stepIndex + 1], steps[stepIndex]] = [steps[stepIndex], steps[stepIndex + 1]];
  }
  if (stepAction === "delete") {
    steps.splice(stepIndex, 1);
  }

  macro.steps = steps;
  renderEditSteps(macro.steps);
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
    setStatus(`Запуск ${macroId} (dev-заглушка).`);
    return;
  }

  if (action === "set-default") {
    setDefaultMacro(macroId);
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
  setStatus("Создание нового macros будет добавлено в следующей итерации.");
});

refs.editSteps.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) {
    return;
  }

  const stepAction = target.dataset.stepAction;
  const stepIndex = Number(target.dataset.stepIndex);
  if (!stepAction || Number.isNaN(stepIndex)) {
    return;
  }

  mutateStep(stepAction, stepIndex);
});

refs.saveEditBtn.addEventListener("click", () => {
  const macro = mockMacros.find((item) => item.id === state.editMacroId);
  if (!macro) {
    return;
  }

  macro.name = refs.editName.value.trim() || macro.name;
  macro.repeats = Number(refs.editRepeats.value) > 0 ? Number(refs.editRepeats.value) : macro.repeats;
  setStatus("Изменения сохранены (dev-заглушка, без storage).");
  closeEditModal();
  render();
});

refs.cancelEditBtn.addEventListener("click", () => {
  closeEditModal();
  setStatus("Редактирование отменено.");
});

refs.confirmDeleteBtn.addEventListener("click", () => {
  const idx = mockMacros.findIndex((item) => item.id === state.deleteMacroId);
  if (idx < 0) {
    return;
  }

  const wasDefault = mockMacros[idx].isDefault;
  mockMacros.splice(idx, 1);
  if (wasDefault && mockMacros.length > 0) {
    mockMacros[0].isDefault = true;
  }

  closeDeleteModal();
  render();
  setStatus("Macros удален (dev-заглушка, без storage).");
});

refs.cancelDeleteBtn.addEventListener("click", () => {
  closeDeleteModal();
  setStatus("Удаление отменено.");
});

render();
syncPopupHeight();
