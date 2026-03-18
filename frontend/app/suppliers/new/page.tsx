"use client";

import { useState } from "react";
import { supplierAPI } from "@/lib/api";
import { useRouter } from "next/navigation";

type Match = {
  supplier_id: number;
  canonical_name: string;
  confidence: number;
  country: string;
  industry: string;
  address?: string;
};

type DisambigState = "idle" | "checking" | "selecting" | "confirmed" | "new";

export default function NewSupplierPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [industry, setIndustry] = useState("");
  const [naicsCode, setNaicsCode] = useState("");

  const [matches, setMatches] = useState<Match[]>([]);
  const [disambigState, setDisambigState] = useState<DisambigState>("idle");
  const [confirmedMatch, setConfirmedMatch] = useState<Match | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkEntity = async () => {
    if (!name.trim() || name.trim().length < 3) return;
    setDisambigState("checking");
    setError(null);
    try {
      const res = await supplierAPI.resolveIdentity(name.trim());
      const found: Match[] = res.data.matches || [];
      setMatches(found);
      if (found.length > 0) {
        setDisambigState("selecting");
      } else {
        setDisambigState("new");
      }
    } catch {
      setError("Entity resolution failed. Please try again.");
      setDisambigState("idle");
    }
  };

  const selectMatch = (match: Match) => {
    setConfirmedMatch(match);
    setDisambigState("confirmed");
  };

  const continueAsNew = () => {
    setConfirmedMatch(null);
    setDisambigState("new");
  };

  const resetDisambig = () => {
    setMatches([]);
    setConfirmedMatch(null);
    setDisambigState("idle");
  };

  const handleSubmit = async () => {
    if (disambigState !== "new" && disambigState !== "confirmed") return;
    setSubmitting(true);
    setError(null);
    try {
      if (confirmedMatch) {
        router.push(`/assessment/${confirmedMatch.supplier_id}`);
        return;
      }
      await supplierAPI.create({ name, country, industry, naics_code: naicsCode });
      router.push("/suppliers");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to create supplier.");
    } finally {
      setSubmitting(false);
    }
  };

  const isReady = disambigState === "new" || disambigState === "confirmed";

  return (
    <main className="min-h-screen bg-[#070b12] text-white flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl space-y-6">

        {/* Header */}
        <div className="space-y-2 mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Register Supplier</h1>
          <p className="text-gray-500 text-sm">
            Entity identity resolution ensures you assess the correct legal entity.
          </p>
        </div>

        {/* Step 1: Name + Entity Check */}
        <div className="border border-zinc-800 bg-[#0b111b] rounded-xl p-6">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
            <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-bold ${isReady ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"}`}>
              {isReady ? "✓" : "1"}
            </span>
            Legal Entity Name
          </div>

          <div className="flex gap-3">
            <input
              className="flex-1 px-4 py-2.5 bg-[#0e1623] border border-zinc-800 rounded-lg focus:outline-none focus:border-indigo-500/50 transition text-sm disabled:opacity-50"
              placeholder="e.g. Acme Steel Inc"
              value={name}
              onChange={e => { setName(e.target.value); resetDisambig(); }}
              disabled={disambigState === "checking"}
            />
            <button
              onClick={checkEntity}
              disabled={name.trim().length < 3 || disambigState === "checking"}
              className="px-4 py-2.5 text-sm border border-indigo-500/60 text-indigo-400 bg-indigo-500/10 rounded-lg hover:bg-indigo-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {disambigState === "checking" ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                  Checking…
                </span>
              ) : "Check Entity"}
            </button>
          </div>

          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </div>

        {/* Step 2: Disambiguation Panel */}
        {disambigState === "selecting" && (
          <div className="border border-amber-500/20 bg-amber-500/[0.03] rounded-xl p-6 space-y-4">
            <div className="flex items-start gap-3 pb-4 border-b border-amber-500/10">
              <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-300">Did you mean one of these?</p>
                <p className="text-xs text-gray-500 mt-0.5">Select the correct legal entity to proceed, or continue as a new entity.</p>
              </div>
            </div>

            <div className="space-y-3">
              {matches.map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => selectMatch(m)}
                  className="flex items-center gap-4 p-4 bg-[#0e1623] border border-zinc-700/50 rounded-lg hover:border-indigo-500/40 hover:bg-[#101828] transition group cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{m.canonical_name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                      <span className="text-[11px] text-gray-400">🌍 {m.country}</span>
                      <span className="text-gray-700">·</span>
                      <span className="text-[11px] text-gray-400">{m.industry}</span>
                      {m.address && (
                        <>
                          <span className="text-gray-700">·</span>
                          <span className="text-[11px] text-gray-500 truncate max-w-xs">{m.address}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[10px] text-gray-600 font-mono hidden sm:block">{m.confidence}% match</span>
                    <span className="px-3 py-1.5 text-[11px] font-semibold text-indigo-300 border border-indigo-500/40 rounded-lg bg-indigo-500/10 group-hover:bg-indigo-500/20 transition whitespace-nowrap">
                      Select →
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={continueAsNew}
              className="w-full py-2.5 text-xs text-gray-500 hover:text-gray-300 border border-zinc-800 hover:border-zinc-700 rounded-lg transition"
            >
              None of these — register as a new entity
            </button>
          </div>
        )}

        {/* Confirmed entity banner */}
        {disambigState === "confirmed" && confirmedMatch && (
          <div className="border border-green-500/25 bg-green-500/[0.04] rounded-xl p-5 flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-300">Entity Confirmed</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {confirmedMatch.canonical_name} · {confirmedMatch.country} · {confirmedMatch.industry}
              </p>
            </div>
            <button onClick={resetDisambig} className="text-xs text-gray-600 hover:text-gray-400 transition">Change</button>
          </div>
        )}

        {/* No match banner */}
        {disambigState === "new" && (
          <div className="border border-zinc-700/50 rounded-xl px-5 py-3 flex items-center gap-3 text-sm text-gray-400 bg-[#0b111b]">
            <span className="flex-shrink-0 text-[10px] uppercase tracking-widest font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded">New</span>
            No existing entities matched. Fill in details below to register.
            <button onClick={resetDisambig} className="ml-auto text-xs text-gray-600 hover:text-gray-400 transition">
              Reset
            </button>
          </div>
        )}

        {/* Step 3: Registration Details (only for new entities) */}
        {disambigState === "new" && (
          <div className="border border-zinc-800 bg-[#0b111b] rounded-xl p-6 space-y-4">
            <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2">
              <span className="w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">2</span>
              Supplier Details
            </div>
            <input
              className="w-full px-4 py-2.5 bg-[#0e1623] border border-zinc-800 rounded-lg focus:outline-none focus:border-white/30 transition text-sm"
              placeholder="Country (e.g. United States)"
              value={country}
              onChange={e => setCountry(e.target.value)}
            />
            <input
              className="w-full px-4 py-2.5 bg-[#0e1623] border border-zinc-800 rounded-lg focus:outline-none focus:border-white/30 transition text-sm"
              placeholder="Industry (e.g. Manufacturing)"
              value={industry}
              onChange={e => setIndustry(e.target.value)}
            />
            <input
              className="w-full px-4 py-2.5 bg-[#0e1623] border border-zinc-800 rounded-lg focus:outline-none focus:border-white/30 transition text-sm"
              placeholder="NAICS Code (optional)"
              value={naicsCode}
              onChange={e => setNaicsCode(e.target.value)}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => router.back()}
            className="px-5 py-2.5 text-sm border border-zinc-700 hover:border-zinc-500 rounded-lg text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isReady || submitting}
            className="flex-1 px-6 py-2.5 rounded-lg border text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed border-white hover:bg-white hover:text-black flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                Processing…
              </>
            ) : confirmedMatch ? (
              "Run Assessment on this Entity →"
            ) : (
              "Register & Continue"
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
