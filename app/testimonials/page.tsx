import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import TestimonialVideo from "@/components/TestimonialVideo";
import { listTestimonials } from "@/lib/api";
import { testimonialPhotoUrl, type PublicTestimonial } from "@/lib/testimonials";

export const metadata = {
  title: "Stories",
  description:
    "Members on what changed over 90 days, in their own words — with their own photos and video.",
};

// Moderation is manual, so an approved story appearing within five minutes is fast
// enough, and the wall stays a static render for everyone else.
export const revalidate = 300;

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function Avatar({ story }: { story: PublicTestimonial }) {
  const url = testimonialPhotoUrl(story.avatar_path);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="tm-av" src={url} alt="" loading="lazy" />
  ) : (
    <span className="tm-av tm-av-fallback" aria-hidden="true">
      {initials(story.display_name)}
    </span>
  );
}

/**
 * Photos and video share one horizontal scroll-snap strip. A member with four photos
 * gets a swipeable card without a carousel library, and a member with one gets a plain
 * image - the strip collapses to whatever is in it.
 */
function MediaStrip({ story }: { story: PublicTestimonial }) {
  const photos = story.photo_paths.map(testimonialPhotoUrl).filter((url): url is string => !!url);
  if (!story.video_file_id && photos.length === 0) return null;

  const single = !story.video_file_id && photos.length === 1;

  return (
    <div className={"tm-strip" + (single ? " single" : "")}>
      {story.video_file_id && (
        <TestimonialVideo fileId={story.video_file_id} name={story.display_name} />
      )}
      {photos.map((url) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="tm-media" key={url} src={url} alt="" loading="lazy" />
      ))}
    </div>
  );
}

function Card({ story }: { story: PublicTestimonial }) {
  return (
    <article className="tm-card">
      <MediaStrip story={story} />
      <blockquote className="tm-quote">{story.story}</blockquote>
      <footer className="tm-who">
        <Avatar story={story} />
        <div>
          <div className="tm-name">{story.display_name}</div>
          {story.role_line && <div className="tm-role">{story.role_line}</div>}
        </div>
      </footer>
    </article>
  );
}

function Featured({ story }: { story: PublicTestimonial }) {
  return (
    <section className="tm-featured" aria-label="Featured story">
      <div className="tm-featured-media">
        <MediaStrip story={story} />
      </div>
      <div className="tm-featured-body">
        <div className="tm-eyebrow">Featured story</div>
        <blockquote className="tm-featured-quote">{story.story}</blockquote>
        <footer className="tm-who">
          <Avatar story={story} />
          <div>
            <div className="tm-name">{story.display_name}</div>
            {story.role_line && <div className="tm-role">{story.role_line}</div>}
          </div>
        </footer>
      </div>
    </section>
  );
}

function ShareCta({ compact = false }: { compact?: boolean }) {
  return (
    <section className={"tm-cta" + (compact ? " compact" : "")}>
      <div>
        <h2>Your 90 days. Your words.</h2>
        <p>
          The trajectory is measured. What it felt like is yours to tell — in writing, in photos,
          or on video.
        </p>
      </div>
      <Link className="tm-cta-btn" href="/testimonials/share">
        Share your story <ArrowRight size={16} />
      </Link>
    </section>
  );
}

export default async function TestimonialsPage() {
  const stories = await listTestimonials();
  // list_testimonials already orders featured first, so at most the head can be one.
  const featured = stories[0]?.featured ? stories[0] : null;
  const wall = featured ? stories.slice(1) : stories;

  return (
    <main className="tm-shell">
      <SiteNav current="/testimonials" />

      <div className="tm-page">
        <header className="tm-hero">
          <div className="tm-eyebrow">Member stories</div>
          <h1>
            The method is measured. <em>The difference is felt.</em>
          </h1>
          <p>
            Every story here was sent in by the person who lived it, and read by a human before it
            went up.
          </p>
        </header>

        {featured && <Featured story={featured} />}

        {wall.length > 0 ? (
          <div className="tm-wall">
            {wall.map((story) => (
              <Card key={story.id} story={story} />
            ))}
          </div>
        ) : (
          !featured && (
            <p className="tm-empty">
              The first stories are being read now. Yours could be the one that opens this page.
            </p>
          )
        )}

        <ShareCta compact={stories.length > 0} />

        <p className="tm-caveat">
          Individual experience, shared with permission. Stories describe what members noticed and
          are not clinical outcomes, medical advice, or a claim of treatment. Results vary.
        </p>
      </div>
    </main>
  );
}
