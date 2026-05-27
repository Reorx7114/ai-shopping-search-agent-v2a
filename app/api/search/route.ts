import { NextResponse } from "next/server";
import mockProducts from "@/data/mock-products.json";
import { parseIntent } from "@/lib/search/intentParser";
import { rankCandidates } from "@/lib/search/ranking";
import { buildRefinedQuery } from "@/lib/search/refinement";
import { buildBlockedResponse, checkGeneratedQueriesSafety, checkParsedIntentSafety, checkSearchSafety } from "@/lib/search/safety";
import type { Candidate, ComparisonRow, SearchApiResponse, SearchRequest, SearchResponse } from "@/lib/search/types";

function buildComparisonTable(candidates: Candidate[]): ComparisonRow[] {
  return candidates.slice(0, 5).map((c) => ({
    candidateId: c.id,
    title: c.title,
    price: c.price ? `$${c.price}` : "N/A",
    style: c.styleKeywords?.slice(0, 2).join(" / ") ?? "一般",
    bestFor: c.comparisonKeywords?.[0] ?? "日常",
    substituteLevel: (c.substituteFor?.length ?? 0) >= 2 ? "高" : "中",
    cpValue: c.price && c.price < 180 ? "高" : c.price && c.price < 280 ? "中" : "低",
    reason: `${c.comparisonKeywords?.join("、") ?? "多用途"}，適合${c.tags?.[0] ?? "一般使用"}`
  }));
}

export async function POST(request: Request) {
  const useSerp = process.env.USE_SERP === "true";
  const apiKeyStatus = {
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    serpApiConfigured: Boolean(process.env.SERPAPI_API_KEY),
    useSerp
  };

  try {
    const body = (await request.json()) as SearchRequest;
    const safety = checkSearchSafety(body);
    if (safety.blocked) return NextResponse.json(buildBlockedResponse(body.intentMode, "pre-parse", safety.matchedTerm));

    const parseResult = await parseIntent({ intentMode: body.intentMode, wanted: body.wanted ?? body.query ?? "", unwanted: body.unwanted ?? body.negativeInput ?? "" });
    const refined = buildRefinedQuery(parseResult.parsedIntent, body.refinementType === "similar" ? body.selectedCandidate : undefined);
    const generatedQueries = Array.from(new Set([refined, ...parseResult.parsedIntent.searchQueries])).filter(Boolean);

    const postParseSafety = checkParsedIntentSafety(parseResult.parsedIntent, generatedQueries);
    if (postParseSafety.blocked) return NextResponse.json(buildBlockedResponse(body.intentMode, "post-parse", postParseSafety.matchedTerm));

    const preSerpSafety = checkGeneratedQueriesSafety(generatedQueries);
    if (preSerpSafety.blocked) return NextResponse.json(buildBlockedResponse(body.intentMode, "pre-serpapi", preSerpSafety.matchedTerm));

    const ranked = rankCandidates(mockProducts as Candidate[], parseResult.parsedIntent);
    const candidates = ranked.slice(0, 12);
    const comparisonTable = buildComparisonTable(candidates);
    const comparisonSummary = comparisonTable.length
      ? `已從本地商品池挑出 ${comparisonTable.length} 個候選，優先考慮風格匹配、平替程度與 CP 值，建議先看前 2 名。`
      : "本次沒有足夠候選可比較，請調整條件。";

    const response: SearchResponse = {
      parsedIntent: parseResult.parsedIntent,
      candidates,
      comparisonTable,
      comparisonSummary,
      debug: {
        apiKeyStatus,
        parserSource: parseResult.parserSource,
        searchSource: "local_pool",
        intentMode: parseResult.parsedIntent.intentMode,
        generatedQueries,
        errorMessage: parseResult.errorMessage
      }
    };
    return NextResponse.json(response satisfies SearchApiResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "search_failed";
    return NextResponse.json({ parsedIntent: null, candidates: [], comparisonTable: [], comparisonSummary: "", debug: { apiKeyStatus, parserSource: "fallback", searchSource: "none", intentMode: "我不確定", generatedQueries: [], errorMessage: message } } satisfies SearchResponse, { status: 500 });
  }
}
