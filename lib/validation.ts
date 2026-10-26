export type FieldName =
  | "namePrefix"
  | "fullName"
  | "email"
  | "mobile"
  | "specialty"
  | "otherSpecialty"
  | "location"
  | "whereDidYouFindUs";

export type FormValues = Record<FieldName, string>;
export type FieldErrors = Partial<Record<FieldName, boolean>>;

export function normalizeMobile(value: string | undefined) {
  return (value ?? "").replace(/\s|-/g, "");
}

export function formatPrefixedName(prefix?: string | null, fullName?: string | null) {
  const name = (fullName ?? "").trim();
  if (!name) return "";
  return `${(prefix || "Dr.").trim()} ${name}`;
}

export function validateField(name: FieldName, value: string | undefined, optionalFields: FieldName[] = []) {
  const trimmed = (value ?? "").trim();

  // Where did you find us is optional everywhere.
  if (name === "whereDidYouFindUs" && !trimmed) return true;
  if (optionalFields.includes(name) && !trimmed) return true;
  if (!trimmed) return false;
  if (name === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  if (name === "mobile") return /^(09|\+639)\d{9}$/.test(normalizeMobile(trimmed));

  return true;
}

export function validateForm(values: FormValues, optionalFields: FieldName[] = []) {
  return (Object.keys(values) as FieldName[]).reduce<FieldErrors>((errors, name) => {
    if (!validateField(name, values[name], optionalFields)) errors[name] = true;
    return errors;
  }, {});
}
