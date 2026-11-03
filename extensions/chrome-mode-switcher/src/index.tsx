import { Action, ActionPanel, closeMainWindow, Icon, List, PopToRootType, showToast, Toast } from "@raycast/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  ChromeTab,
  focusTab,
  getBookmarks,
  getHistory,
  getProfiles,
  getTabs,
  HistoryEntry,
  openBookmark,
  openTab,
  Profile,
} from "./chrome";
import { inputUrl } from "./url";

type Mode = "all" | "history";
const TITLES: Record<Mode, string> = { all: "Onglets et favoris", history: "Historique" };

function matches(title: string, url: string, query: string): boolean {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const haystack = `${title} ${url}`.toLocaleLowerCase();
  return words.every((word) => haystack.includes(word));
}

function failure(title: string, error: unknown) {
  const stderr =
    error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
      ? error.stderr.trim()
      : "";
  return showToast({
    style: Toast.Style.Failure,
    title,
    message: stderr || (error instanceof Error ? error.message : String(error)),
  });
}

export default function Command() {
  const [mode, setMode] = useState<Mode>("all");
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("new-tab");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState("");
  const [tabs, setTabs] = useState<ChromeTab[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (selectCurrentChromeProfile = false) => {
    setLoading(true);
    try {
      const { profiles: available, lastUsed } = await getProfiles();
      const { tabs: openTabs, frontProfileId } = await getTabs(available);
      setProfiles(available);
      setTabs(openTabs);
      const initialProfile = frontProfileId || lastUsed || available[0]?.id || "";
      setProfileId((current) => (selectCurrentChromeProfile ? initialProfile : current || initialProfile));
    } catch (error) {
      await failure("Impossible de lire les onglets Chrome", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  useEffect(() => {
    if (!profileId) return;
    let active = true;
    setLoading(true);
    getBookmarks(profileId)
      .then((items) => {
        if (active) setBookmarks(items);
      })
      .catch((error) => failure("Impossible de lire les favoris", error))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profileId]);

  useEffect(() => {
    if (mode !== "history" || !profileId) return;
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      getHistory(profileId, search)
        .then((items) => {
          if (active) setHistory(items);
        })
        .catch((error) => failure("Impossible de lire l’historique", error))
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [mode, profileId, search]);

  const visibleTabs = useMemo(
    () => tabs.filter((tab) => tab.profileId === profileId && matches(tab.title, tab.url, search)),
    [tabs, profileId, search],
  );
  const visibleBookmarks = useMemo(
    () => bookmarks.filter((item) => matches(item.title, item.url, search)),
    [bookmarks, search],
  );
  async function perform(action: () => Promise<void>) {
    try {
      await action();
      await closeMainWindow({ popToRootType: PopToRootType.Immediate });
    } catch (error) {
      await failure("Action Chrome impossible", error);
      void refresh();
    }
  }

  function actions(primaryTitle: string, action: () => Promise<void>) {
    return (
      <ActionPanel>
        <Action title={primaryTitle} onAction={() => perform(action)} />
        {mode === "all" ? (
          <Action
            title="Afficher l’historique"
            onAction={() => {
              setMode("history");
              setSelectedItemId("new-tab");
            }}
            shortcut={{ modifiers: [], key: "tab" }}
          />
        ) : (
          <Action
            title="Afficher les onglets et favoris"
            onAction={() => {
              setMode("all");
              setSelectedItemId("new-tab");
            }}
            shortcut={{ modifiers: ["shift"], key: "tab" }}
          />
        )}
        <Action title="Ouvrir un nouvel onglet" onAction={() => perform(() => openTab(profileId, tabs))} shortcut={{ modifiers: ["cmd"], key: "n" }} />
        <Action title="Actualiser les onglets" onAction={() => void refresh()} shortcut={{ modifiers: ["cmd"], key: "r" }} />
      </ActionPanel>
    );
  }

  const query = search.trim();
  const url = inputUrl(query);
  const fallbackTitle = query ? (url ? `Ouvrir ${url}` : `Rechercher « ${query} » sur Google`) : "Ouvrir un nouvel onglet";
  const fallbackItem = (
    <List.Item
      key="new-tab"
      id="new-tab"
      title={fallbackTitle}
      subtitle={profiles.find((profile) => profile.id === profileId)?.name}
      icon={query ? (url ? Icon.Link : Icon.MagnifyingGlass) : Icon.Plus}
      actions={actions(fallbackTitle, () => openTab(profileId, tabs, query ? (url || `https://www.google.com/search?q=${encodeURIComponent(query)}`) : undefined))}
    />
  );

  return (
    <List
      filtering={false}
      isLoading={loading}
      navigationTitle={`Chrome · ${TITLES[mode]}`}
      searchBarPlaceholder={mode === "all" ? "Rechercher un onglet, un favori ou saisir une URL" : "Rechercher dans l’historique ou saisir une URL"}
      searchText={search}
      onSearchTextChange={(value) => {
        setSearch(value);
        setSelectedItemId("new-tab");
      }}
      selectedItemId={selectedItemId}
      onSelectionChange={(id) => setSelectedItemId(id || "new-tab")}
      searchBarAccessory={
        <List.Dropdown tooltip="Profil Chrome" value={profileId} onChange={setProfileId}>
          {profiles.map((profile) => (
            <List.Dropdown.Item key={profile.id} title={profile.name} value={profile.id} />
          ))}
        </List.Dropdown>
      }
    >
      {fallbackItem}
      {mode === "all" && (
        <List.Section title="Onglets ouverts">
          {visibleTabs.map((tab) => (
            <List.Item
              key={`${tab.windowId}-${tab.index}`}
              id={`${tab.windowId}-${tab.index}`}
              title={tab.title || tab.url}
              subtitle={tab.url}
              icon={Icon.AppWindow}
              actions={actions("Afficher cet onglet", () => focusTab(tab))}
            />
          ))}
        </List.Section>
      )}
      {mode === "all" && (
        <List.Section title="Favoris">
          {visibleBookmarks.map((item) => (
            <List.Item
              key={item.id}
              id={`bookmark-${item.id}`}
              title={item.title}
              subtitle={item.url}
              icon={Icon.Star}
              actions={actions("Afficher ce favori", () => openBookmark(profileId, profiles, item.url))}
            />
          ))}
        </List.Section>
      )}
      {mode === "history" &&
        history.map((item) => (
          <List.Item
            key={item.id}
            id={`history-${item.id}`}
            title={item.title}
            subtitle={item.url}
            icon={Icon.Clock}
            actions={actions("Ouvrir cette page", () => openTab(profileId, tabs, item.url))}
          />
        ))}
    </List>
  );
}
