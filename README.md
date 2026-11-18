# Zotero "Open With"

A small Zotero plugin (Zotero 8–10) that adds **Open with Adobe Acrobat** to the item
right-click menu. Your normal PDF handler (double-click / Enter) is untouched, so you can keep
reading in your preferred viewer and send a PDF to a second app only when you want to comment.

- Right-click a **PDF attachment** → opens that PDF.
- Right-click a **parent item** → opens its best PDF (same one double-click would pick).
- Multiple selection → each PDF opens once (asks first if more than 5).
- The entry is hidden when nothing selected has a PDF.

## Build

```powershell
pwsh .\build.ps1
```

On Linux/macOS (needs `zip`):

```sh
sh ./build.sh
```

Both produce `build/zotero-open-with.xpi`.

## Install

Zotero → **Tools → Plugins** → gear icon → **Install Plugin From File…** → pick the `.xpi`.

## Configure

Zotero → **Settings → Open With**

- **Application path** — leave empty to auto-detect Adobe Acrobat / Acrobat Reader, or click
  **Browse…** to pick any `.exe` (any PDF app works).
- **Display name** — optional; otherwise derived from the executable (`Acrobat.exe` → "Adobe Acrobat").

Prefs: `extensions.zotero-open-with.appPath`, `extensions.zotero-open-with.appName`.

## Notes

- Acrobat stores comments inside the PDF file. Zotero's reader shows such embedded annotations
  separately from its own (they can be imported).
- While Acrobat has a file open it may be locked, so Zotero file sync can skip it until closed.
- Errors are logged to Help → Debug Output Logging, prefixed `[Open With]`.
