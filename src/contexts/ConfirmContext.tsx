"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";
import { HKModal } from "@/components/ui/hk-design";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual emphasis on the confirm button. Defaults to "primary". */
  intent?: "primary" | "danger" | "success";
  /**
   * When set, the confirm button stays disabled until the user types this
   * exact string. Use for high-stakes, irreversible actions (data wipe,
   * year-end close) where a single tap is too easy.
   */
  requireText?: string;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);
  const [typed, setTyped] = useState("");
  const pendingRef = useRef<PendingState | null>(null);
  pendingRef.current = pending;

  // Reset the typed-confirmation field whenever a new prompt opens.
  useEffect(() => { setTyped(""); }, [pending]);

  const textGateUnmet = Boolean(pending?.requireText) && typed.trim() !== pending?.requireText;

  const confirm = useCallback<ConfirmFn>((options) => {
    const opts: ConfirmOptions =
      typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const close = useCallback((value: boolean) => {
    const p = pendingRef.current;
    if (p) {
      p.resolve(value);
      setPending(null);
    }
  }, []);

  const intentToVariant: Record<NonNullable<ConfirmOptions["intent"]>, "primary" | "danger" | "success"> = {
    primary: "primary",
    danger: "danger",
    success: "success",
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <HKModal
        isOpen={!!pending}
        onClose={() => close(false)}
        title={pending?.title ?? "Confirm"}
        footer={
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <HKButton variant="secondary" onClick={() => close(false)}>
              {pending?.cancelLabel ?? "Cancel"}
            </HKButton>
            <HKButton
              variant={pending ? intentToVariant[pending.intent ?? "primary"] : "primary"}
              onClick={() => close(true)}
              isDisabled={textGateUnmet}
            >
              {pending?.confirmLabel ?? "Confirm"}
            </HKButton>
          </div>
        }
      >
        <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--sb-text)", margin: 0, whiteSpace: "pre-wrap" }}>
          {pending?.message}
        </p>
        {pending?.requireText && (
          <div style={{ marginTop: 14 }}>
            <HKInput
              label={`Type "${pending.requireText}" to confirm`}
              value={typed}
              onValueChange={setTyped}
              autoFocus
            />
          </div>
        )}
      </HKModal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback so legacy code paths still work outside the provider.
    return async (options) => {
      const msg = typeof options === "string" ? options : options.message;
      return typeof window !== "undefined" ? window.confirm(msg) : false;
    };
  }
  return ctx;
}
