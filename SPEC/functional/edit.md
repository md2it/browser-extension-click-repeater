# EDITING

## IN A SEPARATE WINDOW

### Settings
- Name field
   - This field receives focus when the window opens
- Settings in one row:
   - Default // button
      - Default: off
      - Use a star / yellow star to show the setting state
   - Visibility // button
      - Visible | Stealth
      - Do not show the word "Visualisation", only Visible | Stealth
      - Default: Visible
      - Use eye / eye-off to show the setting state
      - A dismissible explanation modal is available as described in SPEC/ui/modal-explanations.md
   - Repeat
      - Numeric repeat-count field
      - Sets the number of repetitions of the complete click cycle for each execution
      - Accepts numbers only
      - Maximum: 999
   - Mode // button
      - Position | Element
      - Do not show the word "Mode", only Position | Element
      - Default: Position
      - Use code for Element / crosshair for Position to show the setting state
      - A dismissible explanation modal is available as described in SPEC/ui/modal-explanations.md

### Buttons
- Save and Cancel buttons are located **above** the step list
- Delete is a red Lucide Trash 2 icon in the modal header, at the opposite end from Close

### Step lists
- Read-only
- Content depends on the Mode setting:
   - Position: click positions are listed
   - Element: UI elements to click are listed
- By default, steps are shown in a compact user-readable form:
   - TYPE: grouped text input
   - KEY: single non-text key action
   - HOTKEY: simple keyboard shortcut
   - CLICK: click target based on the current Mode setting
- The compact step list is calculated from saved low-level steps and does not change storage or execution data
- A small toggle below the step list switches to the detailed low-level step view
- The detailed view shows the original stored steps one by one

### Closing the window
- Close icon
- Save and Cancel button actions
- Click outside the window

## IN THE CLICKS LIST

- Buttons and fields that duplicate edit-window behavior work in the same way
- A separate delete action is available
