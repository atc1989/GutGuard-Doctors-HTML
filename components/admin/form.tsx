"use client";

import type { FormEvent, ReactNode } from "react";
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
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 bg-background p-0 font-sans text-foreground sm:max-w-[480px]">
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
