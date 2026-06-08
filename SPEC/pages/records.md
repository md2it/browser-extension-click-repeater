# CLICKS PAGE

- Contains:
   - "RECORD" button
   - A vertical list of existing click cards below it

## Each entry
- Displayed in one inline row
- Left-aligned:
   - Lucide play icon, which starts execution mode
   - Icon, not a button, based on mode: code / crosshair
   - Icon, not a button, based on visibility: eye / eye-off
   - Name as non-clickable text
- Right-aligned:
   - Star for the default
   - Repeat-count field, the same width as the buttons
   - Lucide square-pen icon, which opens the edit modal
   - trash-2
      - First click on the default button state expands and colors the button and adds clarification text
      - Second click on the expanded button deletes the entry
      - Removing hover from the expanded button collapses it to the default state
