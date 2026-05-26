import ActionButton from "@/components/ActionButton";
import { ArrowRightIcon } from "@/components/Icons";
import type { RegistrationPayload } from "@/lib/types";

type ConfirmRegistrationModalProps = {
  open: boolean;
  payload: RegistrationPayload | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const REVIEW_FIELDS: Array<{
  label: string;
  key: keyof RegistrationPayload;
}> = [
  { label: "Name", key: "fullName" },
  { label: "Email", key: "email" },
  { label: "Mobile", key: "mobile" },
  { label: "Specialty", key: "specialty" },
  { label: "Practice", key: "location" },
];

export default function ConfirmRegistrationModal({
  open,
  payload,
  submitting,
  onCancel,
  onConfirm,
}: ConfirmRegistrationModalProps) {
  if (!open || !payload) return null;

  return (
    <div className="modal-shell" role="presentation">
      <div className="modal-backdrop" onClick={submitting ? undefined : onCancel} />
      <div
        aria-labelledby="confirm-registration-title"
        aria-modal="true"
        className="confirm-modal"
        role="dialog"
      >
        <p className="section-label" id="confirm-registration-title">
          Confirm Registration
        </p>
        <p className="confirm-modal-copy">
          Please confirm these details are correct before we save the registration and
          send the onboarding documents.
        </p>

        <dl className="confirm-list">
          {REVIEW_FIELDS.map((field) => (
            <div className="confirm-row" key={field.key}>
              <dt>{field.label}</dt>
              <dd>{payload[field.key]}</dd>
            </div>
          ))}
        </dl>

        <div className="confirm-actions">
          <button
            className="confirm-secondary"
            disabled={submitting}
            onClick={onCancel}
            type="button"
          >
            Edit details
          </button>
          <ActionButton
            className="confirm-primary"
            disabled={submitting}
            icon={<ArrowRightIcon />}
            main={submitting ? "Registering..." : "Confirm and register"}
            onClick={onConfirm}
            sub="Send documents"
            type="button"
          />
        </div>
      </div>
    </div>
  );
}
