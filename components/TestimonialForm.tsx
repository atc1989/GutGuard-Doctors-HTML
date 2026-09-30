"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { LoaderCircle, X } from "lucide-react";
import { submitTestimonial, uploadTestimonialPhoto } from "@/lib/api";
import {
  checkImageFile,
  IMAGE_MIME_TYPES,
  MAX_PHOTOS,
  parseDriveFileId,
  STORY_MAX,
  validateTestimonial,
  type TestimonialErrors,
  type TestimonialValues,
} from "@/lib/testimonials";

const EMPTY: TestimonialValues = {
  displayName: "",
  email: "",
  roleLine: "",
  story: "",
  videoUrl: "",
  consent: false,
};

const ACCEPT = IMAGE_MIME_TYPES.join(",");

type Picked = { file: File; preview: string };

export default function TestimonialForm() {
  const [values, setValues] = useState<TestimonialValues>(EMPTY);
  const [errors, setErrors] = useState<TestimonialErrors>({});
  const [avatar, setAvatar] = useState<Picked | null>(null);
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // One folder per visit, so a retry after a failed submit does not scatter the photos.
  const folder = useRef(crypto.randomUUID());

  function setValue<K extends keyof TestimonialValues>(name: K, value: TestimonialValues[K]) {
    setValues((current) => ({ ...current, [name]: value }));
    setSubmitError(null);
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function pickAvatar(file: File | undefined) {
    if (!file) return;
    const rejection = checkImageFile(file);
    if (rejection) return setMediaError(rejection);
    setMediaError(null);
    setAvatar({ file, preview: URL.createObjectURL(file) });
  }

  function pickPhotos(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return setMediaError(`You can attach up to ${MAX_PHOTOS} photos.`);

    const accepted: Picked[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      const rejection = checkImageFile(file);
      if (rejection) {
        setMediaError(rejection);
        continue;
      }
      accepted.push({ file, preview: URL.createObjectURL(file) });
    }
    if (accepted.length) {
      setMediaError(files.length > room ? `Only the first ${room} were added.` : null);
      setPhotos((current) => [...current, ...accepted]);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validateTestimonial(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitError("Please check the highlighted fields.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      // Uploads first: if Storage refuses one, nothing has been written to the queue yet.
      const avatarPath = avatar
        ? await uploadTestimonialPhoto(avatar.file, `${folder.current}/avatar`)
        : null;
      const photoPaths: string[] = [];
      for (const photo of photos) {
        photoPaths.push(await uploadTestimonialPhoto(photo.file, folder.current));
      }

      await submitTestimonial({
        displayName: values.displayName,
        email: values.email,
        roleLine: values.roleLine,
        story: values.story,
        avatarPath,
        photoPaths,
        videoFileId: parseDriveFileId(values.videoUrl),
      });

      setDone(true);
    } catch (caught) {
      setSubmitError(
        caught instanceof Error ? caught.message : "Your story could not be sent. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="tm-done">
        <h2>Thank you — we have it.</h2>
        <p>
          A person on our team reads every story before it goes up, so give us a few days. We will
          email {values.email.trim()} if we need anything, and again once yours is live.
        </p>
        <Link className="tm-cta-btn" href="/testimonials">
          Back to the stories
        </Link>
      </div>
    );
  }

  const storyLength = values.story.trim().length;

  return (
    <form className="tm-form" onSubmit={handleSubmit} noValidate>
      <label className="tm-field">
        <span className="tm-label">Your name</span>
        <input
          value={values.displayName}
          onChange={(event) => setValue("displayName", event.target.value)}
          placeholder="How you would like to be credited"
          autoComplete="name"
          aria-invalid={!!errors.displayName}
        />
        {errors.displayName && <span className="tm-err">{errors.displayName}</span>}
      </label>

      <label className="tm-field">
        <span className="tm-label">Email</span>
        <input
          type="email"
          value={values.email}
          onChange={(event) => setValue("email", event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          aria-invalid={!!errors.email}
        />
        <span className="tm-hint">Never published. We use it to confirm the story is yours.</span>
        {errors.email && <span className="tm-err">{errors.email}</span>}
      </label>

      <label className="tm-field">
        <span className="tm-label">
          City or role <span className="tm-opt">optional</span>
        </span>
        <input
          value={values.roleLine}
          onChange={(event) => setValue("roleLine", event.target.value)}
          placeholder="Quezon City · Member since 2025"
          aria-invalid={!!errors.roleLine}
        />
        {errors.roleLine && <span className="tm-err">{errors.roleLine}</span>}
      </label>

      <label className="tm-field">
        <span className="tm-label">Your story</span>
        <textarea
          rows={7}
          value={values.story}
          onChange={(event) => setValue("story", event.target.value)}
          placeholder="What changed, and when did you notice it?"
          maxLength={STORY_MAX}
          aria-invalid={!!errors.story}
        />
        <span className="tm-hint">
          {storyLength}/{STORY_MAX}
        </span>
        {errors.story && <span className="tm-err">{errors.story}</span>}
      </label>

      <div className="tm-field">
        <span className="tm-label">
          Profile photo <span className="tm-opt">optional</span>
        </span>
        <div className="tm-avatar-row">
          {avatar ? (
            <span className="tm-thumb tm-thumb-av">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatar.preview} alt="" />
              <button type="button" aria-label="Remove profile photo" onClick={() => setAvatar(null)}>
                <X size={13} />
              </button>
            </span>
          ) : null}
          <input type="file" accept={ACCEPT} onChange={(event) => pickAvatar(event.target.files?.[0])} />
        </div>
      </div>

      <div className="tm-field">
        <span className="tm-label">
          Photos <span className="tm-opt">optional · up to {MAX_PHOTOS}</span>
        </span>
        {photos.length > 0 && (
          <div className="tm-thumbs">
            {photos.map((photo, index) => (
              <span className="tm-thumb" key={photo.preview}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.preview} alt="" />
                <button
                  type="button"
                  aria-label={`Remove photo ${index + 1}`}
                  onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
        {photos.length < MAX_PHOTOS && (
          <input type="file" accept={ACCEPT} multiple onChange={(event) => pickPhotos(event.target.files)} />
        )}
        <span className="tm-hint">JPG, PNG or WebP. 10MB each.</span>
        {mediaError && <span className="tm-err">{mediaError}</span>}
      </div>

      <label className="tm-field">
        <span className="tm-label">
          Video link <span className="tm-opt">optional</span>
        </span>
        <input
          value={values.videoUrl}
          onChange={(event) => setValue("videoUrl", event.target.value)}
          placeholder="https://drive.google.com/file/d/…/view"
          inputMode="url"
          aria-invalid={!!errors.videoUrl}
        />
        <span className="tm-hint">
          Upload your video to Google Drive, then in Drive open <b>Share → General access</b> and
          set it to <b>Anyone with the link</b>. Paste that link here. Without that setting nobody
          but you can play it, and we will have to send it back.
        </span>
        {errors.videoUrl && <span className="tm-err">{errors.videoUrl}</span>}
      </label>

      <label className={"tm-consent" + (errors.consent ? " invalid" : "")}>
        <input
          type="checkbox"
          checked={values.consent}
          onChange={(event) => setValue("consent", event.target.checked)}
        />
        <span>
          I am sharing my own experience, and I give GutGuard permission to publish it — my name,
          the words above, and any photos or video I attached — on gutguard.ph and its social
          channels. I can ask for it to be taken down at any time.
        </span>
      </label>
      {errors.consent && <span className="tm-err">{errors.consent}</span>}

      {submitError && (
        <p className="tm-submit-error" role="alert">
          {submitError}
        </p>
      )}

      <button className="tm-submit" type="submit" disabled={submitting}>
        {submitting ? (
          <>
            <LoaderCircle size={16} className="tm-spin" /> Sending…
          </>
        ) : (
          "Send my story"
        )}
      </button>
    </form>
  );
}
