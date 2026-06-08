
function render() {
  clearDeleteConfirmation();
  refs.list.innerHTML = "";

  if (clicks.length === 0) {
    const emptyRow = document.createElement("li");
    emptyRow.className = "click-row";
    emptyRow.textContent = t("emptyList");
    refs.list.append(emptyRow);
    syncPopupHeight();
    return;
  }

  for (const macro of clicks) {
    const displayMovesEnabled = getDisplayMovesValue(macro);
    const displayMovesTitle = t(displayMovesEnabled ? "displayMovesOn" : "displayMovesOff");
    const displayMovesIcon = displayMovesEnabled ? iconSet.eye : iconSet.eyeOff;
    const displayMovesClassName = displayMovesEnabled ? "display-moves-on" : "display-moves-off";
    const modeIcon = (macro.mode ?? "position") === "element" ? iconSet.code : iconSet.crosshair;
    const modeTitle = t((macro.mode ?? "position") === "element" ? "modeElement" : "modePosition");
    const isDefault = macro.id === defaultClickId;
    const defaultTitle = t(isDefault ? "defaultLabel" : "makeDefault");
    const defaultDetail = t(isDefault ? "worksByShortcut" : "enableShortcut");
    const row = document.createElement("li");
    row.className = "click-item";
    row.dataset.clickId = macro.id;
    row.innerHTML = `
      <span class="drag-handle" data-action="drag-handle" aria-hidden="true">${iconSet.gripVertical}</span>
      <div class="click-row">
        <div class="click-main">
          <button class="icon-btn run-btn" type="button" data-action="run" data-id="${macro.id}" data-tooltip="${t("run")}" aria-label="${t("run")}">${iconSet.play}</button>
          <span class="click-mode-icon" aria-hidden="true" data-tooltip="${modeTitle}">${modeIcon}</span>
          <span class="click-display-moves-icon ${displayMovesClassName}" aria-hidden="true" data-tooltip="${displayMovesTitle}">${displayMovesIcon}</span>
          <span class="click-name">${macro.name}</span>
        </div>
        <div class="click-actions">
          <button class="icon-btn default-btn ${isDefault ? "active" : ""}" type="button" data-action="set-default" data-id="${macro.id}" data-tooltip="${defaultTitle}" data-tooltip-detail="${defaultDetail}" aria-label="${defaultTitle}. ${defaultDetail}" aria-pressed="${isDefault}">${iconSet.star}</button>
          <span class="repeat-field" data-tooltip="${t("repeat")}"><input class="click-repeats repeat-input" type="number" min="1" max="999" step="1" inputmode="numeric" value="${normalizeRepeats(macro.repeats)}" data-action="set-repeats" data-id="${macro.id}" aria-label="${t("repeat")}" /></span>
          <button class="icon-btn" type="button" data-action="edit" data-id="${macro.id}" data-tooltip="${t("edit")}" aria-label="${t("edit")}">${iconSet.squarePen}</button>
          <button class="icon-btn delete-btn" type="button" data-action="delete" data-id="${macro.id}" data-tooltip="${t("delete")}" aria-label="${t("delete")}">${iconSet.trash}</button>
        </div>
      </div>
    `;
    refs.list.append(row);
  }

  syncPopupHeight();
}

function setStatus(text, { error = false } = {}) {
  refs.status.textContent = text;
  refs.status.classList.toggle("status-line--error", Boolean(error));
  syncPopupHeight();
}

function clearDeleteConfirmation() {
  for (const button of refs.list.querySelectorAll(".delete-btn-armed")) {
    const label = button.querySelector(".delete-btn-label");
    button.classList.remove("delete-btn-armed");
    button.style.width = "28px";
    button.dataset.tooltip = t("delete");
    button.setAttribute("aria-label", t("delete"));

    if (label) {
      let collapseFallback;
      const finishCollapse = () => {
        button.removeEventListener("transitionend", handleCollapseTransitionEnd);
        clearTimeout(collapseFallback);
        if (!button.classList.contains("delete-btn-armed") && label.isConnected) {
          label.remove();
          button.style.width = "";
        }
      };
      const handleCollapseTransitionEnd = (event) => {
        if (event.propertyName !== "width") {
          return;
        }

        finishCollapse();
      };
      button.addEventListener("transitionend", handleCollapseTransitionEnd);
      collapseFallback = setTimeout(finishCollapse, 200);
    }
  }

  state.pendingDeleteClickId = null;
}

function armDeleteButton(button, macroId) {
  clearDeleteConfirmation();
  state.pendingDeleteClickId = macroId;
  button.dataset.tooltip = t("confirmDelete");
  button.setAttribute("aria-label", t("confirmDelete"));
  for (const existingLabel of button.querySelectorAll(".delete-btn-label")) {
    existingLabel.remove();
  }

  const label = document.createElement("span");
  label.className = "delete-btn-label";
  label.setAttribute("aria-hidden", "true");
  label.textContent = t("confirmDelete");
  button.append(label);
  button.style.width = "max-content";
  const expandedWidth = Math.ceil(button.getBoundingClientRect().width);
  button.style.width = "28px";
  button.getBoundingClientRect();
  button.classList.add("delete-btn-armed");
  button.style.width = `${expandedWidth}px`;
  button.focus();
  syncPopupHeight();
}

async function deleteClick(macroId) {
  const index = clicks.findIndex((item) => item.id === macroId);
  if (index < 0) {
    clearDeleteConfirmation();
    setStatus(t("notFound"));
    return;
  }

  const [deletedClick] = clicks.splice(index, 1);
  if (deletedClick.id === defaultClickId) {
    defaultClickId = null;
    await persistDefaultClickId();
  }

  clearDeleteConfirmation();
  await persistClicks();
  render();
  setStatus(t("deleted"));
}

function openEditModal(macroId, { selectAll = false } = {}) {
  if (macroId !== null) {
    const macro = clicks.find((item) => item.id === macroId);
    if (!macro) {
      setStatus(t("notFound"));
      return;
    }

    state.modalMode = "edit";
    state.editClickId = macro.id;
    refs.editModalTitle.textContent = t("editTitle");
    refs.editName.value = macro.name;
    refs.editRepeats.value = String(macro.repeats ?? 1);
    setEditDisplayMoves(getDisplayMovesValue(macro));
    setEditDefault(macro.id === defaultClickId);
    setEditMode(macro.mode ?? "position");
    renderEditSteps(Array.isArray(macro.steps) ? macro.steps : []);
    refs.editModal.classList.remove("hidden");
    if (selectAll) {
      focusEditNameSelectAll();
    } else {
      focusEditNameAtEnd();
    }
    syncPopupHeight();
    return;
  }

  state.modalMode = "create";
  state.editClickId = null;
  refs.editModalTitle.textContent = t("createTitle");
  refs.editName.value = buildDefaultClickName();
  refs.editRepeats.value = "1";
  setEditDisplayMoves(true);
  setEditDefault(false);
  setEditMode("position");
  renderEditSteps([]);
  refs.editModal.classList.remove("hidden");
  focusEditNameSelectAll();
  syncPopupHeight();
}

function focusEditNameAtEnd() {
  refs.editNameField.classList.remove("invalid");
  refs.editName.focus();
  const end = refs.editName.value.length;
  refs.editName.setSelectionRange(end, end);
}

function focusEditNameSelectAll() {
  refs.editNameField.classList.remove("invalid");
  refs.editName.focus();
  refs.editName.select();
}

function validateEditName() {
  const isValid = Boolean(refs.editName.value.trim());
  refs.editNameField.classList.toggle("invalid", !isValid);
  if (!isValid) {
    refs.editName.focus();
    setStatus(t("enterName"));
  }
  return isValid;
}

function requestCloseEditModal() {
  if (!validateEditName()) {
    return false;
  }

  closeEditModal();
  setStatus(t("editCanceled"));
  return true;
}

function closeEditModal() {
  state.modalMode = null;
  state.editClickId = null;
  refs.editNameField.classList.remove("invalid");
  refs.editModal.classList.add("hidden");
  syncPopupHeight();
}

function openRecordModal() {
  refs.recordDontShow.checked = false;
  refs.recordModal.classList.remove("hidden");
  syncPopupHeight();
}

function closeRecordModal() {
  refs.recordModal.classList.add("hidden");
  syncPopupHeight();
}

function openDisplayMovesModal() {
  refs.displayMovesDontShow.checked = false;
  refs.displayMovesModal.classList.remove("hidden");
  syncPopupHeight();
}

function closeDisplayMovesModal() {
  refs.displayMovesModal.classList.add("hidden");
  syncPopupHeight();
}

function openModeModal() {
  refs.modeDontShow.checked = false;
  refs.modeModal.classList.remove("hidden");
  syncPopupHeight();
}

function closeModeModal() {
  refs.modeModal.classList.add("hidden");
  syncPopupHeight();
}

async function startCreateMode() {
  const activeTab = await getActiveTab();
  if (!activeTab || !Number.isInteger(activeTab.id)) {
    setStatus(t("activeTabNotFound"));
    return;
  }

  const response = await sendRuntimeMessage({
    type: "recording-start",
    tabId: activeTab.id,
    url: activeTab.url
  });

  if (!response?.ok) {
    if (response?.error === "page_blocked") {
      // The background script already opened the restricted-page notice.
      window.close();
      return;
    }
    setStatus(t("createFailed"), { error: true });
    return;
  }

  window.close();
}

async function completeCreateModeIfNeeded() {
  const response = await sendRuntimeMessage({ type: "recording-stop" });
  if (!response?.ok || !response.hasSession) {
    return null;
  }

  const steps = Array.isArray(response.steps)
    ? response.steps.filter((step) => step && typeof step === "object" && (step.position || step.selector))
    : [];

  const createdClick = {
    id: createClickId(),
    name: typeof response.clickName === "string" && response.clickName.trim() ? response.clickName : buildDefaultClickName(),
    repeats: 1,
    displayMoves: true,
    trackMoves: true,
    mode: "position",
    steps
  };

  clicks.unshift(createdClick);
  await persistClicks();
  return createdClick;
}

function getCurrentEditSteps() {
  if (!state.editClickId) {
    return [];
  }

  const macro = clicks.find((item) => item.id === state.editClickId);
  return Array.isArray(macro?.steps) ? macro.steps : [];
}

function renderEditSteps(steps) {
  refs.editSteps.innerHTML = "";

  if (steps.length === 0) {
    const li = document.createElement("li");
    li.className = "step-row step-row-empty";
    li.textContent = t("noSteps");
    refs.editSteps.append(li);
    syncPopupHeight();
    return;
  }

  steps.forEach((step) => {
    const li = document.createElement("li");
    li.className = "step-row";
    if (step && typeof step === "object") {
      li.textContent = state.editMode === "element" ? (step.selector ?? "") : (step.position ?? "");
    } else {
      li.textContent = typeof step === "string" ? step : "";
    }
    refs.editSteps.append(li);
  });

  syncPopupHeight();
}
