"use client";
import { useState } from "react";
import type { Candidate, IntentMode, NarrowingOption, SearchApiResponse } from "@/lib/search/types";
import { INTENT_MODES } from "@/lib/search/types";

function CandidateImage({ src, alt }: { src: string; alt: string }) { const [failed, setFailed] = useState(false); if (failed || !src) return <div className="h-40 w-full bg-slate-200 text-xs flex items-center justify-center">No Image</div>; return <img src={src} alt={alt} className="h-40 w-full object-cover" onError={() => setFailed(true)} referrerPolicy="no-referrer" />; }
const joinOrFallback = (items?: string[], fallback = "無") => (!items?.length ? fallback : items.join("、"));

export default function Home() {
  const [intentMode, setIntentMode] = useState<IntentMode>("我不確定");
  const [wanted, setWanted] = useState("");
  const [unwanted, setUnwanted] = useState("");
  const [result, setResult] = useState<SearchApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const runSearch = async () => { setLoading(true); try { const r = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "narrowing", intentMode, wanted, unwanted, query: wanted, negativeInput: unwanted }) }); setResult((await r.json()) as SearchApiResponse); setShowDebug(false);} finally { setLoading(false);} };
  const chooseOption = async (option: NarrowingOption) => { setLoading(true); try { const r = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "search", intentMode, originalQuery: wanted, unwanted, negativeInput: unwanted, selectedOption: option }) }); setResult((await r.json()) as SearchApiResponse); setShowDebug(false);} finally { setLoading(false);} };
  const refineLikeThis = async (candidate: Candidate) => chooseOption({ id: "A", label: `延伸 ${candidate.title}`, description: "沿用目前候選延伸搜尋", reason: "根據你偏好的候選再縮小", searchQuery: `${candidate.title} similar` });

  const blocked = result && "blocked" in result && result.blocked ? result : null;
  const narrowing = result && "mode" in result && result.mode === "narrowing" ? result : null;
  const results = result && "mode" in result && result.mode === "results" ? result : null;

  return <main className="mx-auto max-w-5xl p-6 space-y-6"><h1 className="text-2xl font-semibold">AI Shopping Comparison Agent V2A</h1><section className="bg-white rounded-lg border p-4 space-y-3"><div className="flex gap-2 flex-wrap">{INTENT_MODES.map((m) => <button key={m} type="button" className={`px-3 py-1 rounded border ${intentMode === m ? "bg-slate-900 text-white" : "bg-white"}`} onClick={() => setIntentMode(m)}>{m}</button>)}</div><textarea className="w-full border rounded p-2" placeholder="你想找什麼？" value={wanted} onChange={(e) => setWanted(e.target.value)} /><textarea className="w-full border rounded p-2" placeholder="你不想要什麼？例如 家樂福, carrefour" value={unwanted} onChange={(e) => setUnwanted(e.target.value)} /><button type="button" className="px-4 py-2 bg-slate-900 text-white rounded" onClick={runSearch} disabled={loading || !wanted.trim()}>{loading ? "搜尋中..." : "開始比較"}</button></section>

  {result && <section className="space-y-4">{blocked ? <article className="bg-white border rounded-lg p-4">安全提示</article> : null}
    {narrowing ? <article className="bg-white border rounded-lg p-4 space-y-3"><h2 className="font-semibold">請先選擇比較方向</h2><div className="grid md:grid-cols-3 gap-3">{narrowing.options.map((option: NarrowingOption) => <button key={option.id} className="text-left border rounded p-3 hover:bg-slate-50" onClick={() => chooseOption(option)}><p className="font-semibold">{option.id}. {option.label}</p><p className="text-xs text-slate-600">{option.description}</p><p className="text-xs mt-2">理由：{option.reason}</p></button>)}</div><p className="text-sm"><span className="font-medium">解析關鍵字：</span>{joinOrFallback(narrowing.parsedIntent?.keywords)}</p></article> : null}
    {results ? <><article className="bg-white border rounded-lg p-4 space-y-2"><h2 className="text-base font-semibold">AI 解析結果</h2><p className="text-sm"><span className="font-medium">商品特徵：</span>{joinOrFallback(results.parsedIntent?.features)}</p></article><article className="bg-white border rounded-lg p-4 space-y-3"><h3 className="font-semibold">比較表（Comparison First）</h3><p className="text-sm text-slate-600">{results.comparisonSummary}</p><div className="overflow-auto"><table className="w-full text-xs border"><thead className="bg-slate-100"><tr><th className="p-2 border">商品</th><th className="p-2 border">價格</th><th className="p-2 border">風格</th><th className="p-2 border">適合對象</th><th className="p-2 border">平替程度</th><th className="p-2 border">CP 值</th><th className="p-2 border">推薦理由</th></tr></thead><tbody>{results.comparisonTable.map((row) => <tr key={row.candidateId}><td className="p-2 border">{row.title}</td><td className="p-2 border">{row.price}</td><td className="p-2 border">{row.style}</td><td className="p-2 border">{row.bestFor}</td><td className="p-2 border">{row.substituteLevel}</td><td className="p-2 border">{row.cpValue}</td><td className="p-2 border">{row.reason}</td></tr>)}</tbody></table></div></article><div className="grid md:grid-cols-3 gap-4">{results.candidates.map((candidate) => <article key={candidate.id} className="bg-white border rounded overflow-hidden"><CandidateImage src={candidate.image} alt={candidate.title} /><div className="p-3 space-y-2"><h2 className="font-medium text-sm">{candidate.title}</h2><p className="text-xs text-slate-500">{candidate.source}</p><div className="flex gap-2 text-xs"><a href={candidate.link} target="_blank" className="underline" rel="noreferrer">查看連結</a><button type="button" className="underline" onClick={() => refineLikeThis(candidate)}>比較像這個</button></div></div></article>)}</div></> : null}
    <button type="button" className="text-xs underline text-slate-500" onClick={() => setShowDebug((v) => !v)}>{showDebug ? "隱藏除錯資訊" : "顯示除錯資訊"}</button>{showDebug ? <pre className="bg-slate-900 text-slate-100 text-xs p-3 rounded overflow-auto">{JSON.stringify(result, null, 2)}</pre> : null}
  </section>}</main>;
}
