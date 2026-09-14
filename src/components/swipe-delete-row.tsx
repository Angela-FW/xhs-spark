"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";

const ACTION_WIDTH = 88;
const OPEN_THRESHOLD = 40;

export function SwipeDeleteRow({
  onDelete,
  children,
}: {
  onDelete: () => void;
  children: ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const base = useRef(0);
  const axis = useRef<"x" | "y" | null>(null);
  const dragging = useRef(false);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging.current = true;
    axis.current = null;
    startX.current = e.clientX;
    startY.current = e.clientY;
    base.current = offset;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic / already captured */
    }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (!axis.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (axis.current !== "x") return;
    const next = Math.min(0, Math.max(-ACTION_WIDTH, base.current + dx));
    setOffset(next);
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
    if (axis.current !== "x") {
      axis.current = null;
      return;
    }
    axis.current = null;
    setOffset((v) => (v < -OPEN_THRESHOLD ? -ACTION_WIDTH : 0));
  }

  const open = offset < -OPEN_THRESHOLD;
  const revealing = offset < -1;

  return (
    <div className="relative overflow-hidden rounded-xl">
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-hidden={!revealing}
        className={`absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-[var(--coral)] text-sm text-white transition-opacity ${
          revealing ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          setOffset(0);
          onDelete();
        }}
      >
        删除
      </button>
      <div
        className="relative touch-pan-y rounded-xl bg-white"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging.current ? "none" : "transform 0.2s ease",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if (offset < -12) {
            e.stopPropagation();
            e.preventDefault();
            setOffset(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
