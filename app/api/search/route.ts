import { NextResponse } from "next/server";
import { mockCandidates } from "@/mockData";
import { parseIntent } from "@/lib/search/intentParser";
import { rankCandidates } from "@/lib/search/ranking";
import { buildRefinedQuery } from "@/lib/search/refinement";
import { searchImages } from "@/lib/search/serp";
import { buildBlockedResponse, checkGeneratedQueriesSafety, checkParsedIntentSafety, checkSearchSafety } from "@/lib/search/safety";
import type { Candidate, SearchApiResponse, SearchRequest, SearchResponse, SearchSource } from "@/lib/search/types";

export async function POST(request: Request) {
  const apiKeyStatus = {
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    serpApiConfigured: Boolean(process.env.SERPAPI_API_KEY)
  };

  try {
    const body = (await request.json()) as SearchRequest;

    const safety = checkSearchSafety(body);
    if (safety.blocked) {
      return NextResponse.json(buildBlockedResponse(body.intentMode, "pre-parse", safety.matchedTerm));
    }

    const parseResult = await parseIntent({
      intentMode: body.intentMode,
      wanted: body.wanted ?? body.query ?? "",
      unwanted: body.unwanted ?? body.negativeInput ?? ""
    });

    const baseQueries = parseResult.parsedIntent.searchQueries;
    const refined = buildRefinedQuery(
      parseResult.parsedIntent,
      body.refinementType === "similar" ? body.selectedCandidate : undefined
    );
    const generatedQueries = Array.from(new Set([refined, ...baseQueries])).filter(Boolean);

    const postParseSafety = checkParsedIntentSafety(parseResult.parsedIntent, generatedQueries);
    if (postParseSafety.blocked) {
      return NextResponse.json(buildBlockedResponse(body.intentMode, "post-parse", postParseSafety.matchedTerm));
    }

    const preSerpSafety = checkGeneratedQueriesSafety(generatedQueries);
    if (preSerpSafety.blocked) {
      return NextResponse.json(buildBlockedResponse(body.intentMode, "pre-serpapi", preSerpSafety.matchedTerm));
    }

    let candidates: Candidate[] = [];
    let searchSource: SearchSource = "none";
    let errorMessage = parseResult.errorMessage;

    if (apiKeyStatus.serpApiConfigured) {
      const serp = await searchImages(generatedQueries);
      if (serp.errorMessage) {
        errorMessage = errorMessage ? `${errorMessage}; ${serp.errorMessage}` : serp.errorMessage;
      } else {
        candidates = rankCandidates(serp.candidates, parseResult.parsedIntent);
        searchSource = "serpapi";
      }
    } else if (!apiKeyStatus.openaiConfigured && body.mockMode !== false) {
      candidates = rankCandidates(mockCandidates, parseResult.parsedIntent);
      searchSource = "mock";
      errorMessage = errorMessage ?? "Both OPENAI_API_KEY and SERPAPI_API_KEY are missing; using mock data";
    } else {
      errorMessage = errorMessage ?? "SERPAPI_API_KEY is missing; search results are empty";
    }

    const response: SearchResponse = {
      parsedIntent: parseResult.parsedIntent,
      candidates,
      debug: {
        apiKeyStatus,
        parserSource: parseResult.parserSource,
        searchSource,
        intentMode: parseResult.parsedIntent.intentMode,
        generatedQueries,
        errorMessage
      }
    };

    return NextResponse.json(response satisfies SearchApiResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "search_failed";
    return NextResponse.json(
      {
        parsedIntent: null,
        candidates: [],
        debug: {
          apiKeyStatus,
          parserSource: "fallback",
          searchSource: "none",
          intentMode: "我不確定",
          generatedQueries: [],
          errorMessage: message
        }
      } satisfies SearchResponse,
      { status: 500 }
    );
  }
}
