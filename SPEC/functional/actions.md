# ACTIONS

---

## TABLE OF CONTENTS

- [GENERAL RULES](#general-rules)
- [TIMING](#timing)
   - [Speed setting](#speed-setting)
   - [Base timing](#base-timing)
   - [Speed calculation](#speed-calculation)
   - [Examples](#examples)
   - [Runtime variability](#runtime-variability)
- [POINTER MOVEMENT](#pointer-movement)
   - [Attributes](#attributes)
   - [Calculation](#calculation)
   - [Events](#events)
- [CLICK](#click)
   - [Attributes](#attributes-1)
   - [Target entry and hover](#target-entry-and-hover)
   - [Events](#events-1)
- [KEY DOWN](#key-down)
   - [Attributes](#attributes-2)
   - [Events](#events-2)
- [KEY UP](#key-up)
   - [Attributes](#attributes-3)
   - [Events](#events-3)

---

## GENERAL RULES

- A recorded scenario is an ordered list of actions
- Actions are executed in the same order in which they were recorded
- Pointer movement may be generated during execution when needed for a click
- Keyboard actions do not generate pointer movement
- Pointer actions do not generate keyboard actions

---

## TIMING

### Speed setting

- Speed is controlled by the extension-wide setting: [Settings - Execution speed](../pages/settings.md#settings-page)
- The setting applies to all generated timing during execution
- Default value: `1x`
- Each speed is a positive multiplier, lower or higher than `1`
- Speed lower than `1` slows execution down
- Speed higher than `1` speeds execution up
- Available speed options:
   - `0.5x`
   - `1x`
   - `4x`
   - `10x`

### Base timing

- `1x` is the base timing profile
- Click action:
   - Movement point interval: 12 ms between generated pointer movement points before the click
   - Pause before pressing: 80-140 ms after target entry and before `pointerdown`
   - Button hold: 50-90 ms between `mousedown` and `pointerup`
   - Release-to-click pause: 25-60 ms between `mouseup` and `click`
   - Completed-action pause: 250-450 ms after the click action completes
- Key down action:
   - Completed-action pause: 250-450 ms after the `keydown` action completes
- Key up action:
   - Completed-action pause: 250-450 ms after the `keyup` action completes

### Speed calculation

- For any selected speed, calculate each timing value from the base `1x` value:

  `W = ceil(V / X)`

  Where:
   - `W` is the final timing value in milliseconds
   - `V` is the base timing value at `1x`
   - `X` is the selected positive speed multiplier
- For ranges, apply the formula to both range boundaries
- Round calculated values up to whole milliseconds
- The final value must not be lower than 1 ms

### Examples

  | Base value | Speed | Calculation | Final value |
  |---:|---:|---:|---:|
  | 100 ms | `4x` | `ceil(100 / 4)` | 25 ms |
  | 100 ms | `0.5x` | `ceil(100 / 0.5)` | 200 ms |

### Runtime variability

- Distance may increase pointer movement duration; the multiplier controls relative pacing but does not guarantee a proportional change in total duration
- Calculate pauses at runtime
- Do not repeat timing patterns
- Avoid a uniform overall pace by varying the curve and non-movement pauses

---

## POINTER MOVEMENT

- Moves the virtual pointer from the current point to the target point
- Used before pointer-based actions when the target point differs from the current pointer position
- Does not move the system cursor

### Attributes

- Start point:
   - Current virtual pointer position
- Target point:
   - Click target point for the next click action
- Movement distance:
   - Pixel distance between the start point and target point
- Movement point interval:
   - Defined by the selected execution speed

### Calculation

- Do not jump the cursor
- Calculate the path at runtime
- Use one smooth uneven curve for the complete movement
- Do not apply independent random displacement to every intermediate point
- The number of intermediate movement points depends logarithmically on the distance between the current cursor position and the click point
- Calculate the number of points as:

  `N = round(2 + 5 x log2(1 + D / 10))`

  Where:
   - `N` is the number of movement points
   - `D` is the movement distance in pixels
- Do not apply an additional minimum or maximum limit to `N`
- The interval between movement points is fixed within one speed option
- Do not randomize the interval between individual movement points
- Different speed options may define different fixed movement intervals

### Events

- For each generated movement point, send:
   1. `pointermove`
   2. `mousemove`
- Populate `movementX`
- Populate `movementY`
- Movement events change the virtual cursor position from one calculated point to the next
- The system cursor is not moved

---

## CLICK

- Presses and releases the primary pointer button at the target point
- Includes the required pointer and mouse events
- May use a recorded element selector and/or recorded coordinates as the target

### Attributes

- Target source:
   - Recorded element selector, when element mode is used
   - Recorded coordinates, when position mode is used
- Click point:
   - Calculated from the target source during execution
- Target offset:
   - Randomized within 0.2 mm radius from the click point
- Pointer button:
   - Primary pointer button

### Target entry and hover

- Before clicking a new target, send the target-entry event sequence:
   1. `pointerover`
   2. `pointerenter`
   3. `mouseover`
   4. `mouseenter`
- When leaving the previous target, send the corresponding target-exit events in the correct browser order
- After entering the target, allow a short stabilization period before pressing
- The pause before pressing is the target stabilization period
- Recheck the element at the click point after stabilization and immediately before pressing
- If the target has changed, update the target and send the required exit and entry events before continuing
- Synthetic events support JavaScript hover handlers but do not guarantee native CSS `:hover`
- Do not add fixed 1 px micro-movements solely to force hover; they do not guarantee hover activation
- Native CSS `:hover` has no synthetic fallback because browser-generated trusted pointer movement is required

### Events

- Perform the click with this event sequence:
   1. `pointerdown`
   2. `mousedown`
   3. Hold for the duration defined by the selected speed
   4. `pointerup`
   5. `mouseup`
   6. Pause for the release-to-click duration defined by the selected speed
   7. `click`

---

## KEY DOWN

- Presses a keyboard key
- Records the key identity and required keyboard event data
- Does not imply key release unless a key release action is also recorded

### Attributes

- Key identity:
   - `key`
   - `code`
- Modifier state:
   - `altKey`
   - `ctrlKey`
   - `metaKey`
   - `shiftKey`
- Keyboard event data:
   - `location`
   - `repeat`
   - `isComposing`

### Events

- Send `keydown`
- Preserve the recorded key identity, modifier state, and keyboard event data
- Do not generate a corresponding `keyup`
- Do not generate pointer movement

---

## KEY UP

- Releases a keyboard key
- Records the key identity and required keyboard event data
- Does not imply key press unless a key press action is also recorded

### Attributes

- Key identity:
   - `key`
   - `code`
- Modifier state:
   - `altKey`
   - `ctrlKey`
   - `metaKey`
   - `shiftKey`
- Keyboard event data:
   - `location`
   - `repeat`
   - `isComposing`

### Events

- Send `keyup`
- Preserve the recorded key identity, modifier state, and keyboard event data
- Do not generate a corresponding `keydown`
- Do not generate pointer movement
