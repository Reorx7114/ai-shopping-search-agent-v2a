export const INTENT_MODES = ["找商品", "找旅遊", "找靈感", "我不確定"] as const;

export type IntentMode = (typeof INTENT_MODES)[number];
export type ParserSource = "openai" | "fallback";
export type SearchSource = "serpapi" | "local_fallback" | "none";

export type NarrowingOption = {
  id: "A" | "B" | "C" | "D";
  label: string;
  description: string;
  searchQuery: string;
  reason: string;
};

export interface ParsedIntent { intentMode: IntentMode; features: string[]; keywords: string[]; englishKeywords: string[]; coreClues: string[]; negativeTerms: string[]; searchQueries: string[]; }
export interface Candidate { id: string; image: string; title: string; source: string; link: string; snippet?: string; description?: string; category?: string; tags?: string[]; styleKeywords?: string[]; comparisonKeywords?: string[]; substituteFor?: string[]; price?: number; score?: number; }
export interface SelectedCandidatePayload { title: string; source: string; link: string; }
export interface ComparisonRow { candidateId: string; title: string; price: string; style: string; bestFor: string; substituteLevel: "高" | "中" | "低"; cpValue: "高" | "中" | "低"; reason: string; }
export interface SearchDebug { searchProvider: "serpapi" | "local_fallback"; serpApiCalls: number; selectedOptionId?: "A" | "B" | "C" | "D"; generatedSearchQueries: string[]; parserSource: ParserSource; intentMode: IntentMode; errorMessage?: string; }

export interface SearchRequest {
  mode?: "narrowing" | "search";
  intentMode: IntentMode;
  wanted?: string;
  unwanted?: string;
  query?: string;
  negativeInput?: string;
  selectedCandidate?: SelectedCandidatePayload;
  refinementType?: "similar";
  originalQuery?: string;
  selectedOption?: NarrowingOption;
}

export interface BlockedSearchResponse { blocked: true; safetyReason: string; candidates: Candidate[]; parsedIntent: null; intentMode: IntentMode; generatedQueries: string[]; errorMessage: string; safetyStage: "pre-parse" | "post-parse" | "pre-serpapi"; matchedSafetyTerm?: string; }
export interface NarrowingResponse { mode: "narrowing"; parsedIntent: ParsedIntent; options: NarrowingOption[]; debug: SearchDebug; }
export interface ResultsResponse { mode: "results"; parsedIntent: ParsedIntent | null; candidates: Candidate[]; comparisonTable: ComparisonRow[]; comparisonSummary: string; debug: SearchDebug; }

export type SearchApiResponse = BlockedSearchResponse | NarrowingResponse | ResultsResponse;
