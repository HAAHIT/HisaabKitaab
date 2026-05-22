"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@/lib/formula";

export interface CatalogItem {
  id: string;
  name: string;
  hsnCode: string | null;
  unit: string;
  rate: number;
  taxRate: number | null;
}

interface Props {
  /** Template columns — used to figure out which column gets the name / rate */
  columns: ColumnDef[];
  /** Called with the pre-filled row data AND the item's tax rate (null = keep current) */
  onSelect: (rowData: Record<string, string | number>, taxRate: number | null) => void;
  onClose: () => void;
}

// ── Column-mapping heuristics ─────────────────────────────────────────────────

function findNameColId(cols: ColumnDef[]): string | null {
  const nameHints = ["name", "item", "description", "desc", "product", "particulars", "detail"];
  const byHint = cols.find(
    (c) => c.type === "text" && nameHints.some((h) => c.name.toLowerCase().includes(h))
  );
  if (byHint) return byHint.id;
  return cols.find((c) => c.type === "text")?.id ?? null;
}

function findRateColId(cols: ColumnDef[]): string | null {
  const rateHints = ["rate", "price", "mrp", "unit price", "unit rate", "amount"];
  const byHint = cols.find(
    (c) => c.type === "number" && rateHints.some((h) => c.name.toLowerCase().includes(h))
  );
  if (byHint) return byHint.id;
  return cols.find((c) => c.type === "number")?.id ?? null;
}

function findQtyColId(cols: ColumnDef[]): string | null {
  const qtyHints = ["qty", "quantity", "nos", "pcs", "count", "units"];
  return (
    cols.find(
      (c) => c.type === "number" && qtyHints.some((h) => c.name.toLowerCase().includes(h))
    )?.id ?? null
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ItemCatalogPicker({ columns, onSelect, onClose }: Props) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus search box on mount
  useEffect(() => {
    const t = window.setTimeout(() => searchRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, []);

  // Load catalogue once
  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((d) => setItems((d.items || []) as CatalogItem[]))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.hsnCode && i.hsnCode.toLowerCase().includes(q))
    );
  }, [items, query]);

  const nameColId = useMemo(() => findNameColId(columns), [columns]);
  const rateColId = useMemo(() => findRateColId(columns), [columns]);
  const qtyColId  = useMemo(() => findQtyColId(columns),  [columns]);

  function handleSelect(item: CatalogItem) {
    const row: Record<string, string | number> = {};
    if (nameColId) row[nameColId] = item.name;
    if (rateColId) row[rateColId] = item.rate;
    if (qtyColId)  row[qtyColId]  = 1;
    // Always carry the per-row HSN code
    row._hsnCode = item.hsnCode ?? "";
    onSelect(row, item.taxRate);
  }

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[199] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[200] flex flex-col rounded-t-3xl bg-background shadow-2xl md:bottom-auto md:left-1/2 md:top-1/2 md:right-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[520px] md:rounded-2xl"
        style={{ maxHeight: "80vh" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-divider px-5 py-4">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-divider bg-default-100 px-3 py-2">
            <svg className="h-4 w-4 shrink-0 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={searchRef}
              type="text"
              placeholder="Item dhundho... (naam ya HSN)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-default-400"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-default-400 hover:text-foreground">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-divider text-default-500 hover:bg-default-100"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Column mapping hint */}
        {!loading && items.length > 0 && (
          <div className="border-b border-divider/40 bg-default-50/60 px-5 py-2 text-xs text-default-400">
            {nameColId ? `Name → "${columns.find(c => c.id === nameColId)?.name}"` : "No name column found"}
            {rateColId && ` · Rate → "${columns.find(c => c.id === rateColId)?.name}"`}
            {qtyColId  && ` · Qty → "${columns.find(c => c.id === qtyColId)?.name}"`}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-default-100" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-default-500">
                {items.length === 0 ? "Catalogue empty hai" : "Koi item nahi mila"}
              </p>
              <p className="mt-1 text-xs text-default-400">
                {items.length === 0
                  ? "Settings → Items Catalogue mein items add karo"
                  : "Alag naam try karo"}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="group flex w-full items-center gap-4 rounded-xl border border-transparent p-3 text-left transition-all hover:border-primary/30 hover:bg-primary/5 active:scale-[0.99]"
                >
                  {/* Icon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 3H8l-2 4h12l-2-4z"/>
                    </svg>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                    <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                      {item.hsnCode && (
                        <span className="rounded bg-default-100 px-1.5 py-0.5 font-mono text-xs text-default-500">
                          HSN {item.hsnCode}
                        </span>
                      )}
                      {item.taxRate !== null && (
                        <span className="rounded bg-warning/10 px-1.5 py-0.5 text-xs font-semibold text-warning-700">
                          GST {item.taxRate}%
                        </span>
                      )}
                      <span className="text-xs text-default-400">{item.unit}</span>
                    </div>
                  </div>

                  {/* Rate */}
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-foreground">
                      ₹{item.rate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-default-400">per {item.unit}</p>
                  </div>

                  {/* Add arrow */}
                  <svg className="h-4 w-4 shrink-0 text-default-300 group-hover:text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" d="m9 18 6-6-6-6"/></svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && items.length > 0 && (
          <div className="border-t border-divider px-5 py-3 text-center text-xs text-default-400">
            {filtered.length} item{filtered.length !== 1 ? "s" : ""} · Manage karo{" "}
            <a href="/settings/items" className="font-semibold text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              Settings → Items
            </a>
          </div>
        )}
      </div>
    </>
  );
}
