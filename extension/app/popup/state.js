const STORAGE_KEY = "macros_list";
const DEFAULT_MACRO_ID_KEY = "default_macro_id";
const SETTINGS_KEY = "popup_settings";
const macros = [];
let defaultMacroId = null;

const EXECUTION_SPEED_VALUES = [0.25, 0.5, 1, 2];

const settings = {
  executionSpeed: 1,
  skipNewMacroExplanation: false,
  skipDisplayMovesExplanation: false,
  skipModeExplanation: false
};

const state = {
  modalMode: null,
  editMacroId: null,
  editMode: "position",
  pendingDeleteMacroId: null,
  executionPollTimer: null
};

const refs = {
  popup: document.querySelector(".popup-shell"),
  menu: document.querySelector(".popup-menu"),
  menuButtons: document.querySelectorAll(".popup-menu-btn"),
  pages: document.querySelectorAll("[data-page-content]"),
  list: document.getElementById("macros-list"),
  status: document.getElementById("status-line"),
  stopExecutionBtn: document.getElementById("stop-execution-btn"),
  newMacroBtn: document.getElementById("new-macro-btn"),
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
  editModeToggle: document.getElementById("edit-mode-toggle"),
  editModeIcon: document.getElementById("edit-mode-icon"),
  editModeLabel: document.getElementById("edit-mode-label"),
  saveEditBtn: document.getElementById("save-edit-btn"),
  cancelEditBtn: document.getElementById("cancel-edit-btn"),
  newMacroModal: document.getElementById("new-macro-modal"),
  closeNewMacroModalBtn: document.getElementById("close-new-macro-modal-btn"),
  newMacroDontShow: document.getElementById("new-macro-dont-show"),
  newMacroStartBtn: document.getElementById("new-macro-start-btn"),
  newMacroCancelBtn: document.getElementById("new-macro-cancel-btn"),
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
  settingSkipNewMacro: document.getElementById("setting-skip-new-macro"),
  settingSkipDisplayMoves: document.getElementById("setting-skip-display-moves"),
  settingSkipMode: document.getElementById("setting-skip-mode")
};

const iconSet = globalThis.macrosRepeaterLucideIcons;
