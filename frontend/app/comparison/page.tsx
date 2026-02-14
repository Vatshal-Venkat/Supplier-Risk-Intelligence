"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";

import AnimatedCounter from "@/components/ui/AnimatedCounter";
import GradientSurface from "@/components/ui/GradientSurface";
import DeltaIndicator from "@/components/ui/DeltaIndicator";
import ComparisonBar from "@/components/ui/ComparisonBar";
import HeatBar from "@/components/ui/HeatBar";

export default function ComparisonPage() {
  const searchParams = useSearchParams();
  const ids = searchParams.get("ids");

  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => {
    if (!ids) return;

    const idArray = ids.split(",");

    Promise.all(
      idArray.map(id =>
        axios.get(
          `http://127.0.0.1:8000/suppliers/${id}/assessment`
        )
      )
    ).then(responses =>
      setSuppliers(responses.map(r => r.data))
    );
  }, [ids]);

  if (suppliers.length !== 2) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Select exactly 2 suppliers.
      </div>
    );
  }

  const [a, b] = suppliers;

  const delta = b.risk_score - a.risk_score;
  const maxScore = Math.max(a.risk_score, b.risk_score, 100);

  return (
    <main className="min-h-screen px-10 py-16 space-y-14">

      <h1 className="text-4xl font-semibold">
        Supplier Comparison
      </h1>

      {/* Score Comparison */}
      <div className="grid md:grid-cols-2 gap-10">

        <GradientSurface>
          <h2 className="text-xl mb-6">{a.supplier}</h2>

          <div className="text-4xl font-semibold">
            <AnimatedCounter value={a.risk_score} />
          </div>

          <ComparisonBar
            value={a.risk_score}
            max={maxScore}
          />

          <div className="mt-6">
            <HeatBar value={a.risk_score} />
          </div>
        </GradientSurface>

        <GradientSurface>
          <h2 className="text-xl mb-6">{b.supplier}</h2>

          <div className="text-4xl font-semibold">
            <AnimatedCounter value={b.risk_score} />
            <DeltaIndicator value={delta} />
          </div>

          <ComparisonBar
            value={b.risk_score}
            max={maxScore}
          />

          <div className="mt-6">
            <HeatBar value={b.risk_score} />
          </div>
        </GradientSurface>

      </div>

    </main>
  );
}
