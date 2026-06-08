# FAILURE SCENARIOS

---

## CANNOT BE EXECUTED

### General rules
- Execution stops
- Subsequent steps and repetitions do not start
- The user receives a notification explaining why execution stopped:
   1. A small popup with text appears
      - Appearance, disappearance, and proportions follow the popup in SPEC/functional/page-operability.md
      - Differences: notification text states the reason for stopping and uses a different color
   2. A notification is shown in place of the recent-event explanation text in the standard popup
- A failure event is shown in red

### Element not found
- Applies to Element mode
- Reason: "The saved element is missing or can no longer be identified by its selector"
- Notification: "Element not found"

### User stopped execution
- Reason: the user stopped execution
- Notification: "Stopped"

### User started interacting with the page
- Reason: the user clicked during execution
- Notification: "Stopped by user"

### No recorded steps
- Reason: no recorded steps
- Notification: "No steps"

### Other reasons
- The page was closed or reloaded
- The extension lost access to the page
- An internal error occurred
- Any other reason that prevents execution from completing, including unknown reasons
- Notification: "Could not execute"

---

## EXTENSION CANNOT START

- Described in SPEC/functional/page-operability.md
