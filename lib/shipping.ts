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

const RATE_TABLE: Record<ShippingArea, Array<[number, number]>> = {
  mindanao: [
    [500, 90],
    [1000, 160],
    [3000, 185],
    [4000, 275],
    [5000, 365],
    [6000, 460],
  ],
  visayas: [
    [500, 110],
    [1000, 180],
    [3000, 200],
    [4000, 290],
    [5000, 380],
    [6000, 475],
  ],
  luzon: [
    [500, 110],
    [1000, 200],
    [3000, 220],
    [4000, 330],
    [5000, 440],
    [6000, 550],
  ],
  island: [
    [500, 120],
    [1000, 210],
    [3000, 235],
    [4000, 345],
    [5000, 455],
    [6000, 565],
  ],
};

const SHIPPING_LABELS: Record<ShippingArea, string> = {
  mindanao: "Mindanao",
  visayas: "Visayas",
  luzon: "Luzon / Metro Manila",
  island: "Island / remote",
};

const VISAYAS_REGION_CODES = new Set(["060000000", "070000000", "080000000", "170000000"]);
const MINDANAO_REGION_CODES = new Set(["090000000", "100000000", "110000000", "120000000", "150000000", "160000000", "190000000"]);
const ISLAND_PROVINCE_KEYWORDS = ["batanes", "palawan", "siquijor", "dinagat", "camiguin", "sulu", "tawi-tawi", "basilan"];

export function calculateShopSubtotal(items: ShopOrderItem[]) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

export function estimateShippingWeight(items: ShopOrderItem[]) {
  if (items.length === 0) return 0;
  const bottles = items.reduce((sum, item) => sum + Math.ceil(item.caps / CAPS_PER_BOTTLE) * item.qty, 0);
  return bottles * BOTTLE_WEIGHT_GRAMS + PACKAGING_BUFFER_GRAMS;
}

export function quoteShipping(items: ShopOrderItem[], input: { province: string; regionCode: string }): ShippingQuote {
  const weightGrams = estimateShippingWeight(items);
  const area = getShippingArea(input.province, input.regionCode);
  const fee = getShippingFee(area, weightGrams);

  // No province chosen yet - nothing to quote, and no error to show either.
  if (!input.province.trim()) {
    return { area, label: "", weightGrams, fee: 0, error: "" };
  }

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
 * Rates are keyed on the region, and PSGC codes carry it in their first two digits
 * ("1102400000" -> region 11 -> "110000000"). Checkout and the server both derive it here,
 * so they always agree on the area.
 */
export function psgcRegionCode(psgcCode: string) {
  const clean = psgcCode.trim();
  return /^\d{10}$/.test(clean) ? `${clean.slice(0, 2)}0000000` : "";
}

/**
 * The fee a stored order must carry, re-quoted from its PSGC province code and items - the
 * browser's figure is never trusted. Every order since the address lists became mandatory
 * (Aug 2026) has a province code, so one without it cannot be priced and gets null, as does
 * an order over the weight limit. Check the items against the catalog first: their capsule
 * counts set the weight.
 */
export function expectedShippingFee(items: ShopOrderItem[], order: { province: string; provinceCode: string | null }) {
  const regionCode = psgcRegionCode(order.provinceCode ?? "");
  if (!regionCode || !order.province.trim()) return null;
  const quote = quoteShipping(items, { province: order.province, regionCode });
  return quote.error || quote.fee <= 0 ? null : quote.fee;
}

function getShippingFee(area: ShippingArea, weightGrams: number) {
  const bracket = RATE_TABLE[area].find(([maxWeight]) => weightGrams <= maxWeight);
  return bracket?.[1] ?? 0;
}

function getShippingArea(province: string, regionCode: string): ShippingArea {
  const cleanProvince = province.trim().toLowerCase();
  if (ISLAND_PROVINCE_KEYWORDS.some((keyword) => cleanProvince.includes(keyword))) return "island";
  if (MINDANAO_REGION_CODES.has(regionCode)) return "mindanao";
  if (VISAYAS_REGION_CODES.has(regionCode)) return "visayas";
  return "luzon";
}
