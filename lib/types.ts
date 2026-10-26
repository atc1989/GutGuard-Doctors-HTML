export type Screen = 1 | 2 | 3 | 4;

export type Registration = {
  id: string;
  namePrefix: string;
  fullName: string;
  email: string;
  mobile: string;
  specialty: string;
  location: string;
  whereDidYouFindUs?: string;
  registeredAt: number;
  referrerSlug?: string;
};

export type RegistrationPayload = Omit<Registration, "id" | "registeredAt">;

export type RegistrationEmailDelivery =
  | { status: "idle" }
  | { status: "sending"; email: string }
  | { status: "sent"; email: string }
  | { status: "failed"; email: string }
  | { status: "not-requested" };

export type Prize = {
  id?: string;
  label: string;
  color: string;
  text: string;
  textColor?: string;
  weight: number;
  chanceWeight?: number;
  note: string;
  totalStock?: number;
  remainingStock?: number;
  isActive?: boolean;
  sortOrder?: number;
  claimCount?: number;
};

export type WheelPrize = Required<
  Pick<
    Prize,
    | "id"
    | "label"
    | "note"
    | "color"
    | "totalStock"
    | "remainingStock"
    | "isActive"
    | "sortOrder"
  >
> &
  Pick<Prize, "claimCount"> & {
    text: string;
    textColor: string;
    weight: number;
    chanceWeight: number;
  };

export type WheelPrizeInput = {
  id?: string;
  label: string;
  note: string;
  color: string;
  textColor: string;
  chanceWeight: number;
  totalStock: number;
  remainingStock: number;
  isActive: boolean;
  sortOrder: number;
};
