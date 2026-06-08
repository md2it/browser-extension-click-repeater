
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
  setStatus(t("running", { name: executionState.clickName, remaining }));
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
    const description = describeExecutionEvent(response?.lastEvent);
    if (description) {
      setStatus(description.text, { error: description.error });
    }
  } else {
    syncPopupHeight();
  }

  return response;
}

function describeExecutionEvent(event) {
  if (!event?.kind) {
    return null;
  }

  const name = event.clickName || t("clickNoun");
  switch (event.kind) {
    case "completed":
      return { text: t("executionCompleted", { name }), error: false };
    case "stopped":
      return { text: t("stopped"), error: true };
    case "user-click":
      return { text: t("stoppedByUser"), error: true };
    case "element-not-found":
      return {
        text: t("elementNotFound"),
        error: true
      };
    case "empty-steps":
      return { text: t("hasNoSteps"), error: true };
    case "failed":
      return { text: t("executionFailed"), error: true };
    default:
      return null;
  }
}

async function startExecution(macroId) {
  const macro = clicks.find((item) => item.id === macroId);
  if (!macro) {
    setStatus(t("notFound"));
    return;
  }

  const activeTab = await getActiveTab();
  if (!activeTab || !Number.isInteger(activeTab.id)) {
    setStatus(t("activeTabNotFound"));
    return;
  }

  const clickMode = macro.mode === "element" ? "element" : "position";
  const steps = Array.isArray(macro.steps)
    ? macro.steps
      .map((step) => {
        if (typeof step === "string") return step;
        if (step && typeof step === "object") {
          return clickMode === "element" ? (step.selector ?? "") : (step.position ?? "");
        }
        return "";
      })
      .filter((step) => step && step.trim())
    : [];
  if (steps.length === 0) {
    setStatus(t("hasNoSteps"), { error: true });
    return;
  }

  const response = await sendRuntimeMessage({
    type: "execution-start",
    clickId: macro.id,
    clickName: macro.name,
    repeats: macro.repeats,
    tabId: activeTab.id,
    steps,
    trackMoves: getDisplayMovesValue(macro),
    executionSpeed: settings.executionSpeed
  });

  if (!response?.ok) {
    if (response?.error === "already_running") {
      renderExecutionStatus(response.state);
      setStatus(t("alreadyRunning", { name: response.state?.clickName ?? t("clickNoun") }));
      return;
    }

    if (response?.error === "empty_steps") {
      setStatus(t("hasNoSteps"), { error: true });
      return;
    }

    if (response?.error === "page_blocked") {
      // The background script already opened the restricted-page notice.
      window.close();
      return;
    }

    if (response?.error === "tab_unreachable") {
      setStatus(t("executionFailed"), { error: true });
      return;
    }

    setStatus(t("executionFailed"), { error: true });
    return;
  }

  renderExecutionStatus(response.state);
  setStatus(t("executionStarted", { name: macro.name }));
  window.close();
}

async function stopExecution() {
  const response = await sendRuntimeMessage({ type: "execution-stop" });
  if (!response?.ok) {
    setStatus(t("stopFailed"));
    return;
  }

  clearExecutionPolling();
  refs.stopExecutionBtn.classList.add("hidden");
  if (response.wasRunning) {
    setStatus(t("stopped"), { error: true });
  } else {
    setStatus(t("noActiveExecution"));
  }
}
