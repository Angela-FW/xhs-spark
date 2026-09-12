"use client";

import { createPortal } from "react-dom";
import { CoverKeysForm } from "@/components/cover-keys-form";
import { Button } from "@/components/ui/button";
import { hasUsableCoverKeys, type StoredCoverKeys } from "@/lib/cover-keys";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called after user saves a usable key set */
  onConfigured?: (keys: StoredCoverKeys) => void;
};

export function CoverKeysModal({ open, onClose, onConfigured }: Props) {
  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cover-keys-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--paper)] p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              id="cover-keys-title"
              className="font-display text-lg text-[var(--ink)]"
            >
              配置文生图 Key
            </h3>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">
              每人使用自己的 Key，登录后跨设备同步到账号。不会占用别人的 Cloudflare 额度。
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            关闭
          </Button>
        </div>

        <div className="mt-4">
          <CoverKeysForm
            onSaved={(keys) => {
              if (hasUsableCoverKeys(keys)) {
                onConfigured?.(keys);
                onClose();
              }
            }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
