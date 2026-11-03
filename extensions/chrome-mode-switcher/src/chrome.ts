import { execFile } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { windowProfiles } from "./session";
import { sameUrl } from "./url";

const run = promisify(execFile);
export const CHROME_DIRECTORY = path.join(os.homedir(), "Library/Application Support/Google/Chrome");

export type Profile = { id: string; name: string };
export type ChromeTab = { windowId: number; index: number; title: string; url: string; profileId?: string };
export type Bookmark = { id: string; title: string; url: string };
export type HistoryEntry = { id: number; title: string; url: string; lastVisitTime: number };

export async function getProfiles(): Promise<{ profiles: Profile[]; lastUsed?: string }> {
  const raw = JSON.parse(await readFile(path.join(CHROME_DIRECTORY, "Local State"), "utf8"));
  const info = raw.profile?.info_cache ?? {};
  const profiles: Profile[] = Object.entries(info).map(([id, value]) => ({
    id,
    name: (value as { name?: string }).name || id,
  }));
  return { profiles, lastUsed: raw.profile?.last_used };
}

export async function getTabs(profiles: Profile[]): Promise<{ tabs: ChromeTab[]; frontProfileId?: string }> {
  const script = `
    const chrome = Application("Google Chrome");
    JSON.stringify(chrome.windows().map(w => ({
      id: Number(w.id()),
      tabs: w.tabs().map((t, i) => ({index: i + 1, title: t.title(), url: t.url()}))
    })));
  `;
  const [{ stdout }, mapping] = await Promise.all([
    run("osascript", ["-l", "JavaScript", "-e", script], { maxBuffer: 20 * 1024 * 1024 }),
    windowProfiles(CHROME_DIRECTORY, profiles.map((profile) => profile.id)),
  ]);
  const windows = JSON.parse(stdout) as { id: number; tabs: { index: number; title: string; url: string }[] }[];
  return {
    frontProfileId: mapping.get(windows[0]?.id),
    tabs: windows.flatMap((window) =>
      window.tabs.map((tab) => ({
        ...tab,
        windowId: window.id,
        profileId: mapping.get(window.id),
      })),
    ),
  };
}

export async function getBookmarks(profileId: string): Promise<Bookmark[]> {
  let contents: string;
  try {
    contents = await readFile(path.join(CHROME_DIRECTORY, profileId, "Bookmarks"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const raw = JSON.parse(contents);
  const found: Bookmark[] = [];
  function walk(node: { id?: string; name?: string; type?: string; url?: string; children?: unknown[] }) {
    if (node.type === "url" && node.url) {
      found.push({ id: node.id || node.url, title: node.name || node.url, url: node.url });
    }
    for (const child of node.children || []) walk(child as typeof node);
  }
  for (const root of Object.values(raw.roots || {})) walk(root as Parameters<typeof walk>[0]);
  return found;
}

export async function getHistory(profileId: string, query: string): Promise<HistoryEntry[]> {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raycast-chrome-modes-"));
  const database = path.join(temporary, "History");
  try {
    // Chrome locks the live database. A read-only snapshot avoids changing it.
    await copyFile(path.join(CHROME_DIRECTORY, profileId, "History"), database);
    const escaped = query.trim().replaceAll("'", "''");
    const filter = escaped ? `AND (instr(lower(title), lower('${escaped}')) > 0 OR instr(lower(url), lower('${escaped}')) > 0)` : "";
    const sql = `SELECT id, COALESCE(NULLIF(title, ''), url) AS title, url, last_visit_time AS lastVisitTime FROM urls WHERE hidden = 0 ${filter} ORDER BY last_visit_time DESC LIMIT 200`;
    const { stdout } = await run("sqlite3", ["-readonly", "-json", database, sql], { maxBuffer: 5 * 1024 * 1024 });
    return stdout.trim() ? (JSON.parse(stdout) as HistoryEntry[]) : [];
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function focusTab(tab: ChromeTab): Promise<void> {
  const script = `function run(argv) {
    const chrome = Application("Google Chrome");
    const windowId = Number(argv[0]);
    const tabIndex = Number(argv[1]);
    const targetWindow = chrome.windows().find((window) => Number(window.id()) === windowId);
    if (!targetWindow) throw new Error("Chrome window " + windowId + " is no longer open");
    targetWindow.activeTabIndex = tabIndex;
    targetWindow.index = 1;
    chrome.activate();
  }`;
  await run("osascript", ["-l", "JavaScript", "-e", script, String(tab.windowId), String(tab.index)]);
}

export async function openBookmark(profileId: string, profiles: Profile[], url: string): Promise<void> {
  const { tabs } = await getTabs(profiles);
  const existing = tabs.find((tab) => tab.profileId === profileId && sameUrl(tab.url, url));
  if (existing) {
    await focusTab(existing);
  } else {
    await openTab(profileId, tabs, url);
  }
}

export async function openTab(profileId: string, tabs: ChromeTab[], url?: string): Promise<void> {
  const window = tabs.find((tab) => tab.profileId === profileId);
  if (window) {
    const script = `function run(argv) {
      const chrome = Application("Google Chrome");
      const windowId = Number(argv[0]);
      const targetURL = argv[1];
      const targetWindow = chrome.windows().find((window) => Number(window.id()) === windowId);
      if (!targetWindow) throw new Error("Chrome window " + windowId + " is no longer open");
      targetWindow.tabs.push(targetURL ? chrome.Tab({url: targetURL}) : chrome.Tab());
      targetWindow.activeTabIndex = targetWindow.tabs().length;
      targetWindow.index = 1;
      chrome.activate();
    }`;
    await run("osascript", ["-l", "JavaScript", "-e", script, String(window.windowId), url || ""]);
  } else {
    await run("open", ["-na", "Google Chrome", "--args", `--profile-directory=${profileId}`, url || "about:blank"]);
  }
}
