"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Calendar } from "@/components/admin/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
const LABEL = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Date and time field in the admin style: a calendar plus a typed time, in the browser's time
 * zone. Value is an ISO timestamp or null ("Not set").
 */
export function DateTimePicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(value) : null;
  const date = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;

  // Picking a day keeps the chosen time (or the current time when nothing was set yet).
  const pickDay = (day: Date | undefined) => {
    if (!day) return;
    const base = date ?? new Date();
    const next = new Date(day);
    next.setHours(base.getHours(), base.getMinutes(), 0, 0);
    onChange(next.toISOString());
  };
  const setTime = (hhmm: string) => {
    if (!hhmm) return;
    const [hours, minutes] = hhmm.split(":").map(Number);
    const next = new Date(date ?? new Date());
    next.setHours(hours, minutes, 0, 0);
    onChange(next.toISOString());
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        className={cn(
          "flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm outline-none focus-field data-[state=open]:border-muted-foreground",
          !date && "text-muted-foreground",
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        <span className="truncate">{date ? LABEL.format(date) : "Not set"}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0 font-sans">
        <Calendar mode="single" selected={date ?? undefined} defaultMonth={date ?? undefined} onSelect={pickDay} className="p-3" />
        <div className="flex items-center gap-2 border-t border-border p-3">
          <input
            type="time"
            aria-label="Time"
            value={date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : ""}
            onChange={(event) => setTime(event.target.value)}
            className="h-8 w-28 rounded-md border border-input bg-background px-2 text-[13px] tabular-nums outline-none focus-field [&::-webkit-calendar-picker-indicator]:hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto text-[13px] font-normal text-muted-foreground"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            Clear
          </Button>
          <Button type="button" size="sm" className="text-[13px]" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
