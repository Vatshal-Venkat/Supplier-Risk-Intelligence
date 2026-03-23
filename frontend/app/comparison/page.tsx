"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/api";

import AnimatedCounter from "@/components/ui/AnimatedCounter";
import DeltaIndicator from "@/components/ui/DeltaIndicator";

type Metrics = {
  risk_score: number;
  sanctions_count: number;
  section_rank: number;
  graph_exposure: number;
  news_signal: number;
};

type SupplierData = {
  id: number;
  name: string;
  metrics: Metrics;
  decision_score: number;
  country?: string;
  industry?: string;
  latest_status?: string;
};

type CompareResponse = {
  supplier_a?: SupplierData;
  supplier_b?: SupplierData;
  comparison?: {
    winner: string;
    score_difference: number;
    confidence_percent: number;
    interpretation: string;
  };
  delta_breakdown?: any;
  error?: string;
};

export default function ComparisonPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ids = searchParams.get("ids");

  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [allSuppliers, setAllSuppliers] = useState<SupplierData[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!ids) {
      // Fetch all suppliers for selection
      api
        .get("/suppliers/with-status")
        .then((res) => setAllSuppliers(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
      return;
    }

    const [a, b] = ids.split(",");

    api
      .get(`/suppliers/compare?supplier_a=${a}&supplier_b=${b}`)
      .then((res) => setData(res.data))
      .catch(() => setData({ error: "Failed to load comparison." }))
      .finally(() => setLoading(false));
  }, [ids]);

  const handleToggleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((s) => s !== id)
        : prev.length < 2
        ? [...prev, id]
        : [prev[1], id]
    );
  };

  const goToComparison = () => {
    if (selected.length === 2) {
      router.push(`/comparison?ids=${selected.join(",")}`);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#070b12] text-white space-y-4">
        <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <div className="text-zinc-500 text-sm animate-pulse">Analyzing comparison data...</div>
      </div>
    );

  if (!ids) {
    const filtered = allSuppliers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.industry?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <main className="min-h-screen px-12 py-16 bg-[#070b12] text-white flex flex-col items-center">
        <div className="max-w-4xl w-full space-y-12">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight">Select 2 Suppliers to Compare</h1>
            <p className="text-zinc-500 max-w-lg mx-auto">
              Benchmark compliance scores, sanctions risk, and enterprise network exposure side-by-side.
            </p>
          </div>

          <div className="relative">
            <input 
              type="text"
              placeholder="Search suppliers by name or industry..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0c121c] border border-zinc-800 rounded-xl px-6 py-4 text-lg focus:outline-none focus:border-indigo-500 transition shadow-2xl"
            />
            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((s) => {
              const isSelected = selected.includes(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => handleToggleSelect(s.id)}
                  className={`p-6 rounded-xl border cursor-pointer transition-all duration-300 group ${
                    isSelected 
                      ? "bg-indigo-500/10 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.1)]" 
                      : "bg-[#0c121c] border-zinc-800 hover:border-zinc-600"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg">{s.name}</h3>
                      <p className="text-xs text-zinc-500 uppercase tracking-widest">{s.industry || "General Industry"}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition ${
                      isSelected ? "bg-indigo-500 border-indigo-500" : "border-zinc-700"
                    }`}>
                      {isSelected && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-4 text-xs font-medium">
                    <span className="text-zinc-500">{s.country || "Global"}</span>
                    {s.latest_status && (
                      <span className={`${
                        s.latest_status === "PASS" ? "text-green-400" : 
                        s.latest_status === "FAIL" ? "text-red-400" : "text-yellow-400"
                      }`}>{s.latest_status}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-12 flex justify-center pt-8">
            <button
              onClick={goToComparison}
              disabled={selected.length < 2}
              className={`px-12 py-4 rounded-full font-bold text-lg transition-all duration-300 transform ${
                selected.length === 2 
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:-translate-y-1 active:scale-95" 
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50"
              }`}
            >
              {selected.length === 2 ? "Run Comparison" : `Select ${2 - selected.length} more`}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (data?.error)
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        {data.error}
      </div>
    );

  if (!data?.supplier_a || !data?.supplier_b)
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Invalid comparison data received.
      </div>
    );

  const a = data.supplier_a;
  const b = data.supplier_b;

  const winner = data.comparison?.winner;

  return (
    <main className="min-h-screen px-12 py-16 bg-[#070b12] text-white space-y-16">

      {/* HEADER */}
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">
          Supplier Comparison
        </h1>

        {data.comparison && (
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <div>
              Winner:{" "}
              <span className="text-green-400 font-medium">
                {winner}
              </span>
            </div>
            <div>
              Score Difference:{" "}
              <span className="text-white">
                {data.comparison.score_difference}
              </span>
            </div>
            <div>
              Confidence:{" "}
              <span className="text-white">
                {data.comparison.confidence_percent}%
              </span>
            </div>
          </div>
        )}

        {data.comparison?.interpretation && (
          <p className="text-zinc-500 text-sm max-w-3xl">
            {data.comparison.interpretation}
          </p>
        )}
      </div>

      {/* SUPPLIER GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

        {[a, b].map((supplier) => {
          const isWinner = supplier.name === winner;

          return (
            <div
              key={supplier.id}
              className="bg-[#0c121c] border border-zinc-800 rounded-xl p-8 space-y-6 relative"
            >
              {isWinner && (
                <div className="absolute top-4 right-4 px-3 py-1 text-xs bg-green-600 text-white rounded-full">
                  WINNER
                </div>
              )}

              <div>
                <h2 className="text-2xl font-semibold">
                  {supplier.name}
                </h2>
              </div>

              {/* Risk Score */}
              <div className="space-y-2">
                <div className="text-sm text-zinc-500">Risk Score</div>
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold">
                    <AnimatedCounter
                      value={supplier.metrics.risk_score}
                    />
                  </div>
                </div>
              </div>

              {/* Decision Score */}
              <div className="space-y-2">
                <div className="text-sm text-zinc-500">
                  Decision Score
                </div>
                <div className="text-xl font-semibold text-indigo-400">
                  {supplier.decision_score}
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <MetricBox
                  label="Sanctions"
                  value={supplier.metrics.sanctions_count}
                />
                <MetricBox
                  label="Graph Exposure"
                  value={supplier.metrics.graph_exposure}
                />
                <MetricBox
                  label="Section 889 Rank"
                  value={supplier.metrics.section_rank}
                />
                <MetricBox
                  label="News Signal"
                  value={supplier.metrics.news_signal}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* DELTA BREAKDOWN */}
      {data.delta_breakdown && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">
            Metric Breakdown
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {Object.entries(data.delta_breakdown).map(
              ([metric, values]: any) => (
                <div
                  key={metric}
                  className="bg-[#0c121c] border border-zinc-800 rounded-xl p-6 space-y-4"
                >
                  <div className="text-sm uppercase tracking-wider text-zinc-500">
                    {metric.replace("_", " ")}
                  </div>

                  <div className="flex justify-between text-sm">
                    <span>{values.supplier_a}</span>
                    <span>{values.supplier_b}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <DeltaIndicator value={values.difference} />
                    <span className="text-xs text-zinc-400">
                      Weight: {values.weight}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-500">
                    Better:{" "}
                    <span className="text-white">
                      {values.better_supplier}
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

    </main>
  );
}

/* ===========================
   Metric Box Component
=========================== */

function MetricBox({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="bg-[#101726] border border-zinc-800 rounded-lg p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-lg font-semibold">
        {value}
      </div>
    </div>
  );
}