
function badgeColorToHex(color) {
  return `#${color.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function interpolateBadgeColor(startColor, endColor, progress) {
  return badgeColorToHex(startColor.map((channel, index) =>
    Math.round(channel + (endColor[index] - channel) * progress)
  ));
}

function getBadgeAnimationTextColor(colors, frame) {
  const totalFrames = BADGE_ANIMATION_STEPS * 2;
  const normalizedFrame = ((frame % totalFrames) + totalFrames) % totalFrames;
  const step = normalizedFrame < BADGE_ANIMATION_STEPS
    ? normalizedFrame + 1
    : totalFrames - normalizedFrame;

  if (colors.length === 2) {
    return interpolateBadgeColor(
      colors[0],
      colors[1],
      (step - 1) / (BADGE_ANIMATION_STEPS - 1)
    );
  }

  const middleStep = Math.floor(BADGE_ANIMATION_STEPS / 2);
  if (step <= middleStep) {
    return interpolateBadgeColor(
      colors[0],
      colors[1],
      (step - 1) / (middleStep - 1)
    );
  }
  return interpolateBadgeColor(
    colors[1],
    colors[2],
    (step - middleStep) / (BADGE_ANIMATION_STEPS - middleStep)
  );
}

function clearBadgeAnimation() {
  if (badgeAnimationIntervalId !== null) {
    clearInterval(badgeAnimationIntervalId);
    badgeAnimationIntervalId = null;
  }
  badgeAnimationFrame = 0;
  badgeAnimationMode = null;
}

async function setActiveBadgeVisual(mode) {
  const isCreateMode = mode === "create";
  const colors = isCreateMode ? CREATE_BADGE_TEXT_COLORS : RUN_BADGE_TEXT_COLORS;
  const backgroundColor = isCreateMode
    ? CREATE_BADGE_BACKGROUND_COLOR
    : RUN_BADGE_BACKGROUND_COLOR;

  await ext.action.setBadgeBackgroundColor({ color: backgroundColor });
  if (typeof ext.action.setBadgeTextColor === "function") {
    await ext.action.setBadgeTextColor({
      color: getBadgeAnimationTextColor(colors, badgeAnimationFrame)
    });
  }
  await ext.action.setBadgeText({ text: ACTIVE_BADGE_TEXT });
}

function ensureBadgeAnimation(mode) {
  if (badgeAnimationIntervalId !== null && badgeAnimationMode === mode) {
    return;
  }

  clearBadgeAnimation();
  badgeAnimationMode = mode;
  const totalFrames = BADGE_ANIMATION_STEPS * 2;

  badgeAnimationIntervalId = setInterval(() => {
    badgeAnimationFrame = (badgeAnimationFrame + 1) % totalFrames;
    void setActiveBadgeVisual(mode);
  }, BADGE_ANIMATION_STEP_MS);
}

async function syncActionBadge() {
  clearShortcutHintTimer();

  const session = await readSession();
  if (session?.isActive) {
    ensureBadgeAnimation("create");
    await setActiveBadgeVisual("create");
    return;
  }

  const executionState = await getRuntimeExecutionState();
  if (executionState?.isRunning) {
    clearBadgeAnimation();
    const completedCycles = Math.floor(executionState.completedSteps / executionState.stepsPerCycle);
    const remainingCycles = Math.max(0, executionState.repeats - completedCycles);
    await setActionBadgeText(String(Math.min(remainingCycles, 999)));
    return;
  }

  clearBadgeAnimation();
  await setActionBadgeText("");
}

async function showShortcutHintBadge() {
  const session = await readSession();
  const executionState = await getRuntimeExecutionState();
  if (session?.isActive || executionState?.isRunning) {
    await syncActionBadge();
    return;
  }

  clearShortcutHintTimer();
  clearBadgeAnimation();
  await ext.action.setBadgeText({ text: SHORTCUT_HINT_BADGE_TEXT });
  await ext.action.setBadgeBackgroundColor({ color: SHORTCUT_HINT_BADGE_BACKGROUND_COLOR });
  if (typeof ext.action.setBadgeTextColor === "function") {
    await ext.action.setBadgeTextColor({ color: SHORTCUT_HINT_BADGE_TEXT_COLOR });
  }
  shortcutHintTimerId = setTimeout(() => {
    shortcutHintTimerId = null;
    void syncActionBadge();
  }, SHORTCUT_HINT_DURATION_MS);
}

async function startDefaultClickFromTab(tabId) {
  if (!Number.isInteger(tabId)) {
    return { ok: false, error: "tab_id_required" };
  }

  const defaultClickId = await readDefaultClickId();
  if (!defaultClickId) {
    return { ok: false, error: "default_click_missing" };
  }

  const clicks = await readClicks();
  const click = clicks.find((item) => item.id === defaultClickId);
  if (!click) {
    return { ok: false, error: "default_click_missing" };
  }

  const clickMode = click.mode === "element" ? "element" : "position";
  const steps = Array.isArray(click.steps)
    ? click.steps
      .map((step) => normalizeStepForExecution(step, clickMode))
      .filter(Boolean)
    : [];
  const clickName = typeof click.name === "string" && click.name.trim() ? click.name.trim() : "clicks";
  if (!steps.length) {
    // Preserve the failure so the popup can report a shortcut-triggered run.
    await writeExecutionLastEvent({ kind: "empty-steps", clickName });
    return { ok: false, error: "empty_steps" };
  }
  const repeatsRaw = Number(click.repeats);
  const repeats = Number.isFinite(repeatsRaw) && repeatsRaw > 0 ? Math.floor(repeatsRaw) : 1;
  const settingsData = await ext.storage.local.get("popup_settings");
  const storedSettings = settingsData?.popup_settings;
  const soundVolume = ["volume", "volume-1", "volume-2"].includes(storedSettings?.soundVolume)
    ? storedSettings.soundVolume
    : (storedSettings?.clickSound !== false ? "volume-2" : "volume");
  return startExecutionOnTab({
    tabId,
    clickId: click.id,
    clickName,
    repeats,
    trackMoves: Boolean(click.displayMoves ?? click.trackMoves),
    executionSpeed: normalizeExecutionSpeed(storedSettings?.executionSpeed),
    soundVolume,
    clickSound: soundVolume !== "volume",
    steps
  });
}
