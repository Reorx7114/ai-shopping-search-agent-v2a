import { NextResponse } from "next/server";
import mockProducts from "@/data/mock-products.json";
import { parseIntent } from "@/lib/search/intentParser";
import { rankCandidates } from "@/lib/search/ranking";
import { searchImages } from "@/lib/search/serp";
import { buildBlockedResponse, checkGeneratedQueriesSafety, checkParsedIntentSafety, checkSearchSafety } from "@/lib/search/safety";
import type { Candidate, ComparisonRow, NarrowingOption, ResultsResponse, SearchApiResponse, SearchRequest } from "@/lib/search/types";

function buildComparisonTable(candidates: Candidate[]): ComparisonRow[] {
  return candidates.slice(0, 5).map((c) => ({ candidateId: c.id, title: c.title, price: c.price ? `$${c.price}` : "N/A", style: c.styleKeywords?.slice(0, 2).join(" / ") ?? "一般", bestFor: c.comparisonKeywords?.[0] ?? "日常", substituteLevel: (c.substituteFor?.length ?? 0) >= 2 ? "高" : "中", cpValue: c.price && c.price < 180 ? "高" : c.price && c.price < 280 ? "中" : "低", reason: `${c.comparisonKeywords?.join("、") ?? "多用途"}，適合${c.tags?.[0] ?? "一般使用"}` }));
}

function buildNarrowingOptions(baseQuery: string, negatives: string[], parsedKeywords: string[], parsedFeatures: string[]): NarrowingOption[] {
  const neg = negatives.map((n) => `-${n}`).join(" ");
  const core = [parsedFeatures[0], parsedKeywords[0], parsedKeywords[1], parsedFeatures[1]].filter(Boolean) as string[];
  const k1 = core[0] ?? "你提到的風格";
  const k2 = core[1] ?? "細節感";
  const k3 = core[2] ?? "入門版本";

  const abc: NarrowingOption[] = [
    { id: "A", label: `偏 ${k1} 的方向`, description: `比較接近你剛剛提到的 ${k1} 感覺。`, reason: `先用 ${k1} 這條線收斂，較容易找到第一批像的商品。`, searchQuery: `${baseQuery} ${k1} style ${neg}`.trim() },
    { id: "B", label: `偏 ${k2} 的方向`, description: `會更重視外觀細節和整體完成度。`, reason: `如果你在意質感與辨識度，這個方向通常更貼近需求。`, searchQuery: `${baseQuery} ${k2} design ${neg}`.trim() },
    { id: "C", label: `偏 ${k3} 的方向`, description: `先從比較好入手、好比較的款式開始。`, reason: `先快速找到相近款，再往你最喜歡的版本縮小。`, searchQuery: `${baseQuery} ${k3} starter ${neg}`.trim() }
  ];

  return [...abc, { id: "D", label: "重新整理方向", description: "如果都不太像，可以重新整理方向或換個描述方式試試看。", reason: "先把方向重新講清楚，通常下一輪會更準。", searchQuery: "" }];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SearchRequest;
    const isSearchMode = body.mode === "search";
    const wanted: string = isSearchMode ? body.originalQuery ?? "" : body.wanted ?? body.query ?? "";
    const unwanted = body.unwanted ?? body.negativeInput ?? "";

    const safety = checkSearchSafety({ intentMode: body.intentMode, query: wanted, negativeInput: unwanted });
    if (safety.blocked) return NextResponse.json(buildBlockedResponse(body.intentMode, "pre-parse", safety.matchedTerm));

    const parseResult = await parseIntent({ intentMode: body.intentMode, wanted, unwanted });
    const generatedQueries = parseResult.parsedIntent.searchQueries;
    const postParseSafety = checkParsedIntentSafety(parseResult.parsedIntent, generatedQueries);
    if (postParseSafety.blocked) return NextResponse.json(buildBlockedResponse(body.intentMode, "post-parse", postParseSafety.matchedTerm));

    const options = buildNarrowingOptions(wanted, parseResult.parsedIntent.negativeTerms, parseResult.parsedIntent.keywords, parseResult.parsedIntent.features);

    if (!isSearchMode) {
      return NextResponse.json({ mode: "narrowing", parsedIntent: parseResult.parsedIntent, options, debug: { searchProvider: "local_fallback", serpApiCalls: 0, generatedSearchQueries: options.filter((o) => o.id !== "D").map((o) => o.searchQuery), parserSource: parseResult.parserSource, intentMode: parseResult.parsedIntent.intentMode, errorMessage: parseResult.errorMessage } } satisfies SearchApiResponse);
    }

    const selected = body.selectedOption;
    if (!selected) {
      return NextResponse.json({ mode: "results", parsedIntent: parseResult.parsedIntent, candidates: [], comparisonTable: [], comparisonSummary: "請先選擇 A/B/C/D 方向。", debug: { searchProvider: "local_fallback", serpApiCalls: 0, generatedSearchQueries: [], parserSource: parseResult.parserSource, intentMode: parseResult.parsedIntent.intentMode, errorMessage: "selectedOption is required in search mode" } } satisfies ResultsResponse, { status: 400 });
    }

    if (selected.id === "D") {
      return NextResponse.json({ mode: "narrowing", parsedIntent: parseResult.parsedIntent, options, debug: { searchProvider: "local_fallback", serpApiCalls: 0, selectedOptionId: "D", generatedSearchQueries: options.filter((o) => o.id !== "D").map((o) => o.searchQuery), parserSource: parseResult.parserSource, intentMode: parseResult.parsedIntent.intentMode, errorMessage: "user requested re-narrowing" } } satisfies SearchApiResponse);
    }
    const queries = [selected.searchQuery, ...generatedQueries].slice(0, 2);
    const preSerpSafety = checkGeneratedQueriesSafety(queries);
    if (preSerpSafety.blocked) return NextResponse.json(buildBlockedResponse(body.intentMode, "pre-serpapi", preSerpSafety.matchedTerm));

    const queries = [selected.searchQuery, ...generatedQueries].slice(0, 2);
    const preSerpSafety = checkGeneratedQueriesSafety(queries);
    if (preSerpSafety.blocked) return NextResponse.json(buildBlockedResponse(body.intentMode, "pre-serpapi", preSerpSafety.matchedTerm));

    const useSerp = process.env.USE_SERP === "true" && Boolean(process.env.SERPAPI_API_KEY);
    let candidates: Candidate[] = [];
    let provider: "serpapi" | "local_fallback" = "local_fallback";
    let serpApiCalls = 0;
    let errorMessage = parseResult.errorMessage;

    if (useSerp) {
      const serp = await searchImages(queries.slice(0, 2));
      serpApiCalls = serp.calls;
      if (serp.candidates.length > 0) {
        candidates = rankCandidates(serp.candidates, parseResult.parsedIntent).slice(0, 12);
        provider = "serpapi";
      }
      if (serp.errorMessage) errorMessage = errorMessage ? `${errorMessage}; ${serp.errorMessage}` : serp.errorMessage;
    }

    if (candidates.length === 0) {
      candidates = rankCandidates(mockProducts as Candidate[], parseResult.parsedIntent).slice(0, 12);
      provider = "local_fallback";
    }

    const comparisonTable = buildComparisonTable(candidates);
    const response: ResultsResponse = { mode: "results", parsedIntent: parseResult.parsedIntent, candidates, comparisonTable, comparisonSummary: comparisonTable.length ? `已依你選擇的 ${selected.id} 方向完成比較，建議先看前 2 名。` : "本次沒有足夠候選可比較，請調整條件。", debug: { searchProvider: provider, serpApiCalls, selectedOptionId: selected.id, generatedSearchQueries: queries, parserSource: parseResult.parserSource, intentMode: parseResult.parsedIntent.intentMode, errorMessage } };
    return NextResponse.json(response satisfies SearchApiResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "search_failed";
    return NextResponse.json({ mode: "results", parsedIntent: null, candidates: [], comparisonTable: [], comparisonSummary: "", debug: { searchProvider: "local_fallback", serpApiCalls: 0, generatedSearchQueries: [], parserSource: "fallback", intentMode: "我不確定", errorMessage: message } } satisfies ResultsResponse, { status: 500 });
  }
}
