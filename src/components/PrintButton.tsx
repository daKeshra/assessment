"use client";

export default function PrintButton() {
  return (
    <button type="button" className="btn btn-secondary no-print" onClick={() => window.print()}>
      Print / save as PDF
    </button>
  );
}
