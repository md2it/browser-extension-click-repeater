# INTERFACE

- All icons:
   - SVG only
   - Use Lucide icons from the original source
   - Copy them as code and embed them in the project code
- All modal windows:
   - If they do not fit entirely in the popup, they may scroll vertically
   - Can be closed with Esc

## Button colors

- Blue buttons (`btn-primary`, launch button):
   - Blue `#012292` background; white `#fff` icons and text
- White buttons (all other `icon-btn`, `btn`):
   - White/transparent background; dark gray `#4f5570` icons and text
- Exceptions that intentionally differ:
   - Active default-click star: filled yellow `#ffc400` icon
   - Expanded delete button: red `#c83232` background; white text and icon

## Tooltips

- All tooltips are custom; browser-native tooltips (`title`) are not used
- The following rules apply to tooltips outside the menu
- Shown on pointer hover and keyboard focus
- Use one consistent, concise style, are visually separated from the main interface, and provide good readability
- Contain short localized text; a second explanatory line is allowed when needed
- Positioned near the element and remain fully within the popup boundaries
- Menu tooltips use a separate style and are specified separately
