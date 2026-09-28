"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { drivePreviewUrl, driveThumbnailUrl } from "@/lib/testimonials";

/**
 * Click-to-load facade for a Google Drive video.
 *
 * The wall can hold a dozen stories, and a dozen Drive iframes mounted at once makes the
 * page crawl. So we render Drive's thumbnail endpoint as a poster and only mount the
 * iframe once someone actually asks to watch.
 *
 * A missing thumbnail almost always means the file is not shared as "anyone with the
 * link". We fall back to a plain play panel rather than a broken image, and the
 * moderation queue is where that gets caught - a reviewer hits the same sign-in wall a
 * visitor would.
 */
export default function TestimonialVideo({ fileId, name }: { fileId: string; name: string }) {
  const [playing, setPlaying] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  if (playing) {
    return (
      <iframe
        className="tm-media tm-video-frame"
        src={drivePreviewUrl(fileId)}
        title={`${name} — video story`}
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    );
  }

  return (
    <button
      className={"tm-media tm-video-facade" + (posterFailed ? " no-poster" : "")}
      type="button"
      onClick={() => setPlaying(true)}
    >
      {!posterFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={driveThumbnailUrl(fileId, 800)}
          alt=""
          loading="lazy"
          onError={() => setPosterFailed(true)}
        />
      )}
      <span className="tm-play" aria-hidden="true">
        <Play size={20} fill="currentColor" />
      </span>
      <span className="tm-sr">Play {name}&apos;s video</span>
    </button>
  );
}
