# MACRO EXECUTION MODE

---

## START AND STOP

- Clicking the extension icon in the browser toolbar:
   - Opens the popup
   - Does not start anything
   - Stops the active mode, if one is running
- Creation mode starts only from the button in the popup
- Execution mode starts:
   - From the button for a specific macro in the popup
   - From the shortcut for the default macro

---

## HUMAN BEHAVIOR SIMULATION

### Execution speed

- Speed is controlled by the extension-wide setting: [Settings - Execution speed](../pages/settings.md#settings-page)
- The setting applies to all macros
- Default value: `1×`
- The multiplier applies only to one additional pacing delay after each completed step:
   - `0.25×`: 3500 ms
   - `0.5×`: 1500 ms
   - `1×`: 500 ms
   - `2×`: 0 ms
- All other execution intervals remain unchanged
- The multiplier controls relative pacing but does not guarantee a proportional change in the macro's total duration

### General rules
- Do not jump the cursor
- Calculate the path at runtime
- Use an uneven path
- Add micro-movements
- Randomize by several millimeters
- Randomize the target point
- Offset the click by 1 mm
- Populate movementX
- Populate movementY
- Calculate pauses at runtime
- Do not repeat timing patterns
- Avoid a uniform pace

### Action sequence

Loop conditions:
- A next step exists
- The user has not clicked
- Stop has not been requested

Loop:
1. Prepare the target
    1. Find the element or point. Stop if the target is not found
    2. Set the click point
    3. Offset the click by 1 mm
2. If a path is needed
    1. Calculate the path at runtime
    2. Account for distance
    3. Add micro-movements
    4. Randomize by several millimeters
    5. Send pointermove
    6. Send mousemove
    7. Populate movementX/Y
3. If the target is new
    1. Send pointerover
    2. Send pointerenter
    3. Send mouseover
    4. Send mouseenter
    5. Pause for 80-250 ms
4. Perform the click
    1. Send pointerdown
    2. Send mousedown
    3. Hold for 50-150 ms
    4. Send pointerup
    5. Send mouseup
    6. Pause for 20-120 ms
    7. Send click
5. Complete the step
    1. Pause for 80-250 ms
6. Apply the additional pacing delay defined by the speed setting
7. Start the loop for the next click if:
    - A next step exists
    - The user has not clicked
    - Stop has not been requested
    - The target was found
