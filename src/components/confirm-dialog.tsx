"use client";

import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确定继续",
  cancelLabel = "取消",
  danger,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--paper)] p-5 shadow-xl">
        <h3
          id="confirm-dialog-title"
          className="font-display text-lg text-[var(--ink)]"
        >
          {title}
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--ink-soft)]">
          {message}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            className={
              danger
                ? "bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
                : "bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
