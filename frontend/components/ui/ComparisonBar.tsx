"use client";

import { useEffect, useState } from "react";

type Props = {
  value: number;
  max: number;
  color?: "green" | "yellow";
};

export default function ComparisonBar({
  value,
  max,
  color = "green",
}: Props) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    setTimeout(() => {
      setWidth((value / max) * 100);
    }, 200);
  }, [value, max]);

  const gradient =
    color === "green"
      ? "from-[#064e3b] to-[#059669]"
      : "from-[#b45309] to-[#eab308]";

  return (
    <div className="w-full bg-zinc-800 rounded-xl h-4 overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${gradient} transition-all duration-700 ease-out`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
