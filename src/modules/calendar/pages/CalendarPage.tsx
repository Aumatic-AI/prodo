"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, LayoutGrid } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";
import { PageHeader } from "@/components/kit/PageHeader";
import { Skeleton } from "@/components/kit/Skeleton";
import { button } from "@/components/kit/styles";
import { addDays } from "@/lib/zoned-time";
import { AddDateModal } from "../components/AddDateModal";
import { CalendarToolbar, type Layer, type View } from "../components/CalendarToolbar";
import { DayAgenda } from "../components/DayAgenda";
import { MonthGrid } from "../components/MonthGrid";
import { MonthStats } from "../components/MonthStats";
import { UpNext } from "../components/UpNext";
import { WeekView } from "../components/WeekView";
import { useCalendar, useDeleteEvent } from "../hooks/useCalendar";
import { formatDay, localToday, monthGrid, monthOf, shiftMonth, weekOf } from "../lib/dates";
import { byDay, toEntries } from "../lib/entries";
import type { CalendarEvent } from "../lib/types";

/** Calendar: posts, planned slots and key dates, with the selected day's agenda alongside. */
export function CalendarPage() {
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(localToday);
  const [picked, setPicked] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [layers, setLayers] = useState<Layer[]>(["posts", "planned", "dates"]);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<CalendarEvent | null>(null);

  const days = useMemo(() => (view === "month" ? monthGrid(anchor) : weekOf(anchor)), [view, anchor]);
  const { data, isLoading, error } = useCalendar(days[0], days[days.length - 1]);
  const deleteEvent = useDeleteEvent();

  const today = data?.clock.today ?? localToday();
  const allEntries = useMemo(() => (data ? toEntries(data) : []), [data]);
  const platforms = useMemo(() => [...new Set(allEntries.flatMap((e) => e.platforms.map((p) => p.platform)))].sort(), [allEntries]);

  const entries = useMemo(
    () =>
      allEntries.filter(
        (e) => (e.kind === "post" ? layers.includes("posts") : layers.includes("planned")) && (!platform || e.platforms.some((p) => p.platform === platform))
      ),
    [allEntries, layers, platform]
  );
  const events = useMemo(() => (layers.includes("dates") ? (data?.events ?? []) : []), [data, layers]);
  const entriesByDay = useMemo(() => byDay(entries), [entries]);
  const eventsByDay = useMemo(() => byDay(events.map((e) => ({ ...e, day: e.date }))), [events]);

  const month = monthOf(anchor);
  const selected = picked && days.includes(picked) ? picked : days.includes(today) ? today : view === "month" ? `${month}-01` : days[0];
  const inView = (day: string) => (view === "month" ? monthOf(day) === month : days.includes(day));
  const title =
    view === "month"
      ? formatDay(`${month}-01`, { month: "long", year: "numeric" })
      : `${formatDay(days[0], { day: "numeric", month: "short" })} – ${formatDay(days[6], { day: "numeric", month: "short", year: "numeric" })}`;

  const move = (n: number) => {
    setPicked(null);
    setAnchor((a) => (view === "month" ? shiftMonth(a, n) : addDays(a, 7 * n)));
  };

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-7">
      <PageHeader
        title="Calendar"
        description="Everything going out, everything planned, and the dates that matter to your business."
        actions={
          <>
            <Link href="/week" className={button({ variant: "secondary", size: "sm" })}>
              <LayoutGrid size={15} /> This week
            </Link>
            <button type="button" className={button({ size: "sm" })} onClick={() => setAdding(true)}>
              <CalendarPlus size={15} /> Add a date
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex min-w-0 flex-col gap-5 rounded-ob-lg border border-ob-line bg-ob-surface p-5 shadow-ob-xs">
          <CalendarToolbar
            title={title}
            view={view}
            onView={(v) => {
              setView(v);
              setAnchor(selected);
            }}
            onPrev={() => move(-1)}
            onNext={() => move(1)}
            onToday={() => {
              setAnchor(today);
              setPicked(today);
            }}
            platforms={platforms}
            platform={platform}
            onPlatform={setPlatform}
            layers={layers}
            onLayer={(l) => setLayers((list) => (list.includes(l) ? list.filter((x) => x !== l) : [...list, l]))}
          />
          {error ? (
            <Alert tone="error">{error.message}</Alert>
          ) : isLoading && !data ? (
            <Skeleton className="h-[640px]" />
          ) : view === "month" ? (
            <MonthGrid days={days} month={month} today={today} selected={selected} entries={entriesByDay} events={eventsByDay} onSelect={setPicked} />
          ) : (
            <WeekView days={days} today={today} selected={selected} entries={entriesByDay} events={eventsByDay} onSelect={setPicked} />
          )}
        </section>

        <aside className="flex flex-col gap-5 xl:sticky xl:top-6">
          {isLoading && !data ? (
            <>
              <Skeleton className="h-64" />
              <Skeleton className="h-36" />
            </>
          ) : (
            <>
              <DayAgenda
                day={selected}
                today={today}
                entries={entriesByDay.get(selected) ?? []}
                events={eventsByDay.get(selected) ?? []}
                onAddDate={() => setAdding(true)}
                onDeleteEvent={setRemoving}
                deletingId={deleteEvent.isPending ? (deleteEvent.variables ?? null) : null}
              />
              <MonthStats entries={entries.filter((e) => inView(e.day))} events={events.filter((e) => inView(e.date))} />
              <UpNext entries={entries} now={new Date().toISOString()} />
            </>
          )}
        </aside>
      </div>

      <AddDateModal open={adding} onOpenChange={setAdding} defaultDate={selected} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this date?"
        description={<p className="m-0">“{removing?.name}” won&apos;t be used for planning any more.</p>}
        confirmLabel="Remove"
        danger
        busy={deleteEvent.isPending}
        error={deleteEvent.error?.message}
        onConfirm={async () => {
          if (!removing) return;
          await deleteEvent.mutateAsync(removing.id);
          setRemoving(null);
        }}
      />
    </div>
  );
}
