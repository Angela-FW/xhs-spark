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

type AuthApi = {
  ready: boolean;
  authEnabled: boolean;
  user: User | null;
  session: Session | null;
  /** Gate AI「生成」：未登录则弹登录/注册；随便逛不弹。 */
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
    sb.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      cancelled = true;
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
