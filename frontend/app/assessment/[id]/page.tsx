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
  profile?: {
    address?: string;
    country?: string;
    industry?: string;
    naics_code?: string;
    parent_entity?: string;
    subsidiaries?: string[];
  };
  sanctions_details?: {
    list: string;
    entity: string;
    date: string;
    reference_url?: string;
  }[];
  section_889_details?: {
    rule: string;
    status: "PASS" | "FAIL" | "UNKNOWN";
    reason?: string;
  }[];
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
    if (data.profile?.country) pdf.text(`Country: ${data.profile.country}`, 20, 48);
    if (data.profile?.industry) pdf.text(`Industry: ${data.profile.industry}`, 20, 56);

    pdf.setFontSize(14);
    pdf.text("Risk Assessment Summary", 20, 75);

    pdf.setFontSize(12);
    pdf.text(`Risk Score: ${data.risk_score}`, 20, 85);
    pdf.text(`Status: ${data.overall_status}`, 20, 93);

    if (data.breakdown) {
      pdf.text(`Sanctions Risk: ${data.breakdown.sanctions}`, 20, 105);
      pdf.text(`Section 889 Risk: ${data.breakdown.section_889}`, 20, 113);
      pdf.text(`Graph/Network Risk: ${data.breakdown.graph}`, 20, 121);
      pdf.text(`Negative Media: ${data.breakdown.news}`, 20, 129);
    }

    let y = 145;
    if (data.sanctions_details && data.sanctions_details.length > 0) {
      pdf.setFontSize(14);
      pdf.text("Sanctions & Watchlist Matches", 20, y);
      y += 10;
      pdf.setFontSize(10);
      data.sanctions_details.slice(0, 5).forEach((hit) => {
        pdf.text(`- ${hit.list}: ${hit.entity} (${hit.date})`, 20, y);
        y += 8;
      });
      if (data.sanctions_details.length > 5) {
        pdf.text(`... and ${data.sanctions_details.length - 5} more`, 20, y);
        y += 8;
      }
      y += 5;
    }

    if (data.section_889_details && data.section_889_details.length > 0) {
      if (y > 250) {
        pdf.addPage();
        y = 30;
      }
      pdf.setFontSize(14);
      pdf.text("Section 889 Compliance", 20, y);
      y += 10;
      pdf.setFontSize(10);
      data.section_889_details.forEach((rule) => {
        const text = `- [${rule.status}] ${rule.rule}`;
        const wrapped = pdf.splitTextToSize(text, 170);
        pdf.text(wrapped, 20, y);
        y += (wrapped.length * 5) + 3;

        if (y > 280) {
          pdf.addPage();
          y = 30;
        }
      });
    }

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

            {data.profile && (
              <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8 text-sm">
                {data.profile.country && (
                  <div>
                    <span className="text-gray-500 block text-xs uppercase tracking-wider mb-1">Country</span>
                    <span className="text-gray-300">{data.profile.country}</span>
                  </div>
                )}
                {data.profile.industry && (
                  <div>
                    <span className="text-gray-500 block text-xs uppercase tracking-wider mb-1">Industry</span>
                    <span className="text-gray-300">{data.profile.industry}</span>
                  </div>
                )}
                {data.profile.naics_code && (
                  <div>
                    <span className="text-gray-500 block text-xs uppercase tracking-wider mb-1">NAICS</span>
                    <span className="text-gray-300">{data.profile.naics_code}</span>
                  </div>
                )}
                {data.profile.parent_entity && (
                  <div>
                    <span className="text-gray-500 block text-xs uppercase tracking-wider mb-1">Parent Entity</span>
                    <span className="text-gray-300">{data.profile.parent_entity}</span>
                  </div>
                )}
                {data.profile.address && (
                  <div className="col-span-2">
                    <span className="text-gray-500 block text-xs uppercase tracking-wider mb-1">Address</span>
                    <span className="text-gray-300">{data.profile.address}</span>
                  </div>
                )}
              </div>
            )}

            {data.profile?.subsidiaries && data.profile.subsidiaries.length > 0 && (
              <div className="mt-4 text-sm flex gap-3 items-center">
                <span className="text-gray-500 text-xs uppercase tracking-wider">Known Subsidiaries:</span>
                <span className="text-gray-300 flex flex-wrap gap-2">
                  {data.profile.subsidiaries.map((sub, i) => (
                    <span key={i} className="bg-zinc-800/80 px-2.5 py-1 rounded border border-zinc-700/50 text-xs text-nowrap">
                      {sub}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>

          <div
            className={`px-4 py-1.5 text-xs font-medium tracking-widest border rounded ${riskStyle(
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
            {data.explanations && data.explanations.length > 0 && (
              <div className="mt-8">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 border-b border-zinc-800/60 pb-2">
                  Key Risk Drivers
                </div>
                <ul className="list-disc pl-4 text-sm text-gray-400 space-y-2 marker:text-zinc-600">
                  {data.explanations.map((explanation, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {/* For actual links, mapping to an object with `text` and `url` is better, but MVP renders raw text */}
                      {explanation}
                    </li>
                  ))}
                </ul>
              </div>
            )}
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

        {/* Sanctions & Watchlists Detail */}
        {data.sanctions_details && data.sanctions_details.length > 0 && (
          <div className="border border-zinc-800 rounded-lg p-8 bg-[#0b111b]">
            <div className="text-xs uppercase tracking-widest text-gray-500 mb-6 flex items-center justify-between">
              <span>Sanctions & Watchlist Matches</span>
              <span className="bg-red-500/10 text-red-500 px-2.5 py-1 rounded text-[10px] font-bold tracking-wider">
                {data.sanctions_details.length} HITS
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] text-gray-500 uppercase tracking-widest bg-[#0a0f18] border-b border-zinc-800 border-t">
                  <tr>
                    <th className="px-6 py-4 font-medium">List Name</th>
                    <th className="px-6 py-4 font-medium">Matched Entity</th>
                    <th className="px-6 py-4 font-medium">Date / Info</th>
                    <th className="px-6 py-4 font-medium text-right">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sanctions_details.map((hit, idx) => (
                    <tr key={idx} className="border-b border-zinc-800/50 hover:bg-white/[0.02] transition">
                      <td className="px-6 py-4 font-medium text-red-400">{hit.list}</td>
                      <td className="px-6 py-4 text-gray-300">{hit.entity}</td>
                      <td className="px-6 py-4 text-gray-500">{hit.date}</td>
                      <td className="px-6 py-4 text-right">
                        {hit.reference_url ? (
                          <a href={hit.reference_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs hover:underline">View Source</a>
                        ) : (
                          <span className="text-gray-600 text-xs">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 889 Details */}
        {data.section_889_details && data.section_889_details.length > 0 && (
          <div className="border border-zinc-800 rounded-lg p-8 bg-[#0b111b]">
            <div className="text-xs uppercase tracking-widest text-gray-500 mb-6">
              Section 889 Compliance Detail
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.section_889_details.map((rule, idx) => (
                <div key={idx} className="border border-zinc-800/80 bg-[#0a0f18]/50 p-6 rounded-md flex flex-col">
                  <div className="font-medium text-gray-300 text-sm mb-4 flex-1">
                    {rule.rule}
                  </div>

                  <div className="mt-2 border-t border-zinc-800/50 pt-4">
                    <span className={`inline-block px-2.5 py-1 text-[10px] font-bold tracking-widest rounded ${rule.status === 'PASS'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : rule.status === 'FAIL'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : 'bg-zinc-800 text-gray-400 border border-zinc-700'
                      }`}>
                      {rule.status}
                    </span>
                    {rule.reason && (
                      <div className="mt-3 text-xs text-gray-500 leading-relaxed">
                        {rule.reason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
