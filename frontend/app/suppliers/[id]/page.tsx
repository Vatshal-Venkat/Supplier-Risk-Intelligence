"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import TrustGraph from "@/components/TrustGraph";

export default function SupplierProfilePage() {
    const { id } = useParams();
    const router = useRouter();
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        if (!id) return;

        api
            .get(`/suppliers/${id}`)
            .then((res) => setData(res.data))
            .catch(console.error);
    }, [id]);

    if (!data) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen flex items-center justify-center bg-[#070b12] text-white">
                    Loading supplier profile...
                </div>
            </ProtectedRoute>
        );
    }

    const {
        supplier,
        latest_assessment,
        linked_entities,
        sanctioned_entities,
        graph_summary,
        parent_entities,
        subsidiaries,
        certifications,
    } = data;

    return (
        <ProtectedRoute>
            <main className="min-h-screen bg-[#060910] text-white selection:bg-indigo-500/30">
                {/* ─── Top Gradient Glow ─── */}
                <div className="absolute top-0 left-0 right-0 h-[300px] bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />

                <div className="relative z-10 max-w-6xl mx-auto px-8 md:px-12 py-16 space-y-12">
                    {/* ═══════════════════════════════════════════ */}
                    {/*                  HEADER                    */}
                    {/* ═══════════════════════════════════════════ */}
                    <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-white/[0.05] pb-10">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                                    Entity Profile
                                </div>
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 animate-pulse" />
                                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">Verified Registration</span>
                            </div>
                            
                            <div>
                                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white/90">
                                    {supplier.legal_entity_name}
                                </h1>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-sm text-gray-400">
                                    <div className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        {supplier.address || "Address not provided"}
                                    </div>
                                    <div className="flex items-center gap-1.5 border-l border-white/10 pl-4">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h1.5a3.5 3.5 0 013.5 3.5V17m-6-10H14a5.5 5.5 0 00-5.5 5.5v1.5a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 001-1h2a1 1 0 001-1v-2a1 1 0 001-1h1.5a1 1 0 011 1v.5" />
                                        </svg>
                                        {supplier.registration_country}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => router.push(`/suppliers/${id}/history`)}
                                className="px-6 py-2.5 bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.2] text-white text-sm font-medium rounded-xl transition-all duration-300 backdrop-blur-sm"
                            >
                                Assessment History
                            </button>
                            <button
                                onClick={() => router.push(`/suppliers/assessment?id=${id}`)}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all duration-300"
                            >
                                Run Assessment
                            </button>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* ─── LEFT COLUMN: CORE INTELLIGENCE ─── */}
                        <div className="lg:col-span-2 space-y-8">
                            
                            {/* LATEST ASSESSMENT CARD */}
                            <section className="group p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-indigo-500/20 transition-all duration-500">
                                <div className="flex justify-between items-center mb-8">
                                    <h2 className="text-xl font-bold tracking-tight text-white/90">Risk Profile Summary</h2>
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.05]">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                        <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Latest Run</span>
                                    </div>
                                </div>

                                {latest_assessment ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">Total Risk Score</p>
                                            <p className={`text-5xl font-black font-mono tracking-tighter ${
                                                latest_assessment.risk_score >= 70 ? "text-red-500" : 
                                                latest_assessment.risk_score >= 40 ? "text-amber-500" : "text-emerald-500"
                                            }`}>
                                                {latest_assessment.risk_score}
                                            </p>
                                        </div>
                                        <div className="space-y-1 border-l border-white/5 pl-8">
                                            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">Operational Status</p>
                                            <p className="text-lg font-bold text-white/90 mt-1">{latest_assessment.overall_status}</p>
                                            <p className="text-xs text-gray-500">Analyzed {new Date(latest_assessment.created_at).toLocaleDateString()}</p>
                                        </div>
                                        <div className="space-y-1 border-l border-white/5 pl-8">
                                            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">Graph Complexity</p>
                                            <p className="text-lg font-bold text-white/90 mt-1">{graph_summary?.node_count ?? 0} Associated Entities</p>
                                            <p className="text-xs text-gray-500">{graph_summary?.relationship_count ?? 0} Network Edges</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-10 text-center border border-dashed border-white/10 rounded-xl">
                                        <p className="text-gray-500 text-sm italic">Initial risk assessment pending for this entity.</p>
                                    </div>
                                )}
                            </section>

                            {/* ENTERPRISE INTELLIGENCE & OWNERSHIP GRID */}
                            <div className="grid md:grid-cols-2 gap-8">
                                {/* ENTERPRISE INTELLIGENCE */}
                                <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                        </div>
                                        <h2 className="text-lg font-bold">Enterprise Identity</h2>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                                            <span className="text-xs text-gray-500 font-medium">Industry Classification</span>
                                            <span className="text-xs text-white/80 font-semibold">{supplier.industry || "N/A"}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                                            <span className="text-xs text-gray-500 font-medium">NAICS Code</span>
                                            <span className="text-xs font-mono text-indigo-300 font-bold">{supplier.naics_code || "Not Indexed"}</span>
                                        </div>
                                        <div className="space-y-2">
                                            <span className="text-xs text-gray-500 font-medium block">Compliance Certifications</span>
                                            <div className="flex flex-wrap gap-2">
                                                {certifications && certifications.length > 0 ? (
                                                    certifications.map((cert: string, i: number) => (
                                                        <span key={i} className="px-2.5 py-1 rounded bg-white/[0.03] border border-white/[0.08] text-[10px] font-bold text-gray-300 uppercase tracking-tight">
                                                            {cert}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-[10px] text-gray-600 italic">No certifications discoverable at this time.</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* OWNERSHIP & STRUCTURE */}
                                <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                            </svg>
                                        </div>
                                        <h2 className="text-lg font-bold">Ownership & Structure</h2>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/40" />
                                                <span className="text-xs text-gray-500 font-medium">Parent Entities</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {parent_entities && parent_entities.length > 0 ? (
                                                    parent_entities.map((p: string, i: number) => (
                                                        <span key={i} className="px-2.5 py-1 rounded-lg bg-cyan-500/5 border border-cyan-500/10 text-[11px] font-semibold text-cyan-300">
                                                            {p}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-[10px] text-gray-600 italic pl-3.5">Self-owned entity</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/40" />
                                                <span className="text-xs text-gray-500 font-medium">Known Subsidiaries</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {subsidiaries && subsidiaries.length > 0 ? (
                                                    subsidiaries.map((s: string, i: number) => (
                                                        <span key={i} className="px-2.5 py-1 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-[11px] font-semibold text-indigo-300">
                                                            {s}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-[10px] text-gray-600 italic pl-3.5">No subsidiaries identified</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* TRUST GRAPH SECTION */}
                            <section className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-6">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                            </svg>
                                        </div>
                                        <h2 className="text-xl font-bold">Network & Trust Visualization</h2>
                                    </div>
                                    <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest bg-white/[0.03] px-3 py-1 rounded-full border border-white/5">
                                        Live Graph Engine
                                    </div>
                                </div>
                                <div className="h-[450px] rounded-xl overflow-hidden bg-black/20 border border-white/5 relative">
                                    <TrustGraph name={supplier.legal_entity_name} />
                                </div>
                            </section>
                        </div>

                        {/* ─── RIGHT COLUMN: COMPLIANCE & IDENTITY ─── */}
                        <div className="space-y-8">
                            {/* SANCTIONS STATUS CARD */}
                            <section className={`p-6 rounded-2xl border transition-all duration-500 ${
                                sanctioned_entities?.length > 0 
                                ? "bg-red-500/[0.02] border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.05)]" 
                                : "bg-emerald-500/[0.02] border-emerald-500/20"
                            }`}>
                                <div className="flex items-center gap-3 mb-6">
                                    {sanctioned_entities?.length > 0 ? (
                                        <div className="p-2 rounded-lg bg-red-500/20 text-red-400 animate-pulse">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                            </svg>
                                        </div>
                                    ) : (
                                        <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                            </svg>
                                        </div>
                                    )}
                                    <h2 className="text-lg font-bold">Sanctions Exposure</h2>
                                </div>

                                {sanctioned_entities?.length === 0 ? (
                                    <p className="text-sm text-emerald-400/80 font-medium bg-emerald-500/10 border border-emerald-500/10 p-3 rounded-xl">
                                        Negative result: No direct or derived sanctions matches found.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-xs text-red-400 font-bold uppercase tracking-wider mb-2">High Risk Hits:</p>
                                        <ul className="space-y-2">
                                            {sanctioned_entities?.map((name: string, index: number) => (
                                                <li key={index} className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/10 text-xs text-red-300 font-medium">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                                    {name}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </section>

                            {/* IDENTITY RESOLUTION CARD */}
                            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold">Identity Context</h2>
                                </div>

                                <div className="space-y-4">
                                    {linked_entities?.map((entity: any, index: number) => (
                                        <div key={index} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="text-sm font-bold text-white/90">{entity.canonical_name}</div>
                                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">{entity.entity_type}</div>
                                                </div>
                                                <div className="px-2 py-0.5 rounded bg-indigo-500/20 text-[10px] font-black text-indigo-400">
                                                    {Math.round(entity.confidence_score * 100)}% Match
                                                </div>
                                            </div>

                                            {entity.sanctions?.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {entity.sanctions.map((s: any, si: number) => (
                                                        <span key={si} className="px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-[9px] font-bold text-red-300">
                                                            {s.source}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </main>
        </ProtectedRoute>
    );
}

function Row({ label, value }: { label: string; value: any }) {
    return (
        <div className="flex justify-between items-center py-2.5 border-b border-white/[0.03] last:border-0">
            <span className="text-xs text-gray-500 font-medium">{label}</span>
            <span className="text-xs font-semibold text-white/80">{value}</span>
        </div>
    );
}