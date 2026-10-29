"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type FilterFn,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Columns3, Download, Search, X } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Checkbox } from "@/components/admin/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { Input } from "@/components/admin/ui/input";
import { Select } from "@/components/admin/ui/select";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { ColumnHeader } from "./column-header";
import { FacetedFilter } from "./faceted-filter";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Header, Columns menu and CSV heading. */
    label?: string;
    align?: "right";
    /** CSV value; defaults to the column's value. Columns without a label are not exported. */
    csv?: (row: TData) => unknown;
  }
}

// Faceted filters store the chosen values as a string array.
const inValues: FilterFn<unknown> = (row, id, values: string[]) => values.includes(String(row.getValue(id) ?? ""));

const PAGE_SIZES = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

export type Facet = { column: string; title: string; labels?: Record<string, string> };

type DataTableProps<TData> = {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  loading?: boolean;
  /** Text the search box matches against; no search box without it. */
  searchText?: (row: TData) => string;
  searchPlaceholder?: string;
  facets?: Facet[];
  /** File name prefix for "Export"; no export button without it. */
  exportName?: string;
  onRowClick?: (row: TData) => void;
  /** Buttons at the right end of the toolbar, e.g. "Add order". */
  actions?: ReactNode;
  initialSort?: SortingState;
  initialHidden?: string[];
  emptyText?: string;
  /** false hides search, filters, Columns and Export, for short lists. */
  toolbar?: boolean;
  /** Adds a checkbox column; the header box selects every row matching the search and filters. */
  selection?: { getId: (row: TData) => string; selected: string[]; onChange: (ids: string[]) => void };
};

export function DataTable<TData>({
  data,
  columns,
  loading,
  searchText,
  searchPlaceholder = "Search",
  facets = [],
  exportName,
  onRowClick,
  actions,
  initialSort = [],
  initialHidden = [],
  emptyText = "Nothing here yet.",
  toolbar = true,
  selection,
}: DataTableProps<TData>) {
  const [query, setQuery] = useState("");
  const pageSizeId = useId();
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q && searchText ? data.filter((row) => searchText(row).toLowerCase().includes(q)) : data;
  }, [data, query, searchText]);

  const allColumns = useMemo<ColumnDef<TData, unknown>[]>(() => {
    if (!selection) return columns;
    const { getId, selected, onChange } = selection;
    const picked = new Set(selected);
    const toggle = (ids: string[], on: boolean) =>
      onChange(on ? Array.from(new Set([...selected, ...ids])) : selected.filter((id) => !ids.includes(id)));
    return [
      {
        id: "select",
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => {
          const ids = table.getPrePaginationRowModel().rows.map((row) => getId(row.original));
          const count = ids.filter((id) => picked.has(id)).length;
          return (
            <Checkbox
              aria-label={`Select all ${ids.length.toLocaleString()} matching rows`}
              title={`Select all ${ids.length.toLocaleString()} matching rows`}
              disabled={ids.length === 0}
              checked={count > 0 && count === ids.length ? true : count > 0 ? "indeterminate" : false}
              onCheckedChange={() => toggle(ids, count < ids.length)}
            />
          );
        },
        cell: ({ row }) => (
          <Checkbox
            aria-label="Select row"
            checked={picked.has(getId(row.original))}
            onClick={(event) => event.stopPropagation()}
            onCheckedChange={(on) => toggle([getId(row.original)], on === true)}
          />
        ),
      },
      ...columns,
    ];
  }, [columns, selection]);

  const table = useReactTable({
    data: searched,
    columns: allColumns,
    defaultColumn: { filterFn: inValues as FilterFn<TData> },
    // TanStack's own reset queues a state update from render, which React flags when the rows
    // change before the table has mounted. The effect below does the same reset after render.
    autoResetPageIndex: false,
    initialState: {
      sorting: initialSort,
      columnVisibility: Object.fromEntries(initialHidden.map((id) => [id, false])),
      pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  // Back to page 1 whenever the rows, search or filters change.
  const columnFilters = table.getState().columnFilters;
  useEffect(() => {
    if (table.getState().pagination.pageIndex !== 0) table.setPageIndex(0);
  }, [table, searched, columnFilters]);

  const filtered = query !== "" || columnFilters.length > 0;
  const reset = () => {
    setQuery("");
    table.resetColumnFilters();
  };

  const exportRows = () => {
    const cols = table.getAllLeafColumns().filter((column) => column.columnDef.meta?.label);
    const rows = table.getPrePaginationRowModel().rows.map((row) =>
      cols.map((column) => column.columnDef.meta?.csv?.(row.original) ?? row.getValue(column.id)),
    );
    downloadCsv(exportName!, [cols.map((column) => column.columnDef.meta!.label), ...rows]);
  };

  // With selection and no row action, clicking a row ticks its box.
  const rowClick =
    onRowClick ??
    (selection
      ? (row: TData) => {
          const id = selection.getId(row);
          selection.onChange(selection.selected.includes(id) ? selection.selected.filter((item) => item !== id) : [...selection.selected, id]);
        }
      : undefined);

  const { pageIndex, pageSize } = table.getState().pagination;
  const total = table.getFilteredRowModel().rows.length;
  const visibleColumns = table.getVisibleLeafColumns().length;

  return (
    <div className="flex flex-col gap-3">
      {toolbar && (
      <div className="flex flex-wrap items-center gap-2">
        {searchText && (
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-8 rounded-lg pl-8 text-[13px] shadow-none md:text-[13px]"
            />
          </div>
        )}
        {facets.map((facet) => {
          const column = table.getColumn(facet.column);
          return column ? <FacetedFilter key={facet.column} column={column} title={facet.title} labels={facet.labels} /> : null;
        })}
        {filtered && (
          <Button variant="ghost" size="sm" onClick={reset} className="h-8 text-[13px] font-normal text-muted-foreground">
            Reset
            <X strokeWidth={1.5} />
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-[13px] font-normal shadow-none">
                <Columns3 strokeWidth={1.5} />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 font-sans">
              {table
                .getAllLeafColumns()
                .filter((column) => column.getCanHide() && column.columnDef.meta?.label)
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) => column.toggleVisibility(Boolean(checked))}
                    onSelect={(e) => e.preventDefault()}
                    className="text-[13px]"
                  >
                    {column.columnDef.meta?.label}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {exportName && (
            <Button variant="outline" size="sm" onClick={exportRows} disabled={loading || total === 0} className="h-8 rounded-lg text-[13px] font-normal shadow-none">
              <Download strokeWidth={1.5} />
              Export
            </Button>
          )}
          {actions}
        </div>
      </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id} className="h-12 border-b border-border">
                  {group.headers.map((header) => (
                    <th
                      key={header.id}
                      scope="col"
                      className={cn(
                        "px-4 text-[13px] font-normal whitespace-nowrap text-muted-foreground",
                        header.column.columnDef.meta?.align === "right" && "text-right",
                        header.column.id === "select" && "w-px pr-0",
                      )}
                    >
                      {header.isPlaceholder ? null : header.column.id === "select" ? (
                        <span className="flex">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                      ) : (
                        <ColumnHeader column={header.column} />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="h-16 border-b border-border last:border-0">
                    <td colSpan={visibleColumns} className="px-4">
                      <Skeleton className="h-4 w-2/3" />
                    </td>
                  </tr>
                ))
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={rowClick ? () => rowClick(row.original) : undefined}
                    onKeyDown={rowClick ? (e) => e.key === "Enter" && rowClick(row.original) : undefined}
                    tabIndex={rowClick ? 0 : undefined}
                    className={cn(
                      "h-16 border-b border-border last:border-0",
                      rowClick && "cursor-pointer outline-none hover:bg-chrome/60 focus-visible:bg-chrome",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-4 py-2.5 align-middle",
                          cell.column.columnDef.meta?.align === "right" && "text-right tabular-nums",
                          cell.column.id === "select" && "w-px pr-0 [&>button]:flex",
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={visibleColumns} className="h-24 px-4 text-center text-sm text-muted-foreground">
                    {filtered ? "No rows match these filters." : emptyText}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden while everything fits on one page at the default size; stays once someone picks 10. */}
      {(total > DEFAULT_PAGE_SIZE || pageSize < DEFAULT_PAGE_SIZE) && (
      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted-foreground">
        <span className="tabular-nums">
          {total === 0
            ? "0 rows"
            : `Showing ${(pageIndex * pageSize + 1).toLocaleString()}–${Math.min((pageIndex + 1) * pageSize, total).toLocaleString()} of ${total.toLocaleString()}`}
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor={pageSizeId}>Rows per page</label>
            <Select
              id={pageSizeId}
              value={String(pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
              options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
              className="h-8 w-[72px] rounded-lg text-[13px] text-foreground"
            />
          </div>
          <span className="tabular-nums">
            Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page" className="rounded-lg shadow-none">
              <ChevronLeft strokeWidth={1.5} />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page" className="rounded-lg shadow-none">
              <ChevronRight strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

/** Two-line cell: primary text over a smaller gray line. */
export function CellStack({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="leading-tight">
      <p className="whitespace-nowrap">{title}</p>
      {sub ? <p className="mt-0.5 text-[13px] whitespace-nowrap text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
