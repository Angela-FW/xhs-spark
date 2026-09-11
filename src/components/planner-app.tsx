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
  const { exportJson, importJson, state, setSelectedPostId } = useAppStore();
  const { authEnabled, user, openAuth, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const persona = state.persona;

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

  const heroFacts = [
    persona.name || null,
    persona.age ? `${persona.age}岁` : null,
    persona.gender || null,
    persona.background || null,
    persona.stage || null,
  ].filter(Boolean);

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
            文案 + 一年规划，边写边调整
          </h1>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-[var(--ink-soft)] sm:text-base">
            {heroFacts.join(" · ")}
            {heroFacts.length ? "。" : ""}
            从 {state.calendarStart} 起排内容阶段；面向
            {persona.audience || "你的读者"}；
            {persona.voice
              ? `语气：${persona.voice.slice(0, 48)}${persona.voice.length > 48 ? "…" : ""}。`
              : ""}
            生成小红书文案与免费封面图，不生成视频。随便逛无需登录；点「生成」时再注册。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const blob = new Blob([exportJson()], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `restart-planner-backup-${state.calendarStart}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              导出备份
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
            >
              导入备份
            </Button>
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
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  importJson(await file.text());
                } catch {
                  alert("导入失败，请检查备份文件");
                }
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-[max(1rem,4vw)]">
        {generateOpen ? (
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
