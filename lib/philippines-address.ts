const PSGC_API_BASE = "https://psgc.cloud/api";

/**
 * psgc.cloud stopped returning region_code, and shipping rates depend on the region.
 * PSGC codes encode it in the first two digits ("1102400000" -> region 11 -> "110000000"),
 * so derive it rather than trusting a field the API may drop again.
 */
function toRegionCode(psgcCode: string) {
  const clean = psgcCode.replace(/\D/g, "");
  return clean.length >= 2 ? `${clean.slice(0, 2)}0000000` : "";
}

type PsgcApiItem = {
  code?: string;
  name?: string;
  region_code?: string;
  province_code?: string;
  city_municipality_code?: string;
  is_city?: boolean;
  is_municipality?: boolean;
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
  return items
    .map((item) => ({
      code: String(item.code ?? ""),
      name: String(item.name ?? ""),
      regionCode: String(item.region_code ?? "") || toRegionCode(String(item.code ?? "")),
    }))
    .filter((item) => item.code && item.name)
    .sort(sortByName);
}

export async function fetchLocalities(provinceCode: string): Promise<LocalityOption[]> {
  const items = await fetchPsgcItems(`/provinces/${encodeURIComponent(provinceCode)}/cities-municipalities`);
  return items
    .map((item) => ({
      code: String(item.code ?? ""),
      name: String(item.name ?? ""),
      provinceCode,
      regionCode: String(item.region_code ?? "") || toRegionCode(provinceCode),
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
      name: String(item.name ?? ""),
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

function sortByName<T extends { name: string }>(first: T, second: T) {
  return first.name.localeCompare(second.name);
}
