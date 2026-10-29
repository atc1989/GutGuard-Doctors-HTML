"use client";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Header label; sortable columns get the ↕ menu (sort ascending / descending / clear, hide column). */
export function ColumnHeader<TData>({ column }: { column: Column<TData, unknown> }) {
  const label = column.columnDef.meta?.label ?? column.id;
  const right = column.columnDef.meta?.align === "right";
  if (!column.getCanSort()) return <span className={cn("block", right && "text-right")}>{label}</span>;

  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "-mx-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 outline-none hover:bg-black/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:bg-black/[0.04]",
          sorted && "text-foreground",
          right && "float-right",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", !sorted && "text-subtle-foreground")} strokeWidth={1.5} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={right ? "end" : "start"} className="w-44 font-sans">
        <DropdownMenuItem onSelect={() => column.toggleSorting(false)}>
          <ArrowUp strokeWidth={1.5} />
          Sort ascending
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => column.toggleSorting(true)}>
          <ArrowDown strokeWidth={1.5} />
          Sort descending
        </DropdownMenuItem>
        {sorted && (
          <DropdownMenuItem onSelect={() => column.clearSorting()}>
            <X strokeWidth={1.5} />
            Clear sort
          </DropdownMenuItem>
        )}
        {column.getCanHide() && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => column.toggleVisibility(false)}>
              <EyeOff strokeWidth={1.5} />
              Hide column
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
