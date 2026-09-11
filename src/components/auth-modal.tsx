"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { CoverKeysForm } from "@/components/cover-keys-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  mode: "login" | "register";
  onModeChange: (mode: "login" | "register") => void;
  onClose: () => void;
  onSuccess: () => void;
};

export function AuthModal({
  open,
  mode,
  onModeChange,
  onClose,
  onSuccess,
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState(false);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const sb = getSupabaseBrowser();
    if (!sb) {
      setError("未配置登录服务（缺少 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY）");
      return;
    }
    if (!email.trim() || password.length < 6) {
      setError("请填写邮箱，密码至少 6 位");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error: err } = await sb.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        onSuccess();
      } else {
        const { data, error: err } = await sb.auth.signUp({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        if (data.session) {
          onSuccess();
        } else {
          setInfo("注册成功。若开启了邮箱验证，请先去邮箱点确认，再回来登录。");
          onModeChange("login");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-[var(--paper)] p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="auth-title" className="font-display text-lg text-[var(--ink)]">
              {mode === "login" ? "登录后生成" : "注册后生成"}
            </p>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">
              随便浏览不用账号；点「生成」类功能时再登录或注册。
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            关闭
          </Button>
        </div>

        <div className="mt-4 flex gap-1 rounded-xl bg-white/70 p-1">
          <button
            type="button"
            className={`flex-1 rounded-lg px-3 py-2 text-sm ${
              mode === "login"
                ? "bg-[var(--coral)] text-white"
                : "text-[var(--ink-soft)]"
            }`}
            onClick={() => {
              onModeChange("login");
              setError(null);
              setInfo(null);
            }}
          >
            登录
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg px-3 py-2 text-sm ${
              mode === "register"
                ? "bg-[var(--coral)] text-white"
                : "text-[var(--ink-soft)]"
            }`}
            onClick={() => {
              onModeChange("register");
              setError(null);
              setInfo(null);
            }}
          >
            注册
          </button>
        </div>

        <form className="mt-4 space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="auth-email">邮箱</Label>
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-password">密码</Label>
            <Input
              id="auth-password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              required
              minLength={6}
            />
          </div>

          {mode === "register" ? (
            <div className="space-y-2">
              <button
                type="button"
                className="text-left text-xs text-[var(--coral-deep)] underline-offset-2 hover:underline"
                onClick={() => setShowKeys((v) => !v)}
              >
                {showKeys ? "收起生图 Key 配置" : "配置生图模型 Key（登录后同步）"}
              </button>
              {showKeys ? <CoverKeysForm compact /> : (
                <p className="text-xs text-[var(--ink-soft)]">
                  每人自备 Cloudflare / 硅基流动等 Key，登录后同步到账号，不占用别人额度。可先注册，之后在生成页再配；
                  <a
                    href="https://dash.cloudflare.com/?to=/:account/ai/workers-ai"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--coral-deep)] underline-offset-2 hover:underline"
                  >
                    打开 Cloudflare 申请页
                  </a>
                  。
                </p>
              )}
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-[var(--coral)]" role="alert">
              {error}
            </p>
          ) : null}
          {info ? (
            <p className="text-sm text-[var(--ink-soft)]" role="status">
              {info}
            </p>
          ) : null}

          <Button
            type="submit"
            className="h-11 w-full bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
            disabled={busy}
          >
            {busy
              ? "请稍候…"
              : mode === "login"
                ? "登录并继续生成"
                : "注册并继续"}
          </Button>
        </form>
      </div>
    </div>
  );
}
