"use client";

import { useState, useRef, useEffect, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { HKInput } from "@/components/ui/HKInput";

function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Spinner() {
  return (
    <div className="sb-spin h-4 w-4 rounded-full border-2 border-[var(--sb-border)] border-t-[var(--sb-orange)]" />
  );
}

export interface SearchableSelectProps<T extends object> {
  items: T[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSelectionChange: (item: T) => void;
  isLoading?: boolean;
  label?: string;
  placeholder?: string;
  renderItem: (item: T) => React.ReactNode;
  getKey: (item: T) => string;
  getTextValue: (item: T) => string;
  bottomContent?: React.ReactNode | ((close: () => void) => React.ReactNode);
  isInvalid?: boolean;
  errorMessage?: string;
  emptyContent?: string;
  size?: "sm" | "md" | "lg";
  variant?: "flat" | "bordered" | "faded" | "underlined";
  className?: string;
}

interface DropdownRect {
  top: number;
  left: number;
  width: number;
  flipUp: boolean;
}

export function SearchableSelect<T extends object>({
  items,
  inputValue,
  onInputChange,
  onSelectionChange,
  isLoading,
  label,
  placeholder,
  renderItem,
  getKey,
  getTextValue,
  bottomContent,
  isInvalid,
  errorMessage,
  emptyContent = "No items found",
  size = "lg",
  className,
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [rect, setRect] = useState<DropdownRect | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const instanceId = useId();
  const portalId = `searchable-select-portal-${instanceId}`;

  const calcRect = useCallback(() => {
    if (!containerRef.current) return;
    const bcr = containerRef.current.getBoundingClientRect();
    const dropdownMaxHeight = 256 + 4;
    const spaceBelow = window.innerHeight - bcr.bottom;
    const spaceAbove = bcr.top;
    const flipUp = spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow;

    setRect({
      top: flipUp ? bcr.top - 4 : bcr.bottom + 4,
      left: bcr.left,
      width: bcr.width,
      flipUp,
    });
  }, []);

  const open = useCallback(() => {
    calcRect();
    setIsOpen(true);
    setFocusedIndex(-1);
  }, [calcRect]);

  const close = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
  }, []);

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

  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      const portal = document.getElementById(portalId);
      if (portal?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isOpen, close, portalId]);

  const handleSelection = (key: string) => {
    const selectedItem = items.find((item) => getKey(item) === key);
    if (selectedItem) {
      onSelectionChange(selectedItem);
      close();
    }
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter") {
          e.preventDefault();
          open();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev < items.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : items.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < items.length) {
            handleSelection(getKey(items[focusedIndex]));
          }
          break;
        case "Escape":
          e.preventDefault();
          close();
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen, items, focusedIndex, open, close, getKey]
  );

  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const listItems = listRef.current.querySelectorAll("[data-key]");
    listItems[focusedIndex]?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex]);

  const dropdown =
    isOpen && rect ? (
      <div
        id={portalId}
        style={{
          position: "fixed",
          ...(rect.flipUp
            ? { bottom: window.innerHeight - rect.top }
            : { top: rect.top }),
          left: rect.left,
          width: rect.width,
          zIndex: 9999,
        }}
        className="overflow-hidden rounded-xl border border-[var(--sb-border)] bg-[var(--sb-card)] shadow-[var(--shadow-large)]"
      >
        <div ref={listRef} className="max-h-64 overflow-y-auto">
          {items.length === 0 && !isLoading ? (
            <div className="p-4 text-center text-sm text-[var(--sb-sub)]">
              {emptyContent}
            </div>
          ) : (
            <ul className="p-1" role="listbox" aria-label="Selection options">
              {items.map((item, idx) => (
                <li
                  key={getKey(item)}
                  data-key={getKey(item)}
                  role="option"
                  aria-selected={idx === focusedIndex}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelection(getKey(item));
                  }}
                  className={`cursor-pointer rounded-lg px-3 py-2 text-sm text-[var(--sb-text)] transition-colors ${
                    idx === focusedIndex
                      ? "bg-[var(--surface-100)]"
                      : "hover:bg-[var(--surface-50)]"
                  }`}
                >
                  {renderItem(item)}
                </li>
              ))}
            </ul>
          )}
        </div>
        {typeof bottomContent === "function"
          ? bottomContent(close)
          : bottomContent}
      </div>
    ) : null;

  return (
    <>
      <div
        ref={containerRef}
        className={`w-full ${className || ""}`}
        onKeyDown={handleKeyDown}
      >
        <HKInput
          ref={inputRef}
          label={label}
          placeholder={placeholder}
          value={inputValue}
          onValueChange={(val) => {
            onInputChange(val);
            if (!isOpen) open();
          }}
          onFocus={() => {
            if (!isOpen) open();
          }}
          size={size}
          classNames={{
            inputWrapper: size === "lg" ? "h-16" : undefined,
          }}
          isInvalid={isInvalid}
          errorMessage={errorMessage}
          endContent={
            <div
              className="flex h-full cursor-pointer items-center"
              onClick={(e) => {
                e.stopPropagation();
                isOpen ? close() : open();
              }}
            >
              {isLoading ? (
                <Spinner />
              ) : (
                <ChevronDownIcon className="h-4 w-4 text-[var(--sb-muted)]" />
              )}
            </div>
          }
        />
      </div>
      {typeof window !== "undefined" && createPortal(dropdown, document.body)}
    </>
  );
}
