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
- The user clicks elements on the page
- The extension records:
   - Click coordinates
   - Selectors of clicked elements

### Event listeners
- The `click` listener is enabled only during recording
- `recording-click` is not sent outside recording
- Selectors are not generated outside recording
- The listener is removed after recording ends
- `keydown/keyup` events do not record clicks
- Listeners do not block website events
- Do not use `stopPropagation`
- Do not use `preventDefault`

### Ending recording mode
- After finishing the clicks, the user clicks the extension icon again to end the mode
- The popup immediately opens the "Edit" window with prefilled steps:
   - Name:
      - Prefilled by default as `domain + date + time`, for example `google.com 2026-06-02 19:34`. Exclude http, www, /, etc.
      - The text is selected so the user can immediately enter a custom name
   - Repeat = 1
   - All other values use their defaults
   - The user can work with this window in the same way as when editing existing clicks
