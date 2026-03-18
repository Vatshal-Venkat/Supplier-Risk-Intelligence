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

type BreakdownFactor = {
  key: string;
  label: string;
  weight: number;
  max_points: number;
  points: number;
  triggered: boolean;
  reason: string;
  status?: string;
};

type BreakdownData = {
  factors: BreakdownFactor[];
  total_scored: number;
  total_possible: number;
  scoring_version: string;
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
  breakdown?: BreakdownData;
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
    pdf.text(`Risk Score: ${data.risk_score} / 100`, 20, 85);
    pdf.text(`Status: ${data.overall_status}`, 20, 93);

    // Weighted breakdown
    if (data.breakdown?.factors) {
      let y = 110;
      pdf.setFontSize(14);
      pdf.text("Risk Score Breakdown (Weighted)", 20, y);
      y += 12;

      pdf.setFontSize(10);
      for (const factor of data.breakdown.factors) {
        const status = factor.triggered ? "TRIGGERED" : "CLEAR";
        const line = `${factor.label}: ${factor.points} / ${factor.max_points} pts (Weight: ${factor.max_points}pts max) [${status}]`;
        pdf.text(line, 20, y);
        y += 7;

        const reasonWrapped = pdf.splitTextToSize(`  Reason: ${factor.reason}`, 165);
        pdf.text(reasonWrapped, 25, y);
        y += reasonWrapped.length * 5 + 3;

        if (y > 270) {
          pdf.addPage();
          y = 30;
        }
      }

      pdf.text(`Total: ${data.breakdown.total_scored} / ${data.breakdown.total_possible}`, 20, y);
      y += 8;
      pdf.text(`Scoring Version: ${data.breakdown.scoring_version}`, 20, y);
      y += 15;

      // Sanctions details
      if (data.sanctions_details && data.sanctions_details.length > 0) {
        if (y > 250) { pdf.addPage(); y = 30; }
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

      // Section 889 details
      if (data.section_889_details && data.section_889_details.length > 0) {
        if (y > 250) { pdf.addPage(); y = 30; }
        pdf.setFontSize(14);
        pdf.text("Section 889 Compliance", 20, y);
        y += 10;
        pdf.setFontSize(10);
        data.section_889_details.forEach((rule) => {
          const text = `- [${rule.status}] ${rule.rule}`;
          const wrapped = pdf.splitTextToSize(text, 170);
          pdf.text(wrapped, 20, y);
          y += (wrapped.length * 5) + 3;
          if (y > 280) { pdf.addPage(); y = 30; }
        });
      }
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

  // Factor bar colors
  const factorBarColor = (factor: BreakdownFactor) => {
    if (!factor.triggered) return "bg-green-500/20";
    const pct = factor.points / factor.max_points;
    if (pct >= 0.75) return "bg-red-500";
    if (pct >= 0.4) return "bg-yellow-500";
    return "bg-orange-500";
  };

  const factorBadgeStyle = (factor: BreakdownFactor) => {
    if (!factor.triggered)
      return "bg-green-500/10 text-green-400 border-green-500/20";
    return "bg-red-500/10 text-red-400 border-red-500/20";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#070b12] text-white px-6">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Running Intelligence Assessment</h2>
            <p className="text-gray-500 text-sm">
              Gathering and analyzing data from global sanctions lists, trade records, corporate filings, and media sentiment.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs font-medium text-gray-400">
              <span className="uppercase tracking-widest">Analysis in Progress</span>
              <span className="text-indigo-400 animate-pulse">Processing...</span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden relative">
              <div 
                className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full w-1/3 animate-[progress_2s_ease-in-out_infinite] shadow-[0_0_10px_rgba(99,102,241,0.5)]"
              />
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 text-center">
            <p className="text-xs text-gray-400">
              <span className="text-indigo-400 font-semibold">Note:</span> A full assessment can take between 2-3 minutes while the AI engine maps the trust graph and screens thousands of public records.
            </p>
          </div>
        </div>

        {/* Custom keyframes for the indeterminate progress bar */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes progress {
            0% { left: -33%; width: 33%; }
            50% { left: 33%; width: 50%; }
            100% { left: 100%; width: 33%; }
          }
        `}} />
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

        {/* Risk Score + Score Explainer */}
        <div className="border border-zinc-800 rounded-lg p-8 bg-[#0b111b]">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Left: Overall Score */}
            <div className="flex-1">
              <div className="text-xs uppercase tracking-widest text-gray-500 flex items-center gap-2">
                Overall Risk Score
                <div className="group relative inline-flex items-center justify-center cursor-help pb-1">
                  <svg className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {/* Tooltip */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 invisible group-hover:visible w-72 p-4 bg-[#121822] border border-zinc-700/80 rounded-lg shadow-2xl z-50 transition-all duration-200 pointer-events-none">
                    <p className="font-semibold text-white mb-2 pb-2 border-b border-zinc-800 text-sm normal-case tracking-normal">Score Calculation</p>
                    <p className="text-xs mb-3 text-gray-400 leading-relaxed normal-case tracking-normal border-b border-zinc-800 pb-2">The risk score (0-100) measures potential supplier exposure. A higher score signifies higher risk.</p>
                    {data.breakdown?.factors?.filter(f => f.triggered).length ? (
                      <div className="space-y-1.5 pt-1">
                        {data.breakdown.factors.filter(f => f.triggered).map((factor, idx) => (
                          <div key={idx} className="flex justify-between items-start text-xs normal-case tracking-normal">
                            <span className="text-gray-400 pr-3">- {factor.label}</span>
                            <span className="font-mono text-red-400 whitespace-nowrap">+{factor.points}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                       <div className="text-xs text-green-400 pt-1 normal-case tracking-normal">No risk points assigned.</div>
                    )}
                    {/* Tooltip Arrow */}
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-zinc-700/80"></div>
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-[7px] w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-[#121822]"></div>
                  </div>
                </div>
              </div>
              <div className="text-5xl font-semibold mt-3">
                {data.risk_score}
                <span className="text-lg text-gray-500 ml-1">/ 100</span>
              </div>

              {/* Score gauge bar */}
              <div className="mt-4 w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    data.risk_score >= 75 ? "bg-red-500" :
                    data.risk_score >= 40 ? "bg-yellow-500" :
                    "bg-green-500"
                  }`}
                  style={{ width: `${data.risk_score}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-600 mt-1.5">
                <span>LOW</span>
                <span>MODERATE</span>
                <span>HIGH</span>
              </div>

              {data.explanations && data.explanations.length > 0 && (
                <div className="mt-8">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 border-b border-zinc-800/60 pb-2">
                    Key Risk Drivers
                  </div>
                  <ul className="list-disc pl-4 text-sm text-gray-400 space-y-2 marker:text-zinc-600">
                    {data.explanations.map((explanation, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {explanation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right: Scoring Version badge */}
            {data.breakdown?.scoring_version && (
              <div className="flex flex-col items-end gap-2">
                <div className="bg-zinc-800/50 text-gray-400 text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-zinc-700/50">
                  Scoring {data.breakdown.scoring_version}
                </div>
              </div>
            )}
          </div>

          {/* ──────────── SCORE EXPLAINER ──────────── */}
          {data.breakdown?.factors && (
            <div className="mt-10 border-t border-zinc-800 pt-8">
              <div className="text-xs uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-3">
                <span>Risk Score Explainer</span>
                <span className="text-[10px] text-gray-600 normal-case tracking-normal">
                  — How each factor contributed to the overall score
                </span>
              </div>

              <div className="space-y-4">
                {data.breakdown.factors.map((factor) => (
                  <div
                    key={factor.key}
                    className={`border rounded-lg p-5 transition-all ${
                      factor.triggered
                        ? "border-zinc-700/80 bg-[#0a0f18]"
                        : "border-zinc-800/50 bg-[#0a0f18]/50"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <h4 className="text-sm font-medium text-gray-200">
                          {factor.label}
                        </h4>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold tracking-widest border rounded ${factorBadgeStyle(factor)}`}
                        >
                          {factor.triggered ? "TRIGGERED" : "CLEAR"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-mono font-semibold text-white">
                          {factor.points}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">
                          / {factor.max_points} pts
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${factorBarColor(factor)}`}
                        style={{
                          width: factor.max_points > 0
                            ? `${Math.max((factor.points / factor.max_points) * 100, factor.triggered ? 3 : 0)}%`
                            : "0%",
                        }}
                      />
                    </div>

                    {/* Reason + weight info */}
                    <div className="flex items-start justify-between">
                      <p className="text-xs text-gray-500 leading-relaxed max-w-lg">
                        {factor.reason}
                      </p>
                      <span className="text-[10px] text-gray-600 uppercase tracking-wider whitespace-nowrap ml-4">
                        Weight: {factor.max_points} pts max
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Summary Bar */}
              <div className="mt-6 border border-zinc-700/50 rounded-lg p-4 bg-[#080d15] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-xs uppercase tracking-widest text-gray-500">
                    Total Risk Score
                  </span>
                  <div className="w-48 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        data.breakdown.total_scored >= 75 ? "bg-red-500" :
                        data.breakdown.total_scored >= 40 ? "bg-yellow-500" :
                        "bg-green-500"
                      }`}
                      style={{ width: `${data.breakdown.total_scored}%` }}
                    />
                  </div>
                </div>
                <div>
                  <span className="text-2xl font-mono font-semibold text-white">
                    {data.breakdown.total_scored}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">
                    / {data.breakdown.total_possible}
                  </span>
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
