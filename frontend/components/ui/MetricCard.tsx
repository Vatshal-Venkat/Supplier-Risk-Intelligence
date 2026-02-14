"use client";

import AnimatedCounter from "./AnimatedCounter";

type Props = {
  title: string;
  value: number;
};

export default function MetricCard({ title, value }: Props) {
  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0f172a] to-[#064e3b] border border-zinc-800">
      <h3 className="text-sm text-gray-400 mb-2">
        {title}
      </h3>

      <p className="text-4xl font-semibold">
        <AnimatedCounter value={value} />
      </p>
    </div>
  );
}
