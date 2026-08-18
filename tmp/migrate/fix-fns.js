const fs = require("fs");
const path = require("path");
const outDir = "C:/Users/najee/Projects/GutGuard-Doctors-HTML/tmp/migrate";
const wrapped = JSON.parse(fs.readFileSync(path.join(outDir, "functions.json"), "utf8"));
const r = wrapped.result;
const fns = JSON.parse(r.slice(r.indexOf("["), r.lastIndexOf("]") + 1));

function rewriteDoctorsFn(def) {
  let s = def;
  s = s.replace(/CREATE OR REPLACE FUNCTION public\./g, "CREATE OR REPLACE FUNCTION doctors.");
  s = s.replace(/\bpublic\./g, "doctors.");
  s = s.replace(/SET search_path TO 'doctors'/g, "SET search_path TO 'doctors', 'public'");
  s = s.replace(/RETURNS SETOF shop_orders/g, "RETURNS SETOF doctors.shop_orders");
  s = s.replace(/\bdoctors\.auth\./g, "auth.");
  s = s.replace(/\bdoctors\.gen_random_uuid\(/g, "gen_random_uuid(");
  s = s.replace(/\bdoctors\.pg_advisory_xact_lock\(/g, "pg_advisory_xact_lock(");
  return s;
}

function rewriteSandboxFn(def) {
  let s = def;
  s = s.replaceAll("public.doctor_registrations", "doctors.doctor_registrations");
  s = s.replace(/\bpublic\.assert_wheel_admin\b/g, "doctors.assert_wheel_admin");
  s = s.replace(/SET search_path TO 'sandbox', 'public'/g, "SET search_path TO 'sandbox', 'doctors', 'public'");
  s = s.replace(/v_doctor public\.doctor_registrations/g, "v_doctor doctors.doctor_registrations");
  return s;
}

const parts = [];
for (const row of fns) {
  const isSandbox = (row.sig || "").startsWith("sandbox.") || /FUNCTION sandbox\./.test(row.def);
  parts.push(isSandbox ? rewriteSandboxFn(row.def) : rewriteDoctorsFn(row.def));
}
fs.writeFileSync(path.join(outDir, "02_functions.sql"), parts.join("\n\n"));
console.log("count", parts.length);
console.log(parts[0].slice(0, 420));
