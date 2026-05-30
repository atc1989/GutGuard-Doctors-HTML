export type FieldName =
  | "fullName"
  | "email"
  | "mobile"
  | "specialty"
  | "location";

export type FormValues = Record<FieldName, string>;
export type FieldErrors = Partial<Record<FieldName, boolean>>;

export function normalizeMobile(value: string) {
  return value.replace(/\s|-/g, "");
}

export function validateField(name: FieldName, value: string) {
  const trimmed = value.trim();

  if (name === "specialty") return true;
  if (!trimmed) return false;
  if (name === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  if (name === "mobile") return /^(09|\+639)\d{9}$/.test(normalizeMobile(trimmed));

  return true;
}

export function validateForm(values: FormValues) {
  return (Object.keys(values) as FieldName[]).reduce<FieldErrors>((errors, name) => {
    if (!validateField(name, values[name])) errors[name] = true;
    return errors;
  }, {});
}
