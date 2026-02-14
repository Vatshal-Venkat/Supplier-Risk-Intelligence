"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "next/navigation";
import jsPDF from "jspdf";

import MetricCard from "@/components/ui/MetricCard";
import RiskBadge from "@/components/ui/RiskBadge";
import GradientSurface from "@/components/ui/GradientSurface";

type AssessmentData = {
  supplier: string;
  overall_status: string;
  risk_score: number;
  sanctions: any;
  section_889: any;
  explanations: string[];
  executive_brief?: string;
};

export default function AssessmentPage() {
  const params = useParams();
  const id = params?.id as string;

  const [data, setData] = useState<AssessmentData | null>(null);

  useEffect(() => {
    axios
      .get(`http://127.0.0.1:8000/suppliers/${id}/assessment`)
      .then(res => setData(res.data));
  }, [id]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  const exportPDF = () => {
    const pdf = new jsPDF();

    pdf.setFontSize(22);
    pdf.text("Executive Risk Report", 20, 25);

    pdf.setFontSize(14);
    pdf.text(`Supplier: ${data.supplier}`, 20, 45);
    pdf.text(`Risk Score: ${data.risk_score}`, 20, 55);
    pdf.text(`Status: ${data.overall_status}`, 20, 65);

    pdf.setFontSize(12);
    pdf.text("Findings:", 20, 80);

    let y = 90;
    data.explanations.forEach((line) => {
      pdf.text(`- ${line}`, 25, y);
      y += 8;
    });

    pdf.save("executive-risk-report.pdf");
  };

  return (
    <main className="min-h-screen px-12 py-16">

      {/* HEADER SECTION */}
      <div className="max-w-7xl mx-auto space-y-16">

        <GradientSurface>
          <div className="flex items-start justify-between">

            {/* Left Side */}
            <div className="space-y-4 max-w-3xl">
              <h1 className="text-4xl font-semibold leading-tight">
                {data.supplier}
              </h1>

              <p className="text-base text-gray-400">
                Executive Risk Assessment Overview
              </p>

              <p className="text-gray-400 pt-4 leading-relaxed">
                {data.executive_brief ||
                  "No material compliance risk detected based on current screening data."}
              </p>
            </div>

            {/* Right Side */}
            <div className="pt-2">
              <RiskBadge
                status={data.overall_status}
                score={data.risk_score}
              />
            </div>

          </div>
        </GradientSurface>


        {/* METRICS ROW */}
        <div className="grid md:grid-cols-2 gap-10">

          <MetricCard
            title="Risk Score"
            value={data.risk_score}
          />

          <MetricCard
            title="Sanctions Risk"
            value={
              data.sanctions?.overall_status === "FAIL" ? 1 : 0
            }
          />

        </div>


        {/* FINDINGS SECTION */}
        <GradientSurface>
          <div className="space-y-8">

            <h2 className="text-2xl font-semibold">
              Compliance Findings
            </h2>

            <ul className="space-y-3 text-gray-400 leading-relaxed">
              {data.explanations.map((reason, i) => (
                <li key={i}>• {reason}</li>
              ))}
            </ul>

          </div>
        </GradientSurface>


        {/* EXPORT BUTTON */}
        <div className="flex justify-end">
          <button
            onClick={exportPDF}
            className="px-8 py-3 rounded-xl bg-green-700 hover:bg-green-600 transition-all"
          >
            Export Executive PDF
          </button>
        </div>

      </div>
    </main>
  );
}
