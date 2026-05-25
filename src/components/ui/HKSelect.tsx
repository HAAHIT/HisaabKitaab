"use client";

import React, { useState, useRef, useEffect, useCallback, useId } from "react";
import { createPortal } from "react-dom";

// ── Types ────────────────────────────────────────────────────────────────────

interface HKSelectProps {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  isDisabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
  startContent?: React.ReactNode;
  description?: string;
  "aria-label"?: string;
}

// ── HKSelectItem ─────────────────────────────────────────────────────────────
// Acts as a declarative data container — HKSelect reads its props via
// React.Children and renders its own custom dropdown. This component itself
// renders nothing, which prevents invalid DOM nesting (<option> outside <select>).

export function HKSelectItem({
  value: _value,
  children: _children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  void _value;
  void _children;
  return null;
}

// ── Height tokens ─────────────────────────────────────────────────────────────

const SIZE_H: Record<string, string> = {
  sm: "h-10",
  md: "h-12",
  lg: "h-14",
};
const SIZE_TEXT: Record<string, string> = {
  sm: "text-sm",
  md: "text-sm",
  lg: "text-base",
};

// ── HKSelect ──────────────────────────────────────────────────────────────────
// Fully custom portal dropdown — immune to OS-level colour overrides that plague
// native <select> on Windows Chrome in dark mode.

export function HKSelect({
  label,
  value,
  onValueChange,
  placeholder,
  isRequired,
  isInvalid,
  errorMessage,
  isDisabled,
  size = "md",
  className,
  children,
  startContent,
  description,
  "aria-label": ariaLabel,
}: HKSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; flipUp: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);

  const triggerId = useId();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // ── Extract options from HKSelectItem children ──────────────────────────
  const options: { value: string; label: React.ReactNode }[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const c = child as React.ReactElement<{ value: string; children: React.ReactNode }>;
    options.push({ value: c.props.value, label: c.props.children });
  });

  const selectedLabel = options.find((o) => o.value === value)?.label ?? null;
  const currentIndex = options.findIndex((o) => o.value === value);

  // ── Dropdown positioning ─────────────────────────────────────────────────
  const calcRect = useCallback(() => {
    if (!containerRef.current) return;
    const bcr = containerRef.current.getBoundingClientRect();
    const dropdownMaxH = 260;
    const spaceBelow = window.innerHeight - bcr.bottom;
    const flipUp = spaceBelow < dropdownMaxH && bcr.top > spaceBelow;
    setRect({
      top: flipUp ? bcr.top - 4 : bcr.bottom + 4,
      left: bcr.left,
      width: bcr.width,
      flipUp,
    });
  }, []);

  const open = useCallback(() => {
    if (isDisabled) return;
    calcRect();
    setIsOpen(true);
    setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
  }, [isDisabled, calcRect, currentIndex]);

  const close = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
  }, []);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    const update = () => calcRect();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen, calcRect]);

  // Click-outside
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      const portal = document.getElementById(listboxId);
      if (portal?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen, close, listboxId]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-idx]");
    items[focusedIndex]?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex]);

  // ── Keyboard handler ─────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isDisabled) return;

      if (!isOpen) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          open();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((p) => (p < options.length - 1 ? p + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((p) => (p > 0 ? p - 1 : options.length - 1));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < options.length) {
            onValueChange(options[focusedIndex].value);
            close();
          }
          break;
        case "Escape":
          e.preventDefault();
          close();
          break;
        case "Tab":
          close();
          break;
      }
    },
    [isOpen, isDisabled, open, close, options, focusedIndex, onValueChange]
  );

  // ── Border style ─────────────────────────────────────────────────────────
  const borderCls = isInvalid
    ? "border-[#ef4444]"
    : "border-[var(--sb-border)] hover:border-[var(--sb-orange)]/50";
  const focusCls = isOpen ? "border-[var(--sb-orange)]" : "";

  // ── Dropdown portal ──────────────────────────────────────────────────────
  const dropdown =
    isOpen && rect && mounted
      ? createPortal(
          <div
            id={listboxId}
            style={{
              position: "fixed",
              ...(rect.flipUp
                ? { bottom: window.innerHeight - rect.top }
                : { top: rect.top }),
              left: rect.left,
              width: rect.width,
              zIndex: 9999,
            }}
          >
            <div
              ref={listRef}
              role="listbox"
              aria-label={ariaLabel ?? label ?? "Select"}
              style={{
                maxHeight: 256,
                overflowY: "auto",
                borderRadius: 12,
                border: "1.5px solid var(--sb-border)",
                background: "var(--sb-card)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                padding: "4px",
              }}
            >
              {options.length === 0 ? (
                <div style={{ padding: "12px 14px", fontSize: 14, color: "var(--sb-sub)", textAlign: "center" }}>
                  No options
                </div>
              ) : (
                options.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isFocused = idx === focusedIndex;
                  return (
                    <div
                      key={opt.value}
                      data-idx={idx}
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onValueChange(opt.value);
                        close();
                      }}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected
                          ? "var(--sb-orange)"
                          : "var(--sb-text)",
                        background: isFocused
                          ? "var(--sb-surface-alt)"
                          : isSelected
                          ? "var(--sb-orange-tint, rgba(255,120,0,0.06))"
                          : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "background 0.1s",
                      }}
                    >
                      <span>{opt.label}</span>
                      {isSelected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="var(--sb-orange)" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col gap-1 ${className || ""}`}>
      {label && (
        <label
          htmlFor={triggerId}
          className="text-xs font-semibold text-[var(--sb-sub)]"
        >
          {label}
          {isRequired && <span className="ml-0.5 text-[#ef4444]">*</span>}
        </label>
      )}

      <div
        ref={containerRef}
        onKeyDown={handleKeyDown}
        style={{ position: "relative" }}
      >
        <button
          id={triggerId}
          type="button"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={isOpen ? listboxId : undefined}
          aria-label={ariaLabel}
          aria-required={isRequired}
          aria-invalid={isInvalid}
          disabled={isDisabled}
          onClick={isOpen ? close : open}
          className={[
            "flex w-full items-center rounded-xl border transition-colors",
            "bg-[var(--sb-card)] px-3 cursor-pointer text-left outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            SIZE_H[size] ?? SIZE_H.md,
            SIZE_TEXT[size] ?? SIZE_TEXT.md,
            borderCls,
            focusCls,
          ].join(" ")}
          style={{ paddingRight: "2.25rem" }}
        >
          {startContent && (
            <span style={{ marginRight: 8, flexShrink: 0 }}>{startContent}</span>
          )}
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: selectedLabel ? "var(--sb-text)" : "var(--sb-muted)",
              fontWeight: selectedLabel ? 500 : 400,
            }}
          >
            {selectedLabel ?? placeholder ?? ""}
          </span>
        </button>

        {/* Chevron */}
        <div
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--sb-muted)", transition: "transform 0.2s", transform: `translateY(-50%) rotate(${isOpen ? "180deg" : "0deg"})` }}
          aria-hidden
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>

      {isInvalid && errorMessage && (
        <p className="text-xs text-[#ef4444]">{errorMessage}</p>
      )}
      {!isInvalid && description && (
        <p className="text-xs text-[var(--sb-muted)]">{description}</p>
      )}

      {dropdown}
    </div>
  );
}
