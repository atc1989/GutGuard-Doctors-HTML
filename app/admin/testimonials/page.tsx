"use client";

import { useMemo, useState, type FormEvent } from "react";
import Header from "@/components/Header";
import TestimonialVideo from "@/components/TestimonialVideo";
import { adminListTestimonials, adminReviewTestimonial } from "@/lib/api";
import {
  testimonialPhotoUrl,
  type AdminTestimonial,
  type TestimonialStatus,
} from "@/lib/testimonials";

export default function AdminTestimonialsPage() {
  const [password, setPassword] = useState("");
  const [stories, setStories] = useState<AdminTestimonial[]>([]);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const metrics = useMemo(
    () => ({
      total: stories.length,
      pending: stories.filter((story) => story.status === "pending").length,
    }),
    [stories],
  );

  const hasPassword = password.trim().length > 0;

  async function load(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      setStories(await adminListTestimonials(password));
      setIsUnlocked(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load stories.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function review(story: AdminTestimonial, status: TestimonialStatus, featured = false) {
    setSavingId(story.id);
    setError(null);
    setNotice(null);
    try {
      const saved = await adminReviewTestimonial(password, { id: story.id, status, featured });
      // Featuring clears the flag on every other row, so refetch rather than patch in place.
      if (featured) await load();
      else setStories((current) => current.map((row) => (row.id === saved.id ? saved : row)));
      setNotice(`${story.display_name}: ${status}${featured ? " · featured" : ""}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="admin-wheel-shell admin-shop-orders-shell">
      <Header dateLabel="Member Stories" />

      <section className="admin-wheel-hero">
        <div>
          <p className="admin-wheel-kicker">GutGuard Stories</p>
          <h1>
            Moderation
            <br />
            <em>Admin</em>
          </h1>
        </div>
        <div className="admin-wheel-summary" aria-live="polite">
          <span>{isUnlocked ? "visible" : "locked"}</span>
          <strong>{metrics.total}</strong>
          <span>{metrics.pending} pending</span>
        </div>
      </section>

      <form className="admin-wheel-auth admin-tiktok-auth" onSubmit={load}>
        <label htmlFor="admin-password">Admin password</label>
        <div className="admin-wheel-auth-row">
          <input
            className="admin-hidden-username"
            type="text"
            value="gutguard-admin"
            readOnly
            aria-hidden="true"
            tabIndex={-1}
          />
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            placeholder="Enter password"
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="submit" disabled={isLoading || !hasPassword}>
            {isLoading ? "Loading" : isUnlocked ? "Refresh" : "Unlock"}
          </button>
        </div>
      </form>

      {notice ? <div className="admin-wheel-alert">{notice}</div> : null}
      {error ? <div className="admin-wheel-alert error">{error}</div> : null}

      {isUnlocked ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">Queue</p>
              <h2>Submitted stories</h2>
            </div>
            <p>
              Play every video before approving — if it asks you to sign in, the member has not
              shared it publicly and visitors will hit the same wall.
            </p>
          </div>

          {stories.length === 0 ? (
            <p className="admin-wheel-empty">Nothing submitted yet.</p>
          ) : (
            <div className="tm-admin-list">
              {stories.map((story) => {
                const photos = story.photo_paths
                  .map(testimonialPhotoUrl)
                  .filter((url): url is string => !!url);
                const avatar = testimonialPhotoUrl(story.avatar_path);

                return (
                  <article className={"tm-admin-row " + story.status} key={story.id}>
                    <div className="tm-admin-meta">
                      <strong>{story.display_name}</strong>
                      <span>{story.email}</span>
                      {story.role_line ? <span>{story.role_line}</span> : null}
                      <span>{new Date(story.created_at).toLocaleString()}</span>
                      <span className="tm-admin-status">
                        {story.status}
                        {story.featured ? " · featured" : ""}
                      </span>
                    </div>

                    <blockquote>{story.story}</blockquote>

                    {(avatar || photos.length > 0 || story.video_file_id) && (
                      <div className="tm-strip">
                        {avatar && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="tm-media" src={avatar} alt="Profile photo" />
                        )}
                        {story.video_file_id && (
                          <TestimonialVideo fileId={story.video_file_id} name={story.display_name} />
                        )}
                        {photos.map((url) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="tm-media" key={url} src={url} alt="" />
                        ))}
                      </div>
                    )}

                    <div className="admin-tiktok-row-actions">
                      <button
                        type="button"
                        disabled={savingId === story.id}
                        onClick={() => review(story, "approved")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={savingId === story.id}
                        onClick={() => review(story, "approved", true)}
                      >
                        Approve &amp; feature
                      </button>
                      <button
                        type="button"
                        disabled={savingId === story.id}
                        onClick={() => review(story, "rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
