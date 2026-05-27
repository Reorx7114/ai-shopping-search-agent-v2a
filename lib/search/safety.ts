import type { IntentMode, ParsedIntent, SearchRequest } from "./types";

const BLOCK_REASON = "此需求可能涉及違法或高風險服務，因此無法協助搜尋。";

type SafetyStage = "pre-parse" | "post-parse" | "pre-serpapi";

const UNSAFE_PATTERNS: Array<{ pattern: RegExp; term: string }> = [
  // weapon
  { pattern: /buy\s+guns?/i, term: "buy gun" },
  { pattern: /where\s+to\s+buy\s+guns?/i, term: "where to buy gun" },
  { pattern: /gun\s+online/i, term: "gun online" },
  { pattern: /firearms?|handgun|rifle|airsoft\s*gun|bb\s*gun|black\s*gun|illegal\s*gun/i, term: "firearm" },
  { pattern: /買槍|哪裡買槍|槍枝?|黑槍|手槍|步槍|子彈|彈藥|花生米|噴子|芭樂|土炮|改槍/i, term: "槍" },
  // sexual
  { pattern: /sexual\s*activity|sex\s*service|female\s*services?|escort|companion|personal\s*companion|overnight\s*companion|one\s*night\s*stand|dating\s*service|adult\s*service|massage\s*service/i, term: "sexual activity" },
  { pattern: /打炮|約砲|找雞|買春|嫖妓|陪睡|過夜|女伴|找女人|女人陪我|茶訊|半套|全套|1s|2s|3s/i, term: "性交易" },
  // vape/tobacco
  { pattern: /vape|e-?cigarette|ecigarette|tobacco|nicotine|smoke\s*shop/i, term: "vape" },
  { pattern: /電子菸|電子煙|菸彈|煙彈|加熱菸|墊子菸|菸|煙/i, term: "電子菸" },
  // drugs
  { pattern: /drugs?|ketamine|heroin|cocaine|meth|amphetamine|mdma|cannabis|marijuana/i, term: "drug" },
  { pattern: /k他命|海洛因|安非他命|搖頭丸|大麻|毒品|毒咖啡包|喪屍菸彈|拿貨|門路/i, term: "毒品" },
  // darknet
  { pattern: /dark\s*web|darknet|onion|black\s*market|illegal\s*market|underground\s*market/i, term: "darknet" },
  { pattern: /暗網|黑市|地下市場|地下交易/i, term: "黑市" },
  // fraud
  { pattern: /fraud|scam|money\s*laundering|fake\s*id|fake\s*passport|stolen\s*credit\s*card|carding|mule\s*account|burner\s*phone/i, term: "fraud" },
  { pattern: /洗錢|詐騙|車手|水房|人頭帳戶|人頭門號|黑卡|盜刷|假證件|假身分證|假護照|假發票|個資買賣/i, term: "詐騙" },
  // facilitation
  { pattern: /how\s*not\s*to\s*get\s*caught|avoid\s*police|anonymous\s*purchase|no\s*record|private\s*deal/i, term: "avoid police" },
  { pattern: /不被抓|避開警察|匿名購買|不留紀錄|私下交易|隱密配送|哪裡拿貨|哪裡有門路/i, term: "不被抓" }
];

export interface SafetyCheckResult {
  blocked: boolean;
  reason?: string;
  matchedTerm?: string;
}

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function checkSafetyText(text: string): SafetyCheckResult {
  const normalized = normalizeText(text);
  for (const rule of UNSAFE_PATTERNS) {
    if (rule.pattern.test(normalized)) {
      return { blocked: true, reason: BLOCK_REASON, matchedTerm: rule.term };
    }
  }
  return { blocked: false };
}

export function buildSafetyInput(body: SearchRequest): string {
  return [
    body.query,
    body.wanted,
    body.negativeInput,
    body.unwanted,
    body.selectedCandidate?.title,
    body.selectedCandidate?.source,
    body.selectedCandidate?.link,
    body.refinementType,
    body.intentMode
  ]
    .filter(Boolean)
    .join(" ");
}

export function checkSearchSafety(body: SearchRequest): SafetyCheckResult {
  return checkSafetyText(buildSafetyInput(body));
}

export function checkParsedIntentSafety(parsedIntent: ParsedIntent, generatedQueries: string[]): SafetyCheckResult {
  const text = [
    ...parsedIntent.features,
    ...parsedIntent.keywords,
    ...parsedIntent.englishKeywords,
    ...parsedIntent.coreClues,
    ...parsedIntent.negativeTerms,
    ...parsedIntent.searchQueries,
    ...generatedQueries
  ].join(" ");
  return checkSafetyText(text);
}

export function checkGeneratedQueriesSafety(finalQueries: string[]): SafetyCheckResult {
  return checkSafetyText(finalQueries.join(" "));
}

export function buildBlockedResponse(intentMode: IntentMode, stage: SafetyStage, matchedSafetyTerm?: string) {
  return {
    blocked: true,
    safetyReason: BLOCK_REASON,
    candidates: [],
    parsedIntent: null,
    intentMode,
    generatedQueries: [],
    errorMessage: "Blocked by safety layer",
    safetyStage: stage,
    matchedSafetyTerm
  };
}
