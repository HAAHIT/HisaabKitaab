"use client";

import { useState, useRef, useEffect, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { Input, Listbox, ListboxItem, Spinner } from "@heroui/react";

function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="m6 9 6 6 6-6" />
        </svg>
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
    variant = "bordered",
    className,
}: SearchableSelectProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const [rect, setRect] = useState<DropdownRect | null>(null);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // [FIX #8] Unique portal ID per instance to avoid collision
    const instanceId = useId();
    const portalId = `searchable-select-portal-${instanceId}`;

    // [FIX #10] Calculate position with viewport flip logic
    const calcRect = useCallback(() => {
        if (!containerRef.current) return;
        const bcr = containerRef.current.getBoundingClientRect();
        const dropdownMaxHeight = 256 + 4; // max-h-64 + gap
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

    // Re-calc on scroll/resize so the dropdown follows the input
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

    // Close on outside click — uses unique portal ID
    useEffect(() => {
        if (!isOpen) return;
        const onMouseDown = (e: MouseEvent) => {
            if (containerRef.current?.contains(e.target as Node)) return;
            // [FIX #8] Allow clicks inside this instance's portal dropdown
            const portal = document.getElementById(portalId);
            if (portal?.contains(e.target as Node)) return;
            close();
        };
        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    }, [isOpen, close, portalId]);

    const handleSelection = (key: React.Key) => {
        const selectedItem = items.find((item) => getKey(item) === key);
        if (selectedItem) {
            onSelectionChange(selectedItem);
            close();
        }
    };

    // [FIX #9] Keyboard navigation
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
        [isOpen, items, focusedIndex, open, close, getKey]
    );

    // Scroll focused item into view
    useEffect(() => {
        if (focusedIndex < 0 || !listRef.current) return;
        const listItems = listRef.current.querySelectorAll("[data-key]");
        listItems[focusedIndex]?.scrollIntoView({ block: "nearest" });
    }, [focusedIndex]);

    const dropdown = isOpen && rect ? (
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
            className="rounded-medium border border-default-200 bg-content1 shadow-large overflow-hidden"
        >
            <div ref={listRef} className="max-h-64 overflow-y-auto">
                {items.length === 0 && !isLoading ? (
                    <div className="p-4 text-sm text-default-500 text-center">
                        {emptyContent}
                    </div>
                ) : (
                    <Listbox
                        aria-label="Selection options"
                        items={items}
                        onAction={handleSelection}
                        emptyContent={null}
                        classNames={{ list: "p-1" }}
                    >
                        {(item: T) => (
                            <ListboxItem
                                key={getKey(item)}
                                textValue={getTextValue(item)}
                                data-key={getKey(item)}
                                className={
                                    items.indexOf(item) === focusedIndex
                                        ? "bg-default-100"
                                        : undefined
                                }
                            >
                                {renderItem(item)}
                            </ListboxItem>
                        )}
                    </Listbox>
                )}
            </div>
            {typeof bottomContent === "function" ? bottomContent(close) : bottomContent}
        </div>
    ) : null;

    return (
        <>
            {/* [FIX #20] Separate click handler on the wrapper; stop propagation
                from the input so typing doesn't toggle the dropdown */}
            <div ref={containerRef} className={`w-full ${className || ""}`} onKeyDown={handleKeyDown}>
                <Input
                    ref={inputRef}
                    label={label}
                    placeholder={placeholder}
                    value={inputValue}
                    onValueChange={(val) => {
                        onInputChange(val);
                        if (!isOpen) open();
                    }}
                    onFocus={() => { if (!isOpen) open(); }}
                    variant={variant}
                    size={size}
                    classNames={{
                        inputWrapper: size === "lg" ? "h-16 min-h-16" : undefined,
                    }}
                    isInvalid={isInvalid}
                    errorMessage={errorMessage}
                    endContent={
                        <div
                            className="flex h-full items-center cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                isOpen ? close() : open();
                            }}
                        >
                            {isLoading ? (
                                <Spinner size="sm" color="default" />
                            ) : (
                                <ChevronDownIcon className="w-4 h-4 text-default-400" />
                            )}
                        </div>
                    }
                />
            </div>
            {typeof window !== "undefined" && createPortal(dropdown, document.body)}
        </>
    );
}
