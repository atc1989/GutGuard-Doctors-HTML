"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CircleCheck, CircleX, Inbox, RefreshCw, Star } from "lucide-react";
import { Alert, FilterTabs, MetricCell, MetricStrip, PageBody, Section, StatusDot } from "@/components/admin/blocks";
import { CellStack, DataTable } from "@/components/admin/data-table/data-table";
import { RowActions } from "@/components/admin/data-table/row-actions";
import { DetailList, EditSheet, FieldGroup } from "@/components/admin/form";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import TestimonialVideo from "@/components/TestimonialVideo";
import { adminListTestimonials, adminReviewTestimonial } from "@/lib/api";
import { testimonialPhotoUrl, type AdminTestimonial, type TestimonialStatus } from "@/lib/testimonials";

type Tab = TestimonialStatus | "all";

const STATUS_VIEW: Record<TestimonialStatus, [string, "amber" | "green" | "gray"]> = {
  pending: ["To review", "amber"],
  approved: ["Published", "green"],
  rejected: ["Rejected", "gray"],
};
const day = (value: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
const when = (value: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
const photosOf = (story: AdminTestimonial) => story.photo_paths.map(testimonialPhotoUrl).filter((url): url is string => !!url);
const searchText = (story: AdminTestimonial) => [story.display_name, story.email, story.role_line, story.story].join(" ");

function mediaTags(story: AdminTestimonial) {
  const tags: string[] = [];
  if (story.video_file_id) tags.push("Video");
  const photos = photosOf(story).length;
  if (photos) tags.push(photos === 1 ? "1 photo" : `${photos} photos`);
  if (story.avatar_path) tags.push("Profile photo");
  return tags;
}

export default function AdminTestimonialsPage() {
  const [stories, setStories] = useState<AdminTestimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  // Review panel; the open flag is separate so it keeps its content while sliding out.
  const [selected, setSelected] = useState<AdminTestimonial | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  async function loadStories() {
    setIsLoading(true);
    setError(null);
    try {
      setStories(await adminListTestimonials());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load stories.");
    } finally {
      setIsLoading(false);
    }
  }

  // AdminShell only renders this page once the admin session is valid.
  useEffect(() => {
    loadStories();
  }, []);

  const open = (story: AdminTestimonial) => {
    setSelected(story);
    setPanelOpen(true);
    setError(null);
  };

  async function review(story: AdminTestimonial, status: TestimonialStatus, featured = false) {
    setSavingId(story.id);
    setError(null);
    setNotice(null);
    try {
      const saved = await adminReviewTestimonial({ id: story.id, status, featured });
      // Featuring clears the flag on every other row, so refetch rather than patch in place.
      if (featured) await loadStories();
      else setStories((current) => current.map((row) => (row.id === saved.id ? saved : row)));
      setNotice(
        `${story.display_name}: ${status === "approved" ? (featured ? "published and featured" : "published") : status === "rejected" ? "rejected" : "back to review"}.`,
      );
      setPanelOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
    } finally {
      setSavingId(null);
    }
  }

  const featured = stories.find((story) => story.featured);
  const counts = useMemo(
    () => ({
      pending: stories.filter((story) => story.status === "pending").length,
      approved: stories.filter((story) => story.status === "approved").length,
      rejected: stories.filter((story) => story.status === "rejected").length,
    }),
    [stories],
  );
  const rows = useMemo(() => (tab === "all" ? stories : stories.filter((story) => story.status === tab)), [stories, tab]);

  const columns = useMemo<ColumnDef<AdminTestimonial, unknown>[]>(
    () => [
      {
        id: "member",
        accessorKey: "display_name",
        meta: { label: "Member" },
        cell: ({ row }) => <CellStack title={row.original.display_name} sub={row.original.role_line || undefined} />,
      },
      { id: "email", accessorKey: "email", meta: { label: "Email" } },
      {
        id: "story",
        accessorKey: "story",
        enableSorting: false,
        meta: { label: "Story" },
        cell: ({ row }) => <p className="max-w-sm truncate text-muted-foreground">{row.original.story}</p>,
      },
      {
        id: "media",
        accessorFn: (story) => mediaTags(story).join(", "),
        enableSorting: false,
        meta: { label: "Media" },
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1.5">
            {mediaTags(row.original).map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        ),
      },
      {
        id: "submitted",
        accessorKey: "created_at",
        meta: { label: "Submitted", csv: (story) => story.created_at },
        cell: ({ row }) => <span className="whitespace-nowrap">{day(row.original.created_at)}</span>,
      },
      {
        id: "status",
        accessorFn: (story) => STATUS_VIEW[story.status]?.[0] ?? story.status,
        meta: { label: "Status" },
        cell: ({ row }) => {
          const [label, tone] = STATUS_VIEW[row.original.status] ?? [row.original.status, "gray"];
          return (
            <span className="inline-flex items-center gap-2">
              <StatusDot tone={tone}>{label}</StatusDot>
              {row.original.featured ? <Badge>Featured</Badge> : null}
            </span>
          );
        },
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const story = row.original;
          const busy = savingId === story.id;
          return (
            <div className="flex justify-end">
              <RowActions
                label={`Actions for ${story.display_name}'s story`}
                actions={[
                  { label: "Review", onSelect: () => open(story) },
                  { label: "Approve", disabled: busy, onSelect: () => review(story, "approved") },
                  { label: "Approve and feature", disabled: busy, onSelect: () => review(story, "approved", true) },
                  { label: "Reject", destructive: true, disabled: busy, onSelect: () => review(story, "rejected") },
                ]}
              />
            </div>
          );
        },
      },
    ],
    // open and review only use state setters and the row they're given.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savingId],
  );

  const photos = selected ? photosOf(selected) : [];
  const avatar = selected ? testimonialPhotoUrl(selected.avatar_path) : null;
  const busy = Boolean(selected && savingId === selected.id);

  return (
    <>
      <MetricStrip>
        <MetricCell label="To review" icon={Inbox} loading={isLoading} value={counts.pending} />
        <MetricCell label="Published" icon={CircleCheck} loading={isLoading} value={counts.approved} />
        <MetricCell
          label="Featured"
          icon={Star}
          loading={isLoading}
          value={<span className="truncate text-xl">{featured?.display_name ?? <span className="text-subtle-foreground">None</span>}</span>}
        />
        <MetricCell label="Rejected" icon={CircleX} loading={isLoading} value={counts.rejected} />
      </MetricStrip>

      <PageBody>
        {error && !panelOpen ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert>{notice}</Alert> : null}

        <Section
          actions={
            <FilterTabs
              label="Filter stories by status"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "pending" as Tab, label: "To review", count: counts.pending },
                { value: "approved" as Tab, label: "Published", count: counts.approved },
                { value: "rejected" as Tab, label: "Rejected", count: counts.rejected },
                { value: "all" as Tab, label: "All", count: stories.length },
              ]}
            />
          }
        >
          <DataTable
            data={rows}
            columns={columns}
            loading={isLoading && stories.length === 0}
            searchText={searchText}
            searchPlaceholder="Search stories"
            onRowClick={open}
            initialSort={[{ id: "submitted", desc: true }]}
            initialHidden={["email"]}
            emptyText={tab === "pending" ? "Nothing waiting for review." : tab === "all" ? "Nothing submitted yet." : `No ${STATUS_VIEW[tab][0].toLowerCase()} stories.`}
            actions={
              <Button variant="outline" size="icon-sm" onClick={loadStories} disabled={isLoading} aria-label="Refresh stories" title="Refresh stories" className="rounded-lg shadow-none">
                <RefreshCw className={isLoading ? "animate-spin" : undefined} strokeWidth={1.5} />
              </Button>
            }
          />
        </Section>
      </PageBody>

      {selected ? (
        <EditSheet
          open={panelOpen}
          onOpenChange={setPanelOpen}
          size="wide"
          title={selected.display_name}
          description={
            <span className="inline-flex flex-wrap items-center gap-x-3">
              {selected.role_line ? <span>{selected.role_line}</span> : null}
              <StatusDot tone={STATUS_VIEW[selected.status]?.[1] ?? "gray"}>{STATUS_VIEW[selected.status]?.[0] ?? selected.status}</StatusDot>
              {selected.featured ? <Badge>Featured</Badge> : null}
            </span>
          }
          onSubmit={(event) => event.preventDefault()}
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => review(selected, "rejected")}
                className="mr-auto text-[13px] font-normal text-down hover:bg-down/5 hover:text-down"
              >
                Reject
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => review(selected, "approved")} className="shadow-none">
                Approve
              </Button>
              <Button type="button" size="sm" disabled={busy} onClick={() => review(selected, "approved", true)}>
                Approve and feature
              </Button>
            </>
          }
        >
          {error ? <Alert tone="error">{error}</Alert> : null}

          <DetailList
            title="Contact"
            items={[
              ["Email", selected.email],
              ["Submitted", when(selected.created_at)],
            ]}
          />

          <FieldGroup title="Story">
            <blockquote className="rounded-lg border border-border bg-chrome p-4 text-sm leading-relaxed whitespace-pre-line">{selected.story}</blockquote>
          </FieldGroup>

          {selected.video_file_id || avatar || photos.length ? (
            <FieldGroup title="Media">
              {selected.video_file_id ? (
                <>
                  <Alert tone="warning">
                    Play the video before approving. If it asks you to sign in, the member hasn&apos;t shared it publicly, and visitors will hit the same wall.
                  </Alert>
                  <div className="overflow-hidden rounded-lg border border-border">
                    <TestimonialVideo fileId={selected.video_file_id} name={selected.display_name} />
                  </div>
                </>
              ) : null}
              {avatar || photos.length ? (
                <div className="grid grid-cols-3 gap-3">
                  {[...(avatar ? [{ url: avatar, label: "Profile photo" }] : []), ...photos.map((url, index) => ({ url, label: `Photo ${index + 1}` }))].map(
                    ({ url, label }) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="group flex flex-col gap-1 rounded-lg focus-ring">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={label} className="aspect-square w-full rounded-lg border border-border object-cover group-hover:opacity-90" />
                        <span className="text-xs text-muted-foreground">{label}</span>
                      </a>
                    ),
                  )}
                </div>
              ) : null}
            </FieldGroup>
          ) : null}

          {featured && featured.id !== selected.id ? (
            <p className="text-xs text-muted-foreground">Approve and feature replaces {featured.display_name} as the featured story.</p>
          ) : null}
        </EditSheet>
      ) : null}
    </>
  );
}
