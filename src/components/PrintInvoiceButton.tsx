"use client";

export function PrintInvoiceButton() {
  return (
    <button type="button" className="btn btn-primary btn-sm print:hidden" onClick={() => window.print()}>
      Print / save PDF
    </button>
  );
}
