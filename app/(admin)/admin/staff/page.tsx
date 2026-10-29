"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, RefreshCw } from "lucide-react";
import { Alert, PageBody, Section, StatusDot } from "@/components/admin/blocks";
import { NAV_GROUPS } from "@/components/admin/AdminShell";
import { DataTable } from "@/components/admin/data-table/data-table";
import { RowActions } from "@/components/admin/data-table/row-actions";
import { ConfirmDialog, EditSheet, Field, FieldGroup } from "@/components/admin/form";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Checkbox } from "@/components/admin/ui/checkbox";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";

type StaffMember = { id: string; username: string; modules: string[]; active: boolean; created_at: string };
type Draft = { id: string | null; username: string; password: string; modules: string[] };

// The checklist is the admin menu itself, minus the Dashboard (open to all) and this page (super admin only).
const SECTION_GROUPS = NAV_GROUPS.map((group) => ({
  title: group.title ?? "",
  items: group.items
    .map((item) => ({ key: item.href.split("/")[2], label: item.label }))
    .filter((item) => item.key && item.key !== "staff"),
})).filter((group) => group.items.length);
const LABELS = Object.fromEntries(SECTION_GROUPS.flatMap((group) => group.items.map((item) => [item.key, item.label])));
const day = (value: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));

async function call<T>(method: string, body?: unknown, query = ""): Promise<T> {
  const res = await fetch(`/api/admin/staff${query}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data as T;
}

/** Super admin only: staff logins and the admin sections each one can open. */
export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  // Edit panel; the open flag is separate so it keeps its content while sliding out.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<StaffMember | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function load() {
    setIsLoading(true);
    try {
      setStaff((await call<{ staff: StaffMember[] }>("GET")).staff);
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "Could not load staff." });
    } finally {
      setIsLoading(false);
    }
  }

  // AdminShell only renders this page for the super admin.
  useEffect(() => {
    load();
  }, []);

  const open = (next: Draft) => {
    setDraft(next);
    setPanelError(null);
    setPanelOpen(true);
  };
  const edit = (member: StaffMember) => open({ id: member.id, username: member.username, password: "", modules: member.modules });

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ tone: "info", text: done });
      await load();
      return true;
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "Something went wrong." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const { id, username, password, modules } = draft;
    setBusy(true);
    setPanelError(null);
    try {
      if (id) await call("PATCH", { id, modules, ...(password ? { password } : {}) });
      else await call("POST", { username, password, modules });
      setMessage({ tone: "info", text: id ? `${username} saved.` : `${username} created. Share the password with them privately.` });
      setPanelOpen(false);
      await load();
    } catch (caught) {
      setPanelError(caught instanceof Error ? caught.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const askDelete = (member: StaffMember) => {
    setToDelete(member);
    setDeleteOpen(true);
  };

  async function confirmDelete() {
    if (!toDelete) return;
    const member = toDelete;
    const ok = await run(() => call("DELETE", undefined, `?id=${encodeURIComponent(member.id)}`), `${member.username} deleted.`);
    setDeleteOpen(false);
    if (ok && draft?.id === member.id) setPanelOpen(false);
  }

  const toggle = (key: string, on: boolean) =>
    setDraft((current) => (current ? { ...current, modules: on ? [...current.modules, key] : current.modules.filter((module) => module !== key) } : current));

  const columns = useMemo<ColumnDef<StaffMember, unknown>[]>(
    () => [
      { id: "username", accessorKey: "username", meta: { label: "Username" }, cell: ({ row }) => <span className="font-medium">{row.original.username}</span> },
      {
        id: "modules",
        accessorFn: (member) => member.modules.length,
        meta: { label: "Can open" },
        cell: ({ row }) =>
          row.original.modules.length ? (
            <div className="flex max-w-xl flex-wrap gap-1.5">
              {row.original.modules.map((key) => (
                <Badge key={key}>{LABELS[key] ?? key}</Badge>
              ))}
            </div>
          ) : (
            <span className="text-subtle-foreground">Dashboard only</span>
          ),
      },
      {
        id: "status",
        accessorFn: (member) => (member.active ? "Active" : "Turned off"),
        meta: { label: "Status" },
        cell: ({ row }) => <StatusDot tone={row.original.active ? "green" : "gray"}>{row.original.active ? "Active" : "Turned off"}</StatusDot>,
      },
      { id: "created", accessorKey: "created_at", meta: { label: "Created" }, cell: ({ row }) => <span className="whitespace-nowrap">{day(row.original.created_at)}</span> },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const member = row.original;
          return (
            <div className="flex justify-end">
              <RowActions
                label={`Actions for ${member.username}`}
                actions={[
                  { label: "Edit", onSelect: () => edit(member) },
                  {
                    label: member.active ? "Turn off" : "Turn on",
                    disabled: busy,
                    onSelect: () => run(() => call("PATCH", { id: member.id, active: !member.active }), `${member.username} turned ${member.active ? "off" : "on"}.`),
                  },
                  { label: "Delete", destructive: true, onSelect: () => askDelete(member) },
                ]}
              />
            </div>
          );
        },
      },
    ],
    // edit, run and askDelete only use state setters and the row they're given.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy],
  );

  return (
    <>
      <PageBody>
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

        <Section
          actions={
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-muted-foreground">
                You sign in as <span className="font-medium text-foreground">admin</span> and can open everything. Staff only see the sections ticked here; changes apply on their next click.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon-sm" onClick={load} disabled={isLoading} aria-label="Refresh staff" title="Refresh staff" className="rounded-lg shadow-none">
                  <RefreshCw className={isLoading ? "animate-spin" : undefined} strokeWidth={1.5} />
                </Button>
                <Button size="sm" onClick={() => open({ id: null, username: "", password: "", modules: [] })} className="h-8 rounded-lg text-[13px]">
                  <Plus strokeWidth={1.5} />
                  New staff account
                </Button>
              </div>
            </div>
          }
        >
          <DataTable
            data={staff}
            columns={columns}
            loading={isLoading && staff.length === 0}
            toolbar={false}
            onRowClick={edit}
            initialSort={[{ id: "username", desc: false }]}
            emptyText="No staff accounts yet."
          />
        </Section>
      </PageBody>

      {draft ? (
        <EditSheet
          open={panelOpen}
          onOpenChange={(isOpen) => !isOpen && setPanelOpen(false)}
          title={draft.id ? draft.username : "New staff account"}
          description={draft.id ? "Change what they can open, or set a new password." : "They sign in with this username and password."}
          onSubmit={save}
          footer={
            <>
              {draft.id ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const member = staff.find((item) => item.id === draft.id);
                    if (member) askDelete(member);
                  }}
                  className="mr-auto text-[13px] font-normal text-down hover:bg-down/5 hover:text-down"
                >
                  Delete
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={() => setPanelOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Saving" : draft.id ? "Save" : "Create account"}
              </Button>
            </>
          }
        >
          {panelError ? <Alert tone="error">{panelError}</Alert> : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Username" htmlFor="staff-username" hint={draft.id ? "Usernames can't be changed." : "3–32 lowercase letters, numbers, - or _."}>
              <Input
                id="staff-username"
                value={draft.username}
                onChange={(event) => setDraft({ ...draft, username: event.target.value.toLowerCase() })}
                placeholder="e.g. ana"
                pattern="[a-z0-9_\-]{3,32}"
                title="3–32 lowercase letters, numbers, - or _"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                disabled={Boolean(draft.id)}
                required
              />
            </Field>
            <Field label={draft.id ? "New password" : "Password"} htmlFor="staff-password" hint={draft.id ? "Leave blank to keep it. A new one signs them out." : "At least 8 characters."}>
              {/* Shown as text on purpose: the super admin types it once and passes it on. */}
              <Input
                id="staff-password"
                type="text"
                value={draft.password}
                onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                minLength={8}
                autoComplete="new-password"
                spellCheck={false}
                required={!draft.id}
              />
            </Field>
          </div>

          <FieldGroup title="Sections they can open">
            <p className="-mt-1 text-xs text-muted-foreground">The Dashboard is always open. Only you can manage staff and log in as a partner.</p>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              {SECTION_GROUPS.map((group) => (
                <fieldset key={group.title} className="flex flex-col gap-2">
                  <legend className="mb-1 text-xs text-muted-foreground">{group.title}</legend>
                  {group.items.map((item) => (
                    <div key={item.key} className="flex items-center gap-2">
                      <Checkbox id={`staff-module-${item.key}`} checked={draft.modules.includes(item.key)} onCheckedChange={(on) => toggle(item.key, on === true)} />
                      <Label htmlFor={`staff-module-${item.key}`} className="text-[13px] font-normal">
                        {item.label}
                      </Label>
                    </div>
                  ))}
                </fieldset>
              ))}
            </div>
          </FieldGroup>
        </EditSheet>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${toDelete?.username ?? ""}?`}
        description="They're signed out and can't log in again. To pause an account instead, turn it off."
        confirmLabel="Delete account"
        destructive
        busy={busy}
        onConfirm={confirmDelete}
      />
    </>
  );
}
