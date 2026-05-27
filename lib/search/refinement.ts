import type { ParsedIntent, SelectedCandidatePayload } from "./types";

export function buildRefinedQuery(parsed: ParsedIntent, selectedCandidate?: SelectedCandidatePayload): string {
  const candidateCore = selectedCandidate ? `${selectedCandidate.title} ${selectedCandidate.source} ${selectedCandidate.link}` : "";
  const semantic = [...parsed.features, ...parsed.keywords, ...parsed.coreClues].filter(Boolean).join(" ");
  const base = selectedCandidate ? `${selectedCandidate.title} ${semantic} ${candidateCore}` : parsed.searchQueries[0] ?? parsed.keywords.join(" ");
  const negatives = parsed.negativeTerms.map((term) => `-${term}`).join(" ");
  return `${base} ${negatives}`.trim();
}
