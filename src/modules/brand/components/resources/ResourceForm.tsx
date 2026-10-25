"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { DatePicker } from "@/components/kit/DatePicker";
import { Field } from "@/components/kit/Field";
import { Modal } from "@/components/kit/Modal";
import { NumberInput, TextArea, TextInput } from "@/components/kit/inputs";
import { Select } from "@/components/kit/Select";
import { TagInput } from "@/components/kit/TagInput";
import { Switch } from "@/components/kit/controls";
import { button } from "@/components/kit/styles";
import { RESOURCES, resourceSchema, type FieldDef, type ResourceKey, type ResourceRow } from "@/core/brand/resources";
import { useResource } from "../../hooks/useResource";

type Values = Record<string, unknown>;

/** "Nothing picked" for optional dropdowns (an empty string would show as no selection). */
const NONE = "__none";

/** Form values from a row (or empty ones for a new row). */
function initialValues(fields: FieldDef[], row: ResourceRow | null): Values {
  return Object.fromEntries(
    fields.map((f) => {
      const v = row?.[f.key];
      if (f.type === "lines") return [f.key, Array.isArray(v) ? v : []];
      if (f.type === "switch") return [f.key, !!v];
      if (f.type === "percent") return [f.key, typeof v === "number" ? v : 0.2];
      if (f.type === "number") return [f.key, typeof v === "number" ? v : null];
      if (f.type === "select" && f.required) return [f.key, v ?? f.options![0].value];
      if (f.type === "select" || f.type === "offering" || f.type === "date") return [f.key, v ?? null];
      return [f.key, v ?? ""];
    })
  );
}

function FieldInput({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const offerings = useResource("offerings");
  const id = `field-${field.key}`;

  switch (field.type) {
    case "textarea":
      return <TextArea id={id} rows={3} value={String(value ?? "")} placeholder={field.placeholder} onValueChange={onChange} />;
    case "lines":
      return <TagInput id={id} value={value as string[]} max={30} onChange={onChange} />;
    case "number":
      return <NumberInput id={id} min={0} value={value as number | null} onValueChange={onChange} />;
    case "percent":
      return <NumberInput id={id} min={0} max={100} value={Math.round(Number(value) * 100)} onValueChange={(v) => onChange(Math.min(100, Math.max(0, v ?? 0)) / 100)} />;
    case "select": {
      const options = field.required ? field.options! : [{ value: NONE, label: "None" }, ...field.options!];
      return <Select id={id} options={options} value={(value as string | null) ?? (field.required ? null : NONE)} onValueChange={(v) => onChange(v === NONE ? null : v)} />;
    }
    case "offering": {
      const options = [{ value: NONE, label: field.placeholder ?? "None" }, ...(offerings.data ?? []).map((o) => ({ value: o.id, label: String(o.name) }))];
      return <Select id={id} searchable searchPlaceholder="Search offerings…" options={options} value={(value as string | null) ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)} />;
    }
    case "switch":
      return <Switch checked={!!value} onChange={onChange} label={field.label} />;
    case "date":
      return <DatePicker id={id} value={String(value ?? "")} onChange={(v) => onChange(v || null)} />;
    default:
      return <TextInput id={id} type={field.type === "url" ? "url" : "text"} value={String(value ?? "")} placeholder={field.placeholder ?? (field.type === "url" ? "https://" : undefined)} onValueChange={onChange} />;
  }
}

interface ResourceFormProps {
  resource: ResourceKey;
  /** null = new row */
  row: ResourceRow | null;
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (values: Values) => void;
}

/** Add or edit one row, with the fields from its definition. Checked with the same schema as the API. */
export function ResourceForm({ resource, row, saving, error, onClose, onSave }: ResourceFormProps) {
  const def = RESOURCES[resource];
  const fields: FieldDef[] = def.fields;
  const [values, setValues] = useState<Values>(() => initialValues(fields, row));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit() {
    const parsed = resourceSchema(resource, row ? "update" : "create").safeParse(values);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    onSave(values);
  }

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={row ? `Edit ${def.noun}` : `Add ${def.noun}`}
      className="w-[min(calc(100vw-32px),640px)]"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          {error && <p className="m-0 mr-auto text-sm font-medium text-ob-danger">{error}</p>}
          <button type="button" className={button({ variant: "secondary" })} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={button()} onClick={submit} disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />}
            Save
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <Field
            key={field.key}
            label={field.type === "switch" ? undefined : field.label}
            htmlFor={`field-${field.key}`}
            optional={!field.required && field.type !== "switch"}
            hint={field.type === "lines" ? "Press Enter after each one" : undefined}
            error={errors[field.key]}
            // Short fields sit side by side; long ones take the full width
            className={["textarea", "lines", "url"].includes(field.type) || field.key === "name" || field.key === "title" ? "sm:col-span-2" : undefined}
          >
            <FieldInput field={field} value={values[field.key]} onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))} />
          </Field>
        ))}
      </div>
    </Modal>
  );
}
