const STORAGE_KEY = "clicks_list";
const DEFAULT_CLICK_ID_KEY = "default_click_id";
const SETTINGS_KEY = "popup_settings";
const clicks = [];
let defaultClickId = null;

const EXECUTION_SPEED_VALUES = [0.5, 1, 4, 10];
const SOUND_VOLUME_LEVELS = ["volume", "volume-1", "volume-2"];
const DEFAULT_SOUND_VOLUME = "volume-2";

const settings = {
  executionSpeed: 1,
  soundVolume: DEFAULT_SOUND_VOLUME,
  skipNewClickExplanation: false,
  skipDisplayMovesExplanation: false,
  skipModeExplanation: false,
  darkTheme: false
};

const state = {
  modalMode: null,
  editClickId: null,
  editMode: "position",
  showDetailedSteps: false,
  pendingDeleteClickId: null,
  executionPollTimer: null
};

const refs = {
  popup: document.querySelector(".popup-shell"),
  menu: document.querySelector(".popup-menu"),
  menuButtons: document.querySelectorAll(".popup-menu-btn"),
  pages: document.querySelectorAll("[data-page-content]"),
  list: document.getElementById("clicks-list"),
  status: document.getElementById("status-line"),
  stopExecutionBtn: document.getElementById("stop-execution-btn"),
  recordBtn: document.getElementById("record-btn"),
  editModal: document.getElementById("edit-modal"),
  editModalTitle: document.getElementById("edit-modal-title"),
  closeEditBtn: document.getElementById("close-edit-btn"),
  editNameField: document.getElementById("edit-name-field"),
  editName: document.getElementById("edit-name"),
  clearEditNameBtn: document.getElementById("clear-edit-name-btn"),
  editRepeats: document.getElementById("edit-repeats"),
  editDisplayMovesToggle: document.getElementById("edit-display-moves-toggle"),
  editDisplayMovesIcon: document.getElementById("edit-display-moves-icon"),
  editDisplayMovesLabel: document.getElementById("edit-display-moves-label"),
  editDisplayMoves: document.getElementById("edit-display-moves"),
  editDefaultToggle: document.getElementById("edit-default-toggle"),
  editDefaultIcon: document.getElementById("edit-default-icon"),
  editDefault: document.getElementById("edit-default"),
  editSteps: document.getElementById("edit-steps"),
  editStepsDetailRow: document.getElementById("edit-steps-detail-row"),
  editStepsDetail: document.getElementById("edit-steps-detail"),
  editStepsDetailLabel: document.getElementById("edit-steps-detail-label"),
  editModeToggle: document.getElementById("edit-mode-toggle"),
  editModeIcon: document.getElementById("edit-mode-icon"),
  editModeLabel: document.getElementById("edit-mode-label"),
  saveEditBtn: document.getElementById("save-edit-btn"),
  cancelEditBtn: document.getElementById("cancel-edit-btn"),
  deleteEditBtn: document.getElementById("delete-edit-btn"),
  recordModal: document.getElementById("record-modal"),
  closeRecordModalBtn: document.getElementById("close-record-modal-btn"),
  recordDontShow: document.getElementById("record-dont-show"),
  recordStartBtn: document.getElementById("record-start-btn"),
  recordCancelBtn: document.getElementById("record-cancel-btn"),
  displayMovesModal: document.getElementById("display-moves-modal"),
  closeDisplayMovesModalBtn: document.getElementById("close-display-moves-modal-btn"),
  displayMovesDontShow: document.getElementById("display-moves-dont-show"),
  displayMovesVisibleBtn: document.getElementById("display-moves-visible-btn"),
  displayMovesStealthBtn: document.getElementById("display-moves-stealth-btn"),
  modeModal: document.getElementById("mode-modal"),
  closeModeModalBtn: document.getElementById("close-mode-modal-btn"),
  modeDontShow: document.getElementById("mode-dont-show"),
  modePositionBtn: document.getElementById("mode-position-btn"),
  modeElementBtn: document.getElementById("mode-element-btn"),
  settingExecutionSpeed: document.getElementById("setting-execution-speed"),
  settingClickSound: document.getElementById("setting-click-sound"),
  languageSelector: document.getElementById("language-selector"),
  settingSkipNewRecording: document.getElementById("setting-skip-new-recording"),
  settingSkipDisplayMoves: document.getElementById("setting-skip-display-moves"),
  settingSkipMode: document.getElementById("setting-skip-mode"),
  settingDarkTheme: document.getElementById("setting-dark-theme")
};

const iconSet = globalThis.clickRepeaterLucideIcons;
