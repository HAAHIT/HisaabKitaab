"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
}

interface DropdownRect {
    top: number;
    left: number;
    width: number;
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
}: SearchableSelectProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const [rect, setRect] = useState<DropdownRect | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate position from viewport (fixed coordinates) every time we open
    const calcRect = useCallback(() => {
        if (!containerRef.current) return;
        const bcr = containerRef.current.getBoundingClientRect();
        setRect({
            top: bcr.bottom + 4,  // 4px gap below input
            left: bcr.left,
            width: bcr.width,
        });
    }, []);

    const open = useCallback(() => {
        calcRect();
        setIsOpen(true);
    }, [calcRect]);

    const close = useCallback(() => setIsOpen(false), []);

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

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const onMouseDown = (e: MouseEvent) => {
            if (containerRef.current?.contains(e.target as Node)) return;
            // Allow clicks inside the portal dropdown
            const portal = document.getElementById("searchable-select-portal");
            if (portal?.contains(e.target as Node)) return;
            close();
        };
        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    }, [isOpen, close]);

    const handleSelection = (key: React.Key) => {
        const selectedItem = items.find((item) => getKey(item) === key);
        if (selectedItem) {
            onSelectionChange(selectedItem);
            close();
        }
    };

    const dropdown = isOpen && rect ? (
        <div
            id="searchable-select-portal"
            style={{
                position: "fixed",
                top: rect.top,
                left: rect.left,
                width: rect.width,
                zIndex: 9999,
            }}
            className="rounded-medium border border-default-200 bg-content1 shadow-large overflow-hidden"
        >
            <div className="max-h-64 overflow-y-auto">
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
                            <ListboxItem key={getKey(item)} textValue={getTextValue(item)}>
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
            <div ref={containerRef} className="w-full" onClick={isOpen ? close : open}>
                <Input
                    label={label}
                    placeholder={placeholder}
                    value={inputValue}
                    onValueChange={onInputChange}
                    variant="bordered"
                    size={size}
                    classNames={{
                        inputWrapper: size === "lg" ? "h-16 min-h-16" : undefined,
                    }}
                    isInvalid={isInvalid}
                    errorMessage={errorMessage}
                    endContent={
                        <div className="flex h-full items-center pointer-events-none">
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
