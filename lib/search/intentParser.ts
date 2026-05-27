import OpenAI from "openai";
import { INTENT_MODES, type IntentMode, type ParsedIntent, type ParserSource } from "./types";

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function normalizeIntentMode(mode: string): IntentMode {
  return (INTENT_MODES.find((m) => m === mode) ?? "我不確定") as IntentMode;
}

function ensureNegativeQueryTerms(query: string, negativeTerms: string[]): string {
  const existing = new Set(query.split(/\s+/));
  const missing = negativeTerms.filter((term) => !existing.has(`-${term}`));
  return [query, ...missing.map((term) => `-${term}`)].join(" ").trim();
}

function buildFallbackIntent(input: { intentMode: IntentMode; wanted: string; unwanted: string }): ParsedIntent {
  const negativeTerms = input.unwanted.split(/[、,，\n]/).map((term) => term.trim()).filter(Boolean);
  const intentHint = input.intentMode === "找旅遊" ? "travel" : input.intentMode === "找靈感" ? "inspiration" : "shopping";
  return {
    intentMode: input.intentMode,
    features: [input.wanted],
    keywords: input.wanted.split(/\s+/).filter(Boolean),
    englishKeywords: [intentHint, input.wanted],
    coreClues: [input.wanted],
    negativeTerms,
    searchQueries: [ensureNegativeQueryTerms(`${input.wanted} ${intentHint}`, negativeTerms)]
  };
}

export async function parseIntent(input: {
  intentMode: IntentMode;
  wanted: string;
  unwanted: string;
}): Promise<{ parsedIntent: ParsedIntent; parserSource: ParserSource; errorMessage?: string }> {
  if (!client) {
    return {
      parsedIntent: buildFallbackIntent(input),
      parserSource: "fallback",
      errorMessage: "OPENAI_API_KEY is missing; using fallback parser"
    };
  }

  const modeInstructions: Record<IntentMode, string> = {
    找商品: "偏向商品、品牌、型號、購買意圖與商業結果",
    找旅遊: "偏向地點、住宿、行程、交通與旅遊資訊",
    找靈感: "偏向風格、範例、參考圖、創意方向",
    我不確定: "推斷最可能模式，並提供可執行查詢"
  };

  const prompt = `你是搜尋意圖解析器。回傳 JSON，欄位固定：intentMode,features,keywords,englishKeywords,coreClues,negativeTerms,searchQueries。
intentMode 只能是 ${INTENT_MODES.join("/")}。
模式指引：${modeInstructions[input.intentMode]}
使用者想要：${input.wanted}
使用者不要：${input.unwanted || "(無)"}
規則：
1) features, englishKeywords, coreClues 不可為空陣列。
2) englishKeywords 必須是可用於英文搜尋的片語。
3) searchQueries 至少 2 筆，且反映 intentMode。
4) 如果有 negativeTerms，所有 searchQueries 都要加上 -term。`;

  try {
    const completion = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "intent_parse",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              intentMode: { type: "string" },
              features: { type: "array", items: { type: "string" } },
              keywords: { type: "array", items: { type: "string" } },
              englishKeywords: { type: "array", items: { type: "string" } },
              coreClues: { type: "array", items: { type: "string" } },
              negativeTerms: { type: "array", items: { type: "string" } },
              searchQueries: { type: "array", items: { type: "string" } }
            },
            required: ["intentMode", "features", "keywords", "englishKeywords", "coreClues", "negativeTerms", "searchQueries"]
          }
        }
      }
    });

    const parsed = JSON.parse(completion.output_text) as ParsedIntent;
    const fallbackNegativeTerms = input.unwanted.split(/[、,，\n]/).map((term) => term.trim()).filter(Boolean);
    const negativeTerms = Array.from(new Set([...(parsed.negativeTerms ?? []), ...fallbackNegativeTerms]));

    return {
      parserSource: "openai",
      parsedIntent: {
        ...parsed,
        intentMode: normalizeIntentMode(parsed.intentMode || input.intentMode),
        features: parsed.features?.length ? parsed.features : [input.wanted],
        keywords: parsed.keywords?.length ? parsed.keywords : input.wanted.split(/\s+/).filter(Boolean),
        englishKeywords: parsed.englishKeywords?.length ? parsed.englishKeywords : [input.wanted],
        coreClues: parsed.coreClues?.length ? parsed.coreClues : [input.wanted],
        negativeTerms,
        searchQueries: (parsed.searchQueries?.length ? parsed.searchQueries : [input.wanted]).map((q) => ensureNegativeQueryTerms(q, negativeTerms))
      }
    };
  } catch (error) {
    return {
      parsedIntent: buildFallbackIntent(input),
      parserSource: "fallback",
      errorMessage: error instanceof Error ? error.message : "OpenAI parse failed"
    };
  }
}
