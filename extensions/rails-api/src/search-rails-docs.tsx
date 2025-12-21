import { ActionPanel, Action, List, Icon, Detail } from "@raycast/api";
import { useFetch } from "@raycast/utils";
import { useState, useMemo } from "react";
import { parse } from "node-html-parser";
import { decode } from "html-entities";

interface SearchData {
  index: {
    searchIndex: string[];
    longSearchIndex: string[];
    info: string[];
  };
}

interface SearchResult {
  name: string;
  type: string;
  path: string;
  namespace: string;
}

function DocumentationDetail({ result }: { result: SearchResult }) {
  const { data: html, isLoading } = useFetch<string>(
    `https://api.rubyonrails.org/${result.path.split("#")[0]}`,
    {
      parseResponse: async (response) => await response.text(),
    }
  );

  const markdown = useMemo(() => {
    if (!html) return "";

    try {
      const doc = parse(html);
      const fragment = result.path.includes("#") ? result.path.split("#")[1] : null;

      let markdown = "";

      if (fragment) {
        const methodElement = doc.getElementById(fragment).parentNode;

        if (methodElement) {
          markdown += `# ${result.name}\n\n`;
          markdown += `**Module:** ${result.type}\n\n`;

          const klass = doc.getElementById("content").querySelector(".type")?.nextElementSibling?.innerText;
          if (klass) {
            markdown += `**Class:** ${klass}\n\n`;
          }

          const descriptionElement = methodElement.querySelector(".description")?.innerHTML;
          if (descriptionElement && descriptionElement.trim() !== "") {
            const description = cleanHtml(descriptionElement);
            markdown += `## Description\n\n${description}\n\n`;
          }

          const sourceLink = methodElement.querySelector(".source-link").innerHTML;
          if (sourceLink && sourceLink.match(/show/)) {
            const sourceCode = methodElement.querySelector(".dyn-source");
            const code = cleanHtml(sourceCode.innerHTML);
            markdown += `## Source Code\n\n${code}\n\n`;
          }
        } else {
          markdown += `# ${result.name}\n\nMethod section not found in documentation.`;
        }
      } else {
        markdown += `# ${result.name}\n\nNo method section.`;
      }

      return markdown || "Documentation not found";
    } catch (error) {
      return "Error loading documentation. Please open in browser.";
    }
  }, [html, result]);

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser url={`https://api.rubyonrails.org/${result.path}`} />
          <Action.CopyToClipboard
            title="Copy URL"
            content={`https://api.rubyonrails.org/${result.path}`}
            shortcut={{ modifiers: ["cmd"], key: "." }}
          />
        </ActionPanel>
      }
    />
  );
}

function cleanHtml(html: string): string {
  const decoded = decode(html);

  return decoded
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (match, content) => {
      const level = match.match(/<h(\d)/)[1];
      return `${"#".repeat(Number(level))} ${content}\n\n`;
    })
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "_$1_")
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "_$1_")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "```ruby\n$1\n```")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function SearchRailsDocs() {
  const [searchText, setSearchText] = useState("");

  const { data: rawData, isLoading } = useFetch<string>(
    "https://api.rubyonrails.org/js/search_index.js",
    {
      keepPreviousData: true,
      execute: true,
      parseResponse: async (response) => await response.text(),
    }
  );

  const searchData = useMemo<SearchResult[]>(() => {
    if (!rawData) return [];

    try {
      const startIndex = rawData.indexOf("{");
      const endIndex = rawData.lastIndexOf("}");
      const jsonString = rawData.substring(startIndex, endIndex + 1);
      const data: SearchData = JSON.parse(jsonString);

      const results: SearchResult[] = [];

      data.index.info.forEach((item) => {
        const [name, type, path, namespace] = item;
        results.push({
          name,
          type,
          path,
          namespace: namespace || "",
        });
      });

      return results;
    } catch (error) {
      return [];
    }
  }, [rawData]);

  const filteredResults = useMemo(() => {
    if (!searchText) return [];

    const query = searchText.toLowerCase();
    return searchData
      .filter((item) => {
        const searchableText = `${item.name} ${item.namespace} ${item.type}`.toLowerCase();
        return searchableText.includes(query);
      })
      .slice(0, 50);
  }, [searchText, searchData]);

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search Rails documentation..."
      throttle
    >
      {searchText === "" ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="Search Rails Documentation"
          description="Type to search through Ruby on Rails API documentation"
        />
      ) : filteredResults && filteredResults.length > 0 ? (
        filteredResults.map((result, index) => (
          <List.Item
            key={`${result.path}-${index}`}
            title={result.name}
            subtitle={result.namespace}
            accessories={[{ text: result.type }]}
            actions={
              <ActionPanel>
                <>
                  <Action.Push
                    title="View Documentation"
                    target={<DocumentationDetail result={result} />}
                  />
                  <Action.OpenInBrowser url={`https://api.rubyonrails.org/${result.path}`} />
                </>
                <Action.CopyToClipboard
                  title="Copy URL"
                  content={`https://api.rubyonrails.org/${result.path}`}
                  shortcut={{ modifiers: ["cmd"], key: "." }}
                />
              </ActionPanel>
            }
          />
        ))
      ) : (
        <List.EmptyView
          icon={Icon.XMarkCircle}
          title="No Results Found"
          description={`No documentation found for "${searchText}"`}
        />
      )}
    </List>
  );
}

