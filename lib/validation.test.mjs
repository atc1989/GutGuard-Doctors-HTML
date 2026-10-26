import assert from "node:assert/strict";
import { validateField, validateForm } from "./validation.ts";

assert.equal(validateField("email", ""), false, "email is required for dashboard sign-in");
assert.equal(validateField("email", "dr@clinic.ph"), true);

assert.equal(validateField("whereDidYouFindUs", ""), true, "empty whereDidYouFindUs is allowed");
assert.equal(validateField("whereDidYouFindUs", "   "), true, "whitespace-only whereDidYouFindUs is allowed");
assert.equal(validateField("whereDidYouFindUs", "Colleague referral"), true, "text in whereDidYouFindUs is allowed");

const form = validateForm({
  fullName: "Dr. Maria Santos",
  email: "dr@clinic.ph",
  mobile: "09171234567",
  specialty: "Family Medicine",
  otherSpecialty: "n/a",
  location: "Makati",
  whereDidYouFindUs: "",
});
assert.equal(form.whereDidYouFindUs, undefined, "optional whereDidYouFindUs must not fail the form");
assert.deepEqual(form, {});

console.log("validation checks passed");
