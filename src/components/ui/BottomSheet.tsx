"use client";

import { useEffect, useRef, useCallback } from "react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Height: "half" = 50vh, "full" = 90vh, "auto" = fit content */
  size?: "half" | "full" | "auto";
  children: React.ReactNode;
}

/**
 * Renders a dialog-based bottom sheet that syncs its open state with `isOpen` and closes on backdrop click or Escape.
 *
 * The sheet is implemented with a native `<dialog>` element, constrains its height according to `size`, optionally displays a `title`, and renders `children` inside a scrollable content area.
 *
 * @param isOpen - Whether the bottom sheet should be open
 * @param onClose - Callback invoked when the sheet requests to close (backdrop click or Escape)
 * @param title - Optional header text displayed at the top of the sheet
 * @param size - Height cap for the sheet; `"auto"` (default), `"half"`, or `"full"`
 * @param children - Content rendered inside the sheet's scrollable area
 * @returns A JSX element that mounts a bottom-sheet dialog
 */
export default function BottomSheet({
  isOpen,
  onClose,
  title,
  size = "auto",
  children,
}: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  // Close on Escape
  const handleCancel = useCallback(
    (e: React.SyntheticEvent) => {
      e.preventDefault();
      onClose();
    },
    [onClose]
  );

  const heightClass =
    size === "full"
      ? "max-h-[90vh]"
      : size === "half"
        ? "max-h-[50vh]"
        : "max-h-[85vh]";

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onCancel={handleCancel}
      className="
        fixed inset-0 m-0 p-0 w-full h-full max-w-full max-h-full
        bg-transparent backdrop:bg-black/40
        open:flex items-end justify-center
      "
    >
      <div
        ref={contentRef}
        className={`
          w-full bg-background rounded-t-2xl shadow-2xl
          ${heightClass} overflow-hidden
          animate-slide-up
        `}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 rounded-full bg-default-300" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-4 pb-3 border-b border-divider">
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
        )}

        {/* Scrollable content */}
        <div className="overflow-y-auto px-4 py-4 pb-safe-bottom">
          {children}
        </div>
      </div>
    </dialog>
  );
}
