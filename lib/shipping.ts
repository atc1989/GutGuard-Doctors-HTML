import type { ShopOrderItem } from "@/lib/api";

export type ShippingArea = "mindanao" | "visayas" | "luzon" | "island";

export type ShippingQuote = {
  area: ShippingArea;
  label: string;
  weightGrams: number;
  fee: number;
  manualReview: boolean;
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
const MINDANAO_REGION_CODES = new Set(["090000000", "100000000", "110000000", "120000000", "130000000", "140000000", "150000000", "160000000", "190000000"]);
const ISLAND_PROVINCE_KEYWORDS = ["batanes", "palawan", "siquijor", "dinagat", "camiguin", "sulu", "tawi-tawi", "basilan"];

export function calculateShopSubtotal(items: ShopOrderItem[]) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

export function estimateShippingWeight(items: ShopOrderItem[]) {
  if (items.length === 0) return 0;
  const bottles = items.reduce((sum, item) => sum + Math.ceil(item.caps / CAPS_PER_BOTTLE) * item.qty, 0);
  return bottles * BOTTLE_WEIGHT_GRAMS + PACKAGING_BUFFER_GRAMS;
}

export function quoteShipping(items: ShopOrderItem[], input: { province: string; regionCode: string; manualAddress: boolean }): ShippingQuote {
  const weightGrams = estimateShippingWeight(items);
  const area = getShippingArea(input.province, input.regionCode);
  const fee = getShippingFee(area, weightGrams);

  if (!input.province.trim() && !input.manualAddress) {
    return {
      area,
      label: "",
      weightGrams,
      fee: 0,
      manualReview: false,
      error: "",
    };
  }

  if (input.manualAddress) {
    return {
      area,
      label: "Manual review",
      weightGrams,
      fee: 0,
      manualReview: true,
      error: "",
    };
  }

  if (!fee) {
    return {
      area,
      label: SHIPPING_LABELS[area],
      weightGrams,
      fee: 0,
      manualReview: false,
      error: "This order is above 6kg. Please contact admin before payment.",
    };
  }

  return {
    area,
    label: SHIPPING_LABELS[area],
    weightGrams,
    fee,
    manualReview: false,
    error: "",
  };
}

export function getOrderTotal(subtotal: number, shippingFee: number) {
  return subtotal + shippingFee;
}

/**
 * Server-side sanity bound on a stored shipping fee. The exact fee depends on the
 * PSGC region code, which the order row does not keep - checking membership in the
 * rate table is enough to stop a tampered total without re-deriving geography.
 * 0 is valid: it means "manual review" or "address not selected yet".
 */
export function isValidShippingFee(fee: number) {
  if (fee === 0) return true;
  return Object.values(RATE_TABLE).some((brackets) => brackets.some(([, rate]) => rate === fee));
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
