"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronLeft, ChevronRight, LayoutGrid, Send, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { expandSchedule, type FormSchedule, type CalendarEvent } from "@/lib/form-schedule";

export interface ScheduleEntry extends FormSchedule {
  formName: string;
  formSlug: string;
}

interface Props {
  schedules: ScheduleEntry[];
}

export function FormsCalendar({ schedules }: Props) {
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month

  // Compute all events across all schedules for the next 6 sends. Then bucket
  // by date string. Cheap because the per-schedule expansion is at most 30 entries.
  const events: CalendarEvent[] = useMemo(() => {
    const out: CalendarEvent[] = [];
    for (const s of schedules) {
      out.push(...expandSchedule(s, s.formName, s.formSlug, 6));
    }
    return out.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [schedules]);

  // Build the visible month grid.
  const today = new Date();
  const cursor = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const firstWeekday = cursor.getDay(); // 0 = Sun
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();

  const grid: Array<{ date: Date | null }> = [];
  for (let i = 0; i < firstWeekday; i++) grid.push({ date: null });
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), d) });
  }
  // Pad to whole weeks
  while (grid.length % 7 !== 0) grid.push({ date: null });

  // Bucket events by ISO date (YYYY-MM-DD) for fast lookup.
  const eventsByDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const arr = m.get(key) ?? [];
      arr.push(e);
      m.set(key, arr);
    }
    return m;
  }, [events]);

  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const todayKey = dayKey(today);

  return (
    <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> {monthLabel}
          </h3>
          <p className="text-[11px] text-muted mt-0.5">
            Form sends and reminders for the next few months. Click any cell to jump to the form.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setMonthOffset((v) => v - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonthOffset(0)} disabled={monthOffset === 0}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonthOffset((v) => v + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-[10px] font-semibold text-muted tracking-[0.14em] uppercase border-b border-line">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-1.5 text-center">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {grid.map((cell, i) => {
          const day = cell.date;
          const k = day ? dayKey(day) : "";
          const dayEvents = day ? eventsByDate.get(k) ?? [] : [];
          const isToday = k === todayKey;
          const isPast = day ? day.getTime() < today.getTime() && !isToday : false;
          return (
            <div
              key={i}
              className={cn(
                "min-h-[88px] border-r border-b border-line/60 p-1.5 text-[11px]",
                !day && "bg-paper2/30",
                isPast && "bg-paper2/10",
                isToday && "bg-gold/5"
              )}
            >
              {day && (
                <div className={cn(
                  "text-[11px] font-semibold mb-1",
                  isToday ? "text-gold-600" : "text-ink"
                )}>
                  {day.getDate()}
                </div>
              )}
              <div className="space-y-0.5">
                {dayEvents.map((e, j) => (
                  <Link
                    key={j}
                    href={`/forms/${e.formSlug}`}
                    title={`${e.formName}${e.type === "reminder" ? ` — reminder (${e.daysBefore}d before)` : " — send"}`}
                    className={cn(
                      "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] truncate hover:opacity-80",
                      e.type === "send"
                        ? "bg-teal-50 text-teal-600 font-medium"
                        : "bg-paper2 text-muted"
                    )}
                  >
                    {e.type === "send" ? <Send className="h-2.5 w-2.5 shrink-0" /> : <Bell className="h-2.5 w-2.5 shrink-0" />}
                    <span className="truncate">{e.formName}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-5 py-2.5 bg-paper2/40 border-t border-line text-[10px] text-muted flex items-center gap-4">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded bg-teal" /> Send
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded bg-muted/60" /> Reminder
        </span>
        <span className="ml-auto">{schedules.length} active schedule{schedules.length === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
}

export function FormsViewToggle({
  view,
  onChange,
}: {
  view: "cards" | "calendar";
  onChange: (v: "cards" | "calendar") => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-white p-0.5">
      <button
        type="button"
        onClick={() => onChange("cards")}
        className={cn(
          "h-7 px-2.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1.5",
          view === "cards" ? "bg-navy text-white" : "text-muted hover:text-ink"
        )}
      >
        <LayoutGrid className="h-3 w-3" /> Cards
      </button>
      <button
        type="button"
        onClick={() => onChange("calendar")}
        className={cn(
          "h-7 px-2.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1.5",
          view === "calendar" ? "bg-navy text-white" : "text-muted hover:text-ink"
        )}
      >
        <Calendar className="h-3 w-3" /> Calendar
      </button>
    </div>
  );
}
