const CONTEXT_MENU_CLICKS = "clicks";
const CONTEXT_MENU_SETTINGS = "settings";
const CONTEXT_MENU_SHORTCUTS = "shortcuts";
const CONTEXT_MENU_ABOUT = "about";

const CONTEXT_MENU_EMOJI = {
  clicks: "▶️",
  settings: "⚙️",
  shortcuts: "⌨️",
  about: "ℹ️",
};

const CONTEXT_MENU_NAV_KEYS = {
  clicks: "navClicks",
  settings: "navSettings",
  shortcuts: "navShortcuts",
  about: "navAbout",
};

function contextMenuTitle(id, locale) {
  const strings = TRANSLATIONS[locale] ?? TRANSLATIONS.en;
  const label = strings[CONTEXT_MENU_NAV_KEYS[id]] ?? EN_MESSAGES[CONTEXT_MENU_NAV_KEYS[id]];
  const emoji = CONTEXT_MENU_EMOJI[id];
  return isRtlLocale(locale) ? `${label} ${emoji}` : `${emoji} ${label}`;
}

async function getStoredLocale() {
  try {
    const data = await ext.storage.local.get(LOCALE_STORAGE_KEY);
    return normalizeLocale(data?.[LOCALE_STORAGE_KEY]) ?? "en";
  } catch {
    return "en";
  }
}

async function createContextMenuItem(props) {
  try {
    await ext.contextMenus.create(props);
  } catch (err) {
    console.error("[Click Repeater] contextMenus.create failed:", err, props);
  }
}

let ensureContextMenuChain = Promise.resolve();

function ensureContextMenu() {
  ensureContextMenuChain = ensureContextMenuChain.then(async () => {
    const locale = await getStoredLocale();
    try {
      await ext.contextMenus.removeAll();
    } catch (err) {
      console.error("[Click Repeater] contextMenus.removeAll failed:", err);
    }
    for (const id of [CONTEXT_MENU_CLICKS, CONTEXT_MENU_SETTINGS, CONTEXT_MENU_SHORTCUTS, CONTEXT_MENU_ABOUT]) {
      await createContextMenuItem({
        id,
        title: contextMenuTitle(id, locale),
        contexts: ["action"],
      });
    }
  });
  return ensureContextMenuChain;
}

void ensureContextMenu();

ext.runtime.onInstalled.addListener(() => {
  void ensureContextMenu();
});

ext.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && LOCALE_STORAGE_KEY in changes) {
    void ensureContextMenu();
  }
});

ext.contextMenus.onClicked.addListener((info, tab) => {
  const page = info.menuItemId;
  if (page === CONTEXT_MENU_CLICKS || page === CONTEXT_MENU_SETTINGS ||
      page === CONTEXT_MENU_SHORTCUTS || page === CONTEXT_MENU_ABOUT) {
    void openMainPopup(tab?.id, tab?.windowId, page);
  }
});
