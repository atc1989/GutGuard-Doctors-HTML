"use client";

import { useState } from "react";
import ActionButton from "@/components/ActionButton";
import ConfirmRegistrationModal from "@/components/ConfirmRegistrationModal";
import { ArrowRightIcon } from "@/components/Icons";
import { InputField, SelectField } from "@/components/FormField";
import SectionLabel from "@/components/SectionLabel";
import { SPECIALTIES } from "@/lib/constants";
import { registerDoctor } from "@/lib/api";
import type { FieldErrors, FieldName, FormValues } from "@/lib/validation";
import {
  normalizeMobile,
  normalizeTikTokUsername,
  validateField,
  validateForm,
} from "@/lib/validation";
import type { Registration, RegistrationPayload } from "@/lib/types";

type RegistrationSectionProps = {
  active: boolean;
  onRegistered: (registration: Registration) => void;
  invitation?: { routing_slug: string; full_name: string } | null;
  invitationInvalid?: boolean;
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

export default function RegistrationSection({
  active,
  onRegistered,
  invitation,
  invitationInvalid,
}: RegistrationSectionProps) {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<RegistrationPayload | null>(null);
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

  function buildPayload(): RegistrationPayload {
    return {
      fullName: values.fullName.trim(),
      email: values.email.trim().toLowerCase(),
      mobile: normalizeMobile(values.mobile),
      tiktokUsername: normalizeTikTokUsername(values.tiktokUsername ?? ""),
      specialty:
        values.specialty === "Other"
          ? values.otherSpecialty.trim()
          : values.specialty.trim(),
      location: values.location.trim(),
      referrerSlug: invitation?.routing_slug,
    };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(values);
    if (values.specialty !== "Other") delete nextErrors.otherSpecialty;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitError(null);
    setPendingPayload(buildPayload());
  }

  async function handleConfirmRegistration() {
    if (!pendingPayload) return;

    setSubmitting(true);
    try {
      const doctor = await registerDoctor(pendingPayload);
      setValues(INITIAL_VALUES);
      setErrors({});
      setPendingPayload(null);
      setSubmitting(false);
      onRegistered({ ...pendingPayload, id: doctor.id, registeredAt: Date.now() });
    } catch (error) {
      setSubmitting(false);
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("tiktok")) {
        setSubmitError("This TikTok username has already been registered. Please check the handle and try again.");
      } else {
        setSubmitError("Registration failed. Please try again or ask the booth coordinator.");
      }
    }
  }

  return (
    <section className={`screen ${active ? "active" : ""}`.trim()}>
      <SectionLabel number="i.">Booth Registration</SectionLabel>
      {invitation ? (
        <aside className="partner-invitation" role="status">
          <strong>Invited by {invitation.full_name}</strong>
          <span>Your registration and future attributed orders will be connected to this partner.</span>
        </aside>
      ) : invitationInvalid ? (
        <aside className="partner-invitation is-neutral" role="status">
          <strong>Invitation unavailable</strong>
          <span>You can continue with a regular GutGuard partner registration.</span>
        </aside>
      ) : null}
      <p className="lede dropcap">
        Lead Clinical Adopters are a closed cohort of one hundred Filipino physicians.
        Register here. Add your email if you would like the proposal delivered to your inbox.
      </p>

      <form noValidate onSubmit={handleSubmit}>
        <InputField
          id="fullName"
          label="Name"
          error="Please enter your full name."
          value={values.fullName}
          hasError={errors.fullName}
          onValueChange={handleValueChange}
          onFieldBlur={handleFieldBlur}
          type="text"
          placeholder="Dr. Maria Santos"
          required
          autoComplete="name"
        />
        <InputField
          id="email"
          label="Email"
          error="Please enter a valid email."
          value={values.email}
          hasError={errors.email}
          onValueChange={handleValueChange}
          onFieldBlur={handleFieldBlur}
          type="email"
          placeholder="you@clinic.com"
          autoComplete="email"
          inputMode="email"
        />
        <InputField
          id="mobile"
          label="Mobile"
          error="Please enter a valid PH mobile number."
          value={values.mobile}
          hasError={errors.mobile}
          onValueChange={handleValueChange}
          onFieldBlur={handleFieldBlur}
          type="tel"
          placeholder="09171234567"
          required
          autoComplete="tel"
          inputMode="tel"
        />
        <InputField
          id="tiktokUsername"
          label="TikTok username"
          error="Please enter a valid TikTok username."
          value={values.tiktokUsername}
          hasError={errors.tiktokUsername}
          onValueChange={handleValueChange}
          onFieldBlur={handleFieldBlur}
          type="text"
          placeholder="@gutguardph"
          required
          autoComplete="off"
          inputMode="text"
        />
        <SelectField
          id="specialty"
          label="Specialty"
          error="Please select your specialty."
          value={values.specialty}
          hasError={errors.specialty}
          options={SPECIALTIES}
          onValueChange={handleValueChange}
          onFieldBlur={handleFieldBlur}
          placeholder="Select your field"
          required
        />
        {values.specialty === "Other" ? (
          <InputField
            id="otherSpecialty"
            label="Other specialty"
            error="Please enter your specialty."
            value={values.otherSpecialty}
            hasError={errors.otherSpecialty}
            onValueChange={handleValueChange}
            onFieldBlur={handleFieldBlur}
            type="text"
            placeholder="Enter specialty"
            required
            autoComplete="off"
          />
        ) : null}
        <InputField
          id="location"
          label="Clinic location"
          error="Please enter your practice location."
          value={values.location}
          hasError={errors.location}
          onValueChange={handleValueChange}
          onFieldBlur={handleFieldBlur}
          type="text"
          placeholder="City or province"
          required
          autoComplete="address-level2"
        />

        <ActionButton
          type="submit"
          disabled={submitting}
          main={submitting ? "Registering…" : "Submit registration"}
          sub="Continue to verification"
          icon={<ArrowRightIcon />}
        />
      </form>

      <ConfirmRegistrationModal
        open={Boolean(pendingPayload)}
        payload={pendingPayload}
        submitting={submitting}
        error={submitError}
        onCancel={() => {
          setSubmitError(null);
          setPendingPayload(null);
        }}
        onConfirm={handleConfirmRegistration}
      />
    </section>
  );
}
