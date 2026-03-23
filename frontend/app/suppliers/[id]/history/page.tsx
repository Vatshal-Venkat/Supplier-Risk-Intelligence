"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";

type Assessment = {
  id: number;
  risk_score: number;
  overall_status: string;
  sanctions_flag: boolean;
  section889_status: string;
  news_signal_score: number;
  graph_risk_score: number;
  scoring_version: string;
  initiated_by_user_id: number;
  created_at: string;
};

type DeltaResponse = {
  risk_score_delta: number;
  sanctions_flag_delta: number;
  news_signal_delta: number;
  graph_risk_delta: number;
  section889_change: { from: string; to: string };
  version_change: { from: string; to: string };
  details?: {
    new_sanctions: any[];
    removed_sanctions: any[];
    factor_changes: any[];
    new_reasons: string[];
  };
};

export default function SupplierHistoryPage() {
  const { id } = useParams();
  const [history, setHistory] = useState<Assessment[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [delta, setDelta] = useState<DeltaResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;

    api
      .get(`/suppliers/${id}/history`)
      .then((res) => {
        const sorted = [...res.data].sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );
        setHistory(sorted);
      })
      .catch(console.error);
  }, [id]);

  const latestVersion = history[0]?.scoring_version;

  const toggleSelect = (assessmentId: number) => {
    setSelected((prev) =>
      prev.includes(assessmentId)
        ? prev.filter((i) => i !== assessmentId)
        : prev.length < 2
          ? [...prev, assessmentId]
          : [prev[1], assessmentId]
    );
  };

  const compareSelected = async () => {
    if (selected.length !== 2) return;

    setLoading(true);
    const [a, b] = selected;

    // Ensure we send them in chronological order if possible, or just let backend handle
    // For delta (B-A), usually B is newer. Let's sort them by date.
    const assessA = history.find(h => h.id === a)!;
    const assessB = history.find(h => h.id === b)!;
    
    const [first, second] = new Date(assessA.created_at) < new Date(assessB.created_at) 
      ? [a, b] 
      : [b, a];

    try {
      const res = await api.post(
        `/suppliers/${id}/compare-assessments?assessment_a_id=${first}&assessment_b_id=${second}`
      );
      setDelta(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-[#070b12] text-white px-20 py-16 max-w-5xl mx-auto space-y-14">

        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Assessment History
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Compare snapshots to track compliance delta over time.
          </p>
        </div>

        {/* TIMELINE */}
        <div className="relative border-l border-zinc-800 pl-6 space-y-8">

          {history.map((assessment, index) => {
            const isLatest = index === 0;
            const isSelected = selected.includes(assessment.id);
            const isNewVersion =
              assessment.scoring_version === latestVersion;

            return (
              <div key={assessment.id} className="relative">

                {/* Timeline Dot */}
                <div
                  className={`absolute -left-[30px] top-4 w-4 h-4 rounded-full border-4 border-[#070b12] transition-colors duration-500 z-10 ${isSelected
                      ? "bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                      : "bg-zinc-700"
                    }`}
                />

                <div
                  onClick={() => toggleSelect(assessment.id)}
                  className={`group cursor-pointer p-6 rounded-xl border transition-all duration-300 ${isSelected
                      ? "border-indigo-500 bg-indigo-500/5 shadow-2xl"
                      : "border-zinc-800 bg-[#0c121c] hover:border-zinc-700"
                    }`}
                >

                  {/* Top Row */}
                  <div className="flex justify-between items-center">

                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold font-mono">
                        {assessment.risk_score}
                      </div>

                      <div className="flex gap-2">
                        {isLatest && (
                          <span className="text-[9px] font-bold tracking-widest px-2 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded">
                            LATEST
                          </span>
                        )}

                        {isNewVersion && (
                          <span className="text-[9px] font-bold tracking-widest px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded">
                            ACTIVE
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-zinc-600 font-mono">
                      {new Date(assessment.created_at).toLocaleString()}
                    </div>
                  </div>

                  {/* High Level Stats */}
                  <div className="mt-6 grid grid-cols-3 gap-6 text-xs border-t border-zinc-800/50 pt-4">
                    <div>
                      <span className="text-zinc-600 block uppercase tracking-tighter mb-1">Status</span>
                      <span className={assessment.overall_status === 'PASS' ? 'text-green-400' : 'text-red-400'}>
                        {assessment.overall_status}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-600 block uppercase tracking-tighter mb-1">Sanctions</span>
                      <span>{assessment.sanctions_flag ? "🚨 MATCHED" : "CLEAN"}</span>
                    </div>
                    <div>
                      <span className="text-zinc-600 block uppercase tracking-tighter mb-1">Engine</span>
                      <span className="text-zinc-400">{assessment.scoring_version}</span>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}

        </div>

        {/* COMPARISON ACTION BAR */}
        {selected.length === 2 && (
          <div className="sticky bottom-10 flex justify-center animate-in slide-in-from-bottom-4 duration-300">
            <button
              onClick={compareSelected}
              disabled={loading}
              className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold shadow-2xl transition transform hover:-translate-y-1 active:scale-95 disabled:opacity-50"
            >
              {loading ? "Calculating Delta..." : "Compare Selected Snapshots"}
            </button>
          </div>
        )}

        {/* DELTA PANEL */}
        {delta && (
          <div className="space-y-10 border-t border-zinc-800 pt-12 animate-in fade-in duration-500">

            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Comparison Results</h2>
                <p className="text-zinc-500 text-sm">Visual delta between selected assessment snapshots.</p>
              </div>
              <div className="text-4xl font-black font-mono tracking-tighter">
                {delta.risk_score_delta > 0 ? `+${delta.risk_score_delta}` : delta.risk_score_delta}
                <span className="text-xs uppercase text-zinc-600 ml-2 tracking-widest font-sans">Risk Delta</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* PRIMARY METRICS */}
              <div className="space-y-4 bg-[#0c121c] p-8 rounded-2xl border border-zinc-800">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-6">Component Delta</h3>
                <DeltaRow label="Risk Score" value={delta.risk_score_delta} />
                <DeltaRow label="Sanctions Hits" value={delta.sanctions_flag_delta} />
                <DeltaRow label="Negative News Signal" value={delta.news_signal_delta} />
                <DeltaRow label="Graph Network Exposure" value={delta.graph_risk_delta} />

                <div className="pt-4 border-t border-zinc-800 mt-4 space-y-4">
                  <SimpleDelta label="Section 889 Compliance" from={delta.section889_change.from} to={delta.section889_change.to} />
                  <SimpleDelta label="Scoring Methodology" from={delta.version_change.from} to={delta.version_change.to} />
                </div>
              </div>

              {/* DETAILED INTELLIGENCE DELTA */}
              {delta.details && (
                <div className="space-y-6 bg-[#0c121c] p-8 rounded-2xl border border-zinc-800">
                   <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-2">Detailed Findings</h3>
                   
                   {/* New Sanctions */}
                   <div className="space-y-3">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest flex justify-between">
                        <span>New Sanctions Detected</span>
                        <span className="text-red-400">+{delta.details.new_sanctions?.length || 0}</span>
                      </div>
                      {delta.details.new_sanctions?.length > 0 ? (
                        <div className="space-y-2">
                          {delta.details.new_sanctions.map((s, i) => (
                            <div key={i} className="bg-red-500/5 border border-red-500/20 p-2.5 rounded text-xs flex justify-between">
                               <span className="text-zinc-300 font-medium">{s.checked_name}</span>
                               <span className="text-red-400 font-bold uppercase tracking-tighter">{s.source}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-600 italic">No new sanctions lists matches found.</div>
                      )}
                   </div>

                   {/* Factor Movement */}
                   <div className="space-y-3 pt-2">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Factor Movement</div>
                      <div className="space-y-3">
                        {delta.details.factor_changes?.map((f, i) => (
                          <div key={i} className="flex justify-between items-center text-xs">
                             <div className="text-zinc-400">{f.label}</div>
                             <div className="flex items-center gap-2">
                                <span className="text-zinc-600">{f.from_points} pts</span>
                                <span className="text-zinc-700">→</span>
                                <span className={f.to_points > f.from_points ? 'text-red-400' : 'text-emerald-400'}>
                                  {f.to_points} pts
                                </span>
                             </div>
                          </div>
                        ))}
                        {(!delta.details.factor_changes || delta.details.factor_changes.length === 0) && (
                           <div className="text-xs text-zinc-600 italic">No significant factor movements.</div>
                        )}
                      </div>
                   </div>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </ProtectedRoute>
  );
}

/* ---------- Compact Components ---------- */

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function DeltaRow({ label, value }: { label: string; value: number }) {
  const positive = value > 0;
  const negative = value < 0;

  return (
    <div className="flex justify-between items-center">
      <span className="text-zinc-500">{label}</span>
      <span
        className={`font-medium ${positive
            ? "text-red-400"
            : negative
              ? "text-green-400"
              : "text-white"
          }`}
      >
        {value > 0 ? `+${value}` : value}
      </span>
    </div>
  );
}

function SimpleDelta({
  label,
  from,
  to,
}: {
  label: string;
  from: string;
  to: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="text-white">
        {from} → {to}
      </span>
    </div>
  );
}