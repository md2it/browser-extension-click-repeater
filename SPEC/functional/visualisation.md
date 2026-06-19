# VISUALISATION

## GENERAL

Two modes are supported:
- Visible
	- Renders and animates the pointer
	- Injects elements into the DOM
- Stealth
	- No visualisation
	- No DOM injection

## VISIBLE

The goal is to show every click and continuous movement of the virtual pointer between click points:

- Minimal overlay using a Lucide mouse-pointer icon, white fill, `#012292` stroke, 36x36 px
- The tip of the cursor (top-left corner of the icon) is aligned with the virtual cursor position
- One pointer is animated directly from the previous click point to the next
- Animation duration matches the calculated virtual movement duration
- The visual animation does not need to reproduce every intermediate virtual movement point (but it pretty corresponds)
- On click:
   - Mouse-pointer changes for 50 ms to 54x54 px, then returns to the default state
   - From the click spot, there should be diverging circles alternating `#012292` and white (5 circles total: blue, white, blue, white, blue)

## STEALTH

The goal is to prevent websites from classifying the extension's behavior as automated:

- Does not inject elements into the DOM, except when click visualisation is enabled
- Does not perform obviously suspicious actions
- Is not detected by website security scripts
- Cursor movements and clicks imitate human behavior with slight randomness and unevenness
- Websites should not detect that the extension is present
