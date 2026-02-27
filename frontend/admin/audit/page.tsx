"use client";

import { useEffect, useState } from "react";
import { auditAPI } from "@/lib/api";

type AuditLog = {
    id: number;
    user_id: number;
    action: string;
    resource_type: string;
    resource_id: number;
    details: any;
    timestamp: string;
};

export default function AuditPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        auditAPI
            .list({ resource_type: "Supplier" })
            .then((res) => setLogs(res.data))
            .catch((err) => console.error("Audit fetch failed:", err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white bg-[#070b12]">
                Loading audit logs...
            </div>
        );
    }

    return (
        <main className="min-h-screen px-16 py-16 bg-[#070b12] text-white space-y-12">

            <div>
                <h1 className="text-4xl font-semibold tracking-tight">
                    Audit Trail
                </h1>
                <p className="text-zinc-500 mt-2">
                    System activity log for supplier-related actions.
                </p>
            </div>

            {logs.length === 0 && (
                <div className="text-zinc-400">
                    No audit records found.
                </div>
            )}

            <div className="grid gap-6">
                {logs.map((log) => (
                    <div
                        key={log.id}
                        className="bg-[#0c121c] border border-zinc-800 rounded-xl p-6 space-y-4"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center">

                            <div className="flex items-center gap-4">
                                <ActionBadge action={log.action} />

                                <div className="text-sm text-zinc-400">
                                    Resource: {log.resource_type} #{log.resource_id}
                                </div>
                            </div>

                            <div className="text-xs text-zinc-500">
                                {new Date(log.timestamp).toLocaleString()}
                            </div>
                        </div>

                        {/* User */}
                        <div className="text-sm text-zinc-400">
                            Performed by User ID: {log.user_id}
                        </div>

                        {/* Details */}
                        {log.details && (
                            <div className="bg-[#101726] border border-zinc-800 rounded-lg p-4 text-sm text-zinc-300 overflow-x-auto">
                                <pre className="whitespace-pre-wrap">
                                    {JSON.stringify(log.details, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                ))}
            </div>

        </main>
    );
}

/* ===========================
   Action Badge Component
=========================== */

function ActionBadge({ action }: { action: string }) {
    const colorMap: Record<string, string> = {
        CREATE_SUPPLIER: "bg-green-600",
        RUN_ASSESSMENT: "bg-indigo-600",
        DELETE_SUPPLIER: "bg-red-600",
    };

    const color = colorMap[action] || "bg-zinc-600";

    return (
        <span
            className={`px-3 py-1 text-xs font-medium rounded-full text-white ${color}`}
        >
            {action}
        </span>
    );
}