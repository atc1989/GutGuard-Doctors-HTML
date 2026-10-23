import { psgcRegionCode } from "@/lib/shipping";

/**
 * Address lists are a snapshot of PSGC served from this site (public/psgc, built by
 * scripts/build-psgc.mjs), so checkout no longer breaks when psgc.cloud is down, rate-limited
 * or changes its data. Metro Manila is the pseudo-province 1300000000 (NCR has no provinces).
 */
const PSGC_BASE = "/psgc";

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

type ProvinceFile = {
  localities: Array<{ code: string; name: string; zipCode: string; barangays: Array<{ code: string; name: string }> }>;
};

// One file per province holds its cities and their barangays, so choosing a city or
// barangay after the province needs no further request.
const provinceFiles = new Map<string, Promise<ProvinceFile>>();

export async function fetchProvinces(): Promise<ProvinceOption[]> {
  const body = await getJson<{ provinces: Array<{ code: string; name: string }> }>("provinces.json");
  return body.provinces.map((province) => ({ ...province, regionCode: psgcRegionCode(province.code) }));
}

export async function fetchLocalities(provinceCode: string): Promise<LocalityOption[]> {
  const file = await loadProvince(provinceCode);
  return file.localities.map((locality) => ({
    code: locality.code,
    name: locality.name,
    provinceCode,
    regionCode: psgcRegionCode(provinceCode),
    zipCode: locality.zipCode,
  }));
}

export async function fetchBarangays(provinceCode: string, localityCode: string): Promise<BarangayOption[]> {
  const file = await loadProvince(provinceCode);
  const locality = file.localities.find((item) => item.code === localityCode);
  return (locality?.barangays ?? []).map((barangay) => ({ ...barangay, localityCode }));
}

function loadProvince(provinceCode: string) {
  if (!/^\d{10}$/.test(provinceCode)) return Promise.reject(new Error("Address list could not be loaded."));
  let file = provinceFiles.get(provinceCode);
  if (!file) {
    file = getJson<ProvinceFile>(`${provinceCode}.json`);
    // A failed load must not stick: the customer's retry should fetch again.
    file.catch(() => provinceFiles.delete(provinceCode));
    provinceFiles.set(provinceCode, file);
  }
  return file;
}

async function getJson<T>(fileName: string): Promise<T> {
  const response = await fetch(`${PSGC_BASE}/${fileName}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Address list could not be loaded.");
  return (await response.json()) as T;
}
