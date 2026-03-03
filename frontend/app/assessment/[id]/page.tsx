"use client";

import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import jsPDF from "jspdf";
import TrustGraph from "@/components/TrustGraph";

type TimelineEvent = {
  timestamp: string;
  label: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
};

type AuditEntry = {
  actor: string;
  action: string;
  timestamp: string;
};

type AssessmentData = {
  supplier: string;
  overall_status: "PASS" | "CONDITIONAL" | "FAIL";
  risk_score: number;
  sanctions: any;
  section_889: any;
  explanations: string[];
  breakdown?: {
    sanctions: number;
    section_889: number;
    news: number;
    graph: number;
  };
  timeline?: TimelineEvent[];
  audit_log?: AuditEntry[];
  risk_history?: number[];
};

export default function AssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<AssessmentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    api
      .get(`/suppliers/${id}/assessment`)
      .then(res => setData(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  const exportPDF = () => {
    if (!data) return;

    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text("Supplier Risk Intelligence Report", 20, 25);
    pdf.setFontSize(12);
    pdf.text(`Supplier: ${data.supplier}`, 20, 40);
    pdf.text(`Risk Score: ${data.risk_score}`, 20, 50);
    pdf.text(`Status: ${data.overall_status}`, 20, 60);

    pdf.save(`${data.supplier}-risk-report.pdf`);
  };

  const riskStyle = (risk: string) => {
    if (risk === "PASS") return "border-green-500 text-green-400";
    if (risk === "CONDITIONAL") return "border-yellow-500 text-yellow-400";
    return "border-red-500 text-red-400";
  };

  const severityStyle = (level: string) => {
    if (level === "LOW") return "text-green-400";
    if (level === "MEDIUM") return "text-yellow-400";
    return "text-red-400";
  };

  const hasTrend = !!data?.risk_history?.length;
  const hasTimeline = !!data?.timeline?.length;
  const hasAudit = !!data?.audit_log?.length;

  const maxRisk = useMemo(() => {
    if (!hasTrend) return 0;
    return Math.max(...(data!.risk_history || []));
  }, [data, hasTrend]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070b12] text-gray-500">
        Loading assessment...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070b12] text-red-500">
        Failed to load assessment.
      </div>
    );
  }

  return (
    <main className="min-h-screen px-16 py-24 bg-[#070b12] text-white">
      <div className="max-w-7xl mx-auto space-y-16">

        {/* Header */}
        <div className="flex justify-between items-start border-b border-zinc-800 pb-8">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">
              {data.supplier}
            </h1>
            <p className="text-gray-500 text-sm mt-2">
              Intelligence risk assessment dossier
            </p>
          </div>

          <div
            className={`px-4 py-1 text-xs tracking-widest border rounded ${riskStyle(
              data.overall_status
            )}`}
          >
            {data.overall_status}
          </div>
        </div>

        {/* Risk Score */}
        <div className="border border-zinc-800 rounded-lg p-8 bg-[#0b111b] flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-widest text-gray-500">
              Overall Risk Score
            </div>
            <div className="text-5xl font-semibold mt-3">
              {data.risk_score}
            </div>
          </div>

          {data.breakdown && (
            <div className="flex-1 border-t md:border-t-0 md:border-l border-zinc-800 pt-6 md:pt-0 md:pl-8">
              <div className="text-xs uppercase tracking-widest text-gray-500 mb-4">
                Risk Breakdown
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Sanctions</span>
                  <span className="font-mono">{data.breakdown.sanctions}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Section 889</span>
                  <span className="font-mono">{data.breakdown.section_889}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Negative Media Signal</span>
                  <span className="font-mono">{data.breakdown.news}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Network & Graph Risk</span>
                  <span className="font-mono">{data.breakdown.graph}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 🔥 Trust Graph Section */}
        <div className="border border-zinc-800 rounded-lg p-8 bg-[#0b111b]">
          <div className="text-xs uppercase tracking-widest text-gray-500 mb-6">
            Trust & Entity Network
          </div>

          <TrustGraph name={data.supplier} />
        </div>

        {/* Risk Trend */}
        <div className="border border-zinc-800 rounded-lg px-6 py-6 bg-[#0b111b]">
          <div className="text-xs uppercase tracking-widest text-gray-500 mb-6">
            Risk Trend
          </div>

          {!hasTrend ? (
            <div className="text-sm text-gray-500">
              None — backend did not provide historical risk data.
            </div>
          ) : (
            <div className="flex items-end gap-4 h-32">
              {data.risk_history!.map((value, index) => (
                <div
                  key={index}
                  className="flex-1 bg-white/10 relative rounded-sm"
                  style={{
                    height: `${(value / maxRisk) * 100}%`,
                  }}
                >
                  <div className="absolute bottom-0 left-0 right-0 h-full bg-white/20 rounded-sm" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 text-xs uppercase tracking-widest text-gray-500 bg-[#0a0f18]">
            Compliance Timeline
          </div>

          <div className="px-6 py-6 space-y-6">
            {!hasTimeline ? (
              <div className="text-sm text-gray-500">
                None — backend did not provide compliance timeline data.
              </div>
            ) : (
              data.timeline!.map((event, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <div>
                    <div className="text-gray-400">
                      {event.timestamp}
                    </div>
                    <div
                      className={`${severityStyle(
                        event.severity
                      )} font-medium`}
                    >
                      {event.label}
                    </div>
                  </div>
                  <div
                    className={`text-xs tracking-widest ${severityStyle(
                      event.severity
                    )}`}
                  >
                    {event.severity}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Audit Log */}
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 text-xs uppercase tracking-widest text-gray-500 bg-[#0a0f18]">
            Audit Log
          </div>

          <div className="px-6 py-6 space-y-4 text-sm text-gray-400">
            {!hasAudit ? (
              <div className="text-sm text-gray-500">
                None — backend did not provide audit log data.
              </div>
            ) : (
              data.audit_log!.map((entry, index) => (
                <div
                  key={index}
                  className="flex justify-between border-b border-zinc-800 pb-3 last:border-none"
                >
                  <div>
                    <span className="text-white">
                      {entry.actor}
                    </span>{" "}
                    — {entry.action}
                  </div>
                  <div className="text-gray-500">
                    {entry.timestamp}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <button
            onClick={() => router.back()}
            className="px-5 py-2 text-sm border border-zinc-700 hover:border-white transition"
          >
            Back
          </button>

          <button
            onClick={exportPDF}
            className="px-5 py-2 text-sm border border-white hover:bg-white hover:text-black transition"
          >
            Export Report
          </button>
        </div>
      </div>
    </main>
  );
}
