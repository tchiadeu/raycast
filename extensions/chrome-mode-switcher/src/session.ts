import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// Chromium writes the Browser session ID as the AppleScript window ID.
// Command 9 (window type) and 14 (window bounds) both start with that ID.
export function sessionWindowIds(data: Buffer): Set<number> {
  const ids = new Set<number>();
  if (data.length < 8 || data.toString("ascii", 0, 4) !== "SNSS") return ids;

  let offset = 8;
  while (offset + 2 <= data.length) {
    const size = data.readUInt16LE(offset);
    offset += 2;
    if (size < 1 || offset + size > data.length) break;
    const command = data[offset];
    if ((command === 9 || command === 14) && size >= 5) {
      ids.add(data.readInt32LE(offset + 1));
    }
    offset += size;
  }
  return ids;
}

export async function windowProfiles(chromeDirectory: string, profileIds: string[]): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  for (const profileId of profileIds) {
    const directory = path.join(chromeDirectory, profileId, "Sessions");
    let files: string[];
    try {
      files = (await readdir(directory)).filter((name) => name.startsWith("Session_")).sort().reverse();
    } catch {
      continue;
    }
    for (const file of files) {
      try {
        for (const windowId of sessionWindowIds(await readFile(path.join(directory, file)))) {
          if (!result.has(windowId)) result.set(windowId, profileId);
        }
      } catch {
        // Chrome may rotate a session file while it is being read.
      }
    }
  }
  return result;
}
