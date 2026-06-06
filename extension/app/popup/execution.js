
function syncPopupHeight() {
  const minHeightPx = parseFloat(window.getComputedStyle(document.body).minHeight) || 0;
  const popupHeight = refs.popup ? refs.popup.scrollHeight : 0;
  const editModalHeight = refs.editModal.classList.contains("hidden") ? 0 : refs.editModal.scrollHeight;
  const modeModalHeight = refs.modeModal.classList.contains("hidden") ? 0 : refs.modeModal.scrollHeight;
  const targetHeight = Math.max(
    minHeightPx,
    popupHeight,
    editModalHeight,
    modeModalHeight
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
    return response;
  }

  clearExecutionPolling();
  refs.stopExecutionBtn.classList.add("hidden");
  if (!silent) {
    if (response?.lastEvent === "completed" && response.completedMacroName) {
      setStatus(`Выполнение "${response.completedMacroName}" завершено.`);
    } else if (response?.lastEvent === "stopped" && response.stoppedMacroName) {
      setStatus(`Выполнение "${response.stoppedMacroName}" остановлено.`);
    } else if (response?.lastEvent === "failed" && response.failedMacroName) {
      setStatus(`Выполнение "${response.failedMacroName}" завершилось с ошибкой.`);
    }
  } else {
    syncPopupHeight();
  }

  return response;
}

async function startExecution(macroId) {
  const macro = macros.find((item) => item.id === macroId);
  if (!macro) {
    setStatus("Macros не найден.");
    return;
  }

  const activeTab = await getActiveTab();
  if (!activeTab || !Number.isInteger(activeTab.id)) {
    setStatus("Активная вкладка не найдена.");
    return;
  }

  const macroMode = macro.mode === "element" ? "element" : "position";
  const steps = Array.isArray(macro.steps)
    ? macro.steps
      .map((step) => {
        if (typeof step === "string") return step;
        if (step && typeof step === "object") {
          return macroMode === "element" ? (step.selector ?? "") : (step.position ?? "");
        }
        return "";
      })
      .filter((step) => step && step.trim())
    : [];
  if (steps.length === 0) {
    setStatus("В macros нет шагов для выполнения.");
    return;
  }

  const response = await sendRuntimeMessage({
    type: "execution-start",
    macroId: macro.id,
    macroName: macro.name,
    repeats: macro.repeats,
    tabId: activeTab.id,
    steps,
    trackMoves: getDisplayMovesValue(macro),
    executionSpeed: settings.executionSpeed
  });

  if (!response?.ok) {
    if (response?.error === "already_running") {
      renderExecutionStatus(response.state);
      setStatus(`Уже выполняется "${response.state?.macroName ?? "макрос"}".`);
      return;
    }

    if (response?.error === "empty_steps") {
      setStatus("Не удалось запустить: отсутствуют шаги исполнения.");
      return;
    }

    if (response?.error === "tab_unreachable") {
      setStatus("Не удалось запустить: вкладка недоступна для исполнения.");
      return;
    }

    setStatus("Не удалось запустить выполнение macros.");
    return;
  }

  renderExecutionStatus(response.state);
  setStatus(`Запущено выполнение "${macro.name}".`);
  window.close();
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
