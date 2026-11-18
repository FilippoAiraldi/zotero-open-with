#!/usr/bin/env sh
# Packages the plugin into build/zotero-open-with.xpi (requires `zip`)
set -eu

cd "$(dirname "$0")"

FILES="manifest.json bootstrap.js openWith.js prefs.js preferences.xhtml preferences.js locale icons"

for f in $FILES; do
    [ -e "$f" ] || { echo "Missing: $f" >&2; exit 1; }
done

command -v zip >/dev/null 2>&1 || { echo "Error: 'zip' not found (e.g. sudo apt install zip)" >&2; exit 1; }

mkdir -p build
rm -f build/zotero-open-with.xpi
# shellcheck disable=SC2086
zip -r -9 -X build/zotero-open-with.xpi $FILES

echo "Built $(pwd)/build/zotero-open-with.xpi"
