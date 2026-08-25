"use client";

import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";
import { SPECIALTIES } from "@/lib/constants";
import { enrollDoctorInSequence, registerDoctor } from "@/lib/api";
import type { FieldErrors, FieldName, FormValues } from "@/lib/validation";
import {
  normalizeMobile,
  normalizeTikTokUsername,
  validateField,
  validateForm,
} from "@/lib/validation";

type PartnerApplyFormProps = {
  invitedBy?: { slug: string; fullName: string } | null;
  onRegistered: (email: string) => Promise<void>;
  onSignIn: () => void;
};

const INITIAL_VALUES: FormValues = {
  fullName: "",
  email: "",
  mobile: "",
  tiktokUsername: "",
  specialty: "",
  otherSpecialty: "",
  location: "",
};

export default function PartnerApplyForm({
  invitedBy,
  onRegistered,
  onSignIn,
}: PartnerApplyFormProps) {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleValueChange(name: FieldName, value: string) {
    setValues((current) => ({
      ...current,
      [name]: value,
      ...(name === "specialty" && value !== "Other" ? { otherSpecialty: "" } : {}),
    }));
    setSubmitError(null);
    if (errors[name]) {
      setErrors((current) => ({
        ...current,
        [name]: !validateField(name, value),
      }));
    }
  }

  function handleFieldBlur(name: FieldName) {
    setErrors((current) => ({
      ...current,
      [name]: !validateField(name, values[name]),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validateForm(values);
    if (values.specialty !== "Other") delete nextErrors.otherSpecialty;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitError("Please complete the highlighted fields.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const email = values.email.trim().toLowerCase();
    try {
      const doctor = await registerDoctor({
        fullName: values.fullName.trim(),
        email,
        mobile: normalizeMobile(values.mobile),
        tiktokUsername: normalizeTikTokUsername(values.tiktokUsername ?? ""),
        specialty:
          values.specialty === "Other" ? values.otherSpecialty.trim() : values.specialty.trim(),
        location: values.location.trim(),
        referrerSlug: invitedBy?.slug,
      });
      if (doctor.id && !String(doctor.id).startsWith("local-")) {
        void enrollDoctorInSequence(doctor.id).catch(() => {
          // Application already succeeded. Drip email is best-effort.
        });
      }
      await onRegistered(email);
    } catch (error) {
      setSubmitting(false);
      setSubmitError(getRegistrationError(error));
    }
  }

  return (
    <form className="partner-form partner-apply-form" onSubmit={handleSubmit} noValidate>
      {invitedBy?.fullName ? (
        <p className="partner-invite-note">
          Invited by <strong>{invitedBy.fullName}</strong>
        </p>
      ) : null}

      <ApplyField
        id="fullName"
        label="Name"
        error="Please enter your full name."
        value={values.fullName}
        hasError={errors.fullName}
        onValueChange={handleValueChange}
        onFieldBlur={handleFieldBlur}
        type="text"
        placeholder="Dr. Maria Santos"
        autoComplete="name"
        required
      />
      <ApplyField
        id="email"
        label="Email address"
        error="Please enter a valid email address."
        value={values.email}
        hasError={errors.email}
        onValueChange={handleValueChange}
        onFieldBlur={handleFieldBlur}
        type="email"
        placeholder="name@clinic.ph"
        autoComplete="email"
        inputMode="email"
        required
      />
      <ApplyField
        id="mobile"
        label="Mobile"
        error="Please enter a valid PH mobile number."
        value={values.mobile}
        hasError={errors.mobile}
        onValueChange={handleValueChange}
        onFieldBlur={handleFieldBlur}
        type="tel"
        placeholder="09171234567"
        autoComplete="tel"
        inputMode="tel"
        required
      />
      <ApplyField
        id="tiktokUsername"
        label="TikTok username"
        optional
        help="Optional. Used for your profile QR code."
        error="Enter a valid TikTok username, or leave this blank."
        value={values.tiktokUsername}
        hasError={errors.tiktokUsername}
        onValueChange={handleValueChange}
        onFieldBlur={handleFieldBlur}
        type="text"
        placeholder="@gutguardph"
        autoComplete="off"
      />

      <div className="partner-apply-field">
        <label htmlFor="specialty">Specialty</label>
        <select
          id="specialty"
          name="specialty"
          value={values.specialty}
          onChange={(event) => handleValueChange("specialty", event.target.value)}
          onBlur={() => handleFieldBlur("specialty")}
          aria-invalid={errors.specialty || undefined}
          aria-describedby={errors.specialty ? "specialty-error" : undefined}
          required
        >
          <option value="">Select your field</option>
          {SPECIALTIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {errors.specialty ? (
          <p id="specialty-error" className="partner-auth-error" role="alert">
            Please select your specialty.
          </p>
        ) : null}
      </div>

      {values.specialty === "Other" ? (
        <ApplyField
          id="otherSpecialty"
          label="Other specialty"
          error="Please enter your specialty."
          value={values.otherSpecialty}
          hasError={errors.otherSpecialty}
          onValueChange={handleValueChange}
          onFieldBlur={handleFieldBlur}
          type="text"
          placeholder="Enter specialty"
          autoComplete="off"
          required
        />
      ) : null}

      <ApplyField
        id="location"
        label="Clinic location"
        error="Please enter your practice location."
        value={values.location}
        hasError={errors.location}
        onValueChange={handleValueChange}
        onFieldBlur={handleFieldBlur}
        type="text"
        placeholder="City or province"
        autoComplete="address-level2"
        required
      />

      {submitError ? (
        <div className="partner-auth-error" role="alert">
          {submitError}
        </div>
      ) : null}

      <button type="submit" className="shop-primary partner-auth-primary" disabled={submitting}>
        {submitting ? <LoaderCircle className="partner-spinner" aria-hidden="true" /> : null}
        <span>{submitting ? "Submitting application…" : "Submit application"}</span>
      </button>

      <p className="partner-apply-link">
        Already a partner?{" "}
        <button type="button" className="partner-auth-text-button" onClick={onSignIn} disabled={submitting}>
          Sign in
        </button>
      </p>
    </form>
  );
}

function ApplyField({
  id,
  label,
  optional,
  help,
  error,
  value,
  hasError,
  onValueChange,
  onFieldBlur,
  ...props
}: {
  id: FieldName;
  label: string;
  optional?: boolean;
  help?: string;
  error: string;
  value: string;
  hasError?: boolean;
  onValueChange: (name: FieldName, value: string) => void;
  onFieldBlur: (name: FieldName) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "name" | "value" | "onChange" | "onBlur">) {
  const errorId = `${id}-error`;
  const helpId = help ? `${id}-help` : undefined;

  return (
    <div className="partner-apply-field">
      <label htmlFor={id}>
        {label}
        {optional ? <span className="partner-optional">Optional</span> : null}
      </label>
      <input
        id={id}
        name={id}
        value={value}
        onChange={(event) => onValueChange(id, event.target.value)}
        onBlur={() => onFieldBlur(id)}
        aria-invalid={hasError || undefined}
        aria-describedby={[hasError ? errorId : null, helpId].filter(Boolean).join(" ") || undefined}
        {...props}
      />
      {help ? (
        <p id={helpId} className="partner-field-help">
          {help}
        </p>
      ) : null}
      {hasError ? (
        <p id={errorId} className="partner-auth-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function getRegistrationError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("duplicate") && message.includes("tiktok")) {
    return "This TikTok username has already been registered. Please check the handle and try again.";
  }
  if (message.includes("duplicate") && message.includes("email")) {
    return "This email has already been registered. Sign in with a one-time code instead.";
  }
  if (message.includes("cannot refer themselves") || message.includes("refer themselves")) {
    return "A partner cannot refer themselves. Register without using your own referral link.";
  }
  return "Registration failed. Please try again in a moment.";
}
