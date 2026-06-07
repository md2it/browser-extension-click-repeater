const menuIcons = {
  macros: iconSet.play,
  settings: iconSet.settings,
  shortcuts: iconSet.keyboard,
  about: iconSet.info
};

for (const button of refs.menuButtons) {
  button.innerHTML = menuIcons[button.dataset.page] ?? "";
}

for (const icon of document.querySelectorAll("[data-about-icon]")) {
  icon.innerHTML = iconSet[icon.dataset.aboutIcon] ?? "";
}

for (const button of document.querySelectorAll(".modal-close-btn")) {
  button.innerHTML = iconSet.x;
}

refs.clearEditNameBtn.innerHTML = iconSet.x;

function renderLanguageSelector() {
  refs.languageSelector.replaceChildren();
  for (const locale of LOCALES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "language-btn";
    button.dataset.locale = locale;
    button.textContent = LOCALE_LABELS[locale];
    button.classList.toggle("active", locale === currentLocale);
    button.setAttribute("aria-pressed", String(locale === currentLocale));
    refs.languageSelector.append(button);
  }
}

function syncPopupLocale() {
  applyTranslations();
  const menuKeys = {
    macros: "navMacros",
    settings: "navSettings",
    shortcuts: "navShortcuts",
    about: "navAbout"
  };
  for (const button of refs.menuButtons) {
    const label = t(menuKeys[button.dataset.page]);
    button.dataset.tooltip = label;
    button.setAttribute("aria-label", label);
  }
  refs.list.setAttribute("aria-label", t("macrosList"));
  refs.languageSelector.setAttribute("aria-label", t("language"));
  renderLanguageSelector();
  setEditDisplayMoves(refs.editDisplayMoves.checked);
  setEditMode(state.editMode);
  setEditDefault(refs.editDefault.checked);
  render();
  syncPopupHeight();
}

refs.languageSelector.addEventListener("click", async (event) => {
  const button = event.target.closest(".language-btn");
  if (!button?.dataset.locale) return;
  await selectLocale(button.dataset.locale);
  syncPopupLocale();
  setStatus(t("initialHint"));
});

function selectPopupPage(pageName) {
  for (const page of refs.pages) {
    page.classList.toggle("hidden", page.dataset.pageContent !== pageName);
  }

  for (const button of refs.menuButtons) {
    const active = button.dataset.page === pageName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  }

  syncPopupHeight();
}

refs.menu.addEventListener("click", (event) => {
  const button = event.target.closest(".popup-menu-btn");
  if (button?.dataset.page) {
    selectPopupPage(button.dataset.page);
  }
});
