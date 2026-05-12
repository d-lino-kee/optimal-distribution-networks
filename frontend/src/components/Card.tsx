import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export default function Card({ title, children, className = "" }: CardProps) {
  return (
    <section
      className={`bg-white rounded-lg border border-slate-200 shadow-sm p-5 ${className}`}
    >
      {title && (
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
