"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface BillHit {
  id: string;
  billNumber: string;
  customerName: string;
  grandTotal: number;
  status: string;
  date: string;
}
interface PartyHit {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  currentBalance: number;
}
interface ItemHit {
  id: string;
  name: string;
  hsnCode: string | null;
  unit: string;
  rate: number;
}
interface SearchData {
  bills: BillHit[];
  parties: PartyHit[];
  items: ItemHit[];
}

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

interface FlatHit {
  key: string;
  group: string;
  title: string;
  subtitle: string;
  right: string;
  href: string;
}

function flatten(data: SearchData | null): FlatHit[] {
  if (!data) return [];
  const out: FlatHit[] = [];
  for (const b of data.bills) {
    out.push({
      key: `bill-${b.id}`,
      group: "Bills",
      title: b.billNumber,
      subtitle: `${b.customerName} · ${b.status}`,
      right: inr(b.grandTotal),
      href: `/bills/${b.id}`,
    });
  }
  for (const p of data.parties) {
    out.push({
      key: `party-${p.id}`,
      group: "Parties",
      title: p.name,
      subtitle: `${p.type.toLowerCase()}${p.phone ? ` · ${p.phone}` : ""}`,
      right: inr(p.currentBalance),
      href: `/parties/${p.id}`,
    });
  }
  for (const i of data.items) {
    out.push({
      key: `item-${i.id}`,
      group: "Items",
      title: i.name,
      subtitle: `${i.unit}${i.hsnCode ? ` · HSN ${i.hsnCode}` : ""}`,
      right: inr(i.rate),
      href: `/settings/items`,
    });
  }
  return out;
}

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [data, setData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setData(null);
    setActiveIndex(0);
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        close();
      }
    }
    function openEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", handler);
    window.addEventListener("open-global-search", openEvent);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("open-global-search", openEvent);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setData(null);
      setActiveIndex(0);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, {
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((json) => {
          if (json?.data) {
            setData(json.data);
            setActiveIndex(0);
          }
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [q, open]);

  const flat = flatten(data);

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[activeIndex];
      if (hit) go(hit.href);
    }
  }

  if (!open) return null;

  // Build grouped output but preserve flat index order for highlighting.
  const groups: { name: string; hits: { hit: FlatHit; idx: number }[] }[] = [];
  flat.forEach((hit, idx) => {
    let g = groups.find((gr) => gr.name === hit.group);
    if (!g) {
      g = { name: hit.group, hits: [] };
      groups.push(g);
    }
    g.hits.push({ hit, idx });
  });

  return (
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "10vh",
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Global search"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 640,
          background: "var(--sb-card)",
          color: "var(--sb-text)",
          border: "1px solid var(--sb-border)",
          borderRadius: 16,
          boxShadow:
            "0 20px 50px -12px rgba(0,0,0,0.45), 0 8px 20px -6px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        {/* Search row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderBottom: "1px solid var(--sb-border)",
          }}
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
            style={{ color: "var(--sb-sub)", flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search bills, parties, items…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--sb-text)",
              fontSize: 14,
              padding: "4px 0",
              minWidth: 0,
            }}
          />
          <kbd
            style={{
              padding: "3px 7px",
              borderRadius: 6,
              fontSize: 10,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              background: "var(--sb-hover)",
              color: "var(--sb-sub)",
              border: "1px solid var(--sb-border)",
              flexShrink: 0,
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Body */}
        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {q.trim().length < 2 ? (
            <p
              style={{
                padding: "32px 16px",
                fontSize: 13,
                color: "var(--sb-sub)",
                textAlign: "center",
                margin: 0,
              }}
            >
              Type at least 2 characters to search.
            </p>
          ) : loading && !data ? (
            <p
              style={{
                padding: "32px 16px",
                fontSize: 13,
                color: "var(--sb-sub)",
                textAlign: "center",
                margin: 0,
              }}
            >
              Searching…
            </p>
          ) : flat.length === 0 ? (
            <p
              style={{
                padding: "32px 16px",
                fontSize: 13,
                color: "var(--sb-sub)",
                textAlign: "center",
                margin: 0,
              }}
            >
              No matches for &quot;{q}&quot;.
            </p>
          ) : (
            <div style={{ padding: "6px 0" }}>
              {groups.map((g) => (
                <div key={g.name}>
                  <div
                    style={{
                      padding: "8px 16px 4px",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                      color: "var(--sb-sub)",
                    }}
                  >
                    {g.name}
                  </div>
                  {g.hits.map(({ hit, idx }) => {
                    const active = idx === activeIndex;
                    return (
                      <button
                        key={hit.key}
                        type="button"
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => go(hit.href)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          border: "none",
                          background: active ? "var(--sb-hover)" : "transparent",
                          color: "var(--sb-text)",
                          padding: "10px 16px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          transition: "background 0.1s",
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "var(--sb-text)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {hit.title}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--sb-sub)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {hit.subtitle}
                          </span>
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--sb-sub)",
                            whiteSpace: "nowrap",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {hit.right}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px",
            borderTop: "1px solid var(--sb-border)",
            fontSize: 11,
            color: "var(--sb-sub)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Kbd>⌘ / Ctrl</Kbd>
            <span>+</span>
            <Kbd>K</Kbd>
            <span style={{ marginLeft: 6 }}>to open / close</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Kbd>↑↓</Kbd>
            <span>navigate</span>
            <Kbd>↵</Kbd>
            <span>open</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        padding: "2px 6px",
        borderRadius: 5,
        fontSize: 10,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        background: "var(--sb-hover)",
        color: "var(--sb-sub)",
        border: "1px solid var(--sb-border)",
        lineHeight: 1.2,
      }}
    >
      {children}
    </kbd>
  );
}
