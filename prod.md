The `../lib/scripts/minify-and-zip.zsh` script is used:
1. Takes the `/extension` directory
2. Minifies its contents
3. Creates a ZIP archive whose name includes the project name and the version from the manifest
4. Places the ZIP archive in `PUBLICATION/`
The script does not modify anything; it only adds the ZIP archive.
