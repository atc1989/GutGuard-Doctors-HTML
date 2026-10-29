"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/admin/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

type SelectProps = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Adds a search box; use for long lists such as partners. */
  searchable?: boolean;
  className?: string;
};

const TRIGGER =
  "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm outline-none focus-field data-[state=open]:border-muted-foreground";

/**
 * The admin's dropdown field: looks like an input and opens our menu with a check on the chosen
 * option. Not a native <select>, so the list matches our style and nothing is highlighted until
 * you hover or use the arrow keys. Not a form control: check required values on submit.
 */
export function Select({ id, value, onValueChange, options, placeholder = "Select", searchable, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  const trigger = (
    <>
      <span className={cn("truncate", !current && "text-muted-foreground")}>{current?.label ?? placeholder}</span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
    </>
  );

  if (searchable) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger id={id} className={cn(TRIGGER, className)}>
          {trigger}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-56 p-0 font-sans">
          <Command>
            <CommandInput placeholder="Search" />
            <CommandList>
              <CommandEmpty>No matches.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    // Label first so search matches names; value keeps duplicate names distinct.
                    value={`${option.label} ${option.value}`}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <span className="flex-1 truncate">{option.label}</span>
                    {option.value === value && <Check className="size-3.5" strokeWidth={2} aria-hidden="true" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger id={id} className={cn(TRIGGER, className)}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-(--radix-dropdown-menu-trigger-width) min-w-40 font-sans">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
