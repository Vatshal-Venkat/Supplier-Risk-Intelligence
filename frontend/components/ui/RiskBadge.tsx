"use client";

type Props = {
  status: string;
  score: number;
};

export default function RiskBadge({ status, score }: Props) {
  const base =
    "px-6 py-3 rounded-xl font-semibold relative overflow-hidden";

  const style =
    status === "FAIL"
      ? "text-red-400"
      : status === "CONDITIONAL"
      ? "text-yellow-400"
      : "text-green-400";

  return (
    <div className={`${base} ${style}`}>
      <span className="relative z-10">
        {status} — {score}
      </span>

      <div
        className={`absolute inset-0 opacity-20 animate-pulse ${
          status === "FAIL"
            ? "bg-red-500"
            : status === "CONDITIONAL"
            ? "bg-yellow-400"
            : "bg-green-500"
        }`}
      />
    </div>
  );
}
