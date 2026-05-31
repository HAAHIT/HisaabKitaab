"use client";

// Client-only wrapper for the print action. The public invoice page is a Server
// Component, which cannot attach browser event handlers (`onClick`) directly —
// doing so throws at render time in Next.js. Keeping just the button here lets
// the rest of the invoice stay server-rendered.

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{ padding: "8px 18px", borderRadius: 8, border: "1.5px solid #374151", background: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
    >
      🖨 Print / Save PDF
    </button>
  );
}
