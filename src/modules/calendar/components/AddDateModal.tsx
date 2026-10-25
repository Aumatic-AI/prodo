"use client";

import { useState } from "react";
import { Alert } from "@/components/kit/Alert";
import { DatePicker } from "@/components/kit/DatePicker";
import { Field } from "@/components/kit/Field";
import { TextArea, TextInput } from "@/components/kit/inputs";
import { Modal } from "@/components/kit/Modal";
import { Select } from "@/components/kit/Select";
import { button } from "@/components/kit/styles";
import { EVENT_STYLE } from "../lib/entries";
import { EVENT_KINDS, type EventKind } from "../lib/types";
import { useAddEvent } from "../hooks/useCalendar";

const KIND_OPTIONS = EVENT_KINDS.map((k) => ({ value: k, label: EVENT_STYLE[k].label }));

/** Add a sale, launch or holiday for the Planner to plan around. */
export function AddDateModal({ open, onOpenChange, defaultDate }: { open: boolean; onOpenChange: (open: boolean) => void; defaultDate: string }) {
  const add = useAddEvent();
  const [date, setDate] = useState(defaultDate);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<EventKind>("sale");
  const [notes, setNotes] = useState("");
  const [tried, setTried] = useState(false);

  const nameError = tried && name.trim().length < 2 ? "Name the date, e.g. “Black Friday sale”" : undefined;
  const dateError = tried && !date ? "Pick a date" : undefined;

  async function save() {
    setTried(true);
    if (name.trim().length < 2 || !date) return;
    await add.mutateAsync({ date, name: name.trim(), kind, notes: notes.trim() || null });
    setName("");
    setNotes("");
    setTried(false);
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (o) setDate(defaultDate);
        onOpenChange(o);
      }}
      title="Add a date"
      description="Sales, launches and holidays. The Planner times posts around them."
      className="w-[min(calc(100vw-32px),520px)]"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button type="button" className={button({ size: "sm" })} disabled={add.isPending} onClick={save}>
            {add.isPending ? "Saving…" : "Add date"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="What is it?" htmlFor="event-name" error={nameError}>
          <TextInput id="event-name" value={name} placeholder="e.g. Summer sale" maxLength={120} onValueChange={setName} autoFocus />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="event-date" error={dateError}>
            <DatePicker id="event-date" value={date} onChange={setDate} />
          </Field>
          <Field label="Kind" htmlFor="event-kind">
            <Select id="event-kind" value={kind} onValueChange={(v) => setKind(v as EventKind)} options={KIND_OPTIONS} />
          </Field>
        </div>
        <Field label="Notes" htmlFor="event-notes" optional hint="Anything the Planner should know, e.g. “20% off all sofas”.">
          <TextArea id="event-notes" value={notes} rows={3} maxLength={500} onValueChange={setNotes} />
        </Field>
        {add.error && <Alert tone="error">{add.error.message}</Alert>}
      </div>
    </Modal>
  );
}
