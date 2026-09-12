"use client";

import { useEffect, useRef, useState } from "react";
import { AppStoreProvider, useAppStore } from "@/components/app-store";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { CalendarBoard } from "@/components/calendar-board";
import { InsightInbox } from "@/components/insight-inbox";
import { GeneratePanel } from "@/components/generate-panel";
import { PersonaPanel } from "@/components/persona-panel";
import { Button } from "@/components/ui/button";
import {
  fetchCloudCoverKeys,
  saveCloudCoverKeys,
} from "@/lib/cloud-cover-keys";
import { fetchCloudState, saveCloudState } from "@/lib/cloud-state";
import {
  hasUsableCoverKeys,
  loadCoverKeys,
  saveCoverKeys,
} from "@/lib/cover-keys";
import { importState } from "@/lib/store";
import { LAUNCH_PRESETS } from "@/lib/persona";

const TABS = [
  { id: "persona", label: "人设" },
  { id: "calendar", label: "日历" },
  { id: "insights", label: "感悟" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function CloudSyncBridge() {
  const { user } = useAuth();
  const { state, ready, importJson, exportJson } = useAppStore();
  const [cloudReady, setCloudReady] = useState(false);
  const pulling = useRef(false);

  useEffect(() => {
    if (!ready || !user) {
      setCloudReady(false);
      return;
    }
    let cancelled = false;
    pulling.current = true;
    (async () => {
      try {
        const remote = await fetchCloudState(user.id);
        if (cancelled) return;
        if (remote?.data) {
          importJson(JSON.stringify(remote.data));
        } else {
          await saveCloudState(user.id, importState(exportJson()));
        }
      } catch (err) {
        console.error("cloud pull failed", err);
      } finally {
        if (!cancelled) {
          pulling.current = false;
          setCloudReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-pull when the signed-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.id]);

  useEffect(() => {
    if (!ready || !user || !cloudReady || pulling.current) return;
    const timer = window.setTimeout(() => {
      void saveCloudState(user.id, importState(exportJson())).catch((err) => {
        console.error("cloud save failed", err);
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [state, ready, user, cloudReady, exportJson]);

  return null;
}

/** Pull / push each user's own AI keys on login (never shared site quota). */
function CoverKeysSyncBridge() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchCloudCoverKeys(user.id);
        if (cancelled) return;
        const local = loadCoverKeys();
        if (remote && hasUsableCoverKeys(remote)) {
          saveCoverKeys(remote);
        } else if (hasUsableCoverKeys(local)) {
          await saveCloudCoverKeys(user.id, local);
        } else if (remote) {
          saveCoverKeys(remote);
        }
      } catch (err) {
        console.error("cover keys sync failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return null;
}

function PlannerInner() {
  const [tab, setTab] = useState<TabId>("calendar");
  const [generateOpen, setGenerateOpen] = useState(false);
  const { state, setSelectedPostId, startLaunchPreset, pickSavedPersona } =
    useAppStore();
  const { authEnabled, user, openAuth, signOut } = useAuth();
  const [mounted, setMounted] = useState(false);
  const persona = state.persona;
  const needsOnboarding = !state.activeWorkspaceId;
  const activeLabel =
    state.workspaces.find((w) => w.id === state.activeWorkspaceId)?.label ||
    persona.name;

  useEffect(() => {
    setMounted(true);
  }, []);

  function openGenerate(postId: string) {
    setSelectedPostId(postId);
    setTab("calendar");
    setGenerateOpen(true);
  }

  function closeGenerate() {
    setGenerateOpen(false);
  }

  return (
    <div className="relative">
      <CloudSyncBridge />
      <CoverKeysSyncBridge />
      <header className="hero-panel relative overflow-hidden px-[max(1.25rem,4vw)] pb-8 pt-8 sm:pt-10">
        <div className="hero-glow" aria-hidden />
        <div className="hero-grain" aria-hidden />
        <div
          className={`mx-auto w-full max-w-7xl transition-all duration-700 ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <p className="brand-mark text-4xl tracking-wide sm:text-5xl">重启笔记</p>
          <h1 className="font-display mt-3 text-xl text-[var(--ink)] sm:text-2xl">
            小红书图文起号，按爆款路径涨粉
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-soft)] sm:text-base">
            {needsOnboarding
              ? "选一个意向人设吧，我来带你起号！"
              : `当前人设「${activeLabel}」· 未来 4 周路线已排好，可往后翻继续规划。`}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!needsOnboarding && state.workspaces.length > 1 ? (
              <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
                <span>切换人设</span>
                <select
                  className="h-8 rounded-md border border-[var(--ink-soft)]/20 bg-white/80 px-2 text-[var(--ink)]"
                  value={state.activeWorkspaceId ?? ""}
                  onChange={(e) => pickSavedPersona(e.target.value)}
                >
                  {state.workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {authEnabled ? (
              user ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void signOut()}
                >
                  退出 {user.email?.split("@")[0]}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openAuth("login")}
                >
                  登录
                </Button>
              )
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-[max(1rem,4vw)]">
        {needsOnboarding ? (
          <div className="pb-16">
            <div className="studio-shell rounded-2xl p-5 sm:p-6">
              <h2 className="font-display text-lg text-[var(--ink)]">
                选一个起号方向
              </h2>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                选定后会生成该人设未来 4 周的笔记路线，之后还能换人或新建。
              </p>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {LAUNCH_PRESETS.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        startLaunchPreset(p.id);
                        setTab("calendar");
                      }}
                      className="h-full w-full rounded-2xl border border-[var(--ink-soft)]/15 bg-white/70 px-4 py-4 text-left transition hover:border-[var(--coral)] hover:bg-[var(--coral)]/5"
                    >
                      <p className="font-medium text-[var(--ink)]">{p.label}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--ink-soft)]">
                        {p.blurb}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : generateOpen ? (
          <div className="pb-16">
            <GeneratePanel onClose={closeGenerate} />
          </div>
        ) : (
          <>
            <nav className="studio-shell sticky top-2 z-20 -mt-2 mb-5 flex gap-1 overflow-x-auto rounded-2xl p-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 rounded-xl px-3 py-2 text-sm transition ${
                    tab === t.id
                      ? "bg-[var(--coral)] text-white"
                      : "text-[var(--ink-soft)] hover:bg-white/70"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="pb-16">
              {tab === "calendar" ? (
                <CalendarBoard onOpenGenerate={openGenerate} />
              ) : null}
              {tab === "persona" ? <PersonaPanel /> : null}
              {tab === "insights" ? <InsightInbox /> : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function PlannerApp() {
  return (
    <AuthProvider>
      <AppStoreProvider>
        <PlannerInner />
      </AppStoreProvider>
    </AuthProvider>
  );
}
