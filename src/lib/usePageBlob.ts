/*
 * The packaged ThreeUI pages are loaded by the frame as a URL, so the derived
 * document has to exist somewhere the frame can point at. It is built here from
 * the build-time template: fetch the template once, substitute the tokens, and
 * hand back a blob URL.
 */
import { useEffect, useState } from "react";

export type TemplateFill = Record<string, string>;

/** One fetch per template, shared by every caller for the life of the page. */
const templateCache = new Map<string, Promise<string>>();

function loadTemplate(url: string): Promise<string> {
  const cached = templateCache.get(url);
  if (cached) return cached;
  const pending = fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url} responded ${response.status}`);
    return response.text();
  });
  // A failed load must not be cached, or a retry would replay the same failure.
  pending.catch(() => templateCache.delete(url));
  templateCache.set(url, pending);
  return pending;
}

export type PageBlobState = {
  /** Blob URL for the filled document, or null while it is being prepared. */
  url: string | null;
  /** True while the template is being fetched or the fill is being applied. */
  loading: boolean;
  error: Error | null;
};

/**
 * Fetches `templateUrl`, replaces each token with its value, and returns a blob
 * URL for the result.
 *
 * `fill` is a dependency: a caller that hands over a new entry list must get a
 * new document, or the shelf keeps showing the catalog it was first built with.
 * Callers therefore memoize it on the data it derives from. The template itself
 * is cached per URL, so rebuilding after a data change does not re-download it —
 * the shelf template alone is 870 KB.
 */
export function usePageBlob(templateUrl: string, fill: TemplateFill): PageBlobState {
  const [state, setState] = useState<PageBlobState>({ url: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;

    // An empty URL means the caller has nothing to render yet, so there is no
    // document to fetch and no blob to build.
    if (!templateUrl) {
      setState({ url: null, loading: false, error: null });
      return;
    }

    setState((previous) => ({ ...previous, loading: true, error: null }));

    loadTemplate(templateUrl)
      .then((template) => {
        if (cancelled) return;
        let document = template;
        for (const [token, value] of Object.entries(fill)) {
          document = document.split(token).join(value);
        }
        const missing = document.match(/__DIARY_[A-Z_]+__/);
        if (missing) throw new Error(`template token left unfilled: ${missing[0]}`);
        created = URL.createObjectURL(new Blob([document], { type: "text/html" }));
        setState({ url: created, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ url: null, loading: false, error: error instanceof Error ? error : new Error(String(error)) });
      });

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [templateUrl, fill]);

  return state;
}
