"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/components/app-store";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  MAX_SAVED_PERSONAS,
  PERSONA_PRESETS,
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

const SYSTEM_PRESETS = PERSONA_PRESETS.filter((p) => p.id !== "custom");

const REBUILD_HINT =
  "会清空其他周的「待写」选题，只保留已起草/已发布，并新生成未来一周。确定继续？";

type PendingAction =
  | { kind: "system"; id: PresetId }
  | { kind: "saved"; id: string }
  | { kind: "blank" }
  | { kind: "rebuild" }
  | { kind: "delete"; id: string; label: string };

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
  } = useAppStore();
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

  const activeSaved = state.activeSavedPersonaId;
  const systemActive =
    !activeSaved && SYSTEM_PRESETS.some((p) => p.id === draft.presetId);

  function buildCustomPersona(): CreatorPersona {
    return {
      ...buildFromFields(),
      presetId: "custom",
    };
  }

  function runSaveAndRebuild() {
    if (state.activeSavedPersonaId || draft.presetId === "custom") {
      const next = buildCustomPersona();
      setDraft(next);
      const id = savePersonaToListAndRebuild(next, next.name);
      if (id) {
        setSavedHint(`已保存「${next.name}」，并重算了未来最近一周的待写选题`);
      }
      return;
    }
    const next = buildFromFields();
    setDraft(next);
    applyPersonaAndRebuild(next);
    setSavedHint("已保存，并重算了未来最近一周的待写选题");
  }

  function onConfirmPending() {
    if (!pending) return;
    const action = pending;
    setPending(null);
    if (action.kind === "system") {
      applySystemPreset(action.id);
      setSavedHint(
        "已切换系统预设：页头、阶段标签已同步，并重算了未来最近一周的待写选题",
      );
      return;
    }
    if (action.kind === "saved") {
      pickSavedPersona(action.id);
      setSavedHint("已切换自定义人设，并重算了未来最近一周的待写选题");
      return;
    }
    if (action.kind === "blank") {
      startBlankCustom();
      setSavedHint("已打开空白自定义人设，填完后点「保存」加入列表");
      return;
    }
    if (action.kind === "rebuild") {
      runSaveAndRebuild();
      return;
    }
    removeSavedPersona(action.id);
    setSavedHint(`已删除「${action.label}」`);
  }

  function onPickSystem(id: PresetId) {
    if (systemActive && draft.presetId === id) return;
    setPending({ kind: "system", id });
  }

  function onPickSaved(id: string) {
    if (activeSaved === id) return;
    setPending({ kind: "saved", id });
  }

  function onStartBlank() {
    if (!activeSaved && draft.presetId === "custom") return;
    setPending({ kind: "blank" });
  }

  /** 已有人设 → 更新；新建自定义 → 新增；系统预设 → 只更新当前使用 */
  function onSave() {
    if (state.activeSavedPersonaId || draft.presetId === "custom") {
      const next = buildCustomPersona();
      setDraft(next);
      const id = savePersonaToList(next, next.name);
      if (id) {
        const isUpdate = Boolean(state.activeSavedPersonaId);
        setSavedHint(
          isUpdate
            ? `已更新人设「${next.name}」`
            : `已新增人设「${next.name}」`,
        );
      }
      return;
    }
    const next = buildFromFields();
    setDraft(next);
    updatePersona(next);
    setSavedHint("已保存当前系统预设的修改（未写入自定义列表）");
  }

  function onSaveAndRebuild() {
    setPending({ kind: "rebuild" });
  }

  function onDeleteSaved(id: string, label: string) {
    setPending({ kind: "delete", id, label });
  }

  const dialog =
    pending?.kind === "delete"
      ? {
          title: "删除自定义人设",
          message: `删除自定义人设「${pending.label}」？此操作不可恢复。`,
          confirmLabel: "删除",
          danger: true,
        }
      : pending
        ? {
            title:
              pending.kind === "system"
                ? "切换系统预设"
                : pending.kind === "saved"
                  ? "切换自定义人设"
                  : pending.kind === "blank"
                    ? "新建空白自定义人设"
                    : "保存并重算选题",
            message: REBUILD_HINT,
            confirmLabel: "确定继续",
            danger: false,
          }
        : null;

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
      <div className="studio-shell rounded-2xl p-5">
        <h3 className="font-display text-lg text-[var(--ink)]">创作者人设</h3>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          系统预设可一键切换；自定义人设保存后会出现在下方列表（最多{" "}
          {MAX_SAVED_PERSONAS} 个）。
        </p>

        <p className="mt-4 text-xs font-medium text-[var(--ink-soft)]">系统预设</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SYSTEM_PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={
                systemActive && draft.presetId === p.id ? "default" : "outline"
              }
              className={
                systemActive && draft.presetId === p.id
                  ? "bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
                  : ""
              }
              onClick={() => onPickSystem(p.id)}
            >
              {p.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={!activeSaved && draft.presetId === "custom" ? "default" : "outline"}
            className={
              !activeSaved && draft.presetId === "custom"
                ? "bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
                : ""
            }
            onClick={onStartBlank}
          >
            + 新建自定义
          </Button>
        </div>

        <p className="mt-4 text-xs font-medium text-[var(--ink-soft)]">
          我的人设（{state.savedPersonas.length}/{MAX_SAVED_PERSONAS}）
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {state.savedPersonas.length === 0 ? (
            <p className="text-xs text-[var(--ink-soft)]">
              还没有自定义人设。编辑下方字段后点「保存到人设列表」。
            </p>
          ) : (
            state.savedPersonas.map((s) => (
              <div key={s.id} className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={activeSaved === s.id ? "default" : "outline"}
                  className={
                    activeSaved === s.id
                      ? "bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
                      : ""
                  }
                  onClick={() => onPickSaved(s.id)}
                >
                  {s.label}
                </Button>
                <button
                  type="button"
                  className="rounded-md px-1.5 text-xs text-[var(--ink-soft)] hover:bg-white/70 hover:text-[var(--ink)]"
                  title="删除"
                  onClick={() => onDeleteSaved(s.id, s.label)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
        <p className="mt-2 text-xs text-[var(--ink-soft)]">
          {activeSaved
            ? `当前：自定义「${state.savedPersonas.find((s) => s.id === activeSaved)?.label ?? ""}」`
            : SYSTEM_PRESETS.find((p) => p.id === draft.presetId)?.blurb ||
              (draft.presetId === "custom"
                ? "空白自定义：填写后保存到人设列表"
                : "")}
        </p>
      </div>

      <div className="studio-shell rounded-2xl p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="persona-name">账号人设名</Label>
            <Input
              id="persona-name"
              value={fields.name}
              onChange={(e) => patchField("name", e.target.value)}
              placeholder="如：美食博主"
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
              placeholder="如：家常菜 / 探店"
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
            placeholder="#美食 #家常菜 #探店"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onSave}>
            保存
          </Button>
          <Button
            type="button"
            className="bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
            onClick={onSaveAndRebuild}
          >
            保存并重算最近一周
          </Button>
        </div>
        {savedHint ? (
          <p className="mt-3 text-sm text-[var(--ink-soft)]">{savedHint}</p>
        ) : null}
      </div>

      <div className="studio-shell rounded-2xl p-5 text-sm text-[var(--ink-soft)]">
        <p>
          当前生效：{state.persona.name} · {state.persona.age}岁
          {state.persona.background ? ` · ${state.persona.background}` : ""}
        </p>
        <p className="mt-1">
          日历阶段标签：{state.persona.phases.map((p) => p.label).join(" → ")}
        </p>
        <p className="mt-1 text-xs">
          「保存」：已有人设则更新，新建则加入列表（最多 {MAX_SAVED_PERSONAS}{" "}
          个）。「保存并重算最近一周」会清空其他待写周，只保留已起草/已发布，并新生成未来一周。需要更长规划时，到日历点「生成更多」。
        </p>
      </div>
    </div>
  );
}
