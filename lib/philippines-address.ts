import { psgcRegionCode } from "@/lib/shipping";

const PSGC_API_BASE = "https://psgc.cloud/api";

/**
 * NCR has no provinces in PSGC - its cities hang directly off the region - so /provinces
 * never lists it. Offer the region as a pseudo-province and load its cities from the region.
 */
const NCR_REGION_PSGC_CODE = "1300000000";
const NCR_PROVINCE_OPTION_NAME = "Metro Manila (NCR)";

type PsgcApiItem = {
  code?: string;
  name?: string;
  province_code?: string;
  city_municipality_code?: string;
  is_city?: boolean;
  is_municipality?: boolean;
  type?: string;
  zip_code?: string | number | null;
};

export type ProvinceOption = {
  code: string;
  name: string;
  regionCode: string;
};

export type LocalityOption = {
  code: string;
  name: string;
  provinceCode: string;
  regionCode: string;
  zipCode: string;
};

export type BarangayOption = {
  code: string;
  name: string;
  localityCode: string;
};

export async function fetchProvinces(): Promise<ProvinceOption[]> {
  const items = await fetchPsgcItems("/provinces");
  const provinces = items
    .map((item) => ({
      code: String(item.code ?? ""),
      name: fixMojibake(String(item.name ?? "")),
      regionCode: psgcRegionCode(String(item.code ?? "")),
    }))
    .filter((item) => item.code && item.name);
  provinces.push({ code: NCR_REGION_PSGC_CODE, name: NCR_PROVINCE_OPTION_NAME, regionCode: psgcRegionCode(NCR_REGION_PSGC_CODE) });
  return provinces.sort(sortByName);
}

export async function fetchLocalities(provinceCode: string): Promise<LocalityOption[]> {
  const path =
    provinceCode === NCR_REGION_PSGC_CODE
      ? `/regions/${NCR_REGION_PSGC_CODE}/cities-municipalities`
      : `/provinces/${encodeURIComponent(provinceCode)}/cities-municipalities`;
  // psgc.cloud lists Metro Manila's cities under Sarangani too; picking one there quoted
  // Mindanao shipping. Independent cities (Cebu City under Cebu) keep the region digits.
  const regionPrefix = provinceCode.slice(0, 2);
  const items = withSubMunicipalities(await fetchPsgcItems(path)).filter((item) =>
    String(item.code ?? "").startsWith(regionPrefix),
  );
  return items
    .map((item) => ({
      code: String(item.code ?? ""),
      name: fixMojibake(String(item.name ?? "")),
      provinceCode,
      regionCode: psgcRegionCode(provinceCode),
      zipCode: item.zip_code ? String(item.zip_code).replace(/\D/g, "").slice(0, 4) : "",
    }))
    .filter((item) => item.code && item.name)
    .sort(sortByName);
}

export async function fetchBarangays(localityCode: string): Promise<BarangayOption[]> {
  const items = await fetchPsgcItems(`/cities-municipalities/${encodeURIComponent(localityCode)}/barangays`);
  return items
    .map((item) => ({
      code: String(item.code ?? ""),
      name: fixMojibake(String(item.name ?? "")),
      localityCode,
    }))
    .filter((item) => item.code && item.name)
    .sort(sortByName);
}

async function fetchPsgcItems(path: string): Promise<PsgcApiItem[]> {
  const response = await fetch(`${PSGC_API_BASE}${path}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Address list could not be loaded.");

  const body = await response.json();
  if (Array.isArray(body)) return body as PsgcApiItem[];
  if (body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)) {
    return (body as { data: PsgcApiItem[] }).data;
  }

  return [];
}

/**
 * City of Manila has no barangays of its own - they sit under its districts (SubMun), e.g.
 * "Tondo I/II". Replace a city that has districts with the districts, named after the city.
 */
function withSubMunicipalities(items: PsgcApiItem[]) {
  const subMuns = items.filter((item) => item.type === "SubMun");
  if (subMuns.length === 0) return items;

  const parentPrefix = (code: string | undefined) => String(code ?? "").slice(0, 5);
  const parentNames = new Map(
    items.filter((item) => item.type !== "SubMun").map((item) => [parentPrefix(item.code), String(item.name ?? "")]),
  );
  const splitParents = new Set(subMuns.map((item) => parentPrefix(item.code)));

  return items
    .filter((item) => item.type === "SubMun" || !splitParents.has(parentPrefix(item.code)))
    .map((item) => {
      const parentName = item.type === "SubMun" ? parentNames.get(parentPrefix(item.code)) : "";
      return parentName ? { ...item, name: `${parentName} - ${item.name ?? ""}` } : item;
    });
}

/** psgc.cloud double-encodes some names ("Las PiÃ±as"); re-decode UTF-8 bytes read as Latin-1. */
function fixMojibake(raw: string) {
  const value = raw.trim();
  if (!/[ÃÂ]/.test(value) || /[^\u0000-\u00ff]/.test(value)) return value;
  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return value;
  }
}

function sortByName<T extends { name: string }>(first: T, second: T) {
  return first.name.localeCompare(second.name);
}
