"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = value / 40;

    const counter = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplay(value);
        clearInterval(counter);
      } else {
        setDisplay(Math.floor(start));
      }
    }, 20);

    return () => clearInterval(counter);
  }, [value]);

  return <span>{display}</span>;
}

export default function Home() {
  const router = useRouter();
  const [underlineWidth, setUnderlineWidth] = useState(0);

  useEffect(() => {
    setTimeout(() => setUnderlineWidth(220), 300);
  }, []);

  return (
    <main className="relative min-h-screen px-10 py-24 overflow-hidden bg-gradient-to-b from-[#05070c] to-[#0a0f1c]">

      {/* Subtle Radial Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-blue-500/5 blur-[140px] rounded-full pointer-events-none" />

      {/* Faint Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
        <div
          className="w-full h-full"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "70px 70px",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto">

        {/* HERO SECTION */}
        <div className="space-y-10 mb-16">

          <div className="relative inline-block">
            <h1 className="text-6xl font-semibold tracking-tight leading-tight">
              Supplier Risk Intelligence
            </h1>

            {/* Animated Underline */}
            <div
              className="h-[3px] bg-white/70 mt-4 transition-all duration-700 ease-out"
              style={{ width: underlineWidth }}
            />
          </div>

          <p className="text-lg text-gray-400 max-w-2xl leading-relaxed">
            Real-time compliance monitoring, multi-tier risk graph analytics,
            and AI-powered executive reporting designed for enterprise
            supply chains.
          </p>

          {/* CTA Row */}
          <div className="flex items-center gap-6 pt-2">
            <button
              onClick={() => router.push("/suppliers")}
              className="px-6 py-3 rounded-xl bg-white text-black font-medium hover:opacity-90 transition"
            >
              View Suppliers
            </button>

            <button
              onClick={() => router.push("/suppliers/new")}
              className="px-6 py-3 rounded-xl border border-zinc-700 hover:border-white transition"
            >
              Register New Vendor
            </button>
          </div>

          {/* Micro Animated Stats */}
          <div className="flex gap-16 pt-8 text-sm text-gray-400">
            <div>
              <p className="text-2xl font-semibold text-white">
                <AnimatedNumber value={24} />/7
              </p>
              <p>Monitoring</p>
            </div>

            <div>
              <p className="text-2xl font-semibold text-white">
                <AnimatedNumber value={1} /> AI
              </p>
              <p>Risk Engine</p>
            </div>

            <div>
              <p className="text-2xl font-semibold text-white">
                <AnimatedNumber value={3} />
              </p>
              <p>Multi-Tier Layers</p>
            </div>
          </div>

        </div>

        {/* Divider */}
        <div className="border-t border-zinc-800/70 mb-16" />

        {/* GLASS CARDS */}
        <div className="grid md:grid-cols-3 gap-10">

          <div
            onClick={() => router.push("/suppliers")}
            className="group backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-10 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-[0_0_40px_rgba(255,255,255,0.05)]"
          >
            <h2 className="text-xl font-semibold mb-4">
              Suppliers
            </h2>
            <p className="text-gray-400 leading-relaxed">
              Manage suppliers and initiate structured risk assessments.
            </p>
          </div>

          <div
            onClick={() => router.push("/comparison")}
            className="group backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-10 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-[0_0_40px_rgba(255,255,255,0.05)]"
          >
            <h2 className="text-xl font-semibold mb-4">
              Comparison
            </h2>
            <p className="text-gray-400 leading-relaxed">
              Benchmark suppliers side-by-side across compliance metrics.
            </p>
          </div>

          <div
            onClick={() => router.push("/monitor")}
            className="group backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-10 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-[0_0_40px_rgba(255,255,255,0.05)]"
          >
            <h2 className="text-xl font-semibold mb-4">
              Live Monitoring
            </h2>
            <p className="text-gray-400 leading-relaxed">
              Continuous event-based compliance signal streaming.
            </p>
          </div>

        </div>

      </div>
    </main>
  );
}
