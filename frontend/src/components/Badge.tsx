import type { ReactNode } from "react";

type Tone = "green" | "gray" | "blue" | "amber" | "red";

const toneClass: Record<Tone, string> = {
  green: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  gray:  "bg-slate-100  text-slate-700  ring-slate-200",
  blue:  "bg-sky-100    text-sky-800    ring-sky-200",
  amber: "bg-amber-100  text-amber-800  ring-amber-200",
  red:   "bg-rose-100   text-rose-800   ring-rose-200",
};

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
}

export default function Badge({ tone = "gray", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}
