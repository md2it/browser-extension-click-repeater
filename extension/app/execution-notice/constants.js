"use strict";

const EXECUTION_ERROR_NOTICE_MESSAGES = {
  "stopped": {
    en: "Stopped",
    es: "Detenido",
    fr: "Arrêté",
    de: "Gestoppt",
    ru: "Остановлено",
    zh: "已停止",
    ar: "تم الإيقاف",
  },
  "user-click": {
    en: "Stopped by the user",
    es: "Detenido por el usuario",
    fr: "Arrêté par l'utilisateur",
    de: "Vom Benutzer gestoppt",
    ru: "Остановлено пользователем",
    zh: "已被用户停止",
    ar: "أوقف المستخدم الماكرو",
  },
  "element-not-found": {
    en: "Element not found: the saved element is missing or no longer matches its selector",
    es: "Elemento no encontrado: falta o ya no coincide con su selector",
    fr: "Élément introuvable : absent ou ne correspondant plus au sélecteur",
    de: "Element nicht gefunden: fehlt oder entspricht nicht mehr dem Selektor",
    ru: "Элемент не найден: сохранённый элемент отсутствует или больше не определяется по селектору",
    zh: "未找到元素：已保存元素不存在或不再匹配选择器",
    ar: "لم يتم العثور على العنصر: العنصر المحفوظ مفقود أو لم يعد يطابق المحدد",
  },
  "empty-steps": {
    en: "No steps recorded",
    es: "Sin pasos grabados",
    fr: "Aucune étape enregistrée",
    de: "Das Makro enthält keine Schritte",
    ru: "В макросе нет шагов",
    zh: "没有记录的步骤",
    ar: "لا يحتوي الماكرو على خطوات",
  },
  "failed": {
    en: "Could not run",
    es: "No se pudo ejecutar",
    fr: "Impossible d'exécuter",
    de: "Konnte nicht ausgeführt werden",
    ru: "Не удалось выполнить макрос",
    zh: "无法运行",
    ar: "تعذر التشغيل",
  },
};

const EXECUTION_NOTICE_POPUP = "execution-notice.html";
const EXECUTION_NOTICE_MIN_MS = 4000;
const EXECUTION_NOTICE_SESSION_KEY = "executionErrorNotice";
const EXECUTION_NOTICE_CONFIG = {
  popupHtml: EXECUTION_NOTICE_POPUP,
  sessionKey: EXECUTION_NOTICE_SESSION_KEY,
  logLabel: "Click Repeater",
};

function executionErrorNoticeText(kind, locale) {
  const messages = EXECUTION_ERROR_NOTICE_MESSAGES[kind] ?? EXECUTION_ERROR_NOTICE_MESSAGES["failed"];
  return messages[locale] ?? messages.en;
}
