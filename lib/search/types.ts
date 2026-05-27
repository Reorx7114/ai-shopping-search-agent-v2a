export const INTENT_MODES = ["找商品", "找旅遊", "找靈感", "我不確定"] as const;

export type IntentMode = (typeof INTENT_MODES)[number];
export type ParserSource = "openai" | "fallback";
export type SearchSource = "local_pool" | "none";

export interface ParsedIntent {
  intentMode: IntentMode;
  features: string[];
  keywords: string[];
  englishKeywords: string[];
  coreClues: string[];
  negativeTerms: string[];
  searchQueries: string[];
}

export interface Candidate {
  id: string;
  image: string;
  title: string;
  source: string;
  link: string;
  snippet?: string;
  description?: string;
  category?: string;
  tags?: string[];
  styleKeywords?: string[];
  comparisonKeywords?: string[];
  substituteFor?: string[];
  price?: number;
  score?: number;
}

export interface SelectedCandidatePayload {
  title: string;
  source: string;
  link: string;
}

export interface SearchRequest {
  intentMode: IntentMode;
  wanted?: string;
  unwanted?: string;
  query?: string;
  negativeInput?: string;
  selectedCandidate?: SelectedCandidatePayload;
  refinementType?: "similar";
}

export interface ComparisonRow {
  candidateId: string;
  title: string;
  price: string;
  style: string;
  bestFor: string;
  substituteLevel: "高" | "中" | "低";
  cpValue: "高" | "中" | "低";
  reason: string;
}

export interface SearchDebug {
  apiKeyStatus: {
    openaiConfigured: boolean;
    serpApiConfigured: boolean;
    useSerp: boolean;
  };
  parserSource: ParserSource;
  searchSource: SearchSource;
  intentMode: IntentMode;
  generatedQueries: string[];
  errorMessage?: string;
}

export interface BlockedSearchResponse {
  blocked: true;
  safetyReason: string;
  candidates: Candidate[];
  parsedIntent: null;
  intentMode: IntentMode;
  generatedQueries: string[];
  errorMessage: string;
  safetyStage: "pre-parse" | "post-parse" | "pre-serpapi";
  matchedSafetyTerm?: string;
}

export interface SearchResponse {
  blocked?: false;
  parsedIntent: ParsedIntent | null;
  candidates: Candidate[];
  comparisonTable: ComparisonRow[];
  comparisonSummary: string;
  debug: SearchDebug;
}

export type SearchApiResponse = SearchResponse | BlockedSearchResponse;
