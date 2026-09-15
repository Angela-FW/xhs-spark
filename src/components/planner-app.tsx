"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown, Lightbulb, Settings } from "lucide-react";
import { AppStoreProvider, useAppStore } from "@/components/app-store";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { CalendarBoard } from "@/components/calendar-board";
import { InsightInbox } from "@/components/insight-inbox";
import { GeneratePanel } from "@/components/generate-panel";
import { PersonaPanel } from "@/components/persona-panel";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  fetchCloudCoverKeys,
  saveCloudCoverKeys,
} from "@/lib/cloud-cover-keys";
import {
  fetchCloudStateWithRetry,
  flushPlannerCloud,
  registerPlannerCloudFlush,
  saveCloudState,
  subscribePlannerState,
} from "@/lib/cloud-state";
import { loadCoverKeys, mergeCoverKeys, saveCoverKeys } from "@/lib/cover-keys";
import { resolvePlannerSync, syncFingerprint } from "@/lib/planner-sync";
import {
  importState,
  plannerHasContent,
  PLANNER_STORAGE_CLEARED_EVENT,
  syncActiveWorkspace,
  type AppState,
} from "@/lib/store";
import { LAUNCH_PRESETS } from "@/lib/persona";

const TABS = [
  { id: "calendar", label: "日历", Icon: CalendarDays },
  { id: "insights", label: "灵感", Icon: Lightbulb },
] as const;

type TabId = (typeof TABS)[number]["id"];

function PersonaSwitcher({
  workspaces,
  activeId,
  onPickSaved,
  onPickLaunch,
}: {
  workspaces: { id: string; label: string; persona: { presetId: string } }[];
  activeId: string | null;
  onPickSaved: (id: string) => void;
  onPickLaunch: (preset: (typeof LAUNCH_PRESETS)[number]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pendingLaunch, setPendingLaunch] = useState<
    (typeof LAUNCH_PRESETS)[number] | null
  >(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = workspaces.find((w) => w.id === activeId);
  const unused = LAUNCH_PRESETS.filter(
    (p) => !workspaces.some((w) => w.persona.presetId === p.id),
  );

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--ink-soft)]/25 bg-white/80 px-4 text-sm text-[var(--ink-soft)] hover:bg-white"
      >
        <span className="max-w-[9.5rem] truncate">{active?.label ?? "选择人设"}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-[var(--ink-soft)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-2 min-w-52 overflow-hidden rounded-xl border border-[var(--ink-soft)]/15 bg-white py-1 shadow-lg"
        >
          {workspaces.map((w) => {
            const selected = w.id === activeId;
            return (
              <button
                key={w.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                  selected
                    ? "bg-[var(--coral)]/10 text-[var(--coral-deep)]"
                    : "text-[var(--ink)] hover:bg-[var(--mist)]"
                }`}
                onClick={() => {
                  if (!selected) onPickSaved(w.id);
                  setOpen(false);
                }}
              >
                {w.label}
                {selected ? <Check className="size-4 shrink-0" /> : null}
              </button>
            );
          })}
          {unused.length > 0 ? (
            <>
              <div className="my-1 border-t border-[var(--ink-soft)]/15" />
              {unused.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="flex w-full px-3 py-2 text-left text-sm text-[var(--ink)] hover:bg-[var(--mist)]"
                  onClick={() => {
                    setPendingLaunch(p);
                    setOpen(false);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(pendingLaunch)}
        title="选用起号方向"
        message="将新建该人设的独立笔记库，并生成未来四周路线。其他人设内容不会丢。"
        confirmLabel="继续"
        onConfirm={() => {
          if (pendingLaunch) onPickLaunch(pendingLaunch);
          setPendingLaunch(null);
        }}
        onCancel={() => setPendingLaunch(null)}
      />
    </div>
  );
}

function CloudSyncBridge({
  onGateReady,
}: {
  onGateReady: (ready: boolean) => void;
}) {
  const { user, ready: authReady } = useAuth();
  const { state, ready, importJson } = useAppStore();
  const [cloudReady, setCloudReady] = useState(false);
  const pulling = useRef(false);
  const pushing = useRef(false);
  const pulledOk = useRef(false);
  const syncRun = useRef(0);
  const localRef = useRef(state);
  const userIdRef = useRef(user?.id);
  const lastPushedFp = useRef("");
  const lastPushedAt = useRef("");
  const pendingPush = useRef<AppState | null>(null);
  const suppressPushUntil = useRef(0);
  const ignoreReloadUntil = useRef(0);
  const pushNowRef = useRef<(explicit?: AppState) => Promise<void>>(async () => {});
  localRef.current = state;
  userIdRef.current = user?.id;

  pushNowRef.current = async (explicit?: AppState) => {
    const userId = userIdRef.current;
    if (!userId || !pulledOk.current) return;
    const next = syncActiveWorkspace(explicit ?? pendingPush.current ?? localRef.current);
    pendingPush.current = next;
    if (!plannerHasContent(next)) {
      pendingPush.current = null;
      return;
    }
    const fp = syncFingerprint(next);
    if (fp === lastPushedFp.current) {
      pendingPush.current = null;
      return;
    }
    if (pushing.current) return;
    pushing.current = true;
    pendingPush.current = null;
    ignoreReloadUntil.current = Date.now() + 8000;
    let saved = false;
    try {
      const updatedAt = await saveCloudState(userId, next);
      lastPushedFp.current = fp;
      lastPushedAt.current = updatedAt;
      saved = true;
    } catch (err) {
      console.error("cloud save failed", err);
      pendingPush.current = next;
    } finally {
      pushing.current = false;
    }
    if (
      saved &&
      pendingPush.current &&
      syncFingerprint(pendingPush.current) !== lastPushedFp.current
    ) {
      await pushNowRef.current(pendingPush.current);
    }
  };

  useEffect(() => {
    registerPlannerCloudFlush((explicit) => pushNowRef.current(explicit));
    return () => registerPlannerCloudFlush(null);
  }, []);

  useEffect(() => {
    if (!authReady || !ready) {
      onGateReady(false);
      return;
    }
    if (!user) {
      lastPushedFp.current = "";
      lastPushedAt.current = "";
      pendingPush.current = null;
      pulledOk.current = false;
      setCloudReady(false);
      onGateReady(true);
      return;
    }

    const userId = user.id;
    let cancelled = false;

    async function syncFromCloud(opts?: { quiet?: boolean }) {
      const runId = ++syncRun.current;
      pulling.current = true;
      if (!opts?.quiet) {
        onGateReady(false);
        setCloudReady(false);
      }
      try {
        const remote = await fetchCloudStateWithRetry(userId);
        if (cancelled || syncRun.current !== runId) return;
        const local = syncActiveWorkspace(localRef.current);
        const remoteState = remote?.data
          ? importState(JSON.stringify(remote.data))
          : null;
        const remoteFp = remoteState ? syncFingerprint(remoteState) : "";
        const remoteAt = remote?.updatedAt ?? "";
        pulledOk.current = true;

        const plan = resolvePlannerSync(local, remoteState);
        const canApply = !opts?.quiet || Date.now() >= ignoreReloadUntil.current;
        if (plan.applyLocal && canApply) {
          suppressPushUntil.current = Date.now() + 2000;
          lastPushedFp.current = syncFingerprint(plan.applyLocal);
          if (remoteAt) lastPushedAt.current = remoteAt;
          importJson(JSON.stringify(plan.applyLocal), { force: true });
        } else if (!opts?.quiet) {
          lastPushedFp.current = remoteFp || syncFingerprint(plan.upload ?? local);
          if (remoteAt) lastPushedAt.current = remoteAt;
        }
        if (plan.upload) {
          pendingPush.current = plan.upload;
          await pushNowRef.current(plan.upload);
        }
      } catch (err) {
        console.error("cloud pull failed", err);
      } finally {
        if (syncRun.current === runId) {
          pulling.current = false;
          if (!cancelled) {
            onGateReady(true);
            if (pulledOk.current) {
              setCloudReady(true);
              if (pendingPush.current) {
                void pushNowRef.current(pendingPush.current);
              }
            } else {
              setCloudReady(false);
            }
          }
        }
      }
    }

    void syncFromCloud();

    const pullQuiet = () => {
      if (cancelled || pulling.current) return;
      void syncFromCloud({ quiet: true });
    };
    const onCleared = () => {
      window.location.reload();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") pullQuiet();
      else void pushNowRef.current();
    };
    const onPageHide = () => {
      void pushNowRef.current();
    };
    window.addEventListener(PLANNER_STORAGE_CLEARED_EVENT, onCleared);
    window.addEventListener("focus", pullQuiet);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVis);
    const poll = window.setInterval(pullQuiet, 15_000);
    const unsubscribe = subscribePlannerState(userId, pullQuiet);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener(PLANNER_STORAGE_CLEARED_EVENT, onCleared);
      window.removeEventListener("focus", pullQuiet);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(poll);
    };
  }, [ready, authReady, user?.id, importJson, onGateReady]);

  useEffect(() => {
    if (!ready || !user || !cloudReady || pulling.current) return;
    if (Date.now() < suppressPushUntil.current) return;
    const next = syncActiveWorkspace(state);
    if (!plannerHasContent(next)) return;
    if (syncFingerprint(next) === lastPushedFp.current) return;
    const timer = window.setTimeout(() => {
      void pushNowRef.current(next);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [state, ready, user, cloudReady]);

  return null;
}

/** Pull / push each user's own AI keys on login (never shared site quota). */
function CoverKeysSyncBridge() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const userId = user.id;

    async function syncKeys() {
      try {
        const remote = await fetchCloudCoverKeys(userId);
        if (cancelled) return;
        const plan = mergeCoverKeys(loadCoverKeys(), remote);
        if (plan.writeLocal) saveCoverKeys(plan.keys);
        if (plan.writeRemote) await saveCloudCoverKeys(userId, plan.keys);
      } catch (err) {
        console.error("cover keys sync failed", err);
      }
    }

    void syncKeys();
    const onVis = () => {
      if (document.visibilityState === "visible") void syncKeys();
    };
    window.addEventListener("focus", syncKeys);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", syncKeys);
      document.removeEventListener("visibilitychange", onVis);
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
  const bootReady = storeReady && authReady && cloudGateReady;
  const needsOnboarding = bootReady && !state.activeWorkspaceId;

  useEffect(() => {
    setMounted(true);
  }, []);

  async function onSignOut() {
    await flushPlannerCloud();
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
      ? "选一个意向人设吧，我来带你创作！"
      : null;

  const showMainToolbar =
    bootReady && !needsOnboarding && !launching && !generateOpen && !personaOpen;

  return (
    <div className="relative">
      <CloudSyncBridge onGateReady={setCloudGateReady} />
      <CoverKeysSyncBridge />
      <header className="hero-panel relative z-40 px-[max(1.25rem,4vw)] pb-4 pt-6 sm:pb-5 sm:pt-8">
        <div className="pointer-events-none absolute inset-0 isolate overflow-hidden" aria-hidden>
          <div className="hero-glow" />
          <div className="hero-grain" />
        </div>
        <div
          className={`relative z-10 mx-auto w-full max-w-7xl transition-all duration-700 ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="brand-mark relative inline-block text-[clamp(1.5rem,5vw,2.25rem)] tracking-wide">
                灵感笔记
                <span
                  className="absolute left-0 -bottom-0.5 h-0.5 w-10 rounded-full bg-[var(--coral)]"
                  aria-hidden
                />
              </p>
              <h1 className="mt-3 text-sm text-[var(--ink-soft)] sm:text-base">
                创作管理你的灵感笔记
              </h1>
            </div>
            {authEnabled ? (
              user ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-10 shrink-0 rounded-xl px-4"
                  onClick={() => void onSignOut()}
                >
                  退出 {user.email?.split("@")[0]}
                </Button>
              ) : (
                <div className="shrink-0 text-right">
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 rounded-[8px] bg-[var(--coral)] px-4 text-white hover:bg-[var(--coral-deep)]"
                    onClick={() => openAuth("login")}
                  >
                    登录
                  </Button>
                  <p className="mt-1 max-w-[10.5rem] text-[11px] leading-4 text-[var(--ink-soft)]">
                    同一账号才能跨浏览器同步
                  </p>
                </div>
              )
            ) : null}
          </div>

          {showMainToolbar ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <nav className="flex rounded-full bg-white/80 p-1 shadow-sm">
                {TABS.map((t) => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition ${
                        active
                          ? "bg-[var(--coral)] text-white"
                          : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                      }`}
                    >
                      <t.Icon className="size-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </nav>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <PersonaSwitcher
                  workspaces={state.workspaces}
                  activeId={state.activeWorkspaceId}
                  onPickSaved={pickSavedPersona}
                  onPickLaunch={(preset) => startLaunchPreset(preset.id)}
                />
                <div className="group relative shrink-0">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label="人设设置"
                    className="size-10 rounded-full"
                    onClick={openPersona}
                  >
                    <Settings />
                  </Button>
                  <span className="pointer-events-none absolute left-1/2 bottom-full z-50 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--ink)] px-2 py-1 text-xs text-white shadow-sm group-hover:block group-focus-within:block">
                    人设设置
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {!bootReady || heroSupport ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-soft)]">
              {!bootReady ? "加载中…" : heroSupport}
            </p>
          ) : null}
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
            <PersonaPanel onDone={closePersona} />
          </div>
        ) : (
          <div className="result-enter">
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
