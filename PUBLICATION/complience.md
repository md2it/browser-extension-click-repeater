# RESPONSES TO MODERATOR QUESTIONS


## Single purpose
Click Repeater records a user-defined sequence of clicks on the current web page and repeats that sequence when the user starts the saved clicks. Users can configure the target mode, visibility, repeat count, and execution speed, and can stop execution at any time. Clicks and preferences are stored locally in the browser. The extension does not collect data, track users, or send page content to any server.

## Permission justification
- `storage`
  Save clicks and preferences locally, including recorded click coordinates and element selectors, click names, repeat counts, execution options, language, theme, and the default. Keep short-lived recording and execution state so the extension can coordinate its popup, background process, and the active page. No data is uploaded or shared.

- `tabs`
  Identify the active tab when the user opens the extension or starts clicks, communicate with the content script in that tab, stop active recording or execution, and open extension-owned notification or welcome pages when required. The extension does not read browsing history or send tab information to external services.

- `scripting`
  Probe whether the extension can operate on the current page when the content script is not yet responding (for example, immediately after a navigation or on a page that loaded before the extension was installed). The probe function runs a minimal operability check and returns a boolean — no page content is read or transmitted.

- `activeTab`
  Confirm that the extension is allowed to interact with the tab the user is currently viewing when they explicitly invoke the extension. No background access to tabs occurs.

- Host access (`<all_urls>` via `content_scripts`)
  Users may need to record and repeat clicks on any website they choose, including localhost, development environments, and public web pages. The content script records clicks only while the user has explicitly started recording and executes only the clicks the user explicitly starts. It does not intercept network requests, collect credentials, or transmit page content.
