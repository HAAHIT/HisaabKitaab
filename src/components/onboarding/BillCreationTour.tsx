"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { C, GR, OR, SG, TYPE, IN } from "@/components/ui/hk-design";

interface Step {
  target: string;
  heading: string;
  body: string;
}

const STEPS: Step[] = [
  {
    target: "[data-tour='party-search']",
    heading: "Step 1 — Pick a customer",
    body: "Search by name or phone. Recent parties appear instantly.",
  },
  {
    target: "[data-tour='line-items']",
    heading: "Step 2 — Add items",
    body: "Type a product name — catalog items auto-suggest. GST splits happen automatically.",
  },
  {
    target: "[data-tour='finalize-btn']",
    heading: "Step 3 — Tap Finalize",
    body: "One tap. Bill is saved, journal posted, and a shareable link is ready.",
  },
];

function useElapsedSeconds(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    if (startRef.current === null) startRef.current = Date.now();

    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  return elapsed;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

interface Props {
  onDismiss: () => void;
  /** Set to true once bill has been successfully finalized */
  billFinalized?: boolean;
  secondsToFinalize?: number;
  /** True once a party has been selected — auto-advances from step 0 → 1 */
  partySelected?: boolean;
  /** True once at least one line-item has a non-zero amount — auto-advances from step 1 → 2 */
  hasItems?: boolean;
}

export function BillCreationTour({ onDismiss, billFinalized, secondsToFinalize, partySelected, hasItems }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const elapsed = useElapsedSeconds(!billFinalized);

  // Auto-advance: only move forward, never backward
  useEffect(() => {
    if (partySelected && step === 0) setStep(1);
  }, [partySelected, step]);

  useEffect(() => {
    if (hasItems && step === 1) setStep(2);
  }, [hasItems, step]);

  // Highlight the target element for the current step
  useEffect(() => {
    if (billFinalized) return;
    const current = STEPS[step];
    if (!current) return;
    const el = document.querySelector<HTMLElement>(current.target);
    if (!el) return;
    el.style.transition = "box-shadow 0.3s ease";
    el.style.boxShadow = `0 0 0 3px var(--sb-primary, #6366f1), 0 0 16px 2px rgba(99,102,241,0.18)`;
    el.style.borderRadius = "14px";
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => {
      el.style.boxShadow = "";
      el.style.borderRadius = "";
    };
  }, [step, billFinalized]);

  const isUnder30 = (secondsToFinalize ?? elapsed) < 30;
  const displaySec = secondsToFinalize ?? elapsed;

  if (billFinalized) {
    return (
      <div
        style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 9000,
          background: isUnder30 ? GR : OR,
          color: "#fff",
          borderRadius: 20,
          padding: "18px 28px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          maxWidth: 360, width: "calc(100% - 48px)",
          fontFamily: SG,
        }}
      >
        <span style={{ fontSize: 28 }}>{isUnder30 ? "🎉" : "✅"}</span>
        <p style={{ fontSize: TYPE.h2, fontWeight: 800, margin: 0 }}>
          {isUnder30
            ? `Bill created in ${Math.round(displaySec)}s — under 30!`
            : `Bill created in ${formatTime(Math.round(displaySec))}`}
        </p>
        <p style={{ fontSize: TYPE.bodySmall, opacity: 0.9, margin: 0 }}>
          {isUnder30
            ? "You just proved the claim. Now do every bill this fast."
            : "Not bad — repeat customers get even faster with autocomplete."}
        </p>
        <button
          onClick={() => { onDismiss(); router.push("/dashboard"); }}
          style={{
            marginTop: 6, padding: "8px 20px", borderRadius: 12,
            background: "rgba(255,255,255,0.2)",
            border: "1px solid rgba(255,255,255,0.4)",
            color: "#fff", cursor: "pointer", fontSize: TYPE.bodySmall,
            fontWeight: 700, fontFamily: SG,
          }}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const current = STEPS[step];

  return (
    <>
      {/* Semi-transparent backdrop stripe at bottom */}
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          height: 160, zIndex: 8998,
          background: "linear-gradient(to top, rgba(0,0,0,0.32), transparent)",
          pointerEvents: "none",
        }}
      />

      {/* Tour card */}
      <div
        style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 9000,
          background: "var(--sb-card)",
          border: "1.5px solid var(--sb-border)",
          borderRadius: 20,
          boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
          padding: "18px 22px",
          maxWidth: 400, width: "calc(100% - 48px)",
          fontFamily: SG,
        }}
      >
        {/* Timer row */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <div style={{ display: "flex", gap: 4 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? 20 : 6, height: 6, borderRadius: 3,
                  background: i <= step ? C.primary : "var(--sb-border)",
                  transition: "width 0.2s",
                }}
              />
            ))}
          </div>
          <span
            style={{
              fontFamily: IN, fontSize: TYPE.bodySmall, fontWeight: 700,
              color: elapsed < 30 ? GR : elapsed < 60 ? C.primary : OR,
            }}
          >
            {formatTime(elapsed)}
          </span>
        </div>

        <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)", margin: "0 0 4px" }}>
          {current.heading}
        </p>
        <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", margin: "0 0 14px" }}>
          {current.body}
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={onDismiss}
            style={{
              fontSize: TYPE.bodySmall, color: "var(--sb-sub)",
              background: "none", border: "none", cursor: "pointer", fontFamily: SG,
            }}
          >
            Skip tour
          </button>
          {step < STEPS.length - 1 && (
            <button
              onClick={() => setStep((s) => s + 1)}
              style={{
                padding: "7px 18px", borderRadius: 10,
                background: C.primary, color: "#fff",
                border: "none", cursor: "pointer",
                fontSize: TYPE.bodySmall, fontWeight: 700, fontFamily: SG,
              }}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </>
  );
}
