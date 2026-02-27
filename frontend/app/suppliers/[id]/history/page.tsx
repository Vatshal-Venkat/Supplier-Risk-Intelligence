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
};

export default function SupplierHistoryPage() {
  const { id } = useParams();
  const [history, setHistory] = useState<Assessment[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [delta, setDelta] = useState<DeltaResponse | null>(null);

  useEffect(() => {
    if (!id) return;

    api
      .get(`/suppliers/${id}/history`)
      .then((res) => {
        // Sort newest first
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
          : prev
    );
  };

  const compareSelected = async () => {
    if (selected.length !== 2) return;

    const [a, b] = selected;

    const res = await api.post(
      `/suppliers/${id}/compare-assessments?assessment_a_id=${a}&assessment_b_id=${b}`
    );

    setDelta(res.data);
  };

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-[#070b12] text-white px-16 py-16 space-y-16">

        <div>
          <h1 className="text-4xl font-semibold">
            Assessment Timeline
          </h1>
          <p className="text-zinc-500 mt-2">
            Historical scoring evolution for this supplier.
          </p>
        </div>

        {/* TIMELINE */}
        <div className="relative pl-10 space-y-12 border-l border-zinc-800">

          {history.map((assessment, index) => {
            const isLatest = index === 0;
            const isSelected = selected.includes(assessment.id);
            const isNewVersion =
              assessment.scoring_version === latestVersion;

            return (
              <div key={assessment.id} className="relative">

                {/* Timeline Dot */}
                <div
                  className={`absolute -left-[11px] top-2 w-5 h-5 rounded-full border-2 ${isLatest
                      ? "bg-indigo-500 border-indigo-400"
                      : "bg-[#070b12] border-zinc-600"
                    }`}
                />

                {/* Card */}
                <div
                  onClick={() => toggleSelect(assessment.id)}
                  className={`cursor-pointer rounded-xl p-6 border transition ${isSelected
                      ? "border-indigo-500 bg-[#0f172a]"
                      : "border-zinc-800 bg-[#0c121c]"
                    }`}
                >

                  {/* Header */}
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold">
                        {assessment.risk_score}
                      </div>

                      {isLatest && (
                        <span className="text-xs bg-indigo-600 px-2 py-1 rounded-full">
                          LATEST
                        </span>
                      )}

                      {isNewVersion && (
                        <span className="text-xs bg-green-600 px-2 py-1 rounded-full">
                          NEW VERSION
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-zinc-500">
                      {new Date(
                        assessment.created_at
                      ).toLocaleString()}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">

                    <Metric label="Status" value={assessment.overall_status} />
                    <Metric label="Section 889" value={assessment.section889_status} />
                    <Metric label="Sanctions" value={assessment.sanctions_flag ? "Yes" : "No"} />
                    <Metric label="Graph Risk" value={assessment.graph_risk_score} />
                    <Metric label="News Signal" value={assessment.news_signal_score} />
                    <Metric label="Version" value={assessment.scoring_version} />

                  </div>

                  <div className="text-xs text-zinc-500 mt-4">
                    Initiated by User ID: {assessment.initiated_by_user_id}
                  </div>

                </div>
              </div>
            );
          })}

        </div>

        {selected.length === 2 && (
          <div>
            <button
              onClick={compareSelected}
              className="px-6 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition"
            >
              Compare Selected Assessments
            </button>
          </div>
        )}

        {/* DELTA PANEL */}
        {delta && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">
              Assessment Delta
            </h2>

            <div className="grid md:grid-cols-2 gap-6">

              <DeltaCard label="Risk Score" value={delta.risk_score_delta} />
              <DeltaCard label="Sanctions Flag" value={delta.sanctions_flag_delta} />
              <DeltaCard label="News Signal" value={delta.news_signal_delta} />
              <DeltaCard label="Graph Risk" value={delta.graph_risk_delta} />

              <DeltaText label="Section 889"
                from={delta.section889_change.from}
                to={delta.section889_change.to}
              />

              <DeltaText label="Scoring Version"
                from={delta.version_change.from}
                to={delta.version_change.to}
              />

            </div>
          </div>
        )}

      </main>
    </ProtectedRoute>
  );
}

/* ---------- Helper Components ---------- */

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-[#101726] border border-zinc-800 rounded-lg p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-sm font-semibold">
        {value}
      </div>
    </div>
  );
}

function DeltaCard({ label, value }: { label: string; value: number }) {
  const positive = value > 0;
  const negative = value < 0;

  return (
    <div className="bg-[#0c121c] border border-zinc-800 rounded-xl p-6">
      <div className="text-sm text-zinc-500 mb-2">{label}</div>
      <div
        className={`text-xl font-bold ${positive ? "text-red-400" : negative ? "text-green-400" : "text-white"
          }`}
      >
        {value}
      </div>
    </div>
  );
}

function DeltaText({
  label,
  from,
  to,
}: {
  label: string;
  from: string;
  to: string;
}) {
  return (
    <div className="bg-[#0c121c] border border-zinc-800 rounded-xl p-6">
      <div className="text-sm text-zinc-500 mb-2">{label}</div>
      <div className="text-white">
        {from} → {to}
      </div>
    </div>
  );
}