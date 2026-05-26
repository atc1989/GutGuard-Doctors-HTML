import { PRIZES } from "@/lib/constants";
import type { Prize } from "@/lib/types";

export function pickPrizeIndex() {
  const total = PRIZES.reduce((sum, prize) => sum + prize.weight, 0);
  let target = Math.random() * total;

  for (let index = 0; index < PRIZES.length; index += 1) {
    target -= PRIZES[index].weight;
    if (target <= 0) return index;
  }

  return 0;
}

export function getPrizeByLabel(label: string | null): Prize | null {
  return PRIZES.find((prize) => prize.label === label) ?? null;
}
