#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Rails server
# @raycast.mode silent

# Optional parameters:
# @raycast.icon 🖥️


osascript <<EOF
tell application "System Events"
  set frontApp to name of first application process whose frontmost is true

  tell application "Finder"
    set screenSize to bounds of window of desktop
    set screenWidth to item 3 of screenSize
    set screenHeight to item 4 of screenSize
  end tell

  set leftWindowWidth to screenWidth * 0.6
  set rightWindowWidth to screenWidth * 0.4
  set fullHeight to screenHeight
  set leftPosX to 0
  set rightPosX to screenWidth * 0.6
  set posY to 0

  tell application process frontApp
    try
      set position of front window to {leftPosX, posY}
      set size of front window to {leftWindowWidth, fullHeight}
    end try
  end tell
end tell

tell application "Warp"
  activate
end tell

tell application "System Events"
  tell application process "Warp"
    set frontmost to true

    keystroke "\"" using {command down}

    set position of front window to {rightPosX, posY}
    set size of front window to {rightWindowWidth, fullHeight}
  end tell
end tell
EOF
