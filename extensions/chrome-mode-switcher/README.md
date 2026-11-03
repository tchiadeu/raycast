# Chrome Modes

Raycast command for one Chrome profile at a time. It initially selects the profile of Chrome's frontmost window; when no Chrome window is open, it falls back to Chrome's last-used profile. The main list searches open tabs and bookmarks together, with separate icons and sections. `Tab` shows history, and `⇧Tab` returns to tabs and bookmarks. Choose a Chrome profile from the dropdown beside the search field.

Press `↵` on a selected result to focus its tab or open its URL in the selected profile. Selecting a bookmark focuses its existing tab if that URL is already open in the selected profile. Without a search, the first row opens a blank tab. If you type a URL or domain, the first row opens it directly; otherwise, it searches Google. Press `↓` to select a matching tab, bookmark or history entry. `⌘N` always opens a blank tab. Chrome actions close Raycast.

## Install

Run `npm install && npm run dev` in this folder. Raycast imports the command in development mode. On this Mac, **Chrome Modes → New Tab** uses `⌃⌥⇧T` in Raycast; the existing Chrome-only Karabiner mapping sends `⌘T` to that hotkey.

The command reads Chrome's profile metadata, bookmarks, history database and session files locally. macOS may ask Raycast for permission to control Google Chrome on first use.
