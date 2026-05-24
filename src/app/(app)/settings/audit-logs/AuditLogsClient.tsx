"use client";

import { useEffect, useState } from "react";
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";
import { HKSelect, HKSelectItem } from "@/components/ui/HKSelect";
import { HKSkeleton } from "@/components/ui/HKSkeleton";

interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  actorType: "USER" | "SYSTEM";
  user: { id: string; name: string; email: string | null } | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const ENTITY_OPTIONS = [
  { value: "", label: "All entities" },
  { value: "Bill", label: "Bill" },
  { value: "Payment", label: "Payment" },
  { value: "Party", label: "Party" },
  { value: "Item", label: "Item" },
  { value: "Tenant", label: "Business Profile" },
  { value: "JournalEntry", label: "Journal Entry" },
  { value: "BankAccount", label: "Bank Account" },
];

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "CREATE", label: "Create" },
  { value: "UPDATE", label: "Update" },
  { value: "DELETE", label: "Delete" },
];

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function truncate(s: string | null, max = 80): string {
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export default function AuditLogsClient() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [entityId, setEntityId] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (entityType) params.set("entityType", entityType);
    if (action) params.set("action", action);
    if (entityId) params.set("entityId", entityId);

    fetch(`/api/audit-logs?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load");
        return json;
      })
      .then((json) => {
        setEntries(json.data);
        setPagination(json.pagination);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      });

    return () => controller.abort();
  }, [entityType, action, entityId, page]);

  return (
    <div className="animate-fade-in p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="mt-1 text-sm text-default-500">
          Every create, update, and delete on accounting records. Append-only as required by MCA Edit Log
          rules (GSR 247(E)).
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-card)] shadow-sm p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <HKSelect
            label="Entity"
            value={entityType}
            onValueChange={(v) => {
              setPage(1);
              setEntityType(v);
            }}
          >
            {ENTITY_OPTIONS.map((o) => (
              <HKSelectItem key={o.value || "all"} value={o.value}>
                {o.label}
              </HKSelectItem>
            ))}
          </HKSelect>
          <HKSelect
            label="Action"
            value={action}
            onValueChange={(v) => {
              setPage(1);
              setAction(v);
            }}
          >
            {ACTION_OPTIONS.map((o) => (
              <HKSelectItem key={o.value || "all"} value={o.value}>
                {o.label}
              </HKSelectItem>
            ))}
          </HKSelect>
          <HKInput
            label="Entity ID (optional)"
            value={entityId}
            onValueChange={(v) => {
              setPage(1);
              setEntityId(v);
            }}
            placeholder="e.g. cl9z..."
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <HKSkeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : entries.length === 0 ? (
          <p className="py-12 text-center text-sm text-default-500">No audit log entries match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-divider text-xs text-default-500 uppercase tracking-wide">
                  <th className="py-2 pr-3 text-left font-semibold">When</th>
                  <th className="py-2 pr-3 text-left font-semibold">Who</th>
                  <th className="py-2 pr-3 text-left font-semibold">Action</th>
                  <th className="py-2 pr-3 text-left font-semibold">Entity</th>
                  <th className="py-2 pr-3 text-left font-semibold">Field</th>
                  <th className="py-2 pr-3 text-left font-semibold">Old → New</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-divider/40 hover:bg-default-50 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-default-600">
                      {formatDateTime(e.createdAt)}
                    </td>
                    <td className="py-2 pr-3">
                      {e.actorType === "SYSTEM" ? (
                        <span className="text-xs uppercase font-semibold text-default-500">System</span>
                      ) : e.user ? (
                        <div>
                          <div className="font-medium">{e.user.name}</div>
                          {e.user.email && (
                            <div className="text-xs text-default-500">{e.user.email}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-default-400">Unknown</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          e.action === "CREATE"
                            ? "bg-success/10 text-success-700"
                            : e.action === "DELETE"
                            ? "bg-danger/10 text-danger-700"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {e.action}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{e.entityType}</div>
                      <div className="text-xs text-default-500 font-mono">{e.entityId}</div>
                    </td>
                    <td className="py-2 pr-3 text-default-600">{e.fieldName ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">
                      {e.oldValue || e.newValue ? (
                        <div className="space-y-0.5">
                          <div className="text-danger-700 line-through">{truncate(e.oldValue)}</div>
                          <div className="text-success-700">{truncate(e.newValue)}</div>
                        </div>
                      ) : (
                        <span className="text-default-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-default-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} entries)
            </span>
            <div className="flex gap-2">
              <HKButton
                size="sm"
                variant="secondary"
                isDisabled={pagination.page <= 1}
                onClick={() => setPage(pagination.page - 1)}
              >
                Previous
              </HKButton>
              <HKButton
                size="sm"
                variant="secondary"
                isDisabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage(pagination.page + 1)}
              >
                Next
              </HKButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
