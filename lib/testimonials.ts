/**
 * Shared rules for the member story wall at /testimonials.
 *
 * Deliberately dependency-free so `lib/testimonials.test.mjs` can import it directly
 * under `node --experimental-strip-types`, and so the same limits are enforced on the
 * form, in the upload helper, and in `doctors.submit_testimonial`.
 */

export const TESTIMONIAL_BUCKET = "testimonial-media";

/** Kept in step with the bucket's allowed_mime_types and file_size_limit. */
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 4;

export const NAME_MIN = 2;
export const NAME_MAX = 80;
export const ROLE_MAX = 80;
export const STORY_MIN = 40;
export const STORY_MAX = 1500;

export type PublicTestimonial = {
  id: string;
  display_name: string;
  role_line: string;
  story: string;
  avatar_path: string | null;
  photo_paths: string[];
  video_file_id: string | null;
  featured: boolean;
  created_at: string;
};

export type TestimonialStatus = "pending" | "approved" | "rejected";

export type AdminTestimonial = PublicTestimonial & {
  email: string;
  status: TestimonialStatus;
  review_note: string;
  reviewed_at: string | null;
};

export type TestimonialValues = {
  displayName: string;
  email: string;
  roleLine: string;
  story: string;
  videoUrl: string;
  consent: boolean;
};

export type TestimonialErrors = Partial<Record<keyof TestimonialValues, string>>;

/* --- Google Drive ---------------------------------------------------------- */

/**
 * Drive file ids are 28-44 chars in practice; the range is loose because Google has
 * never promised a length. The charset is the part that matters - it is what lets every
 * URL below be built by string concatenation with nothing left to escape.
 */
const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{20,200}$/;

const DRIVE_HOSTS = new Set([
  "drive.google.com",
  "docs.google.com",
  "drive.usercontent.google.com",
]);

/**
 * Pull the file id out of whatever a member pasted, or return null.
 *
 * We store the id and never the URL. Rendering a submitted URL into an iframe src would
 * let anyone put an arbitrary page - a fake login, say - inside a gutguard.ph frame;
 * an id constrained to [A-Za-z0-9_-] cannot express anything but a Drive file.
 *
 * Handles /file/d/<id>/view, /open?id=<id>, /uc?id=<id>, and a bare pasted id.
 */
export function parseDriveFileId(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  if (DRIVE_FILE_ID.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!DRIVE_HOSTS.has(url.hostname.toLowerCase())) return null;

  const fromPath = url.pathname.split("/").find((segment) => DRIVE_FILE_ID.test(segment));
  if (fromPath) return fromPath;

  const fromQuery = url.searchParams.get("id");
  return fromQuery && DRIVE_FILE_ID.test(fromQuery) ? fromQuery : null;
}

/** Poster frame for the click-to-play facade. Only resolves for link-shared files. */
export function driveThumbnailUrl(fileId: string, width = 1000) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
}

/**
 * The player. `uc?export=download` is not a usable <video> src - Drive answers large
 * files with a virus-scan interstitial and rate limits the rest - so the embed has to
 * be this iframe.
 */
export function drivePreviewUrl(fileId: string) {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/* --- Storage --------------------------------------------------------------- */

export function testimonialPhotoUrl(path: string | null | undefined) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !path) return null;
  return `${base}/storage/v1/object/public/${TESTIMONIAL_BUCKET}/${path}`;
}

/** Rejects on the same grounds the bucket would, but before wasting the upload. */
export function checkImageFile(file: { type: string; size: number }): string | null {
  if (!IMAGE_MIME_TYPES.includes(file.type)) return "Photos must be JPG, PNG or WebP.";
  if (file.size > MAX_IMAGE_BYTES) return "Each photo must be 10MB or smaller.";
  return null;
}

/* --- Form ------------------------------------------------------------------ */

export function validateTestimonial(values: TestimonialValues): TestimonialErrors {
  const errors: TestimonialErrors = {};
  const name = values.displayName.trim();
  const story = values.story.trim();
  const video = values.videoUrl.trim();

  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    errors.displayName = `Please give a name between ${NAME_MIN} and ${NAME_MAX} characters.`;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Please give an email address we can reach you at.";
  }
  if (values.roleLine.trim().length > ROLE_MAX) {
    errors.roleLine = `Keep this under ${ROLE_MAX} characters.`;
  }
  if (story.length < STORY_MIN) {
    errors.story = `Please write at least ${STORY_MIN} characters.`;
  } else if (story.length > STORY_MAX) {
    errors.story = `Please keep your story under ${STORY_MAX} characters.`;
  }
  if (video && !parseDriveFileId(video)) {
    errors.videoUrl = "That does not look like a Google Drive link. Copy the share link from Drive.";
  }
  if (!values.consent) {
    errors.consent = "We need your permission before we can publish your story.";
  }

  return errors;
}
