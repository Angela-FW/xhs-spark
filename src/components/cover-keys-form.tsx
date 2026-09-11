"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCloudCoverKeys } from "@/lib/cloud-cover-keys";
import type { CoverProvider } from "@/lib/cover-image";
import {
  COVER_KEY_LINKS,
  hasUsableCoverKeys,
  loadCoverKeys,
  saveCoverKeys,
  type StoredCoverKeys,
} from "@/lib/cover-keys";

type Props = {
  /** Compact copy for register modal */
  compact?: boolean;
  onSaved?: (keys: StoredCoverKeys) => void;
};

export function CoverKeysForm({ compact, onSaved }: Props) {
  const { user } = useAuth();
  const [keys, setKeys] = useState<StoredCoverKeys>(() => loadCoverKeys());
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const sync = () => setKeys(loadCoverKeys());
    window.addEventListener("restart-cover-keys", sync);
    return () => window.removeEventListener("restart-cover-keys", sync);
  }, []);

  const link = COVER_KEY_LINKS[keys.provider || "cloudflare"];

  function update<K extends keyof StoredCoverKeys>(key: K, value: StoredCoverKeys[K]) {
    setKeys((prev) => ({ ...prev, [key]: value }));
    setSavedHint(null);
  }

  async function handleSave() {
    setSaving(true);
    setSavedHint(null);
    const next: StoredCoverKeys = {
      ...keys,
      configuredAt: new Date().toISOString(),
    };
    try {
      saveCoverKeys(next);
      if (user) {
        await saveCloudCoverKeys(user.id, next);
        setSavedHint(
          hasUsableCoverKeys(next)
            ? "已保存并同步到你的账号"
            : "已同步（尚未填完整，可稍后再配）",
        );
      } else {
        setSavedHint(
          hasUsableCoverKeys(next)
            ? "已保存到本机；登录后会同步到账号"
            : "已保存（尚未填完整，可稍后再配）",
        );
      }
      onSaved?.(next);
    } catch (err) {
      setSavedHint(
        err instanceof Error ? `本机已存，云端同步失败：${err.message}` : "同步失败",
      );
      onSaved?.(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--ink-soft)]/15 bg-white/70 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">生图模型 Key</p>
          <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
            {compact
              ? "每人自备 Key。登录后会同步到你的账号，不占用别人额度。"
              : "每人使用自己的 Key。登录后跨设备同步；不配则无法生图。"}
          </p>
        </div>
        <a
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[var(--coral-deep)] underline-offset-2 hover:underline"
        >
          去申请 {link.label}
          <ExternalLink className="size-3" />
        </a>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cover-provider">线路</Label>
        <select
          id="cover-provider"
          value={keys.provider || "cloudflare"}
          onChange={(e) =>
            update("provider", e.target.value as CoverProvider)
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="cloudflare">Cloudflare（推荐，每日免费额度）</option>
          <option value="siliconflow">硅基流动</option>
          <option value="pollinations">Pollinations</option>
        </select>
        <p className="text-xs text-[var(--ink-soft)]">{link.help}</p>
      </div>

      {(keys.provider || "cloudflare") === "cloudflare" ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="cf-account">Account ID</Label>
            <Input
              id="cf-account"
              value={keys.cloudflareAccountId || ""}
              onChange={(e) => update("cloudflareAccountId", e.target.value)}
              placeholder="Cloudflare Account ID"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-token">API Token</Label>
            <Input
              id="cf-token"
              type="password"
              value={keys.cloudflareToken || ""}
              onChange={(e) => update("cloudflareToken", e.target.value)}
              placeholder="Workers AI 权限 Token"
              autoComplete="off"
            />
          </div>
        </>
      ) : null}

      {keys.provider === "siliconflow" ? (
        <div className="space-y-1.5">
          <Label htmlFor="sf-key">API Key</Label>
          <Input
            id="sf-key"
            type="password"
            value={keys.siliconflowKey || ""}
            onChange={(e) => update("siliconflowKey", e.target.value)}
            placeholder="硅基流动 API Key"
            autoComplete="off"
          />
        </div>
      ) : null}

      {keys.provider === "pollinations" ? (
        <div className="space-y-1.5">
          <Label htmlFor="po-key">API Key</Label>
          <Input
            id="po-key"
            type="password"
            value={keys.pollinationsKey || ""}
            onChange={(e) => update("pollinationsKey", e.target.value)}
            placeholder="Pollinations API Key"
            autoComplete="off"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? "保存中…" : "保存 Key"}
        </Button>
        {savedHint ? (
          <span className="text-xs text-[var(--coral)]">{savedHint}</span>
        ) : null}
      </div>
    </div>
  );
}
