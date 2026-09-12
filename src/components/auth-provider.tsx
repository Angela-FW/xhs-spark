"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isAuthConfigured } from "@/lib/cloud-env";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { AuthModal } from "@/components/auth-modal";

/** Free generate clicks without login; the next one requires sign-in. */
export const FREE_GENERATE_LIMIT = 9;
const FREE_GEN_STORAGE_KEY = "restart-free-gen-count-v1";

function readFreeGenCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = Number(localStorage.getItem(FREE_GEN_STORAGE_KEY) || "0");
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function bumpFreeGenCount(): number {
  const next = readFreeGenCount() + 1;
  try {
    localStorage.setItem(FREE_GEN_STORAGE_KEY, String(next));
  } catch {
    /* ignore quota / private mode */
  }
  return next;
}

type AuthApi = {
  ready: boolean;
  authEnabled: boolean;
  user: User | null;
  session: Session | null;
  /** Gate AI「生成」：未登录可免费点满 FREE_GENERATE_LIMIT 次，第 N+1 次再弹登录. */
  requireAuth: () => Promise<boolean>;
  openAuth: (mode?: "login" | "register") => void;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const authEnabled = isAuthConfigured();
  const [ready, setReady] = useState(!authEnabled);
  const [session, setSession] = useState<Session | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"login" | "register">("login");
  const pendingRef = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    if (!authEnabled) return;
    const sb = getSupabaseBrowser();
    if (!sb) {
      setReady(true);
      return;
    }
    let cancelled = false;
    const failSafe = window.setTimeout(() => {
      if (cancelled) return;
      setReady(true);
    }, 2500);
    sb.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        setReady(true);
      })
      .catch((err) => {
        console.error("getSession failed", err);
        if (!cancelled) setReady(true);
      })
      .finally(() => {
        window.clearTimeout(failSafe);
      });
    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(failSafe);
      sub.subscription.unsubscribe();
    };
  }, [authEnabled]);

  const resolvePending = useCallback((ok: boolean) => {
    pendingRef.current?.(ok);
    pendingRef.current = null;
  }, []);

  const openAuth = useCallback((mode: "login" | "register" = "login") => {
    setModalMode(mode);
    setModalOpen(true);
  }, []);

  const requireAuth = useCallback((): Promise<boolean> => {
    if (!authEnabled) return Promise.resolve(true);
    if (session?.user) return Promise.resolve(true);
    const used = readFreeGenCount();
    if (used < FREE_GENERATE_LIMIT) {
      bumpFreeGenCount();
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      pendingRef.current = resolve;
      setModalMode("register");
      setModalOpen(true);
    });
  }, [authEnabled, session?.user]);

  const signOut = useCallback(async () => {
    const sb = getSupabaseBrowser();
    if (sb) await sb.auth.signOut();
    setSession(null);
  }, []);

  const api = useMemo<AuthApi>(
    () => ({
      ready,
      authEnabled,
      user: session?.user ?? null,
      session,
      requireAuth,
      openAuth,
      signOut,
    }),
    [ready, authEnabled, session, requireAuth, openAuth, signOut],
  );

  return (
    <AuthCtx.Provider value={api}>
      {children}
      <AuthModal
        open={modalOpen}
        mode={modalMode}
        onModeChange={setModalMode}
        onClose={() => {
          setModalOpen(false);
          resolvePending(false);
        }}
        onSuccess={() => {
          setModalOpen(false);
          resolvePending(true);
        }}
      />
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
