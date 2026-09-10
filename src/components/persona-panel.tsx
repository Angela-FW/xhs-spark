"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/components/app-store";
import {
  PERSONA_PRESETS,
  applyEditableFields,
  clonePersona,
  editableFieldsFromPersona,
  getPreset,
  type CreatorPersona,
  type PresetId,
} from "@/lib/persona";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Fields = ReturnType<typeof editableFieldsFromPersona>;

export function PersonaPanel() {
  const { state, updatePersona, applyPersonaAndRebuild } = useAppStore();
  const [draft, setDraft] = useState<CreatorPersona>(() =>
    clonePersona(state.persona),
  );
  const [fields, setFields] = useState<Fields>(() =>
    editableFieldsFromPersona(state.persona),
  );
  const [savedHint, setSavedHint] = useState<string | null>(null);

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

  function onPickPreset(id: PresetId) {
    const next = getPreset(id);
    setDraft(next);
    setFields(editableFieldsFromPersona(next));
    setSavedHint(null);
  }

  function onSaveFields() {
    const next = buildFromFields();
    setDraft(next);
    updatePersona(next);
    setSavedHint("人设已保存（尚未重算日历）");
  }

  function onRebuild() {
    const next = buildFromFields();
    if (
      !confirm(
        "将按当前人设重算全年 52 周规划。感悟、对话、反馈会保留；已发布/草稿状态与挂载素材尽量按周次保留。确定继续？",
      )
    ) {
      return;
    }
    setDraft(next);
    applyPersonaAndRebuild(next);
    setSavedHint("已按人设重算全年规划");
  }

  return (
    <div className="space-y-5">
      <div className="studio-shell rounded-2xl p-5">
        <h3 className="font-display text-lg text-[var(--ink)]">创作者人设</h3>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          选预设或自行改字段。保存只更新人设；「重算全年规划」会按 topic
          种子重建日历，做成通用创作者工具。
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PERSONA_PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={draft.presetId === p.id ? "default" : "outline"}
              className={
                draft.presetId === p.id
                  ? "bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
                  : ""
              }
              onClick={() => onPickPreset(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--ink-soft)]">
          {PERSONA_PRESETS.find((p) => p.id === draft.presetId)?.blurb}
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
              placeholder="如：双非本科 / 互联网从业"
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
            placeholder="#真实分享 #生活记录"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onSaveFields}
          >
            仅保存人设
          </Button>
          <Button
            type="button"
            className="bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
            onClick={onRebuild}
          >
            应用人设并重算全年规划
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
        <p className="mt-1">阶段示例：{state.persona.phases.map((p) => p.label).join(" → ")}</p>
      </div>
    </div>
  );
}
