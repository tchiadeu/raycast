#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Connexion Casque
# @raycast.mode silent

# Optional parameters:
# @raycast.icon 🎧

source config.env
bluetoothconnector --connect "$HEADSET"
