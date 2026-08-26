export type FieldName =
  | "namePrefix"
  | "fullName"
  | "email"
  | "mobile"
  | "tiktokUsername"
  | "specialty"
  | "otherSpecialty"
  | "location";

export type FormValues = Record<FieldName, string>;
export type FieldErrors = Partial<Record<FieldName, boolean>>;

export function normalizeMobile(value: string | undefined) {
  return (value ?? "").replace(/\s|-/g, "");
}

export function normalizeTikTokUsername(value: string | undefined) {
  return (value ?? "").trim().replace(/^@+/, "").toLowerCase();
}

export function formatPrefixedName(prefix?: string | null, fullName?: string | null) {
  const name = (fullName ?? "").trim();
  if (!name) return "";
  return `${(prefix || "Dr.").trim()} ${name}`;
}

export function validateField(name: FieldName, value: string | undefined) {
  const trimmed = (value ?? "").trim();

  if ((name === "email" || name === "specialty") && !trimmed) return true;
  if (!trimmed) return false;
  if (name === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  if (name === "mobile") return /^(09|\+639)\d{9}$/.test(normalizeMobile(trimmed));
  if (name === "tiktokUsername") return /^[A-Za-z0-9._]{2,24}$/.test(normalizeTikTokUsername(trimmed));

  return true;
}

export function validateForm(values: FormValues) {
  return (Object.keys(values) as FieldName[]).reduce<FieldErrors>((errors, name) => {
    if (!validateField(name, values[name])) errors[name] = true;
    return errors;
  }, {});
}
