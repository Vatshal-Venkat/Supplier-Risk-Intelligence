"use client";

export default function GradientSurface({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-8 bg-gradient-to-br from-[#0f172a] via-[#0b1120] to-[#064e3b] border border-zinc-800 shadow-xl">
      {children}
    </div>
  );
}
