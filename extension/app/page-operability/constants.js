"use strict";
// Keep these translations aligned with element-deleter.
const RESTRICTED_PAGE_NOTICE = {
  en: "Browser extensions don't work on system pages and protected sites. Try another site.",
  es: "Las extensiones del navegador no funcionan en páginas del sistema y sitios protegidos. Prueba en otro sitio.",
  fr: "Les extensions du navigateur ne fonctionnent pas sur les pages système et les sites protégés. Essayez un autre site.",
  de: "Browser-Erweiterungen funktionieren auf Systemseiten und geschützten Websites nicht. Versuche es auf einer anderen Website.",
  ru: "На системных страницах и защищённых сайтах браузерные расширения не работают. Попробуй на другом сайте",
  zh: "浏览器扩展无法在系统页面和受保护网站上运行。请尝试其他网站。",
  ar: "لا تعمل إضافات المتصفح على صفحات النظام والمواقع المحمية. جرّب موقعًا آخر.",
};

const RESTRICTED_NOTICE_POPUP = "blocked-notice.html";
const RESTRICTED_NOTICE_MIN_MS = 4000;
const RESTRICTED_NOTICE_SESSION_KEY = "restrictedNotice";
const RESTRICTED_NOTICE_CONFIG = {
  popupHtml: RESTRICTED_NOTICE_POPUP,
  sessionKey: RESTRICTED_NOTICE_SESSION_KEY,
  logLabel: "Click Repeater",
};

function detectRestrictedNoticeLocale() {
  let tag = "";
  try {
    tag = (ext.i18n?.getUILanguage?.() || navigator.language || "").toLowerCase();
  } catch {
    tag = (navigator.language || "").toLowerCase();
  }
  const base = tag.replace(/_/g, "-").split("-")[0];
  if (tag.startsWith("zh")) return "zh";
  return RESTRICTED_PAGE_NOTICE[base] ? base : "en";
}

async function restrictedPageNoticeLocale() {
  try {
    const data = await ext.storage.local.get("locale");
    const storedLocale = data?.locale === "zh_CN" ? "zh" : data?.locale;
    if (RESTRICTED_PAGE_NOTICE[storedLocale]) {
      return storedLocale;
    }
  } catch {}
  return detectRestrictedNoticeLocale();
}

function restrictedPageNoticeText(locale) {
  return RESTRICTED_PAGE_NOTICE[locale] ?? RESTRICTED_PAGE_NOTICE.en;
}
