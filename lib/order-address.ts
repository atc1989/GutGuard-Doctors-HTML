import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Server-side check that an order's address is one real PSGC place. Shipping is priced from
 * province_code, but the parcel goes to the province/city/barangay names - all written by the
 * browser. Requiring the codes to nest and the names to match them means a faked cheaper
 * province code can only ship the parcel to that cheaper province.
 * Reads the same snapshot checkout uses (public/psgc, traced into the route via next.config).
 */

export type OrderAddress = {
  province: string;
  province_code: string | null;
  city: string;
  city_municipality_code: string | null;
  barangay: string | null;
  barangay_code: string | null;
};

type ProvincesFile = { provinces: Array<{ code: string; name: string }> };
type ProvinceFile = { localities: Array<{ code: string; name: string; barangays: Array<{ code: string; name: string }> }> };

const PSGC_DIR = path.join(process.cwd(), "public", "psgc");
const PSGC_CODE = /^\d{10}$/;

/** "" when the address checks out, else why not (for the server log, never shown to buyers). */
export function checkOrderAddress(order: OrderAddress, provinces: ProvincesFile, provinceFile: ProvinceFile | null) {
  const province = provinces.provinces.find((item) => item.code === order.province_code);
  if (!province || !provinceFile) return `unknown province code ${order.province_code}`;
  if (!sameName(order.province, province.name)) return `province "${order.province}" is not ${province.name}`;

  const locality = provinceFile.localities.find((item) => item.code === order.city_municipality_code);
  if (!locality) return `city code ${order.city_municipality_code} is not in ${province.name}`;
  if (!sameName(order.city, locality.name)) return `city "${order.city}" is not ${locality.name}`;

  const barangay = locality.barangays.find((item) => item.code === order.barangay_code);
  if (!barangay) return `barangay code ${order.barangay_code} is not in ${locality.name}`;
  if (!sameName(order.barangay ?? "", barangay.name)) return `barangay "${order.barangay}" is not ${barangay.name}`;

  return "";
}

let provincesFile: Promise<ProvincesFile> | null = null;

/**
 * Like checkOrderAddress, loading the snapshot from disk. If the snapshot itself cannot be
 * read (a deploy that left public/psgc out), the check is skipped with an error log: blocking
 * every payment costs far more than the ₱20-90 a faked province code could save.
 */
export async function verifyOrderAddress(order: OrderAddress) {
  if (!PSGC_CODE.test(order.province_code ?? "")) return `bad province code ${order.province_code}`;
  try {
    provincesFile ??= readJson<ProvincesFile>("provinces.json");
    const provinces = await provincesFile;
    if (!provinces.provinces.some((item) => item.code === order.province_code)) return `unknown province code ${order.province_code}`;
    return checkOrderAddress(order, provinces, await readJson<ProvinceFile>(`${order.province_code}.json`));
  } catch (error) {
    provincesFile = null;
    console.error("PSGC snapshot unreadable - address check skipped", error);
    return "";
  }
}

async function readJson<T>(fileName: string): Promise<T> {
  return JSON.parse(await readFile(path.join(PSGC_DIR, fileName), "utf8")) as T;
}

/**
 * Orders placed before the snapshot (Oct 2026) stored psgc.cloud's names, which could carry
 * stray spaces or double-encoded letters ("Las PiÃ±as"), so compare repaired, case-folded names.
 */
function sameName(stored: string, official: string) {
  return normalizeName(stored) === normalizeName(official);
}

function normalizeName(raw: string) {
  let value = raw.trim().replace(/\s+/g, " ");
  if (/[ÃÂ]/.test(value) && !/[^\u0000-ÿ]/.test(value)) {
    try {
      value = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(value, (char) => char.charCodeAt(0)));
    } catch {
      // Not double-encoded after all; compare as typed.
    }
  }
  return value.normalize("NFC").toLowerCase();
}
