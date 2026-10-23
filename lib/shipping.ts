import type { ShopOrderItem } from "@/lib/api";

export type ShippingArea = "mindanao" | "visayas" | "luzon" | "island";

export type ShippingQuote = {
  area: ShippingArea;
  label: string;
  weightGrams: number;
  fee: number;
  error: string;
};

const PACKAGING_BUFFER_GRAMS = 100;
const BOTTLE_WEIGHT_GRAMS = 50;
const CAPS_PER_BOTTLE = 30;

// J&T Express public rates from Davao City (jtexpress.ph "Shipping Rates", EZ service), plus
// ₱5 per parcel for packaging. Collected 2026-10-23; J&T's brackets are these same weights.
// J&T base:   mindanao 85/155/180/270/360/435   visayas 105/175/195/285/370/435
//             luzon    105/195/215/325/370/435   island  115/185/205/295/380/445
const HANDLING_FEE = 5;
const JNT_RATES: Record<ShippingArea, number[]> = {
  mindanao: [85, 155, 180, 270, 360, 435],
  visayas: [105, 175, 195, 285, 370, 435],
  luzon: [105, 195, 215, 325, 370, 435],
  island: [115, 185, 205, 295, 380, 445],
};
const WEIGHT_BRACKETS_GRAMS = [500, 1000, 3000, 4000, 5000, 6000];

const SHIPPING_LABELS: Record<ShippingArea, string> = {
  mindanao: "Mindanao",
  visayas: "Visayas",
  luzon: "Luzon / Metro Manila",
  island: "Island / remote",
};

/**
 * J&T's own zone for each checkout province (PSGC code; Metro Manila is the NCR pseudo-province).
 * Taken from J&T's calculator by sampling towns per province. J&T marks a few individual towns
 * as island inside otherwise mainland provinces (e.g. Biri, Northern Samar); those use their
 * province's zone - at most ₱10 off J&T, not worth pricing per town.
 */
const JNT_ZONE_BY_PROVINCE: Record<string, ShippingArea> = {
  "1400100000": "luzon", // Abra
  "1600200000": "mindanao", // Agusan del Norte
  "1600300000": "mindanao", // Agusan del Sur
  "0600400000": "visayas", // Aklan
  "0500500000": "luzon", // Albay
  "0600600000": "visayas", // Antique
  "1408100000": "island", // Apayao
  "0307700000": "luzon", // Aurora
  "1900700000": "island", // Basilan
  "0300800000": "luzon", // Bataan
  "0200900000": "island", // Batanes
  "0401000000": "luzon", // Batangas
  "1401100000": "luzon", // Benguet
  "0807800000": "visayas", // Biliran
  "0701200000": "visayas", // Bohol
  "1001300000": "mindanao", // Bukidnon
  "0301400000": "luzon", // Bulacan
  "0201500000": "luzon", // Cagayan
  "0501600000": "luzon", // Camarines Norte
  "0501700000": "luzon", // Camarines Sur
  "1001800000": "island", // Camiguin
  "0601900000": "visayas", // Capiz
  "0502000000": "luzon", // Catanduanes
  "0402100000": "luzon", // Cavite
  "0702200000": "visayas", // Cebu
  "1204700000": "mindanao", // Cotabato
  "1108600000": "mindanao", // Davao Occidental
  "1102500000": "mindanao", // Davao Oriental
  "1108200000": "mindanao", // Davao de Oro
  "1102300000": "mindanao", // Davao del Norte
  "1102400000": "mindanao", // Davao del Sur
  "1608500000": "island", // Dinagat Islands
  "0802600000": "visayas", // Eastern Samar
  "0607900000": "island", // Guimaras
  "1402700000": "luzon", // Ifugao
  "0102800000": "luzon", // Ilocos Norte
  "0102900000": "luzon", // Ilocos Sur
  "0603000000": "visayas", // Iloilo
  "0203100000": "luzon", // Isabela
  "1403200000": "luzon", // Kalinga
  "0103300000": "luzon", // La Union
  "0403400000": "luzon", // Laguna
  "1003500000": "mindanao", // Lanao del Norte
  "1903600000": "mindanao", // Lanao del Sur
  "0803700000": "visayas", // Leyte
  "1908700000": "mindanao", // Maguindanao del Norte
  "1908800000": "mindanao", // Maguindanao del Sur
  "1704000000": "luzon", // Marinduque
  "0504100000": "luzon", // Masbate
  "1300000000": "luzon", // Metro Manila (NCR)
  "1004200000": "mindanao", // Misamis Occidental
  "1004300000": "mindanao", // Misamis Oriental
  "1404400000": "island", // Mountain Province
  "0604500000": "visayas", // Negros Occidental
  "0704600000": "visayas", // Negros Oriental
  "0804800000": "visayas", // Northern Samar
  "0304900000": "luzon", // Nueva Ecija
  "0205000000": "luzon", // Nueva Vizcaya
  "1705100000": "luzon", // Occidental Mindoro
  "1705200000": "luzon", // Oriental Mindoro
  "1705300000": "visayas", // Palawan
  "0305400000": "luzon", // Pampanga
  "0105500000": "luzon", // Pangasinan
  "0405600000": "luzon", // Quezon
  "0205700000": "luzon", // Quirino
  "0405800000": "luzon", // Rizal
  "1705900000": "island", // Romblon
  "0806000000": "visayas", // Samar
  "1208000000": "mindanao", // Sarangani
  "0706100000": "island", // Siquijor
  "0506200000": "luzon", // Sorsogon
  "1206300000": "mindanao", // South Cotabato
  "0806400000": "visayas", // Southern Leyte
  "1206500000": "mindanao", // Sultan Kudarat
  "1906600000": "island", // Sulu
  "1606700000": "mindanao", // Surigao del Norte
  "1606800000": "mindanao", // Surigao del Sur
  "0306900000": "luzon", // Tarlac
  "1907000000": "island", // Tawi-Tawi
  "0307100000": "luzon", // Zambales
  "0908300000": "mindanao", // Zamboanga Sibugay
  "0907200000": "mindanao", // Zamboanga del Norte
  "0907300000": "mindanao", // Zamboanga del Sur
};

export function calculateShopSubtotal(items: ShopOrderItem[]) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

export function estimateShippingWeight(items: ShopOrderItem[]) {
  if (items.length === 0) return 0;
  const bottles = items.reduce((sum, item) => sum + Math.ceil(item.caps / CAPS_PER_BOTTLE) * item.qty, 0);
  return bottles * BOTTLE_WEIGHT_GRAMS + PACKAGING_BUFFER_GRAMS;
}

export function quoteShipping(items: ShopOrderItem[], input: { provinceCode: string }): ShippingQuote {
  const weightGrams = estimateShippingWeight(items);

  // No province chosen yet - nothing to quote, and no error to show either.
  if (!input.provinceCode.trim()) {
    return { area: "luzon", label: "", weightGrams, fee: 0, error: "" };
  }

  const area = JNT_ZONE_BY_PROVINCE[input.provinceCode];
  if (!area) {
    return { area: "luzon", label: "", weightGrams, fee: 0, error: "We can't price shipping to this province. Please contact admin." };
  }

  const fee = getShippingFee(area, weightGrams);
  if (!fee) {
    return {
      area,
      label: SHIPPING_LABELS[area],
      weightGrams,
      fee: 0,
      error: "This order is above 6kg. Please contact admin before payment.",
    };
  }

  return { area, label: SHIPPING_LABELS[area], weightGrams, fee, error: "" };
}

export function getOrderTotal(subtotal: number, shippingFee: number) {
  return subtotal + shippingFee;
}

/**
 * The fee a stored order must carry, re-quoted from its PSGC province code and items - the
 * browser's figure is never trusted. Every order since the address lists became mandatory
 * (Aug 2026) has a province code, so one without it cannot be priced and gets null, as does
 * an unknown province or an order over the weight limit. Check the items against the catalog
 * first: their capsule counts set the weight.
 */
export function expectedShippingFee(items: ShopOrderItem[], order: { provinceCode: string | null }) {
  const quote = quoteShipping(items, { provinceCode: order.provinceCode ?? "" });
  return quote.error || quote.fee <= 0 ? null : quote.fee;
}

/** J&T zone for a province code; tests hold the address snapshot to it. */
export function shippingZoneFor(provinceCode: string): ShippingArea | undefined {
  return JNT_ZONE_BY_PROVINCE[provinceCode];
}

function getShippingFee(area: ShippingArea, weightGrams: number) {
  const bracket = WEIGHT_BRACKETS_GRAMS.findIndex((maxWeight) => weightGrams <= maxWeight);
  return bracket === -1 ? 0 : JNT_RATES[area][bracket] + HANDLING_FEE;
}
