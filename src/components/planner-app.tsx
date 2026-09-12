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
  { id: "calendar", label: "日历" },
  { id: "insights", label: "感悟" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function CloudSyncBridge({
  onGateReady,
}: {
  onGateReady: (ready: boolean) => void;
}) {
  const { user, ready: authReady } = useAuth();
  const { state, ready, importJson, exportJson } = useAppStore();
  const [cloudReady, setCloudReady] = useState(false);
  const pulling = useRef(false);

  useEffect(() => {
    if (!authReady || !ready) {
      onGateReady(false);
      return;
    }
    if (!user) {
      // Browse locally — no cloud pull to wait for.
      setCloudReady(false);
      onGateReady(true);
      return;
    }

    let cancelled = false;
    pulling.current = true;
    onGateReady(false);
    setCloudReady(false);
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
          onGateReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-pull when the signed-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authReady, user?.id]);

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
  const [personaOpen, setPersonaOpen] = useState(false);
  const {
    state,
    setSelectedPostId,
    startLaunchPreset,
    pickSavedPersona,
    resetAll,
    ready: storeReady,
  } = useAppStore();
  const { authEnabled, user, openAuth, signOut, ready: authReady } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [cloudGateReady, setCloudGateReady] = useState(false);
  const [launching, setLaunching] = useState<{
    id: (typeof LAUNCH_PRESETS)[number]["id"];
    label: string;
  } | null>(null);
  const persona = state.persona;
  const bootReady = storeReady && authReady && cloudGateReady;
  const needsOnboarding = bootReady && !state.activeWorkspaceId;
  const activeLabel =
    state.workspaces.find((w) => w.id === state.activeWorkspaceId)?.label ||
    persona.name;

  useEffect(() => {
    setMounted(true);
  }, []);

  async function onSignOut() {
    await signOut();
    resetAll();
    setPersonaOpen(false);
    setGenerateOpen(false);
    setTab("calendar");
  }

  function openGenerate(postId: string) {
    setSelectedPostId(postId);
    setPersonaOpen(false);
    setTab("calendar");
    setGenerateOpen(true);
  }

  function closeGenerate() {
    setGenerateOpen(false);
  }

  function openPersona() {
    setGenerateOpen(false);
    setPersonaOpen(true);
  }

  function closePersona() {
    setPersonaOpen(false);
    setTab("calendar");
  }

  async function onPickLaunch(preset: (typeof LAUNCH_PRESETS)[number]) {
    if (launching) return;
    setLaunching({ id: preset.id, label: preset.label });
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    await new Promise((resolve) =>
      window.setTimeout(resolve, reduceMotion ? 120 : 1100),
    );
    startLaunchPreset(preset.id);
    setTab("calendar");
    setPersonaOpen(false);
    window.setTimeout(() => setLaunching(null), reduceMotion ? 0 : 280);
  }

  const heroSupport = launching
    ? `已选「${launching.label}」，正在为你排未来 4 周起号路线…`
    : needsOnboarding
      ? "选一个意向人设吧，我来带你起号！"
      : `当前人设「${activeLabel}」· 未来 4 周路线已排好，可往后翻继续规划。`;

  return (
    <div className="relative">
      <CloudSyncBridge onGateReady={setCloudGateReady} />
      <CoverKeysSyncBridge />
      <header className="hero-panel relative overflow-hidden px-[max(1.25rem,4vw)] pb-4 pt-6 sm:pb-5 sm:pt-8">
        <div className="hero-glow" aria-hidden />
        <div className="hero-grain" aria-hidden />
        <div
          className={`mx-auto w-full max-w-7xl transition-all duration-700 ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <div className="relative">
            {authEnabled ? (
              <div className="mb-3 flex justify-end sm:absolute sm:right-0 sm:top-0 sm:mb-0 sm:z-10">
                {user ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => void onSignOut()}
                  >
                    退出 {user.email?.split("@")[0]}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => openAuth("login")}
                  >
                    登录
                  </Button>
                )}
              </div>
            ) : null}
            <p className="brand-mark whitespace-nowrap text-[clamp(1.75rem,8vw,3rem)] tracking-wide sm:pr-24">
              小红书图文起号
            </p>
          </div>
          <h1 className="font-display mt-2 text-xl text-[var(--ink)] sm:mt-3 sm:text-2xl">
            按爆款路径涨粉
          </h1>
          {bootReady && !needsOnboarding && !launching ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {state.workspaces.map((w) => {
                const active = w.id === state.activeWorkspaceId;
                return (
                  <Button
                    key={w.id}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className={
                      active
                        ? "bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
                        : undefined
                    }
                    onClick={() => {
                      if (!active) pickSavedPersona(w.id);
                    }}
                  >
                    {w.label}
                  </Button>
                );
              })}
              <Button type="button" size="sm" variant="outline" onClick={openPersona}>
                选择人设
              </Button>
            </div>
          ) : null}
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--ink-soft)] sm:text-base">
            {!bootReady
              ? "加载中…"
              : heroSupport}
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-[max(1rem,4vw)]">
        {!bootReady ? (
          <div className="studio-shell mb-16 rounded-2xl px-6 py-12 text-center text-sm text-[var(--ink-soft)]">
            正在同步你的规划…
          </div>
        ) : launching ? (
          <div className="launch-bridge studio-shell mb-16 rounded-2xl px-6 py-12 text-center">
            <p className="font-display text-lg text-[var(--ink)]">
              好的，就从「{launching.label}」开始
            </p>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              正在按爆款起号路径，排好未来 4 周笔记…
            </p>
            <div
              className="launch-pulse mx-auto mt-6 h-1 w-40 rounded-full bg-[var(--coral)]"
              aria-hidden
            />
          </div>
        ) : needsOnboarding ? (
          <div className="pb-16">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {LAUNCH_PRESETS.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={Boolean(launching)}
                    onClick={() => void onPickLaunch(p)}
                    className="studio-shell h-full w-full rounded-2xl px-4 py-4 text-left transition hover:border-[var(--coral)] hover:bg-[var(--coral)]/5 disabled:opacity-60"
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
        ) : generateOpen ? (
          <div className="result-enter pb-16">
            <GeneratePanel onClose={closeGenerate} />
          </div>
        ) : personaOpen ? (
          <div className="result-enter pb-16">
            <div className="studio-shell sticky top-2 z-20 -mt-2 mb-5 flex items-center justify-between gap-3 rounded-2xl p-2">
              <Button type="button" size="sm" variant="outline" onClick={closePersona}>
                ← 返回
              </Button>
              <p className="pr-2 text-sm text-[var(--ink-soft)]">人设配置</p>
            </div>
            <PersonaPanel />
          </div>
        ) : (
          <div className="result-enter">
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
              {tab === "insights" ? <InsightInbox /> : null}
            </div>
          </div>
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
