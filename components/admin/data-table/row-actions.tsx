"use client";

import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";

export type RowAction = { label: string; onSelect: () => void; destructive?: boolean; disabled?: boolean };

/**
 * The ⋯ menu at the end of a table row. Clicks and Enter stop here, so they never also trigger
 * the row's own click (React events bubble through the menu's portal to the row).
 */
export function RowActions({ label, actions }: { label: string; actions: RowAction[] }) {
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        onClick={stop}
        onKeyDown={stop}
        className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground outline-none hover:bg-chrome hover:text-foreground focus-ring data-[state=open]:bg-chrome data-[state=open]:text-foreground"
      >
        <MoreHorizontal className="size-4" strokeWidth={1.5} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 font-sans" onClick={stop} onKeyDown={stop}>
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            variant={action.destructive ? "destructive" : "default"}
            disabled={action.disabled}
            onSelect={action.onSelect}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
