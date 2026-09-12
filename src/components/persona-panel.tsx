"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/components/app-store";
import { useAuth } from "@/components/auth-provider";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  LAUNCH_PRESETS,
  MAX_SAVED_PERSONAS,
  applyEditableFields,
  clonePersona,
  editableFieldsFromPersona,
  type CreatorPersona,
  type PresetId,
} from "@/lib/persona";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Fields = ReturnType<typeof editableFieldsFromPersona>;
type Step = "pick" | "edit";

const REBUILD_HINT =
  "会清空其他周的「待写」选题，只保留已起草/已发布，并重新生成未来四周。确定继续？";

type PendingAction =
  | { kind: "system"; id: PresetId }
  | { kind: "saved"; id: string }
  | { kind: "blank" }
  | { kind: "rebuild" }
  | { kind: "delete"; id: string; label: string }
  | { kind: "reset" };

export function PersonaPanel() {
  const {
    state,
    updatePersona,
    applyPersonaAndRebuild,
    applySystemPreset,
    savePersonaToList,
    savePersonaToListAndRebuild,
    removeSavedPersona,
    pickSavedPersona,
    startBlankCustom,
    resetAll,
  } = useAppStore();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("pick");
  const [draft, setDraft] = useState<CreatorPersona>(() =>
    clonePersona(state.persona),
  );
  const [fields, setFields] = useState<Fields>(() =>
    editableFieldsFromPersona(state.persona),
  );
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  useEffect(() => {
    setDraft(clonePersona(state.persona));
    setFields(editableFieldsFromPersona(state.persona));
  }, [state.persona]);

  function patchField<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
    setSavedHint(null);
  }

  function buildFromFields(base: CreatorPersona = draft): CreatorPersona {
    return applyEditableFields(base, fields);
  }

  function buildCustomPersona(): CreatorPersona {
    return {
      ...buildFromFields(),
      presetId: "custom",
    };
  }

  function goEdit() {
    setSavedHint(null);
    setStep("edit");
  }

  function runSaveAndRebuild() {
    if (state.activeWorkspaceId || draft.presetId === "custom") {
      const next = buildCustomPersona();
      setDraft(next);
      const id = savePersonaToListAndRebuild(next, next.name);
      if (id) {
        setSavedHint(`已保存「${next.name}」，并重算了未来四周的待写选题`);
      }
      return;
    }
    const next = buildFromFields();
    setDraft(next);
    applyPersonaAndRebuild(next);
    setSavedHint("已保存，并重算了未来四周的待写选题");
  }

  function onConfirmPending() {
    if (!pending) return;
    const action = pending;
    setPending(null);
    if (action.kind === "system") {
      applySystemPreset(action.id);
      goEdit();
      return;
    }
    if (action.kind === "saved") {
      pickSavedPersona(action.id);
      goEdit();
      return;
    }
    if (action.kind === "blank") {
      startBlankCustom();
      goEdit();
      return;
    }
    if (action.kind === "rebuild") {
      runSaveAndRebuild();
      return;
    }
    if (action.kind === "reset") {
      resetAll();
      setStep("pick");
      setSavedHint(null);
      return;
    }
    removeSavedPersona(action.id);
    setSavedHint(`已删除「${action.label}」`);
    setStep("pick");
  }

  function onPickSystem(id: PresetId) {
    const existing = state.workspaces.find((w) => w.persona.presetId === id);
    if (existing && existing.id === state.activeWorkspaceId) {
      goEdit();
      return;
    }
    if (existing) {
      setPending({ kind: "saved", id: existing.id });
      return;
    }
    setPending({ kind: "system", id });
  }

  function onPickSaved(id: string) {
    if (state.activeWorkspaceId === id) {
      goEdit();
      return;
    }
    setPending({ kind: "saved", id });
  }

  function onStartBlank() {
    setPending({ kind: "blank" });
  }

  function onSave() {
    if (state.activeWorkspaceId || draft.presetId === "custom") {
      const next = buildCustomPersona();
      setDraft(next);
      const id = savePersonaToList(next, next.name);
      if (id) setSavedHint(`已保存人设「${next.name}」`);
      return;
    }
    const next = buildFromFields();
    setDraft(next);
    updatePersona(next);
    setSavedHint("已保存当前人设修改");
  }

  const dialog =
    pending?.kind === "delete"
      ? {
          title: "删除人设",
          message: `删除人设「${pending.label}」？此操作不可恢复。`,
          confirmLabel: "删除",
          danger: true,
        }
      : pending?.kind === "reset"
        ? {
            title: "重新起号",
            message:
              "将清空当前账号在本机与云端的规划，回到选人设引导。已保存的人设笔记都会删除。",
            confirmLabel: "清空并重新起号",
            danger: true,
          }
      : pending
        ? {
            title:
              pending.kind === "system"
                ? "选用起号方向"
                : pending.kind === "saved"
                  ? "切换人设"
                  : pending.kind === "blank"
                    ? "新建自定义人设"
                    : "保存并重算选题",
            message:
              pending.kind === "rebuild"
                ? REBUILD_HINT
                : pending.kind === "blank"
                  ? "将新建一套自定义人设，并进入填写页。"
                  : "将打开该人设的独立笔记库；若还没有这个方向，会新建未来四周路线。其他人设内容不会丢。",
            confirmLabel: "继续",
            danger: false,
          }
        : null;

  const currentLabel =
    state.workspaces.find((w) => w.id === state.activeWorkspaceId)?.label ||
    draft.name ||
    "当前人设";

  if (step === "pick") {
    return (
      <div className="space-y-5">
        <ConfirmDialog
          open={Boolean(dialog)}
          title={dialog?.title ?? ""}
          message={dialog?.message ?? ""}
          confirmLabel={dialog?.confirmLabel}
          danger={dialog?.danger}
          onConfirm={onConfirmPending}
          onCancel={() => setPending(null)}
        />

        <button
          type="button"
          onClick={onStartBlank}
          className="studio-shell w-full rounded-2xl px-4 py-4 text-left transition hover:border-[var(--coral)] hover:bg-[var(--coral)]/5"
        >
          <p className="font-medium text-[var(--ink)]">+ 自定义人设</p>
          <p className="mt-1 text-xs leading-5 text-[var(--ink-soft)]">
            从空白开始填写，适合你自己的细分方向
          </p>
        </button>

        <div>
          <h3 className="font-display text-lg text-[var(--ink)]">选一个人设</h3>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {user
              ? "先选方向或已有人设，下一步再填写具体配置。登录后会同步到账号。"
              : "未登录时人设保存在本机浏览器。换手机或清缓存会丢失；登录后才会同步到账号。"}
            最多 {MAX_SAVED_PERSONAS} 个。
          </p>
        </div>

        {state.workspaces.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium text-[var(--ink-soft)]">
              {user ? "账号里的人设" : "本机已有人设（未登录，未进账号）"}
            </p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {state.workspaces.map((s) => {
                const active = state.activeWorkspaceId === s.id;
                return (
                  <li key={s.id}>
                    <div
                      className={`studio-shell flex h-full flex-col rounded-2xl px-4 py-4 ${
                        active ? "border-[var(--coral)]" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onPickSaved(s.id)}
                        className="flex-1 text-left"
                      >
                        <p className="font-medium text-[var(--ink)]">{s.label}</p>
                        <p className="mt-1 text-xs text-[var(--ink-soft)]">
                          {active ? "当前使用 · 点击继续配置" : "点击切换并配置"}
                        </p>
                      </button>
                      <button
                        type="button"
                        className="mt-3 self-start text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"
                        onClick={() =>
                          setPending({
                            kind: "delete",
                            id: s.id,
                            label: s.label,
                          })
                        }
                      >
                        删除
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-medium text-[var(--ink-soft)]">
            起号方向
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LAUNCH_PRESETS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPickSystem(p.id)}
                  className="studio-shell h-full w-full rounded-2xl px-4 py-4 text-left transition hover:border-[var(--coral)] hover:bg-[var(--coral)]/5"
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

        <button
          type="button"
          className="text-sm text-[var(--ink-soft)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
          onClick={() => setPending({ kind: "reset" })}
        >
          清空规划，重新起号
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={Boolean(dialog)}
        title={dialog?.title ?? ""}
        message={dialog?.message ?? ""}
        confirmLabel={dialog?.confirmLabel}
        danger={dialog?.danger}
        onConfirm={onConfirmPending}
        onCancel={() => setPending(null)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button
            type="button"
            className="text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
            onClick={() => {
              setSavedHint(null);
              setStep("pick");
            }}
          >
            ← 返回选人设
          </button>
          <h3 className="font-display mt-1 text-lg text-[var(--ink)]">
            配置「{currentLabel}」
          </h3>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            改完点保存即可；若要按新人设重排待写选题，用「保存并重算」。
          </p>
        </div>
      </div>

      <div className="studio-shell rounded-2xl p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="persona-name">账号人设名</Label>
            <Input
              id="persona-name"
              value={fields.name}
              onChange={(e) => patchField("name", e.target.value)}
              placeholder="如：家居博主"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="persona-age">年龄</Label>
            <Input
              id="persona-age"
              type="number"
              min={16}
              max={80}
              value={fields.age}
              onChange={(e) => patchField("age", Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="persona-gender">性别（可选）</Label>
            <Input
              id="persona-gender"
              value={fields.gender}
              onChange={(e) => patchField("gender", e.target.value)}
              placeholder="如：女"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="persona-bg">背景标签</Label>
            <Input
              id="persona-bg"
              value={fields.background}
              onChange={(e) => patchField("background", e.target.value)}
              placeholder="如：租房改造 / 小户型"
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label htmlFor="persona-stage">当前阶段</Label>
          <Input
            id="persona-stage"
            value={fields.stage}
            onChange={(e) => patchField("stage", e.target.value)}
          />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="persona-audience">目标读者</Label>
          <Input
            id="persona-audience"
            value={fields.audience}
            onChange={(e) => patchField("audience", e.target.value)}
          />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="persona-voice">语气与边界</Label>
          <Textarea
            id="persona-voice"
            value={fields.voice}
            onChange={(e) => patchField("voice", e.target.value)}
            className="min-h-24 bg-white/80"
          />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="persona-trust">信任锚点（每行一条）</Label>
          <Textarea
            id="persona-trust"
            value={fields.trustAnchorsText}
            onChange={(e) => patchField("trustAnchorsText", e.target.value)}
            className="min-h-28 bg-white/80"
          />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="persona-tags">默认话题标签</Label>
          <Textarea
            id="persona-tags"
            value={fields.noteTagsText}
            onChange={(e) => patchField("noteTagsText", e.target.value)}
            className="min-h-16 bg-white/80"
            placeholder="#家居 #收纳 #真实分享"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onSave}>
            保存
          </Button>
          <Button
            type="button"
            className="bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
            onClick={() => setPending({ kind: "rebuild" })}
          >
            保存并重算
          </Button>
        </div>
        {savedHint ? (
          <p className="mt-3 text-sm text-[var(--ink-soft)]">{savedHint}</p>
        ) : null}
      </div>
    </div>
  );
}
