"use client";

import { useMemo } from "react";
import type { Column } from "@tanstack/react-table";
import { Check, Plus } from "lucide-react";
import { Badge } from "@/components/admin/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/admin/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Multi-select filter for one column. Options are the values present in the rows (or the given
 * labels), each with how many rows have it under the other active filters.
 */
export function FacetedFilter<TData>({
  column,
  title,
  labels,
}: {
  column: Column<TData, unknown>;
  title: string;
  labels?: Record<string, string>;
}) {
  const counts = column.getFacetedUniqueValues();
  const selected = new Set((column.getFilterValue() as string[] | undefined) ?? []);
  const options = useMemo(
    () =>
      [...counts.keys()]
        .map((value) => String(value))
        .filter((value) => value !== "")
        .sort((a, b) => (labels?.[a] ?? a).localeCompare(labels?.[b] ?? b)),
    [counts, labels],
  );
  const label = (value: string) => labels?.[value] ?? value;

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    column.setFilterValue(next.size ? [...next] : undefined);
  };

  return (
    <Popover>
      <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[13px] text-foreground outline-none hover:bg-chrome/60 focus-ring">
        <Plus className="size-3.5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        {title}
        {selected.size > 0 && (
          <span className="ml-1 flex items-center gap-1 border-l border-border pl-2">
            {selected.size > 2 ? (
              <Badge>{selected.size} selected</Badge>
            ) : (
              [...selected].map((value) => (
                <Badge key={value} className="max-w-36 truncate">
                  {label(value)}
                </Badge>
              ))
            )}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0 font-sans">
        <Command>
          {options.length > 6 && <CommandInput placeholder={title} />}
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {options.map((value) => {
                const isSelected = selected.has(value);
                return (
                  <CommandItem key={value} value={label(value)} onSelect={() => toggle(value)} className="gap-2 text-[13px]">
                    <span
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded-[4px] border border-border",
                        isSelected && "border-foreground bg-foreground text-background",
                      )}
                    >
                      {isSelected && <Check className="size-3" strokeWidth={2} aria-hidden="true" />}
                    </span>
                    <span className="flex-1 truncate">{label(value)}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">{counts.get(value) ?? 0}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => column.setFilterValue(undefined)} className="justify-center text-[13px]">
                    Clear filter
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
