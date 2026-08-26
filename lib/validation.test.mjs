import assert from "node:assert/strict";
import { normalizeTikTokUsername, validateField, validateForm } from "./validation.ts";

assert.equal(validateField("tiktokUsername", ""), true, "empty TikTok is allowed");
assert.equal(validateField("tiktokUsername", "   "), true, "whitespace-only TikTok is allowed");
assert.equal(validateField("tiktokUsername", "@gutguardph"), true);
assert.equal(validateField("tiktokUsername", "ab"), true);
assert.equal(validateField("tiktokUsername", "a"), false, "too-short handles are still rejected");
assert.equal(validateField("tiktokUsername", "not a handle"), false);

assert.equal(normalizeTikTokUsername("@GutGuardPH"), "gutguardph");
assert.equal(normalizeTikTokUsername(""), "");

assert.equal(validateField("email", ""), false, "email is required for dashboard sign-in");
assert.equal(validateField("email", "dr@clinic.ph"), true);

const form = validateForm({
  fullName: "Dr. Maria Santos",
  email: "dr@clinic.ph",
  mobile: "09171234567",
  tiktokUsername: "",
  specialty: "Family Medicine",
  otherSpecialty: "n/a",
  location: "Makati",
});
assert.equal(form.tiktokUsername, undefined, "optional TikTok must not fail the form");
assert.deepEqual(form, {});

console.log("validation checks passed");
