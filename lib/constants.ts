export const LOCAL_KEY = "gg_lca_v3";
export const PARTNER_REFERRER_KEY = "gg_partner_ref";
export const PARTNER_PENDING_SIGNIN_KEY = "gg_partner_pending_signin";

export const LINKS = {
  email: null,
  facebook: "https://www.facebook.com/share/g/1AcZoVc7xp/",
  tiktok: "https://www.tiktok.com/@gutguardph",
  reel: null,
} as const;

export const SPECIALTIES = [
  "Internal Medicine",
  "Family Medicine",
  "Gastroenterology",
  "General Practice",
  "Pediatrics",
  "OB-GYN",
  "Surgery",
  "Endocrinology",
  "Cardiology",
  "Other",
];

export const TASKS = [
  {
    id: "email",
    number: "i.",
    title: "Confirm your email",
    meta: "Your proposal is in your inbox.",
  },
  {
    id: "facebook",
    number: "ii.",
    title: "Follow our Facebook page",
    meta: "GutGuard Doctors' TikTok Affiliate.",
  },
  {
    id: "tiktok",
    number: "iii.",
    title: "Follow @gutguardph",
    meta: "Tap follow on the official page.",
    hasTikTokMark: true,
  },
  {
    id: "reel",
    number: "iv.",
    title: "Post your first reel",
    meta: "A short introduction mentioning GutGuard.",
  },
] as const;

export const PRIZES = [
  {
    label: "₱500 GCash",
    color: "#0608A9",
    text: "#F4F1EA",
    weight: 25,
    note: "₱500 GCash, sent to your registered mobile within three business days.",
  },
  {
    label: "GutGuard Tote",
    color: "#F4F1EA",
    text: "#0F0F18",
    weight: 20,
    note: "A limited-edition Lead Clinical Adopter tote, delivered to your clinic.",
  },
  {
    label: "Free SynBIOTIC+",
    color: "#B08D5B",
    text: "#0F0F18",
    weight: 15,
    note: "A complimentary GutGuard SynBIOTIC+ Start Pack.",
  },
  {
    label: "₱1,000 GCash",
    color: "#04067A",
    text: "#F4F1EA",
    weight: 15,
    note: "₱1,000 GCash, sent within three business days.",
  },
  {
    label: "LCA Welcome Kit",
    color: "#0F0F18",
    text: "#F4F1EA",
    weight: 10,
    note: "The full LCA welcome kit: tote, certificate, lapel pin, and starter supply.",
  },
  {
    label: "Strategy Call",
    color: "#EBE7DE",
    text: "#0608A9",
    weight: 8,
    note: "A thirty-minute private call with the GutGuard Medical Director.",
  },
  {
    label: "₱5,000 GCash",
    color: "#C9AC7E",
    text: "#04067A",
    weight: 5,
    note: "₱5,000 GCash — the headline prize.",
  },
  {
    label: "Surprise Gift",
    color: "#0608A9",
    text: "#B08D5B",
    weight: 2,
    note: "A surprise from the founder. Your Partnership Manager will reveal it on your activation call.",
  },
] as const;
