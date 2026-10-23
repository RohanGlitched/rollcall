"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-sheet hover:bg-duct-2">
      Print or save as PDF
    </button>
  );
}
