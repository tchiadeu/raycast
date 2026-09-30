#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.title Open Browser
# @raycast.mode silent
# @raycast.packageName Browser Toggle
# @raycast.icon 🌐

set -euo pipefail

STATE_FILE="$HOME/raycast/scripts/.selected-browser"

if [ ! -s "$STATE_FILE" ]; then
  echo "No browser set. Run \"Set Browser\" first."
  exit 1
fi

BUNDLE_ID=$(tr -d '[:space:]' <"$STATE_FILE")

FRONT_ID=$(lsappinfo info -only bundleid "$(lsappinfo front)" | cut -d'"' -f4)

if [ "$FRONT_ID" = "$BUNDLE_ID" ]; then
  osascript -l JavaScript -e 'ObjC.import("AppKit"); $.NSRunningApplication.runningApplicationsWithBundleIdentifier("'"$BUNDLE_ID"'").firstObject.hide' >/dev/null
else
  open -b "$BUNDLE_ID"
fi
