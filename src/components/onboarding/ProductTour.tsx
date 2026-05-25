"use client";

import { useEffect, useLayoutEffect, useState } from "react";

type Step = {
  key: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    key: "new-bill",
    title: "Create your first bill",
    body: "Tap +New Bill anytime to invoice a customer. Bills drive Tally export, GST, and party ledger.",
  },
  {
    key: "bills",
    title: "Sales bills",
    body: "All your invoices live here — search, filter, share, and download.",
  },
  {
    key: "parties",
    title: "Parties & Khata",
    body: "Customers and suppliers go here. Every bill links to a party, that's how Udhar Khata works.",
  },
  {
    key: "payments",
    title: "Record payments",
    body: "Log cash, bank, or UPI receipts against bills. Party balances update instantly.",
  },
  {
    key: "profile",
    title: "Settings & more",
    body: "Templates, GSTIN, Tally export, reports — all under your profile menu. You're ready!",
  },
];

const CARD_WIDTH = 320;
const CARD_OFFSET = 14;

export function ProductTour({ onFinish }: { onFinish: () => void }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = STEPS[stepIdx];

  useLayoutEffect(() => {
    function measure() {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.key}"]`);
      if (!el) {
        setTargetRect(null);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      setTargetRect(el.getBoundingClientRect());
    }
    measure();
    const id = window.setTimeout(measure, 250);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step.key]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFinish();
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") setStepIdx((i) => Math.max(0, i - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function next() {
    if (stepIdx >= STEPS.length - 1) {
      onFinish();
    } else {
      setStepIdx((i) => i + 1);
    }
  }

  const cardPos = (() => {
    if (!targetRect) return { top: 24, left: window.innerWidth / 2 - CARD_WIDTH / 2 };
    const below = targetRect.bottom + CARD_OFFSET;
    const fitsBelow = below + 220 < window.innerHeight;
    const top = fitsBelow ? below : Math.max(16, targetRect.top - 220 - CARD_OFFSET);
    let left = targetRect.left + targetRect.width / 2 - CARD_WIDTH / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - CARD_WIDTH - 12));
    return { top, left };
  })();

  const highlight = targetRect
    ? {
        top: targetRect.top - 6,
        left: targetRect.left - 6,
        width: targetRect.width + 12,
        height: targetRect.height + 12,
      }
    : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15, 23, 42, 0.55)",
          pointerEvents: "auto",
        }}
        onClick={onFinish}
      />

      {highlight && (
        <div
          style={{
            position: "absolute",
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
            border: "2px solid #2563eb",
            borderRadius: 12,
            boxShadow:
              "0 0 0 9999px rgba(15, 23, 42, 0.55), 0 0 0 4px rgba(37, 99, 235, 0.25)",
            transition: "all 0.25s ease",
            pointerEvents: "none",
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          top: cardPos.top,
          left: cardPos.left,
          width: CARD_WIDTH,
          background: "var(--sb-card, #fff)",
          color: "var(--sb-text, #0f172a)",
          borderRadius: 14,
          boxShadow: "0 18px 50px rgba(15, 23, 42, 0.25)",
          padding: 18,
          pointerEvents: "auto",
          fontFamily: "var(--font-sans)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#2563eb" }}>
            STEP {stepIdx + 1} / {STEPS.length}
          </span>
          <button
            onClick={onFinish}
            style={{
              fontSize: 12,
              color: "var(--sb-sub, #64748b)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 2,
            }}
          >
            Skip tour
          </button>
        </div>

        <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>{step.title}</p>
        <p style={{ fontSize: 13.5, color: "var(--sb-sub, #475569)", lineHeight: 1.5, margin: "0 0 14px" }}>
          {step.body}
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            disabled={stepIdx === 0}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: stepIdx === 0 ? "var(--sb-border, #cbd5e1)" : "var(--sb-sub, #475569)",
              background: "none",
              border: "none",
              cursor: stepIdx === 0 ? "default" : "pointer",
              padding: "6px 10px",
            }}
          >
            Back
          </button>
          <button
            onClick={next}
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              background: "#2563eb",
              border: "none",
              borderRadius: 8,
              padding: "8px 18px",
              cursor: "pointer",
            }}
          >
            {stepIdx === STEPS.length - 1 ? "Finish" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
