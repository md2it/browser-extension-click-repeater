# RECORDING MODE

---

## LOGIC

### Starting the mode
1. Use the dedicated button in the popup
2. A dismissible explanation modal is shown as described in SPEC/ui/modal-explanations.md
3. The mode starts:
   - From the button in the modal, if the modal is shown
   - Immediately, if the modal is not shown
4. The popup closes when the mode starts

### During the mode
- The user performs supported actions on the page
- The extension records:
   - Actions described in SPEC/functional/actions.md
   - Click coordinates, for click actions
   - Selectors of clicked elements, for click actions
   - Keyboard event data, for key press and key release actions

### Event listeners
- Action listeners are enabled only during recording
- `recording-click` is not sent outside recording
- Selectors are not generated outside recording
- Listeners are removed after recording ends
- `keydown/keyup` events record only keyboard actions
- Listeners do not block website events
- Do not use `stopPropagation`
- Do not use `preventDefault`

### Ending recording mode
- After finishing the actions, the user clicks the extension icon again to end the mode
- The popup immediately opens the "Edit" window with prefilled steps:
   - Name:
      - Prefilled by default as `domain + date + time`, for example `google.com 2026-06-02 19:34`. Exclude http, www, /, etc.
      - The text is selected so the user can immediately enter a custom name
   - Repeat = 1
   - All other values use their defaults
   - The user can work with this window in the same way as when editing existing recorded scenarios
