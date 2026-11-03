const DIRECT_SCHEMES = new Set(["http:", "https:", "chrome:", "file:", "about:"]);

export function inputUrl(input: string): string | undefined {
  const value = input.trim();
  if (!value || /\s/.test(value)) return undefined;

  if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^[^/]+:\d+(?:[/?#]|$)/.test(value)) {
    try {
      const url = new URL(value);
      return DIRECT_SCHEMES.has(url.protocol) ? url.href : undefined;
    } catch {
      return undefined;
    }
  }

  const authority = value.split(/[/?#]/, 1)[0];
  const hostname = authority.replace(/:\d+$/, "");
  const isLocal = hostname === "localhost" || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
  const isDomain = /^(?:[\p{L}\d-]+\.)+[\p{L}]{2,}$/u.test(hostname);
  if (!isLocal && !isDomain) return undefined;

  try {
    const url = new URL(`${isLocal ? "http" : "https"}://${value}`);
    return url.href;
  } catch {
    return undefined;
  }
}

export function sameUrl(a: string, b: string): boolean {
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return a === b;
  }
}
