"use client";

type Props = {
  value: number;
};

export default function DeltaIndicator({ value }: Props) {
  if (value === 0) return null;

  const positive = value > 0;

  return (
    <span
      className={`ml-3 text-sm font-semibold ${
        positive ? "text-green-500" : "text-red-400"
      }`}
    >
      {positive ? "↑" : "↓"} {Math.abs(value)}
    </span>
  );
}
