import type { Candidate, ParsedIntent } from "./types";

export function rankCandidates(candidates: Candidate[], parsedIntent: ParsedIntent): Candidate[] {
  const clues = new Set(
    [...parsedIntent.keywords, ...parsedIntent.englishKeywords, ...parsedIntent.coreClues]
      .flatMap((x) => x.toLowerCase().split(/\s+/))
      .filter(Boolean)
  );

  return [...candidates].sort((a, b) => score(b) - score(a));

  function score(candidate: Candidate): number {
    const text = `${candidate.title} ${candidate.source}`.toLowerCase();
    let s = 0;
    for (const clue of clues) {
      if (text.includes(clue)) s += 1;
    }
    for (const neg of parsedIntent.negativeTerms) {
      if (text.includes(neg.toLowerCase())) s -= 2;
    }
    return s;
  }
}
