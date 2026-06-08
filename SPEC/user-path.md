# USER JOURNEY

## RECORDING CLICKS

1. Launch the extension
2. Start recording
3. Click items on the page
4. Stop recording
5. Optionally configure additional settings

## EXECUTING CLICKS

1. Open the extension popup
2. Start a specific entry
3. Execution runs:
   1. The popup closes
   2. The cursor moves to the first point or element that has not yet been clicked
   3. Click
   4. Repeat steps 3.2-3.3 for each remaining step
   5. Exit the loop after all steps have been clicked
4. The extension completes automatically:
   1. The popup opens with information that execution has completed

### User interruption
- Any user click in the browser interrupts execution
- Switching to another OS window outside the browser does not affect execution
- Clicks outside the browser do not affect execution

### Launch by shortcut
- If a default is set, the shortcut starts it. Step 1 is omitted, step 2 is the shortcut itself, and the remaining steps are unchanged
