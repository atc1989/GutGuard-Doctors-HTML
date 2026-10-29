"use client";

import { Fragment, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/admin/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/admin/ui/dialog";
import { Label } from "@/components/admin/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/admin/ui/sheet";
import { cn } from "@/lib/utils";

// Form building blocks for the admin redesign: a right-side edit panel and labelled fields.

/** Right-side panel holding one form: title, scrolling fields, footer actions pinned at the bottom. */
export function EditSheet({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  footer,
  size = "default",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  footer: ReactNode;
  /** "wide" for editors with rows of fields (e.g. promo prices per product). */
  size?: "default" | "wide";
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn("w-full gap-0 bg-background p-0 font-sans text-foreground", size === "wide" ? "sm:max-w-[640px]" : "sm:max-w-[480px]")}
      >
        <form onSubmit={onSubmit} className="flex h-full min-h-0 flex-col">
          <SheetHeader className="gap-0.5 border-b border-border px-6 py-4 pr-12">
            <SheetTitle className="text-base font-medium">{title}</SheetTitle>
            {description ? <SheetDescription className="text-[13px]">{description}</SheetDescription> : null}
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">{children}</div>
          <div className="flex items-center justify-end gap-2 border-t border-border bg-chrome px-6 py-3">{footer}</div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** Small "are you sure?" window. `destructive` makes the confirm button red. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-sm gap-5 rounded-xl border-border p-5 font-sans text-foreground shadow-[0_8px_32px_-8px_rgb(0_0_0/0.16)]">
        <DialogHeader className="gap-1 text-left">
          <DialogTitle className="text-base font-medium">{title}</DialogTitle>
          {description ? <DialogDescription className="text-[13px]">{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" size="sm" variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A titled block of fields (or anything else) inside an EditSheet. */
export function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[13px] font-medium">{title}</h3>
      {children}
    </section>
  );
}

/** Read-only label / value pairs; empty values show a dash. */
export function DetailList({ title, items }: { title: string; items: [string, ReactNode][] }) {
  return (
    <FieldGroup title={title}>
      <dl className="grid grid-cols-[128px_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
        {items.map(([label, value]) => (
          <Fragment key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words">{value === "" || value === null || value === undefined ? "—" : value}</dd>
          </Fragment>
        ))}
      </dl>
    </FieldGroup>
  );
}

/** Label, control, then an optional gray hint. */
export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[13px] font-normal">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
