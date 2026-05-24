"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface NotificationItem {
  id: string;
  kind: string;
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
  href?: string;
}

const REFRESH_MS = 60_000;

const SEVERITY_DOT: Record<NotificationItem["severity"], string> = {
  danger: "#dc2626",
  warning: "#d97706",
  info: "var(--sb-primary)",
};

export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && Array.isArray(json?.data?.items)) {
          setItems(json.data.items);
        }
      } catch {
        // non-critical
      }
    }
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const count = items.length;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        style={{
          position: "relative",
          width: 40,
          height: 40,
          borderRadius: 10,
          border: "none",
          background: "transparent",
          color: "var(--sb-sub)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sb-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: "#dc2626",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 360,
            maxHeight: "70vh",
            overflowY: "auto",
            background: "var(--sb-card)",
            color: "var(--sb-text)",
            border: "1px solid var(--sb-border)",
            borderRadius: 14,
            boxShadow:
              "0 10px 30px -8px rgba(0,0,0,0.25), 0 4px 12px -4px rgba(0,0,0,0.15)",
            zIndex: 250,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid var(--sb-border)",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--sb-text)" }}>
              Notifications
            </span>
            <span style={{ fontSize: 12, color: "var(--sb-sub)" }}>
              {count === 0
                ? "All clear"
                : `${count} alert${count > 1 ? "s" : ""}`}
            </span>
          </div>

          {count === 0 ? (
            <p
              style={{
                padding: "32px 16px",
                fontSize: 13,
                color: "var(--sb-sub)",
                textAlign: "center",
                margin: 0,
              }}
            >
              You&apos;re all caught up. Nothing needs attention right now.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {items.map((it, idx) => (
                <li
                  key={it.id}
                  style={{
                    borderBottom:
                      idx < items.length - 1 ? "1px solid var(--sb-border)" : "none",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (it.href) {
                        setOpen(false);
                        router.push(it.href);
                      }
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 16px",
                      background: "transparent",
                      border: "none",
                      cursor: it.href ? "pointer" : "default",
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      color: "var(--sb-text)",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--sb-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <span
                      aria-hidden
                      style={{
                        marginTop: 6,
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        flexShrink: 0,
                        background: SEVERITY_DOT[it.severity],
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--sb-text)",
                          lineHeight: 1.35,
                        }}
                      >
                        {it.title}
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginTop: 2,
                          fontSize: 12,
                          color: "var(--sb-sub)",
                          lineHeight: 1.4,
                        }}
                      >
                        {it.message}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
