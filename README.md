# CLICK REPEATER

=-=-=-=-=-=-=-=-= | [DE](./READMIES/DE.md) | EN | [ES](./READMIES/ES.md) | [FR](./READMIES/FR.md) | [RU](./READMIES/RU.md) | [中文](./READMIES/ZH.md) | [عربي](./READMIES/AR.md) | =-=-=-=-=-=-=-=-=

## INSTALLATION

### Stores

Store versions are not published yet.

### Development mode

Load the entire [`extension`](./extension) directory as an unpacked extension.

## DESCRIPTION

Click Repeater records clicks on a web page and repeats them later.

Create a click sequence once, configure how it should run, and launch it from the extension popup or with a keyboard shortcut. Clicks can target recorded coordinates or page elements.

## KEY FEATURES

- Record click sequences on web pages
- Run clicks in Position or Element mode
- Visible and Stealth execution
- Repeat up to 999 times
- Four execution speed settings
- Set one as default and launch it with a shortcut
- Edit, delete, and reorder saved clicks
- Light and dark themes

## PRIVACY

- No data collection
- No tracking
- No network requests
- Clicks and settings are stored locally in the browser

## INTERFACE LANGUAGES

- English
- Russian
- Spanish
- French
- German
- Simplified Chinese
- Arabic

## USAGE

### Record clicks

1. Open the extension popup
2. Start recording
3. Click the required points or elements on the page
4. Click the extension icon again
5. Name and configure, then save

### Run clicks

1. Open the extension popup
2. Start the required clicks
3. The extension repeats the recorded clicks and reports the result

A user click or `Esc` stops execution. The default can also be launched with `Ctrl+Shift+X` → `M` or, on Mac, `Cmd+Shift+X` → `M`.

See [all user paths](./SPEC/user-path.md) for more details.

## LIMITATIONS

- Browser extensions cannot operate on browser system pages or protected websites
- Element mode depends on recorded elements remaining available on the page
- Position mode depends on the relevant content remaining at the recorded coordinates
- Website changes may prevent older saved clicks from completing
- Simulated pointer movement cannot guarantee native CSS `:hover`; controls revealed only by real cursor hover may not activate
- The extension records and repeats clicks and keyboard input
- Delete / Backspace playback does not work in Google Docs
- Keyboard input into Google Sheets cells does not work
- Simulated clicks may be detected by websites even in Stealth mode — browser-generated events lack the `isTrusted: true` flag that real user interactions carry; sites that check `event.isTrusted` will see through the automation regardless of how the click is dispatched

## LICENSE

[MIT License](./LICENSE)
