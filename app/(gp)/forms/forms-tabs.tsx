"use client";

import { useState, type ReactNode } from "react";
import { FormsCalendar, FormsViewToggle, type ScheduleEntry } from "./forms-calendar";

interface Props {
  cards: ReactNode;
  schedules: ScheduleEntry[];
}

/** Client wrapper around /forms — toggles between the existing card grid and
 *  the calendar view of upcoming sends + reminders. */
export function FormsTabs({ cards, schedules }: Props) {
  const [view, setView] = useState<"cards" | "calendar">("cards");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <FormsViewToggle view={view} onChange={setView} />
      </div>
      {view === "cards" ? cards : (
        schedules.length === 0 ? (
          <div className="bg-white rounded-xl border border-line shadow-card px-6 py-12 text-center text-[12px] text-muted">
            No active schedules yet. Open any form and use the Schedule block on its edit page to set a cadence.
          </div>
        ) : (
          <FormsCalendar schedules={schedules} />
        )
      )}
    </div>
  );
}
