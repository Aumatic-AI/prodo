"use client";

import { useState, type ReactNode } from "react";
import { Archive, Check, ExternalLink, Pencil, Plus, RotateCcw, Trash2, X, type LucideIcon } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { Badge } from "@/components/kit/Badge";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";
import { EmptyState } from "@/components/kit/EmptyState";
import { Skeleton } from "@/components/kit/Skeleton";
import { Switch } from "@/components/kit/controls";
import { button } from "@/components/kit/styles";
import { RESOURCES, type FieldDef, type ResourceKey, type ResourceRow } from "@/core/brand/resources";
import type { PendingKind } from "@/core/brand/pending";
import { cn } from "@/lib/utils";
import { useDecidePending } from "../../hooks/useBible";
import { useResource, useResourceMutations } from "../../hooks/useResource";
import { ResourceForm } from "./ResourceForm";

const PENDING_KIND: Partial<Record<ResourceKey, PendingKind>> = { offerings: "offering", offers: "offer", proof: "proof" };

/** A field's value as a short label for the list. */
function display(field: FieldDef, value: unknown): string | null {
  if (value == null || value === "" || (Array.isArray(value) && !value.length)) return null;
  switch (field.type) {
    case "select":
      return field.options?.find((o) => o.value === value)?.label ?? String(value);
    case "switch":
      return null;
    case "percent":
      return `${Math.round(Number(value) * 100)}% of posts`;
    case "date":
      return `${field.label} ${value}`;
    case "lines":
      return (value as string[]).join(" · ");
    case "url":
      return String(value).replace(/^https?:\/\/(www\.)?/, "");
    default:
      return String(value);
  }
}

interface ResourceListProps {
  resource: ResourceKey;
  emptyIcon: LucideIcon;
  emptyText: string;
  /** "cards" lays rows out as a grid (personas, competitors) */
  layout?: "list" | "cards";
  /** Extra content under a row, e.g. a competitor's analysis */
  renderExtra?: (row: ResourceRow) => ReactNode;
  /** Extra badge next to a row's title */
  badge?: (row: ResourceRow) => ReactNode;
}

/**
 * Add, edit, archive (or delete) and restore rows of one brand list. Rows the agents found show
 * "Found on your website" with Confirm / Reject until the client decides.
 */
export function ResourceList({ resource, emptyIcon, emptyText, layout = "list", renderExtra, badge }: ResourceListProps) {
  const def = RESOURCES[resource];
  const fields: FieldDef[] = def.fields;
  const [showArchived, setShowArchived] = useState(false);
  const { data: rows, isLoading, error } = useResource(resource, showArchived);
  const { create, update, remove } = useResourceMutations(resource);
  const decide = useDecidePending();
  const [editing, setEditing] = useState<ResourceRow | "new" | null>(null);
  const [removing, setRemoving] = useState<ResourceRow | null>(null);

  const pendingKind = PENDING_KIND[resource];
  const isPending = (row: ResourceRow) => def.verify && row.verified === false;
  const isArchived = (row: ResourceRow) => def.archive && row.active === false && !isPending(row);
  const pendingCount = rows?.filter(isPending).length ?? 0;

  async function save(values: Record<string, unknown>) {
    if (editing === "new") await create.mutateAsync(values);
    else if (editing) await update.mutateAsync({ id: editing.id, values });
    setEditing(null);
  }

  const addButton = (
    <button type="button" className={button({ size: "sm" })} onClick={() => setEditing("new")}>
      <Plus size={15} /> Add {def.noun}
    </button>
  );

  // A render function, not a component, so rows keep their state between renders
  const renderRow = (row: ResourceRow) => {
    const pending = isPending(row);
    const archived = isArchived(row);
    const details = fields
      .filter((f) => f.inList)
      .map((f) => display(f, row[f.key]))
      .filter(Boolean);
    const url = typeof row.url === "string" ? row.url : typeof row.website === "string" ? row.website : null;
    return (
      <div className={cn("flex h-full flex-col gap-3 bg-ob-surface p-4", archived && "opacity-60", pending && "bg-ob-warn-soft/50")}>
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="line-clamp-2 text-[15px] leading-snug">{String(row[def.titleKey] ?? "")}</strong>
              {row.is_hero === true && (
                <Badge tone="primary" size="sm">
                  Hero
                </Badge>
              )}
              {pending && (
                <Badge tone="warn" size="sm">
                  Found on your website
                </Badge>
              )}
              {archived && <Badge size="sm">Archived</Badge>}
              {badge?.(row)}
            </div>
            {details.length > 0 && <p className="m-0 line-clamp-2 text-[13px] text-ob-muted">{details.join(" · ")}</p>}
            {url && (
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-ob-primary hover:underline">
                {url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48)} <ExternalLink size={12} />
              </a>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {archived ? (
              <button type="button" className={button({ variant: "quiet", size: "xs" })} onClick={() => update.mutate({ id: row.id, values: { active: true } })}>
                <RotateCcw size={14} /> Restore
              </button>
            ) : (
              <>
                <button type="button" className={button({ variant: "quiet", size: "iconSm" })} aria-label="Edit" title="Edit" onClick={() => setEditing(row)}>
                  <Pencil size={15} />
                </button>
                {!pending && (
                  <button
                    type="button"
                    className={button({ variant: "danger", size: "iconSm" })}
                    aria-label={def.archive ? "Archive" : "Delete"}
                    title={def.archive ? "Archive" : "Delete"}
                    onClick={() => setRemoving(row)}
                  >
                    {def.archive ? <Archive size={15} /> : <Trash2 size={15} />}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        {pending && pendingKind && (
          <div className="flex gap-2">
            <button type="button" className={button({ variant: "secondary", size: "xs" })} disabled={decide.isPending} onClick={() => decide.mutate({ items: [{ kind: pendingKind, id: row.id }], accept: true })}>
              <Check size={14} /> Confirm
            </button>
            <button type="button" className={button({ variant: "danger", size: "xs" })} disabled={decide.isPending} onClick={() => decide.mutate({ items: [{ kind: pendingKind, id: row.id }], accept: false })}>
              <X size={14} /> Reject
            </button>
          </div>
        )}
        {renderExtra?.(row)}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-ob-muted">
          {rows ? `${rows.length} ${rows.length === 1 ? def.noun : `${def.noun}s`}` : " "}
          {pendingCount > 0 && <span className="font-semibold text-ob-warn"> · {pendingCount} to confirm</span>}
        </span>
        <div className="flex flex-wrap items-center gap-4">
          {def.archive && <Switch checked={showArchived} onChange={setShowArchived} label="Show archived" />}
          {addButton}
        </div>
      </div>

      {error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : isLoading ? (
        <Skeleton className="h-48" />
      ) : !rows?.length ? (
        <EmptyState icon={emptyIcon} title={`No ${def.noun}s yet`} description={emptyText} action={addButton} />
      ) : layout === "cards" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <div key={row.id} className="overflow-hidden rounded-ob-lg border border-ob-line shadow-ob-xs">
              {renderRow(row)}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-ob-line overflow-hidden rounded-ob-lg border border-ob-line shadow-ob-xs">
          {rows.map((row) => (
            <div key={row.id}>{renderRow(row)}</div>
          ))}
        </div>
      )}

      {editing && (
        <ResourceForm
          key={editing === "new" ? "new" : editing.id}
          resource={resource}
          row={editing === "new" ? null : editing}
          saving={create.isPending || update.isPending}
          error={(create.error ?? update.error)?.message}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={def.archive ? `Archive this ${def.noun}?` : `Delete this ${def.noun}?`}
        description={def.archive ? "Agents stop using it. Past posts keep their link, and you can restore it any time." : "This can't be undone."}
        confirmLabel={def.archive ? "Archive" : "Delete"}
        danger
        busy={remove.isPending}
        error={remove.error?.message}
        onConfirm={async () => {
          if (removing) await remove.mutateAsync(removing.id);
          setRemoving(null);
        }}
      />
    </div>
  );
}
