#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.title Set Browser
# @raycast.mode compact
# @raycast.packageName Browser Toggle
# @raycast.icon 🌐
# @raycast.argument1 { "type": "dropdown", "placeholder": "Browser", "data": [{"title": "Arc", "value": "company.thebrowser.Browser"}, {"title": "Google Chrome", "value": "com.google.Chrome"}, {"title": "Firefox", "value": "org.mozilla.firefox"}, {"title": "Safari", "value": "com.apple.Safari"}, {"title": "Microsoft Edge", "value": "com.microsoft.edgemac"}, {"title": "Zen", "value": "app.zen-browser.zen"}] }

set -euo pipefail

STATE_FILE="$HOME/raycast/scripts/.selected-browser"
BUNDLE_ID="$1"

if ! NAME=$(osascript -e "name of application id \"$BUNDLE_ID\"" 2>/dev/null); then
  echo "Not installed: $BUNDLE_ID"
  exit 1
fi

mkdir -p "$(dirname "$STATE_FILE")"
printf '%s\n' "$BUNDLE_ID" >"$STATE_FILE"

echo "Browser set to $NAME"
