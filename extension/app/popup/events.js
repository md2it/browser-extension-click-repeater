let drag = null;

function onDragMove(event) {
  if (!drag) {
    return;
  }

  const deltaY = event.clientY - drag.startY;
  drag.item.style.transform = `translateY(${deltaY}px)`;

  const dragCenter = drag.rects[drag.dragIndex].top + drag.rects[drag.dragIndex].height / 2 + deltaY;
  let newSlot = 0;
  let minDist = Infinity;
  for (let i = 0; i < drag.items.length; i++) {
    const dist = Math.abs(dragCenter - (drag.rects[i].top + drag.rects[i].height / 2));
    if (dist < minDist) {
      minDist = dist;
      newSlot = i;
    }
  }

  drag.currentSlot = newSlot;

  for (let i = 0; i < drag.items.length; i++) {
    if (i === drag.dragIndex) {
      continue;
    }
    let shift = 0;
    if (newSlot > drag.dragIndex && i > drag.dragIndex && i <= newSlot) {
      shift = -drag.slotHeight;
    } else if (newSlot < drag.dragIndex && i >= newSlot && i < drag.dragIndex) {
      shift = drag.slotHeight;
    }
    drag.items[i].style.transform = shift ? `translateY(${shift}px)` : "";
  }
}

function onDragEnd() {
  document.removeEventListener("pointermove", onDragMove);
  document.removeEventListener("pointerup", onDragEnd);
  document.removeEventListener("pointercancel", onDragEnd);
  document.body.style.cursor = "";

  if (!drag) {
    return;
  }

  const { dragIndex, currentSlot, clickId, items, item } = drag;
  drag = null;

  for (const el of items) {
    el.style.transform = "";
    el.style.transition = "";
    el.style.position = "";
    el.style.zIndex = "";
  }

  const card = item.querySelector(".click-row");
  if (card) {
    card.style.boxShadow = "";
  }

  if (dragIndex !== currentSlot) {
    const srcIndex = clicks.findIndex((m) => m.id === clickId);
    if (srcIndex >= 0) {
      const [moved] = clicks.splice(srcIndex, 1);
      clicks.splice(currentSlot, 0, moved);
      void persistClicks();
    }
  }

  render();
}

refs.list.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest("[data-action='drag-handle']");
  if (!handle) {
    return;
  }

  const dragItem = handle.closest("li[data-click-id]");
  if (!dragItem) {
    return;
  }

  event.preventDefault();

  const items = [...refs.list.querySelectorAll("li[data-click-id]")];
  const dragIndex = items.indexOf(dragItem);
  const rects = items.map((el) => el.getBoundingClientRect());
  const gap = items.length > 1 ? rects[1].top - rects[0].bottom : 8;
  const slotHeight = rects[dragIndex].height + gap;

  dragItem.style.position = "relative";
  dragItem.style.zIndex = "100";

  const card = dragItem.querySelector(".click-row");
  if (card) {
    card.style.boxShadow = "0 8px 24px rgba(19, 25, 48, 0.18)";
  }

  for (let i = 0; i < items.length; i++) {
    if (i !== dragIndex) {
      items[i].style.transition = "transform 150ms ease";
    }
  }

  document.body.style.cursor = "grabbing";

  drag = {
    item: dragItem,
    items,
    rects,
    startY: event.clientY,
    dragIndex,
    currentSlot: dragIndex,
    slotHeight,
    clickId: dragItem.dataset.clickId,
  };

  document.addEventListener("pointermove", onDragMove);
  document.addEventListener("pointerup", onDragEnd);
  document.addEventListener("pointercancel", onDragEnd);
});

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

  if (action === "set-default") {
    void setDefaultClick(macroId, macroId !== defaultClickId);
    return;
  }

  if (action === "toggle-display-moves") {
    const macro = clicks.find((item) => item.id === macroId);
    if (!macro) {
      setStatus(t("notFound"));
      return;
    }

    const nextDisplayMoves = !getDisplayMovesValue(macro);
    macro.displayMoves = nextDisplayMoves;
    macro.trackMoves = nextDisplayMoves;
    void persistClicks().then(() => {
      render();
      setStatus(t("displayMovesChanged", {
        state: t(nextDisplayMoves ? "enabled" : "disabled"),
        name: macro.name
      }));
    });
    return;
  }

  if (action === "delete") {
    if (state.pendingDeleteClickId === macroId) {
      void deleteClick(macroId);
      return;
    }

    armDeleteButton(target, macroId);
  }
});

refs.list.addEventListener("pointerout", (event) => {
  const button = event.target.closest(".delete-btn-armed");
  if (!button || button.contains(event.relatedTarget)) {
    return;
  }

  clearDeleteConfirmation();
});

refs.list.addEventListener("change", (event) => {
  const input = event.target.closest("input[data-action='set-repeats']");
  if (!input) {
    return;
  }

  const macro = clicks.find((item) => item.id === input.dataset.id);
  if (!macro) {
    setStatus(t("notFound"));
    return;
  }

  normalizeRepeatInput(input);
  macro.repeats = Number(input.value);
  void persistClicks().then(() => {
    setStatus(t("repeatChanged", { name: macro.name, repeats: macro.repeats }));
  });
});

refs.recordBtn.addEventListener("click", () => {
  if (settings.skipNewClickExplanation) {
    void startCreateMode();
  } else {
    openRecordModal();
  }
});

refs.stopExecutionBtn.addEventListener("click", () => {
  void stopExecution();
});

refs.editDisplayMovesToggle.addEventListener("click", () => {
  if (settings.skipDisplayMovesExplanation) {
    setEditDisplayMoves(!refs.editDisplayMoves.checked);
  } else {
    openDisplayMovesModal();
  }
});

refs.editDefaultToggle.addEventListener("click", () => {
  setEditDefault(!refs.editDefault.checked);
});

refs.editRepeats.addEventListener("change", () => {
  normalizeRepeatInput(refs.editRepeats);
});

refs.editName.addEventListener("input", () => {
  if (refs.editName.value.trim()) {
    refs.editNameField.classList.remove("invalid");
  }
});

refs.clearEditNameBtn.addEventListener("click", () => {
  refs.editName.value = "";
  refs.editName.focus();
});

document.addEventListener("keydown", (event) => {
  if (event.target.matches(".repeat-input") && ["e", "E", "+", "-", ".", ","].includes(event.key)) {
    event.preventDefault();
  }
});

refs.saveEditBtn.addEventListener("click", async () => {
  const name = refs.editName.value.trim();
  if (!name) {
    validateEditName();
    return;
  }

  const validRepeats = normalizeRepeats(refs.editRepeats.value);
  const displayMoves = Boolean(refs.editDisplayMoves.checked);

  if (state.modalMode === "edit" && state.editClickId) {
    const macro = clicks.find((item) => item.id === state.editClickId);
    if (!macro) {
      setStatus(t("notFoundForSave"));
      closeEditModal();
      return;
    }

    macro.name = name;
    macro.repeats = validRepeats;
    macro.displayMoves = displayMoves;
    macro.trackMoves = displayMoves;
    macro.mode = state.editMode;
    if (!Array.isArray(macro.steps)) {
      macro.steps = [];
    }
    await persistClicks();
    const nextDefaultClickId = refs.editDefault.checked ? macro.id : null;
    if (defaultClickId === macro.id || nextDefaultClickId === macro.id) {
      defaultClickId = nextDefaultClickId;
      await persistDefaultClickId();
    }
    closeEditModal();
    render();
    setStatus(t("updated"));
    return;
  }

  if (state.modalMode !== "create") {
    setStatus(t("saveUnavailable"));
    return;
  }

  const createdClick = {
    id: createClickId(),
    name,
    repeats: validRepeats,
    displayMoves,
    trackMoves: displayMoves,
    mode: state.editMode,
    steps: []
  };
  clicks.unshift(createdClick);
  await persistClicks();
  if (refs.editDefault.checked) {
    defaultClickId = createdClick.id;
    await persistDefaultClickId();
  }
  closeEditModal();
  render();
  setStatus(t("saved"));
});

refs.cancelEditBtn.addEventListener("click", () => {
  requestCloseEditModal();
});

refs.closeEditBtn.addEventListener("click", () => {
  requestCloseEditModal();
});

refs.editModal.addEventListener("click", (event) => {
  if (event.target === refs.editModal) {
    requestCloseEditModal();
  }
});

refs.editModeToggle.addEventListener("click", () => {
  if (settings.skipModeExplanation) {
    setEditMode(state.editMode === "position" ? "element" : "position");
    renderEditSteps(getCurrentEditSteps());
  } else {
    openModeModal();
  }
});

refs.modePositionBtn.addEventListener("click", async () => {
  if (refs.modeDontShow.checked) {
    settings.skipModeExplanation = true;
    syncSettingsUI();
    await persistSettings();
  }
  setEditMode("position");
  closeModeModal();
  renderEditSteps(getCurrentEditSteps());
});

refs.modeElementBtn.addEventListener("click", async () => {
  if (refs.modeDontShow.checked) {
    settings.skipModeExplanation = true;
    syncSettingsUI();
    await persistSettings();
  }
  setEditMode("element");
  closeModeModal();
  renderEditSteps(getCurrentEditSteps());
});

refs.closeModeModalBtn.addEventListener("click", () => {
  closeModeModal();
});

refs.modeModal.addEventListener("click", (event) => {
  if (event.target === refs.modeModal) {
    closeModeModal();
  }
});

refs.closeRecordModalBtn.addEventListener("click", () => {
  closeRecordModal();
});

refs.recordModal.addEventListener("click", (event) => {
  if (event.target === refs.recordModal) {
    closeRecordModal();
  }
});

refs.recordStartBtn.addEventListener("click", async () => {
  if (refs.recordDontShow.checked) {
    settings.skipNewClickExplanation = true;
    syncSettingsUI();
    await persistSettings();
  }
  closeRecordModal();
  void startCreateMode();
});

refs.recordCancelBtn.addEventListener("click", () => {
  closeRecordModal();
});

refs.closeDisplayMovesModalBtn.addEventListener("click", () => {
  closeDisplayMovesModal();
});

refs.displayMovesModal.addEventListener("click", (event) => {
  if (event.target === refs.displayMovesModal) {
    closeDisplayMovesModal();
  }
});

refs.displayMovesVisibleBtn.addEventListener("click", async () => {
  if (refs.displayMovesDontShow.checked) {
    settings.skipDisplayMovesExplanation = true;
    syncSettingsUI();
    await persistSettings();
  }
  setEditDisplayMoves(true);
  closeDisplayMovesModal();
});

refs.displayMovesStealthBtn.addEventListener("click", async () => {
  if (refs.displayMovesDontShow.checked) {
    settings.skipDisplayMovesExplanation = true;
    syncSettingsUI();
    await persistSettings();
  }
  setEditDisplayMoves(false);
  closeDisplayMovesModal();
});

refs.settingExecutionSpeed.addEventListener("click", async () => {
  const currentIndex = EXECUTION_SPEED_VALUES.indexOf(settings.executionSpeed);
  const nextIndex = (currentIndex + 1) % EXECUTION_SPEED_VALUES.length;
  settings.executionSpeed = EXECUTION_SPEED_VALUES[nextIndex];
  syncSettingsUI();
  await persistSettings();
});

refs.settingSkipNewRecording.addEventListener("change", async () => {
  settings.skipNewClickExplanation = refs.settingSkipNewRecording.checked;
  await persistSettings();
});

refs.settingSkipDisplayMoves.addEventListener("change", async () => {
  settings.skipDisplayMovesExplanation = refs.settingSkipDisplayMoves.checked;
  await persistSettings();
});

refs.settingSkipMode.addEventListener("change", async () => {
  settings.skipModeExplanation = refs.settingSkipMode.checked;
  await persistSettings();
});

refs.settingDarkTheme.addEventListener("change", async () => {
  settings.darkTheme = refs.settingDarkTheme.checked;
  syncSettingsUI();
  await persistSettings();
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

function closeModalByEscape() {
  if (!refs.modeModal.classList.contains("hidden")) {
    closeModeModal();
    return true;
  }

  if (!refs.displayMovesModal.classList.contains("hidden")) {
    closeDisplayMovesModal();
    return true;
  }

  if (!refs.recordModal.classList.contains("hidden")) {
    closeRecordModal();
    return true;
  }

  if (!refs.editModal.classList.contains("hidden")) {
    requestCloseEditModal();
    return true;
  }

  return false;
}
