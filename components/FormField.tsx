import type { ChangeEvent, FocusEvent, InputHTMLAttributes } from "react";
import type { FieldName } from "@/lib/validation";

type BaseProps = {
  id: FieldName;
  label: string;
  error: string;
  value: string;
  hasError?: boolean;
  onValueChange: (name: FieldName, value: string) => void;
  onFieldBlur: (name: FieldName) => void;
};

type InputFieldProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "name" | "value" | "onChange" | "onBlur">;

export function InputField({
  id,
  label,
  error,
  value,
  hasError,
  onValueChange,
  onFieldBlur,
  ...props
}: InputFieldProps) {
  return (
    <div className={`field ${hasError ? "has-error" : ""}`.trim()}>
      <div className="field-row">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <input
          className="field-input"
          id={id}
          name={id}
          value={value ?? ""}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onValueChange(id, event.target.value)
          }
          onBlur={(event: FocusEvent<HTMLInputElement>) => {
            if (event.target.value) onFieldBlur(id);
          }}
          {...props}
        />
      </div>
      <div className="field-err">{error}</div>
    </div>
  );
}

type SelectFieldProps = BaseProps & {
  options: string[];
  placeholder?: string;
  required?: boolean;
};

export function SelectField({
  id,
  label,
  error,
  value,
  hasError,
  options,
  placeholder = "Select your field",
  onValueChange,
  onFieldBlur,
  required,
}: SelectFieldProps) {
  return (
    <div className={`field ${hasError ? "has-error" : ""}`.trim()}>
      <div className="field-row">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <select
          className="field-input"
          id={id}
          name={id}
          value={value ?? ""}
          onChange={(event) => onValueChange(id, event.target.value)}
          onBlur={() => onFieldBlur(id)}
          required={required}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </div>
      <div className="field-err">{error}</div>
    </div>
  );
}
