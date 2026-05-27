import type { Candidate } from "./types";

interface SerpImageResult { original?: string; thumbnail?: string; title?: string; source?: string; link?: string }

export async function searchImages(queries: string[]): Promise<{ candidates: Candidate[]; calls: number; errorMessage?: string }> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return { candidates: [], calls: 0, errorMessage: "SERPAPI_API_KEY is missing" };

  const collected: Candidate[] = [];
  let calls = 0;
  for (const query of queries.slice(0, 2)) {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_images");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("hl", "zh-tw");
    url.searchParams.set("google_domain", "google.com");

    const response = await fetch(url.toString(), { cache: "no-store" });
    calls += 1;
    if (!response.ok) return { candidates: [], calls, errorMessage: `SerpAPI request failed: ${response.status}` };
    const data = (await response.json()) as { images_results?: SerpImageResult[] };
    for (const [index, item] of (data.images_results ?? []).slice(0, 6).entries()) {
      collected.push({ id: `${query}-${index}-${item.link ?? item.original ?? "unknown"}`, image: item.original ?? item.thumbnail ?? "", title: item.title ?? "Untitled", source: item.source ?? "Unknown", link: item.link ?? "" });
    }
  }
  return { candidates: collected, calls };
}
