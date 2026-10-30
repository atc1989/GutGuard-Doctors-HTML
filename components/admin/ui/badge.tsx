import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Admin spec: squared pills are tags, round pills are counts. Nothing else.
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center whitespace-nowrap border border-border bg-background font-normal [&>svg]:size-3",
  {
    variants: {
      variant: {
        tag: "h-[22px] gap-1 rounded px-1.5 text-xs text-foreground",
        count: "h-5 rounded-full px-1.5 text-[11px] text-muted-foreground tabular-nums",
      },
    },
    defaultVariants: {
      variant: "tag",
    },
  }
)

function Badge({
  className,
  variant = "tag",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
