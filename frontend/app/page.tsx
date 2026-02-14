"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen px-10 py-16">
      <div className="max-w-7xl mx-auto">

        <div className="mb-14">
          <h1 className="text-5xl font-semibold mb-4">
            Supplier Risk Intelligence
          </h1>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl">
            Real-time compliance monitoring, multi-tier risk graph analytics,
            and AI-powered executive reporting designed for enterprise supply chains.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          <div
            onClick={() => router.push("/suppliers")}
            className="surface p-8 cursor-pointer"
          >
            <h2 className="text-xl font-semibold mb-3">
              Suppliers
            </h2>
            <p className="text-[var(--text-secondary)]">
              Manage suppliers and initiate risk assessments.
            </p>
          </div>

          <div
            onClick={() => router.push("/comparison")}
            className="surface p-8 cursor-pointer"
          >
            <h2 className="text-xl font-semibold mb-3">
              Comparison
            </h2>
            <p className="text-[var(--text-secondary)]">
              Benchmark multiple suppliers across compliance metrics.
            </p>
          </div>

          <div
            onClick={() => router.push("/monitor")}
            className="surface p-8 cursor-pointer"
          >
            <h2 className="text-xl font-semibold mb-3">
              Live Monitoring
            </h2>
            <p className="text-[var(--text-secondary)]">
              Continuous real-time compliance event streaming.
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}
