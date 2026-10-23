// Snapshot the Philippine address lists (PSGC) into public/psgc so checkout never depends on
// psgc.cloud at runtime. Re-run when PSA publishes a new PSGC release (quarterly):
//   npm run psgc:build
// Writes public/psgc/provinces.json plus one <provinceCode>.json per province holding its
// cities/municipalities and their barangays. Refuses to write if the API returns too little.
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://psgc.cloud/api";
const OUT_DIR = path.join(process.cwd(), "public", "psgc");

// NCR has no provinces in PSGC - its cities hang directly off the region - so offer the
// region as a pseudo-province. Must match the code the server prices from.
const NCR_CODE = "1300000000";
const NCR_NAME = "Metro Manila (NCR)";

// Sanity floors: PSGC has ~82 provinces, ~1,640 cities/municipalities, ~42,000 barangays.
const MIN_PROVINCES = 80;
const MIN_LOCALITIES = 1600;
const MIN_BARANGAYS = 41000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// psgc.cloud rate-limits (429) hard, so keep concurrency low and honour Retry-After.
async function get(apiPath, attempt = 1) {
  let waitMs = Math.min(60_000, 2000 * 2 ** attempt);
  try {
    const response = await fetch(`${API}${apiPath}`, { headers: { Accept: "application/json" } });
    if (response.status === 429) waitMs = Math.max(waitMs, Number(response.headers.get("retry-after")) * 1000 || 0);
    if (!response.ok) throw new Error(`${response.status} ${apiPath}`);
    const body = await response.json();
    return Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
  } catch (error) {
    if (attempt >= 8) throw error;
    await sleep(waitMs);
    return get(apiPath, attempt + 1);
  }
}

/** psgc.cloud double-encodes some names ("Las PiÃ±as"); re-decode UTF-8 bytes read as Latin-1. */
function cleanName(raw) {
  const value = String(raw ?? "").trim();
  if (!/[ÃÂ]/.test(value) || /[^\u0000-ÿ]/.test(value)) return value;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(value, (char) => char.charCodeAt(0)));
  } catch {
    return value;
  }
}

/**
 * City of Manila has no barangays of its own - they sit under its districts (SubMun), e.g.
 * "Tondo I/II". Replace a city that has districts with the districts, named after the city.
 */
function withSubMunicipalities(items) {
  const subMuns = items.filter((item) => item.type === "SubMun");
  if (subMuns.length === 0) return items;

  const parentPrefix = (code) => String(code ?? "").slice(0, 5);
  const parentNames = new Map(items.filter((item) => item.type !== "SubMun").map((item) => [parentPrefix(item.code), item.name]));
  const splitParents = new Set(subMuns.map((item) => parentPrefix(item.code)));

  return items
    .filter((item) => item.type === "SubMun" || !splitParents.has(parentPrefix(item.code)))
    .map((item) => {
      const parentName = item.type === "SubMun" ? parentNames.get(parentPrefix(item.code)) : "";
      return parentName ? { ...item, name: `${cleanName(parentName)} - ${cleanName(item.name)}` } : item;
    });
}

function cleanZip(raw, provinceCode) {
  const zip = String(raw ?? "").replace(/\D/g, "").slice(0, 4);
  if (zip.length !== 4) return "";
  // psgc.cloud has Mindanao ZIPs on some Manila districts (San Nicolas = 9503). NCR ZIPs are
  // 0400-1899; leave a bad one blank for the buyer to type rather than prefill it wrong.
  if (provinceCode === NCR_CODE && Number(zip) >= 1900) return "";
  return zip;
}

const byName = (first, second) => first.name.localeCompare(second.name);

async function mapLimit(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await task(items[index]);
      }
    }),
  );
  return results;
}

async function buildProvince(province) {
  const listPath =
    province.code === NCR_CODE ? `/regions/${NCR_CODE}/cities-municipalities` : `/provinces/${province.code}/cities-municipalities`;
  // psgc.cloud lists Metro Manila's cities under Sarangani too. Independent cities (Cebu City
  // under Cebu) keep the region digits, so filter on region, not province digits.
  const regionPrefix = province.code.slice(0, 2);
  const items = withSubMunicipalities(await get(listPath)).filter((item) => String(item.code ?? "").startsWith(regionPrefix));

  const localities = await mapLimit(items, 3, async (item) => {
    const code = String(item.code);
    const barangays = (await get(`/cities-municipalities/${code}/barangays`))
      .map((barangay) => ({ code: String(barangay.code ?? ""), name: cleanName(barangay.name) }))
      .filter((barangay) => barangay.code && barangay.name)
      .sort(byName);
    return { code, name: cleanName(item.name), zipCode: cleanZip(item.zip_code, province.code), barangays };
  });

  return localities.filter((locality) => locality.name).sort(byName);
}

async function main() {
  const provinces = (await get("/provinces"))
    .map((item) => ({ code: String(item.code ?? ""), name: cleanName(item.name) }))
    .filter((item) => /^\d{10}$/.test(item.code) && item.name);
  provinces.push({ code: NCR_CODE, name: NCR_NAME });
  provinces.sort(byName);

  const built = await mapLimit(provinces, 1, async (province) => {
    const localities = await buildProvince(province);
    process.stdout.write(".");
    return { province, localities };
  });
  process.stdout.write("\n");

  const localityCount = built.reduce((sum, entry) => sum + entry.localities.length, 0);
  const barangayCount = built.reduce((sum, entry) => sum + entry.localities.reduce((n, l) => n + l.barangays.length, 0), 0);
  const empty = built.flatMap((entry) => entry.localities.filter((l) => l.barangays.length === 0).map((l) => `${entry.province.name}/${l.name}`));
  const ncr = built.find((entry) => entry.province.code === NCR_CODE);

  const problems = [];
  if (provinces.length < MIN_PROVINCES) problems.push(`only ${provinces.length} provinces`);
  if (localityCount < MIN_LOCALITIES) problems.push(`only ${localityCount} cities/municipalities`);
  if (barangayCount < MIN_BARANGAYS) problems.push(`only ${barangayCount} barangays`);
  if (!ncr || ncr.localities.length < 17) problems.push("Metro Manila is missing cities");
  if (empty.length) problems.push(`no barangays for: ${empty.join(", ")}`);
  if (problems.length) {
    console.error(`Refusing to write public/psgc: ${problems.join("; ")}`);
    process.exit(1);
  }

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUT_DIR, "provinces.json"),
    JSON.stringify({ source: API, fetchedAt: new Date().toISOString().slice(0, 10), provinces }),
  );
  for (const { province, localities } of built) {
    await writeFile(path.join(OUT_DIR, `${province.code}.json`), JSON.stringify({ localities }));
  }

  console.log(`Wrote ${provinces.length} provinces, ${localityCount} cities/municipalities, ${barangayCount} barangays.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
