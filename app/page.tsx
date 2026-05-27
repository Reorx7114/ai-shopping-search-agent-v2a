"use client";

import { useState } from "react";
import type { Candidate, IntentMode, SearchApiResponse } from "@/lib/search/types";
import { INTENT_MODES } from "@/lib/search/types";

function CandidateImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return <div className="h-40 w-full bg-slate-200 text-xs flex items-center justify-center">No Image</div>;
  }
  return <img src={src} alt={alt} className="h-40 w-full object-cover" onError={() => setFailed(true)} referrerPolicy="no-referrer" />;
}

function joinOrFallback(items: string[] | undefined, fallback = "無"): string {
  if (!items || items.length === 0) return fallback;
  return items.join("、");
}

export default function Home() {
  const [intentMode, setIntentMode] = useState<IntentMode>("我不確定");
  const [wanted, setWanted] = useState("");
  const [unwanted, setUnwanted] = useState("");
  const [result, setResult] = useState<SearchApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDebug, setShowDebug] = useState<boolean>(false);

  const runSearch = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intentMode,
          wanted,
          unwanted,
          query: wanted,
          negativeInput: unwanted
        })
      });
      const data = (await response.json()) as SearchApiResponse;
      setResult(data);
      setShowDebug(false);
    } finally {
      setLoading(false);
    }
  };

  const refineLikeThis = async (candidate: Candidate) => {
    setLoading(true);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: wanted,
          intentMode,
          negativeInput: unwanted,
          selectedCandidate: {
            title: candidate.title,
            source: candidate.source,
            link: candidate.link
          },
          refinementType: "similar"
        })
      });
      const data = (await response.json()) as SearchApiResponse;
      setResult(data);
      setShowDebug(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Conversational Semantic Search MVP</h1>
      <section className="bg-white rounded-lg border p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {INTENT_MODES.map((mode) => (
            <button key={mode} type="button" className={`px-3 py-1 rounded border ${intentMode === mode ? "bg-slate-900 text-white" : "bg-white"}`} onClick={() => setIntentMode(mode)}>
              {mode}
            </button>
          ))}
        </div>
        <textarea className="w-full border rounded p-2" placeholder="你想找什麼？" value={wanted} onChange={(e) => setWanted(e.target.value)} />
        <textarea className="w-full border rounded p-2" placeholder="你不想要什麼？例如 家樂福, carrefour" value={unwanted} onChange={(e) => setUnwanted(e.target.value)} />
        <button type="button" className="px-4 py-2 bg-slate-900 text-white rounded" onClick={runSearch} disabled={loading || !wanted.trim()}>
          {loading ? "搜尋中..." : "開始搜尋"}
        </button>
      </section>

      {result && (
        <section className="space-y-4">
          {result.blocked ? (
            <article className="bg-white border rounded-lg p-4 space-y-2">
              <h2 className="text-base font-semibold">安全提示</h2>
              <p className="text-sm text-slate-700">這個需求可能涉及違法或高風險服務，因此我不能協助搜尋或提供連結。你可以改搜尋合法、安全的一般商品、旅遊、住宿或靈感內容。</p>
              <button type="button" className="text-xs underline text-slate-500" onClick={() => setShowDebug((v) => !v)} aria-expanded={showDebug}>
                {showDebug ? "隱藏除錯資訊" : "顯示除錯資訊"}
              </button>
              {showDebug ? (
                <pre className="bg-slate-900 text-slate-100 text-xs p-3 rounded overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              ) : null}
            </article>
          ) : (
          <article className="bg-white border rounded-lg p-4 space-y-2">
            <h2 className="text-base font-semibold">AI 解析結果</h2>
            <p className="text-sm"><span className="font-medium">商品特徵：</span>{joinOrFallback(result.parsedIntent?.features)}</p>
            <p className="text-sm"><span className="font-medium">搜尋關鍵字：</span>{joinOrFallback(result.parsedIntent?.keywords)}</p>
            <p className="text-sm"><span className="font-medium">英文搜尋詞：</span>{joinOrFallback(result.parsedIntent?.englishKeywords)}</p>
            <p className="text-sm"><span className="font-medium">重要線索：</span>{joinOrFallback(result.parsedIntent?.coreClues)}</p>
            <p className="text-sm"><span className="font-medium">排除條件：</span>{joinOrFallback(result.parsedIntent?.negativeTerms, "無")}</p>
            <p className="text-sm"><span className="font-medium">搜尋查詢：</span>{joinOrFallback(result.parsedIntent?.searchQueries)}</p>
            <p className="text-sm text-slate-600 pt-1">
              {result.candidates.length > 0 ? "已為你找到候選商品。" : "目前沒有找到候選商品，請換個說法或放寬條件。"}
            </p>
            <button type="button" className="text-xs underline text-slate-500" onClick={() => setShowDebug((v) => !v)} aria-expanded={showDebug}>
              {showDebug ? "隱藏除錯資訊" : "顯示除錯資訊"}
            </button>
            {showDebug ? (
              <pre className="bg-slate-900 text-slate-100 text-xs p-3 rounded overflow-auto">
                {JSON.stringify({ parsedIntent: result.parsedIntent, debug: result.debug }, null, 2)}
              </pre>
            ) : null}
          </article>
          )}

          {result.blocked || result.candidates.length === 0 ? null : (
            <div className="grid md:grid-cols-3 gap-4">
              {result.candidates.map((candidate) => (
                <article key={candidate.id} className="bg-white border rounded overflow-hidden">
                  <CandidateImage src={candidate.image} alt={candidate.title} />
                  <div className="p-3 space-y-2">
                    <h2 className="font-medium text-sm">{candidate.title}</h2>
                    <p className="text-xs text-slate-500">{candidate.source}</p>
                    <div className="flex gap-2 text-xs">
                      <a href={candidate.link} target="_blank" className="underline" rel="noreferrer">
                        查看連結
                      </a>
                      <button type="button" className="underline" onClick={() => refineLikeThis(candidate)}>
                        比較像這個
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <button type="button" className="text-sm underline" onClick={() => setResult(null)}>
            這些都不像
          </button>
        </section>
      )}
    </main>
  );
}
