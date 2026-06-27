# SOUND EFFECTS

- Each successfully executed scenario click plays a short sound imitating a mouse click.
- Each successfully executed scenario key press plays a short sound imitating a keyboard key press.
- Key release actions do not play a sound.
- Sounds are controlled by the extension-wide "Sound effects" setting.
- The setting is enabled by default at the loud volume level.
- Each click on the setting cycles to the next volume level.
- When set to silent, scenario execution sounds are silent.
- Sounds are generated locally and do not require network access.

## Sound types

- Click sound:
   - Plays for every successfully executed click action.
   - Keeps the current mouse-click sound unchanged.
- Key press sound:
   - Plays for every successfully executed key down action.
   - Has the same perceived volume as the click sound.
   - Must clearly differ from the click sound.
   - Uses a duller, softer transient resembling a physical keyboard key press.

## Volume

- Sound-effect volume follows the user's operating-system and output-device volume.
- The extension must not read, change, bypass, or reset system volume or audio-device settings.
- Sound effects have three extension-controlled internal gain levels:
   - `volume`: silent; click gain `0`; key press gain `0`; gray icon.
   - `volume-1`: quiet; click gain `0.14`; key press gain `0.07`; light-blue icon.
   - `volume-2`: loud; click gain `0.28`; key press gain `0.14`; blue icon.
- The setting is shown as an icon button, not as a toggle.
- The icon button uses the Lucide `volume`, `volume-1`, and `volume-2` icons for the three levels.
- Future changes to internal gain must preserve sufficient audibility without clipping or dominating other audio.

## Implementation

- Sounds are generated with the Web Audio API and routed to the current system output.
- One audio context is reused for the complete scenario and released after completion, user interruption, or an execution error.
- Closing or navigating the tab also releases the audio context through browser lifecycle cleanup.
- While a scenario is running, an approximately `-120 dBFS`, 30 Hz keep-alive signal maintains an active Bluetooth audio channel. This is required for reliable system-volume synchronisation with wireless headphones such as AirPods.
- The keep-alive signal starts with scenario execution and stops when execution ends. It must remain effectively inaudible and must not alter other audio streams or device settings.
- Audible click and key press sounds are separate short transients played through the same audio context.
