import type { Candidate, ParsedIntent } from "./types";

export function rankCandidates(candidates: Candidate[], parsedIntent: ParsedIntent): Candidate[] {
  const clues = new Set(
    [...parsedIntent.features, ...parsedIntent.keywords, ...parsedIntent.englishKeywords, ...parsedIntent.coreClues]
      .flatMap((x) => x.toLowerCase().split(/[\s,，、]+/))
      .filter(Boolean)
  );

  return candidates
    .map((candidate) => ({ ...candidate, score: score(candidate) }))
    .filter((candidate) => (candidate.score ?? 0) > -2)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  function score(candidate: Candidate): number {
    const text = `${candidate.title} ${candidate.source} ${candidate.description ?? ""} ${(candidate.tags ?? []).join(" ")} ${(candidate.styleKeywords ?? []).join(" ")} ${(candidate.comparisonKeywords ?? []).join(" ")} ${(candidate.substituteFor ?? []).join(" ")}`.toLowerCase();
    let s = 0;
    for (const clue of clues) {
      if (text.includes(clue)) s += 2;
    }
    for (const neg of parsedIntent.negativeTerms) {
      if (text.includes(neg.toLowerCase())) s -= 4;
    }
    return s;
  }
}
