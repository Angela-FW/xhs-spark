"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  COVER_KEY_LINKS,
  hasUsableCoverKeys,
  loadCoverKeys,
  saveCoverKeys,
  type StoredCoverKeys,
} from "@/lib/cover-keys";
import type { CoverProvider } from "@/lib/cover-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  /** Compact copy for register modal */
  compact?: boolean;
  onSaved?: (keys: StoredCoverKeys) => void;
};

export function CoverKeysForm({ compact, onSaved }: Props) {
  const [keys, setKeys] = useState<StoredCoverKeys>(() => loadCoverKeys());
  const [savedHint, setSavedHint] = useState<string | null>(null);

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

  function handleSave() {
    saveCoverKeys(keys);
    setSavedHint(hasUsableCoverKeys(keys) ? "已保存，可稍后改" : "已保存（尚未填完整，可稍后再配）");
    onSaved?.(keys);
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--ink-soft)]/15 bg-white/70 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">生图模型 Key</p>
          <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
            {compact
              ? "可先跳过，注册后随时再配；不影响登录。"
              : "存在本机浏览器，可随时修改。不配也能先写文案。"}
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
        <Button type="button" size="sm" variant="outline" onClick={handleSave}>
          保存 Key
        </Button>
        {savedHint ? (
          <span className="text-xs text-[var(--coral)]">{savedHint}</span>
        ) : null}
      </div>
    </div>
  );
}
