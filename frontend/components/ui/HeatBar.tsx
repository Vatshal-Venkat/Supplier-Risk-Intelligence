"use client";

type Props = {
  value: number; // 0 - 100
};

export default function HeatBar({ value }: Props) {
  let gradient;

  if (value < 30) {
    gradient = "from-[#064e3b] to-[#059669]";
  } else if (value < 70) {
    gradient = "from-[#b45309] to-[#eab308]";
  } else {
    gradient = "from-[#7f1d1d] to-[#dc2626]";
  }

  return (
    <div className="w-full bg-zinc-800 rounded-xl h-3 overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${gradient}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
