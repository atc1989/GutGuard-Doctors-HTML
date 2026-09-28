import assert from "node:assert/strict";
import {
  checkImageFile,
  driveThumbnailUrl,
  drivePreviewUrl,
  parseDriveFileId,
  validateTestimonial,
} from "./testimonials.ts";

const ID = "1a2B3c4D5e6F7g8H9i0JkLmNoPqRsTu";

/* --- the shapes members actually paste --- */
assert.equal(parseDriveFileId(`https://drive.google.com/file/d/${ID}/view?usp=sharing`), ID);
assert.equal(parseDriveFileId(`https://drive.google.com/file/d/${ID}/preview`), ID);
assert.equal(parseDriveFileId(`https://drive.google.com/open?id=${ID}`), ID);
assert.equal(parseDriveFileId(`https://drive.google.com/uc?export=download&id=${ID}`), ID);
assert.equal(parseDriveFileId(`https://docs.google.com/file/d/${ID}/edit`), ID);
assert.equal(parseDriveFileId(`  https://drive.google.com/file/d/${ID}/view  `), ID, "trims");
assert.equal(parseDriveFileId(ID), ID, "a bare id is accepted");

/* --- anything that is not a Drive file is refused ---
   This is the guard that keeps a submitted link from becoming an arbitrary iframe on
   gutguard.ph, so it matters more than the happy paths above. */
assert.equal(parseDriveFileId(""), null);
assert.equal(parseDriveFileId(null), null);
assert.equal(parseDriveFileId(undefined), null);
assert.equal(parseDriveFileId("not a url"), null);
assert.equal(parseDriveFileId(`https://evil.example.com/file/d/${ID}/view`), null, "wrong host");
assert.equal(
  parseDriveFileId(`https://drive.google.com.evil.example/file/d/${ID}/view`),
  null,
  "suffixed host must not pass",
);
assert.equal(parseDriveFileId("javascript:alert(1)"), null);
assert.equal(parseDriveFileId("https://drive.google.com/file/d/short/view"), null, "id too short");
assert.equal(parseDriveFileId("https://drive.google.com/drive/my-drive"), null, "no id present");

/* --- built URLs carry nothing but the id --- */
assert.equal(drivePreviewUrl(ID), `https://drive.google.com/file/d/${ID}/preview`);
assert.equal(driveThumbnailUrl(ID), `https://drive.google.com/thumbnail?id=${ID}&sz=w1000`);
assert.equal(driveThumbnailUrl(ID, 480), `https://drive.google.com/thumbnail?id=${ID}&sz=w480`);

/* --- image gate matches what the bucket will accept --- */
assert.equal(checkImageFile({ type: "image/jpeg", size: 1024 }), null);
assert.equal(checkImageFile({ type: "image/webp", size: 1024 }), null);
assert.match(checkImageFile({ type: "image/gif", size: 1024 }) ?? "", /JPG, PNG or WebP/);
assert.match(checkImageFile({ type: "video/mp4", size: 1024 }) ?? "", /JPG, PNG or WebP/);
assert.match(checkImageFile({ type: "image/png", size: 11 * 1024 * 1024 }) ?? "", /10MB/);

/* --- form validation --- */
const valid = {
  displayName: "Maria Santos",
  email: "maria@example.ph",
  roleLine: "Quezon City",
  story: "x".repeat(60),
  videoUrl: "",
  consent: true,
};

assert.deepEqual(validateTestimonial(valid), {}, "a complete story passes");
assert.deepEqual(
  validateTestimonial({ ...valid, videoUrl: `https://drive.google.com/file/d/${ID}/view` }),
  {},
  "a Drive link is optional but allowed",
);

assert.ok(validateTestimonial({ ...valid, consent: false }).consent, "consent is required");
assert.ok(validateTestimonial({ ...valid, displayName: "M" }).displayName, "name too short");
assert.ok(validateTestimonial({ ...valid, email: "nope" }).email);
assert.ok(validateTestimonial({ ...valid, story: "too short" }).story);
assert.ok(validateTestimonial({ ...valid, story: "x".repeat(1501) }).story);
assert.ok(validateTestimonial({ ...valid, roleLine: "x".repeat(81) }).roleLine);
assert.ok(
  validateTestimonial({ ...valid, videoUrl: "https://youtube.com/watch?v=abc" }).videoUrl,
  "a non-Drive video link is rejected, not silently dropped",
);

console.log("testimonial checks passed");
