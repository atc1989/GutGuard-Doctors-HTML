import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/admin/ui/badge";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { cn } from "@/lib/utils";

// Page building blocks for the admin redesign (spec: Obsidian "Admin Design Spec").
// Pages compose these instead of styling their own versions.

/** Padded content area under the topbar. Metric strips go outside it so they run edge to edge. */
export function PageBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-8 p-4 sm:p-6", className)} {...props} />;
}

/** Edge-to-edge row of metric cells split by 1px seams. Cells wrap and stretch, so no empty slots. */
export function MetricStrip({ children }: { children: ReactNode }) {
  return <section className="flex flex-wrap gap-px border-b border-border bg-border">{children}</section>;
}

type MetricCellProps = {
  label: string;
  icon?: LucideIcon;
  value: ReactNode;
  loading?: boolean;
  /** Left and right text under the inset divider. */
  footer?: [ReactNode, ReactNode];
  href?: string;
};

export function MetricCell({ label, icon: Icon, value, loading, footer, href }: MetricCellProps) {
  const body = (
    <>
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        {Icon && <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />}
        {label}
      </p>
      <div className="mt-3 flex h-9 items-center text-[28px] leading-9 tracking-[-0.02em] tabular-nums">
        {loading ? <Skeleton className="h-7 w-16" /> : value}
      </div>
      {footer && (
        <div className="mt-4 flex justify-between gap-3 border-t border-border pt-3 text-[13px] text-muted-foreground">
          <span>{footer[0]}</span>
          <span className="tabular-nums">{loading ? "" : footer[1]}</span>
        </div>
      )}
    </>
  );
  const cell = "flex min-w-[220px] flex-1 flex-col bg-background p-6";
  return href ? (
    <Link href={href} className={cn(cell, "hover:bg-chrome/60")}>
      {body}
    </Link>
  ) : (
    <div className={cell}>{body}</div>
  );
}

/** Section heading with an optional round count and a right-hand slot for tabs or buttons. */
export function Section({ title, count, actions, children }: { title: string; count?: number; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-medium leading-6">{title}</h2>
          {count !== undefined && <Badge variant="count">{count}</Badge>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Bordered, rounded list of LinkRows. */
export function LinkList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">{children}</div>;
}

export function LinkRow({ href, icon: Icon, label, count }: { href: string; icon: LucideIcon; label: string; count?: ReactNode }) {
  return (
    <Link href={href} className="flex h-14 items-center gap-3 px-4 text-sm hover:bg-chrome/60">
      <Icon className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="tabular-nums text-muted-foreground">{count}</span>}
      <ChevronRight className="size-4 shrink-0 text-subtle-foreground" strokeWidth={1.5} aria-hidden="true" />
    </Link>
  );
}

/** Placeholder rows for a LinkList or table while data loads. */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <LinkList>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-14 items-center px-4">
          <Skeleton className="h-4 w-40" />
        </div>
      ))}
    </LinkList>
  );
}

/** One line in a bordered box, with an optional action on the right. */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
      <span>{children}</span>
      {action}
    </div>
  );
}
