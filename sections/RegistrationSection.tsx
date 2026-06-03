"use client";

import { useState } from "react";
import ActionButton from "@/components/ActionButton";
import ConfirmRegistrationModal from "@/components/ConfirmRegistrationModal";
import { ArrowRightIcon } from "@/components/Icons";
import { InputField, SelectField } from "@/components/FormField";
import SectionLabel from "@/components/SectionLabel";
import { SPECIALTIES } from "@/lib/constants";
import { registerDoctor, sendProposalEmail } from "@/lib/api";
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
};

const INITIAL_VALUES: FormValues = {
  fullName: "",
  email: "",
  mobile: "",
  tiktokUsername: "",
  specialty: "",
  location: "",
};

export default function RegistrationSection({
  active,
  onRegistered,
}: RegistrationSectionProps) {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<RegistrationPayload | null>(null);

  function handleValueChange(name: FieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
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
      specialty: values.specialty.trim(),
      location: values.location.trim(),
    };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPendingPayload(buildPayload());
  }

  async function handleConfirmRegistration() {
    if (!pendingPayload) return;

    setSubmitting(true);
    try {
      const doctor = await registerDoctor(pendingPayload);
      if (pendingPayload.email) {
        try {
          await sendProposalEmail(doctor.id);
        } catch {
          window.alert(
            "Registration saved, but the proposal email could not be sent. Please ask the booth coordinator to resend it.",
          );
        }
      }
      setValues(INITIAL_VALUES);
      setErrors({});
      setPendingPayload(null);
      setSubmitting(false);
      onRegistered({ ...pendingPayload, id: doctor.id, registeredAt: Date.now() });
    } catch (error) {
      setSubmitting(false);
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("tiktok")) {
        window.alert("This TikTok username has already been registered. Please check the handle and try again.");
      } else {
        window.alert("Registration failed. Please try again or ask the booth coordinator.");
      }
    }
  }

  return (
    <section className={`screen ${active ? "active" : ""}`.trim()}>
      <SectionLabel number="i.">Booth Registration</SectionLabel>
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
          label="Specialty (optional)"
          error="Please select your specialty."
          value={values.specialty}
          hasError={errors.specialty}
          options={SPECIALTIES}
          onValueChange={handleValueChange}
          onFieldBlur={handleFieldBlur}
        />
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
        onCancel={() => setPendingPayload(null)}
        onConfirm={handleConfirmRegistration}
      />
    </section>
  );
}
