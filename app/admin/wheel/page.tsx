"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Header from "@/components/Header";
import { DownloadIcon } from "@/components/Icons";

type AdminWheelPrize = {
  id?: string;
  label: string;
  note: string;
  color: string;
  text: string;
  chance_weight: number;
  total_stock: number;
  remaining_stock: number;
  is_active: boolean;
  sort_order: number;
};

type AdminDoctorRegistration = {
  id: string;
  full_name: string;
  email: string;
  mobile: string;
  tiktok_username: string;
  routing_slug: string;
  redirect_url: string;
  specialty: string;
  practice_location: string;
  created_at: string;
  prize_label?: string | null;
  prize_claimed_at?: string | null;
};

type NewsletterSendHistory = {
  id: string;
  doctor_id: string;
  newsletter_id?: string | null;
  newsletter_title?: string | null;
  email: string;
  subject: string;
  status: "sent" | "failed" | "skipped";
  resend_id?: string | null;
  error_message?: string | null;
  sent_at: string;
};

type NewsletterSendResult = {
  doctorId: string;
  email: string;
  status: "sent" | "failed" | "skipped";
  resendId?: string | null;
  error?: string | null;
};

type SmsSendHistory = {
  id: string;
  doctor_id: string;
  sms_campaign_id?: string | null;
  sms_campaign_title?: string | null;
  mobile: string;
  message: string;
  status: "sent" | "failed" | "skipped";
  provider_message_id?: string | null;
  error_message?: string | null;
  sent_at: string;
};

type SmsSendResult = {
  doctorId: string;
  mobile: string;
  status: "sent" | "failed" | "skipped";
  providerMessageId?: string | null;
  error?: string | null;
};

type RegistrationEmailAttachment = {
  id?: string;
  filename: string;
  contentType: string;
  size: number;
  path?: string;
  base64Content?: string;
};

type RegistrationEmailSettings = {
  enabled: boolean;
  subject: string;
  replyTo: string;
  bodyText: string;
  html: string;
  attachments: RegistrationEmailAttachment[];
  updatedAt?: string;
  fromLabel?: string;
};

type WheelApi = {
  getWheelPrizes?: (adminPassword: string) => Promise<AdminWheelPrize[]>;
  saveWheelPrize?: (adminPassword: string, prize: AdminWheelPrize) => Promise<AdminWheelPrize>;
  createWheelPrize?: (
    adminPassword: string,
    prize: Omit<AdminWheelPrize, "id">,
  ) => Promise<AdminWheelPrize>;
  getDoctorRegistrations?: (adminPassword: string) => Promise<AdminDoctorRegistration[]>;
  updateDoctorRegistration?: (
    adminPassword: string,
    doctor: Pick<
      AdminDoctorRegistration,
      | "id"
      | "full_name"
      | "email"
      | "mobile"
      | "tiktok_username"
      | "redirect_url"
      | "specialty"
      | "practice_location"
    >,
  ) => Promise<AdminDoctorRegistration>;
  getNewsletterSendHistory?: (adminPassword: string) => Promise<NewsletterSendHistory[]>;
  sendNewsletter?: (
    adminPassword: string,
    doctorIds: string[],
    subject: string,
    html: string,
  ) => Promise<{
    sent: number;
    failed: number;
    skipped: number;
    results: NewsletterSendResult[];
  }>;
  getSmsBlastHistory?: (adminPassword: string) => Promise<SmsSendHistory[]>;
  sendSmsBlast?: (
    adminPassword: string,
    doctorIds: string[],
    title: string,
    message: string,
  ) => Promise<{
    sent: number;
    failed: number;
    skipped: number;
    results: SmsSendResult[];
  }>;
  getRegistrationEmailSettings?: (adminPassword: string) => Promise<RegistrationEmailSettings>;
  saveRegistrationEmailSettings?: (
    adminPassword: string,
    settings: RegistrationEmailSettings,
  ) => Promise<RegistrationEmailSettings>;
  sendRegistrationEmailTest?: (adminPassword: string, testEmail: string) => Promise<{ sent: boolean; resendId?: string }>;
  getSequenceSteps?: (adminPassword: string) => Promise<SequenceStep[]>;
  upsertSequenceStep?: (adminPassword: string, step: { id?: string; stepNumber: number; subject: string; htmlBody: string; attachments?: SequenceAttachment[] }) => Promise<SequenceStep>;
  deleteSequenceStep?: (adminPassword: string, stepId: string) => Promise<void>;
  reorderSequenceSteps?: (adminPassword: string, stepIds: string[]) => Promise<void>;
  getSequenceProgress?: (adminPassword: string) => Promise<{ progress: SequenceProgress[]; totalSteps: number }>;
  resendSequenceStep?: (
    doctorId: string,
    stepNumber: number,
  ) => Promise<{ sent?: boolean; reason?: string; sendId?: string; step?: number }>;
};

type SequenceAttachment = {
  filename: string;
  content: string; // base64
  content_type: string;
  size: number;
};

type SequenceStep = {
  id?: string;
  step_number: number;
  subject: string;
  html_body: string;
  attachments?: SequenceAttachment[];
  created_at?: string;
  updated_at?: string;
};

type SequenceProgress = {
  id: string;
  doctor_id: string;
  current_step: number;
  enrolled_at: string;
  status: "active" | "completed";
  doctor_registrations: { full_name: string | null; email: string | null } | null;
  email_sequence_sends: { sent_at: string; clicked_at: string | null; status: string; step_id: string }[];
};

const emptyPrize: AdminWheelPrize = {
  label: "",
  note: "",
  color: "#0608A9",
  text: "#F4F1EA",
  chance_weight: 1,
  total_stock: 0,
  remaining_stock: 0,
  is_active: true,
  sort_order: 0,
};
const PAGE_SIZE_OPTIONS = [10, 20, 100];
const PUBLIC_SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://gut-guard-doctors-html.vercel.app").replace(
  /\/$/,
  "",
);
const SHOP_ORIGIN = (process.env.NEXT_PUBLIC_SHOP_URL ?? "https://shop.gutguard.ph").replace(/\/$/, "");
const PLACEHOLDER_TOKENS = [
  "{{doctor_name}}",
  "{{doctor_email}}",
  "{{doctor_mobile}}",
  "{{tiktok_username}}",
  "{{specialty}}",
  "{{clinic_location}}",
  "{{registered_at}}",
  "{{prize_label}}",
];
const SMS_PLACEHOLDER_TOKENS = [
  "{{doctor_name}}",
  "{{doctor_mobile}}",
  "{{tiktok_username}}",
  "{{specialty}}",
  "{{clinic_location}}",
  "{{registered_at}}",
  "{{prize_label}}",
];
const REGISTRATION_EMAIL_TOKENS = [
  "{{doctor_name}}",
  "{{doctor_email}}",
  "{{doctor_mobile}}",
  "{{tiktok_username}}",
  "{{specialty}}",
  "{{clinic_location}}",
  "{{routing_url}}",
  "{{redirect_url}}",
  "{{registered_at}}",
];
const emptyRegistrationEmailSettings: RegistrationEmailSettings = {
  enabled: false,
  subject: "",
  replyTo: "",
  bodyText: "",
  html: "",
  attachments: [],
};

async function loadWheelApi(): Promise<WheelApi> {
  const api = (await import("@/lib/api")) as WheelApi;
  return api;
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPrizeOdds(prize: AdminWheelPrize, activeWeightTotal: number) {
  if (!prize.is_active || prize.remaining_stock <= 0 || prize.chance_weight <= 0 || activeWeightTotal <= 0) {
    return 0;
  }

  return (prize.chance_weight / activeWeightTotal) * 100;
}

type DoctorQrMode = "shop" | "profile";

function getDoctorQrUrl(doctor: AdminDoctorRegistration, mode: DoctorQrMode) {
  if (!doctor.routing_slug) return "";
  if (mode === "profile") return `${PUBLIC_SITE_ORIGIN}/dr/${encodeURIComponent(doctor.routing_slug)}`;
  if (doctor.routing_slug === "dr-grace-saraza") return `${SHOP_ORIGIN}/beehive`;
  return `${SHOP_ORIGIN}/r/${encodeURIComponent(doctor.routing_slug)}`;
}

function getDoctorQrElementId(doctorId: string, mode: DoctorQrMode) {
  return `doctor-qr-${doctorId}-${mode}`;
}

export default function AdminWheelPage() {
  const [activeTab, setActiveTab] = useState<"wheel" | "doctors" | "newsletter" | "sms" | "registrationEmail" | "sequence">("wheel");
  const [password, setPassword] = useState("");
  const [prizes, setPrizes] = useState<AdminWheelPrize[]>([]);
  const [doctors, setDoctors] = useState<AdminDoctorRegistration[]>([]);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [doctorPage, setDoctorPage] = useState(1);
  const [doctorPageSize, setDoctorPageSize] = useState(10);
  const [doctorQrModes, setDoctorQrModes] = useState<Record<string, DoctorQrMode>>({});
  const [newsletterSearch, setNewsletterSearch] = useState("");
  const [newsletterPage, setNewsletterPage] = useState(1);
  const [newsletterPageSize, setNewsletterPageSize] = useState(10);
  const [selectedDoctorIds, setSelectedDoctorIds] = useState<string[]>([]);
  const [newsletterHistory, setNewsletterHistory] = useState<NewsletterSendHistory[]>([]);
  const [newsletterResults, setNewsletterResults] = useState<NewsletterSendResult[]>([]);
  const [isNewsletterSending, setIsNewsletterSending] = useState(false);
  const [showNewsletterConfirm, setShowNewsletterConfirm] = useState(false);
  const [newsletterSubject, setNewsletterSubject] = useState("");
  const [newsletterHtml, setNewsletterHtml] = useState("");
  const [newsletterFileName, setNewsletterFileName] = useState("");
  const [newsletterFileError, setNewsletterFileError] = useState<string | null>(null);
  const [showNewsletterPreview, setShowNewsletterPreview] = useState(false);
  const [smsSearch, setSmsSearch] = useState("");
  const [smsPage, setSmsPage] = useState(1);
  const [smsPageSize, setSmsPageSize] = useState(10);
  const [selectedSmsDoctorIds, setSelectedSmsDoctorIds] = useState<string[]>([]);
  const [smsHistory, setSmsHistory] = useState<SmsSendHistory[]>([]);
  const [smsResults, setSmsResults] = useState<SmsSendResult[]>([]);
  const [isSmsSending, setIsSmsSending] = useState(false);
  const [showSmsConfirm, setShowSmsConfirm] = useState(false);
  const [smsTitle, setSmsTitle] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [smsHistoryDoctorId, setSmsHistoryDoctorId] = useState<string | null>(null);
  const [registrationEmail, setRegistrationEmail] = useState<RegistrationEmailSettings>(emptyRegistrationEmailSettings);
  const [registrationEmailFileName, setRegistrationEmailFileName] = useState("");
  const [registrationEmailFileError, setRegistrationEmailFileError] = useState<string | null>(null);
  const [registrationAttachmentError, setRegistrationAttachmentError] = useState<string | null>(null);
  const [showRegistrationEmailPreview, setShowRegistrationEmailPreview] = useState(false);
  const [showRegistrationEmailToggleConfirm, setShowRegistrationEmailToggleConfirm] = useState(false);
  const [showRegistrationEmailRemoveHtmlConfirm, setShowRegistrationEmailRemoveHtmlConfirm] = useState(false);
  const [pendingRegistrationEmailEnabled, setPendingRegistrationEmailEnabled] = useState(false);
  const [registrationEmailTestAddress, setRegistrationEmailTestAddress] = useState("");
  const [isRegistrationEmailSaving, setIsRegistrationEmailSaving] = useState(false);
  const [isRegistrationEmailRemovingHtml, setIsRegistrationEmailRemovingHtml] = useState(false);
  const [isRegistrationEmailTesting, setIsRegistrationEmailTesting] = useState(false);
  const [historyDoctorId, setHistoryDoctorId] = useState<string | null>(null);
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>([]);
  const [sequenceProgress, setSequenceProgress] = useState<SequenceProgress[]>([]);
  const [sequenceTotalSteps, setSequenceTotalSteps] = useState(0);
  const [editingStep, setEditingStep] = useState<Partial<SequenceStep> | null>(null);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [isDeletingStepId, setIsDeletingStepId] = useState<string | null>(null);
  const [dragStepId, setDragStepId] = useState<string | null>(null);
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [previewStep, setPreviewStep] = useState<SequenceStep | null>(null);
  const [resendingKey, setResendingKey] = useState<string | null>(null);
  const [isSequenceLoading, setIsSequenceLoading] = useState(false);
  const [sequenceStepFileName, setSequenceStepFileName] = useState("");
  const [editingDoctor, setEditingDoctor] = useState<AdminDoctorRegistration | null>(null);
  const [isDoctorSaving, setIsDoctorSaving] = useState(false);
  const [newPrize, setNewPrize] = useState<AdminWheelPrize>(emptyPrize);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newsletterToast, setNewsletterToast] = useState<{
    tone: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  const activeWeightTotal = useMemo(
    () =>
      prizes.reduce((sum, prize) => {
        if (!prize.is_active || prize.remaining_stock <= 0 || prize.chance_weight <= 0) return sum;
        return sum + prize.chance_weight;
      }, 0),
    [prizes],
  );
  const filteredDoctors = useMemo(() => {
    const query = doctorSearch.trim().toLowerCase();
    if (!query) return doctors;

    return doctors.filter((doctor) =>
      [
        doctor.full_name,
        doctor.email,
        doctor.mobile,
        doctor.tiktok_username,
        doctor.routing_slug,
        doctor.redirect_url,
        doctor.specialty,
        doctor.practice_location,
        doctor.prize_label ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [doctorSearch, doctors]);
  const totalDoctorPages = Math.max(1, Math.ceil(filteredDoctors.length / doctorPageSize));
  const visibleDoctors = filteredDoctors.slice(
    (doctorPage - 1) * doctorPageSize,
    doctorPage * doctorPageSize,
  );
  const filteredNewsletterDoctors = useMemo(() => {
    const query = newsletterSearch.trim().toLowerCase();
    const withEmail = doctors.filter((doctor) => doctor.email);
    if (!query) return withEmail;

    return withEmail.filter((doctor) =>
      [
        doctor.full_name,
        doctor.email,
        doctor.mobile,
        doctor.tiktok_username,
        doctor.specialty,
        doctor.practice_location,
        doctor.prize_label ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [newsletterSearch, doctors]);
  const totalNewsletterPages = Math.max(
    1,
    Math.ceil(filteredNewsletterDoctors.length / newsletterPageSize),
  );
  const visibleNewsletterDoctors = filteredNewsletterDoctors.slice(
    (newsletterPage - 1) * newsletterPageSize,
    newsletterPage * newsletterPageSize,
  );
  const selectedDoctors = useMemo(
    () => doctors.filter((doctor) => selectedDoctorIds.includes(doctor.id)),
    [doctors, selectedDoctorIds],
  );
  const filteredSmsDoctors = useMemo(() => {
    const query = smsSearch.trim().toLowerCase();
    const withMobile = doctors.filter((doctor) => normalizeSmsMobile(doctor.mobile));
    if (!query) return withMobile;

    return withMobile.filter((doctor) =>
      [
        doctor.full_name,
        doctor.email,
        doctor.mobile,
        doctor.tiktok_username,
        doctor.specialty,
        doctor.practice_location,
        doctor.prize_label ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [smsSearch, doctors]);
  const totalSmsPages = Math.max(1, Math.ceil(filteredSmsDoctors.length / smsPageSize));
  const visibleSmsDoctors = filteredSmsDoctors.slice(
    (smsPage - 1) * smsPageSize,
    smsPage * smsPageSize,
  );
  const selectedSmsDoctors = useMemo(
    () => doctors.filter((doctor) => selectedSmsDoctorIds.includes(doctor.id)),
    [doctors, selectedSmsDoctorIds],
  );
  const latestNewsletterByDoctor = useMemo(() => {
    return newsletterHistory.reduce<Record<string, NewsletterSendHistory>>((current, item) => {
      const existing = current[item.doctor_id];
      if (!existing || new Date(item.sent_at).getTime() > new Date(existing.sent_at).getTime()) {
        current[item.doctor_id] = item;
      }
      return current;
    }, {});
  }, [newsletterHistory]);
  const newsletterHistoryByDoctor = useMemo(() => {
    return newsletterHistory.reduce<Record<string, NewsletterSendHistory[]>>((current, item) => {
      current[item.doctor_id] = [...(current[item.doctor_id] ?? []), item].sort(
        (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
      );
      return current;
    }, {});
  }, [newsletterHistory]);
  const historyDoctor = historyDoctorId ? doctors.find((doctor) => doctor.id === historyDoctorId) : null;
  const historyItems = historyDoctorId ? newsletterHistoryByDoctor[historyDoctorId] ?? [] : [];
  const latestSmsByDoctor = useMemo(() => {
    return smsHistory.reduce<Record<string, SmsSendHistory>>((current, item) => {
      const existing = current[item.doctor_id];
      if (!existing || new Date(item.sent_at).getTime() > new Date(existing.sent_at).getTime()) {
        current[item.doctor_id] = item;
      }
      return current;
    }, {});
  }, [smsHistory]);
  const smsHistoryByDoctor = useMemo(() => {
    return smsHistory.reduce<Record<string, SmsSendHistory[]>>((current, item) => {
      current[item.doctor_id] = [...(current[item.doctor_id] ?? []), item].sort(
        (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
      );
      return current;
    }, {});
  }, [smsHistory]);
  const smsHistoryDoctor = smsHistoryDoctorId ? doctors.find((doctor) => doctor.id === smsHistoryDoctorId) : null;
  const smsHistoryItems = smsHistoryDoctorId ? smsHistoryByDoctor[smsHistoryDoctorId] ?? [] : [];
  const detectedPlaceholders = useMemo(() => {
    return Array.from(new Set(newsletterHtml.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ?? [])).map((token) =>
      token.replace(/\s+/g, ""),
    );
  }, [newsletterHtml]);
  const visibleSelectedCount = visibleNewsletterDoctors.filter((doctor) =>
    selectedDoctorIds.includes(doctor.id),
  ).length;
  const allVisibleSelected =
    visibleNewsletterDoctors.length > 0 && visibleSelectedCount === visibleNewsletterDoctors.length;
  const canSendNewsletter =
    selectedDoctorIds.length > 0 && newsletterSubject.trim().length > 0 && newsletterHtml.trim().length > 0;
  const previewHtml = useMemo(() => renderNewsletterPreview(newsletterHtml), [newsletterHtml]);
  const detectedSmsPlaceholders = useMemo(() => {
    return Array.from(new Set(smsMessage.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ?? [])).map((token) =>
      token.replace(/\s+/g, ""),
    );
  }, [smsMessage]);
  const visibleSmsSelectedCount = visibleSmsDoctors.filter((doctor) =>
    selectedSmsDoctorIds.includes(doctor.id),
  ).length;
  const allVisibleSmsSelected =
    visibleSmsDoctors.length > 0 && visibleSmsSelectedCount === visibleSmsDoctors.length;
  const smsSegmentInfo = useMemo(() => getSmsSegmentInfo(smsMessage), [smsMessage]);
  const smsPreview = useMemo(() => renderSmsPreview(smsMessage), [smsMessage]);
  const canSendSms =
    selectedSmsDoctorIds.length > 0 && smsTitle.trim().length > 0 && smsMessage.trim().length > 0;
  const detectedRegistrationEmailPlaceholders = useMemo(() => {
    const source = `${registrationEmail.html}\n${registrationEmail.bodyText}`;
    return Array.from(new Set(source.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ?? [])).map((token) =>
      token.replace(/\s+/g, ""),
    );
  }, [registrationEmail.bodyText, registrationEmail.html]);
  const registrationEmailPreviewHtml = useMemo(
    () => renderRegistrationEmailPreview(registrationEmail.html || renderBodyTextPreview(registrationEmail.bodyText)),
    [registrationEmail.bodyText, registrationEmail.html],
  );
  const registrationEmailHasBody =
    registrationEmail.html.trim().length > 0 || registrationEmail.bodyText.trim().length > 0;
  const canSaveRegistrationEmail =
    !registrationEmail.enabled ||
    (registrationEmail.subject.trim().length > 0 && registrationEmailHasBody);
  const canTestRegistrationEmail =
    registrationEmail.subject.trim().length > 0 &&
    registrationEmailHasBody &&
    registrationEmailTestAddress.trim().length > 0;

  useEffect(() => {
    if (!newsletterToast) return;

    const timeout = window.setTimeout(() => {
      setNewsletterToast(null);
    }, 5200);

    return () => window.clearTimeout(timeout);
  }, [newsletterToast]);

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsLoading(true);

    try {
      const api = await loadWheelApi();
      if (!api.getWheelPrizes) {
        throw new Error("Missing getWheelPrizes helper in lib/api.ts.");
      }

      const [loadedPrizes, loadedDoctors, loadedNewsletterHistory, loadedSmsHistory, loadedRegistrationEmail, loadedSequence] = await Promise.all([
        api.getWheelPrizes(password),
        api.getDoctorRegistrations ? api.getDoctorRegistrations(password) : Promise.resolve([]),
        api.getNewsletterSendHistory ? api.getNewsletterSendHistory(password) : Promise.resolve([]),
        api.getSmsBlastHistory ? api.getSmsBlastHistory(password) : Promise.resolve([]),
        api.getRegistrationEmailSettings
          ? api.getRegistrationEmailSettings(password)
          : Promise.resolve(emptyRegistrationEmailSettings),
        api.getSequenceSteps ? api.getSequenceSteps(password) : Promise.resolve([]),
      ]);
      setPrizes(loadedPrizes.sort((a, b) => a.sort_order - b.sort_order));
      setDoctors(loadedDoctors);
      setNewsletterHistory(loadedNewsletterHistory);
      setSmsHistory(loadedSmsHistory);
      setRegistrationEmail(loadedRegistrationEmail);
      setRegistrationEmailFileName(loadedRegistrationEmail.html ? "Saved registration email HTML" : "");
      setSequenceSteps(loadedSequence.sort((a, b) => a.step_number - b.step_number));
      setDoctorPage(1);
      setNewsletterPage(1);
      setSmsPage(1);
      setIsUnlocked(true);
      setNotice("Admin data loaded.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load wheel prizes.");
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshDoctors() {
    setError(null);
    setNotice(null);
    setIsLoading(true);

    try {
      const api = await loadWheelApi();
      if (!api.getDoctorRegistrations) {
        throw new Error("Missing getDoctorRegistrations helper in lib/api.ts.");
      }

      setDoctors(await api.getDoctorRegistrations(password));
      setDoctorPage(1);
      setNotice("Doctor registrations refreshed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load doctor registrations.");
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshNewsletterHistory() {
    const api = await loadWheelApi();
    if (!api.getNewsletterSendHistory) return;
    setNewsletterHistory(await api.getNewsletterSendHistory(password));
  }

  async function refreshSmsHistory() {
    const api = await loadWheelApi();
    if (!api.getSmsBlastHistory) return;
    setSmsHistory(await api.getSmsBlastHistory(password));
  }

  function toggleNewsletterDoctor(doctorId: string) {
    setShowNewsletterConfirm(false);
    setSelectedDoctorIds((current) =>
      current.includes(doctorId)
        ? current.filter((id) => id !== doctorId)
        : [...current, doctorId],
    );
  }

  function toggleVisibleNewsletterDoctors() {
    setShowNewsletterConfirm(false);
    const visibleIds = visibleNewsletterDoctors.map((doctor) => doctor.id);
    setSelectedDoctorIds((current) => {
      if (visibleIds.every((id) => current.includes(id))) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  function toggleSmsDoctor(doctorId: string) {
    setShowSmsConfirm(false);
    setSelectedSmsDoctorIds((current) =>
      current.includes(doctorId)
        ? current.filter((id) => id !== doctorId)
        : [...current, doctorId],
    );
  }

  function toggleVisibleSmsDoctors() {
    setShowSmsConfirm(false);
    const visibleIds = visibleSmsDoctors.map((doctor) => doctor.id);
    setSelectedSmsDoctorIds((current) => {
      if (visibleIds.every((id) => current.includes(id))) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  async function handleNewsletterUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setNewsletterFileError(null);
    setShowNewsletterConfirm(false);

    if (!file) {
      setNewsletterFileName("");
      setNewsletterHtml("");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".html") && file.type !== "text/html") {
      setNewsletterFileName("");
      setNewsletterHtml("");
      setNewsletterFileError("Please upload a .html newsletter file.");
      return;
    }

    if (file.size > 250_000) {
      setNewsletterFileName("");
      setNewsletterHtml("");
      setNewsletterFileError("Please keep the HTML file under 250 KB.");
      return;
    }

    const content = await file.text();
    setNewsletterFileName(file.name);
    setNewsletterHtml(content);

    if (!newsletterSubject.trim()) {
      setNewsletterSubject(file.name.replace(/\.html?$/i, "").replace(/[-_]+/g, " "));
    }
  }

  async function handleRegistrationEmailUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setRegistrationEmailFileError(null);

    if (!file) {
      setRegistrationEmailFileName("");
      setRegistrationEmail((current) => ({ ...current, html: "" }));
      return;
    }

    if (!file.name.toLowerCase().endsWith(".html") && file.type !== "text/html") {
      setRegistrationEmailFileName("");
      setRegistrationEmailFileError("Please upload a .html email template.");
      return;
    }

    if (file.size > 250_000) {
      setRegistrationEmailFileName("");
      setRegistrationEmailFileError("Please keep the HTML file under 250 KB.");
      return;
    }

    const content = await file.text();
    setRegistrationEmailFileName(file.name);
    setRegistrationEmail((current) => ({
      ...current,
      html: content,
      subject: current.subject || file.name.replace(/\.html?$/i, "").replace(/[-_]+/g, " "),
    }));
  }

  async function handleRegistrationAttachmentUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setRegistrationAttachmentError(null);
    event.target.value = "";

    if (files.length === 0) return;

    const currentAttachments = registrationEmail.attachments;
    if (currentAttachments.length + files.length > 5) {
      setRegistrationAttachmentError("Upload up to 5 attachments only.");
      return;
    }

    const nextFiles: RegistrationEmailAttachment[] = [];
    let totalBytes = currentAttachments.reduce((sum, item) => sum + item.size, 0);

    for (const file of files) {
      if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) {
        setRegistrationAttachmentError(`${file.name} must be a PDF, PNG, or JPG.`);
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setRegistrationAttachmentError(`${file.name} must be 10 MB or smaller.`);
        return;
      }

      totalBytes += file.size;
      if (totalBytes > 20 * 1024 * 1024) {
        setRegistrationAttachmentError("Total attachments must be 20 MB or smaller.");
        return;
      }

      nextFiles.push({
        id: `local-${crypto.randomUUID()}`,
        filename: file.name,
        contentType: file.type,
        size: file.size,
        base64Content: await fileToBase64(file),
      });
    }

    setRegistrationEmail((current) => ({
      ...current,
      attachments: [...current.attachments, ...nextFiles],
    }));
  }

  function removeRegistrationAttachment(index: number) {
    setRegistrationAttachmentError(null);
    setRegistrationEmail((current) => ({
      ...current,
      attachments: current.attachments.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  function requestRegistrationEmailToggle(enabled: boolean) {
    setPendingRegistrationEmailEnabled(enabled);
    setShowRegistrationEmailToggleConfirm(true);
  }

  function confirmRegistrationEmailToggle() {
    setRegistrationEmail((current) => ({ ...current, enabled: pendingRegistrationEmailEnabled }));
    setShowRegistrationEmailToggleConfirm(false);
    setNotice(pendingRegistrationEmailEnabled ? "Registration email enabled. Save settings to apply." : "Registration email disabled. Save settings to apply.");
  }

  async function saveRegistrationEmailSettings() {
    if (registrationEmail.enabled && (!registrationEmail.subject.trim() || !registrationEmailHasBody)) {
      setError("Add a subject and either body text or an HTML template before enabling the registration email.");
      return;
    }

    setError(null);
    setNotice(null);
    setIsRegistrationEmailSaving(true);

    try {
      const api = await loadWheelApi();
      if (!api.saveRegistrationEmailSettings) {
        throw new Error("Missing saveRegistrationEmailSettings helper in lib/api.ts.");
      }

      const saved = await api.saveRegistrationEmailSettings(password, {
        ...registrationEmail,
        subject: registrationEmail.subject.trim(),
        replyTo: registrationEmail.replyTo.trim(),
        bodyText: registrationEmail.bodyText.trim(),
        html: registrationEmail.html.trim(),
      });
      setRegistrationEmail(saved);
      setRegistrationEmailFileName(saved.html ? "Saved registration email HTML" : "");
      setNotice("Registration email settings saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save registration email settings.");
    } finally {
      setIsRegistrationEmailSaving(false);
    }
  }

  async function removeRegistrationEmailHtml() {
    setError(null);
    setNotice(null);
    setIsRegistrationEmailRemovingHtml(true);

    try {
      const api = await loadWheelApi();
      if (!api.saveRegistrationEmailSettings) {
        throw new Error("Missing saveRegistrationEmailSettings helper in lib/api.ts.");
      }

      const saved = await api.saveRegistrationEmailSettings(password, {
        ...registrationEmail,
        enabled: registrationEmail.bodyText.trim().length > 0 ? registrationEmail.enabled : false,
        html: "",
      });
      setRegistrationEmail(saved);
      setRegistrationEmailFileName("");
      setRegistrationEmailFileError(null);
      setShowRegistrationEmailRemoveHtmlConfirm(false);
      setNotice(
        registrationEmail.bodyText.trim().length > 0
          ? "Registration email HTML removed. Body text will be used for automatic sends."
          : "Registration email HTML removed and automatic sending disabled.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove registration email HTML.");
    } finally {
      setIsRegistrationEmailRemovingHtml(false);
    }
  }

  async function sendRegistrationEmailTest() {
    if (!canTestRegistrationEmail) {
      setError("Enter a subject, add body text or upload an HTML template, and add a test email.");
      return;
    }

    setError(null);
    setNotice(null);
    setIsRegistrationEmailTesting(true);

    try {
      const api = await loadWheelApi();
      if (!api.saveRegistrationEmailSettings) {
        throw new Error("Missing saveRegistrationEmailSettings helper in lib/api.ts.");
      }
      if (!api.sendRegistrationEmailTest) {
        throw new Error("Missing sendRegistrationEmailTest helper in lib/api.ts.");
      }

      const saved = await api.saveRegistrationEmailSettings(password, {
        ...registrationEmail,
        subject: registrationEmail.subject.trim(),
        replyTo: registrationEmail.replyTo.trim(),
        bodyText: registrationEmail.bodyText.trim(),
        html: registrationEmail.html.trim(),
      });
      setRegistrationEmail(saved);
      await api.sendRegistrationEmailTest(password, registrationEmailTestAddress.trim());
      setNotice(`Test registration email sent to ${registrationEmailTestAddress.trim()}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send test registration email.");
    } finally {
      setIsRegistrationEmailTesting(false);
    }
  }

  async function handleNewsletterSend() {
    if (!canSendNewsletter) {
      setError("Upload an HTML file, enter a subject, and select at least one recipient.");
      return;
    }

    setShowNewsletterConfirm(true);
  }

  async function confirmNewsletterSend() {
    if (!canSendNewsletter) return;

    setError(null);
    setNotice(null);
    setNewsletterResults([]);
    setIsNewsletterSending(true);

    try {
      const api = await loadWheelApi();
      if (!api.sendNewsletter) {
        throw new Error("Missing sendNewsletter helper in lib/api.ts.");
      }

      const response = await api.sendNewsletter(
        password,
        selectedDoctorIds,
        newsletterSubject.trim(),
        newsletterHtml,
      );
      setNewsletterResults(response.results);
      setNewsletterToast({
        tone: "success",
        title: "Newsletter send complete",
        message: `Newsletter sent: ${response.sent} sent, ${response.failed} failed, ${response.skipped} skipped.`,
      });
      setNotice(
        `Newsletter complete: ${response.sent} sent, ${response.failed} failed, ${response.skipped} skipped.`,
      );
      setShowNewsletterConfirm(false);
      await refreshNewsletterHistory();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to send newsletter.";
      setError(message);
      setNewsletterToast({
        tone: "error",
        title: "Newsletter send failed",
        message,
      });
    } finally {
      setIsNewsletterSending(false);
    }
  }

  async function handleSmsSend() {
    if (!canSendSms) {
      setError("Enter a campaign title, write an SMS message, and select at least one mobile-ready recipient.");
      return;
    }

    setShowSmsConfirm(true);
  }

  async function confirmSmsSend() {
    if (!canSendSms) return;

    setError(null);
    setNotice(null);
    setSmsResults([]);
    setIsSmsSending(true);

    try {
      const api = await loadWheelApi();
      if (!api.sendSmsBlast) {
        throw new Error("Missing sendSmsBlast helper in lib/api.ts.");
      }

      const response = await api.sendSmsBlast(
        password,
        selectedSmsDoctorIds,
        smsTitle.trim(),
        smsMessage.trim(),
      );
      setSmsResults(response.results);
      setNewsletterToast({
        tone: "success",
        title: "SMS blast complete",
        message: `SMS blast complete: ${response.sent} sent, ${response.failed} failed, ${response.skipped} skipped.`,
      });
      setNotice(
        `SMS blast complete: ${response.sent} sent, ${response.failed} failed, ${response.skipped} skipped.`,
      );
      setShowSmsConfirm(false);
      await refreshSmsHistory();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to send SMS blast.";
      setError(message);
      setNewsletterToast({
        tone: "error",
        title: "SMS blast failed",
        message,
      });
    } finally {
      setIsSmsSending(false);
    }
  }

  function openDoctorEditor(doctor: AdminDoctorRegistration) {
    setError(null);
    setNotice(null);
    setEditingDoctor({ ...doctor });
  }

  async function saveDoctorEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDoctor) return;

    setError(null);
    setNotice(null);
    setIsDoctorSaving(true);

    try {
      const api = await loadWheelApi();
      if (!api.updateDoctorRegistration) {
        throw new Error("Missing updateDoctorRegistration helper in lib/api.ts.");
      }

      const updatedDoctor = await api.updateDoctorRegistration(password, {
        id: editingDoctor.id,
        full_name: editingDoctor.full_name.trim(),
        email: editingDoctor.email.trim(),
        mobile: editingDoctor.mobile.trim(),
        tiktok_username: editingDoctor.tiktok_username.trim().replace(/^@+/, ""),
        redirect_url: editingDoctor.redirect_url.trim(),
        specialty: editingDoctor.specialty.trim(),
        practice_location: editingDoctor.practice_location.trim(),
      });
      setDoctors((current) =>
        current.map((doctor) => (doctor.id === updatedDoctor.id ? { ...doctor, ...updatedDoctor } : doctor)),
      );
      setEditingDoctor(null);
      setNotice("Doctor details updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update doctor details.");
    } finally {
      setIsDoctorSaving(false);
    }
  }

  async function copyDoctorQrUrl(url: string) {
    setError(null);
    setNotice(null);

    try {
      await navigator.clipboard.writeText(url);
      setNotice("Doctor QR link copied.");
    } catch {
      setError("Unable to copy the QR link. Please copy it from the text field instead.");
    }
  }

  function downloadDoctorQr(doctor: AdminDoctorRegistration, qrUrl: string, mode: DoctorQrMode) {
    setError(null);
    setNotice(null);

    const svg = document.getElementById(getDoctorQrElementId(doctor.id, mode));
    if (!(svg instanceof SVGSVGElement)) {
      setError("Unable to find the QR code for download.");
      return;
    }

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "512");
    clone.setAttribute("height", "512");

    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: "image/svg+xml;charset=utf-8",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = `${doctor.routing_slug || slugifyDownloadName(doctor.full_name)}-${mode}-qr.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
    setNotice(`QR downloaded for ${doctor.full_name || qrUrl}.`);
  }

  function updatePrize(index: number, patch: Partial<AdminWheelPrize>) {
    setPrizes((current) =>
      current.map((prize, currentIndex) => (currentIndex === index ? { ...prize, ...patch } : prize)),
    );
  }

  async function handleSave(prize: AdminWheelPrize) {
    setError(null);
    setNotice(null);
    setSavingId(prize.id ?? prize.label);

    try {
      const api = await loadWheelApi();
      if (!api.saveWheelPrize) {
        throw new Error("Missing saveWheelPrize helper in lib/api.ts.");
      }

      const savedPrize = await api.saveWheelPrize(password, prize);
      setPrizes((current) =>
        current
          .map((item) => (item.id === prize.id ? savedPrize : item))
          .sort((a, b) => a.sort_order - b.sort_order),
      );
      setNotice(`${savedPrize.label || "Prize"} saved.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save this prize.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsCreating(true);

    try {
      const api = await loadWheelApi();
      if (!api.createWheelPrize) {
        throw new Error("Missing createWheelPrize helper in lib/api.ts.");
      }

      const createdPrize = await api.createWheelPrize(password, {
        label: newPrize.label,
        note: newPrize.note,
        color: newPrize.color,
        text: newPrize.text,
        chance_weight: newPrize.chance_weight,
        total_stock: newPrize.total_stock,
        remaining_stock: newPrize.remaining_stock,
        is_active: newPrize.is_active,
        sort_order: newPrize.sort_order,
      });
      setPrizes((current) => [...current, createdPrize].sort((a, b) => a.sort_order - b.sort_order));
      setNewPrize({ ...emptyPrize, sort_order: prizes.length + 1 });
      setNotice(`${createdPrize.label || "Prize"} created.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create prize.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleResendStep(doctorId: string, stepNumber: number, key: string) {
    setError(null);
    setResendingKey(key);
    try {
      const api = await loadWheelApi();
      if (!api.resendSequenceStep) throw new Error("Missing resendSequenceStep helper.");
      await api.resendSequenceStep(doctorId, stepNumber);
      setNotice(`Step ${stepNumber} sent to doctor.`);
      await refreshSequence();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to send step.");
    } finally {
      setResendingKey(null);
    }
  }

  async function handleDropStep(targetId: string) {
    if (!dragStepId || dragStepId === targetId) { setDragStepId(null); setDragOverStepId(null); return; }
    const reordered = [...sequenceSteps];
    const fromIndex = reordered.findIndex((s) => s.id === dragStepId);
    const toIndex = reordered.findIndex((s) => s.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const renumbered = reordered.map((s, i) => ({ ...s, step_number: i + 1 }));
    setSequenceSteps(renumbered);
    setDragStepId(null);
    setDragOverStepId(null);
    setIsReordering(true);
    try {
      const api = await loadWheelApi();
      if (!api.reorderSequenceSteps) throw new Error("Missing reorderSequenceSteps helper.");
      await api.reorderSequenceSteps(password, renumbered.map((s) => s.id!));
      setNotice("Sequence reordered.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reorder steps.");
      await refreshSequence();
    } finally {
      setIsReordering(false);
    }
  }

  async function refreshSequence() {
    setIsSequenceLoading(true);
    try {
      const api = await loadWheelApi();
      const [steps, prog] = await Promise.all([
        api.getSequenceSteps ? api.getSequenceSteps(password) : Promise.resolve([]),
        api.getSequenceProgress ? api.getSequenceProgress(password) : Promise.resolve({ progress: [], totalSteps: 0 }),
      ]);
      setSequenceSteps(steps.sort((a, b) => a.step_number - b.step_number));
      setSequenceProgress(prog.progress);
      setSequenceTotalSteps(prog.totalSteps);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load sequence.");
    } finally {
      setIsSequenceLoading(false);
    }
  }

  async function handleSaveSequenceStep() {
    if (!editingStep) return;
    if (!editingStep.subject?.trim()) { setError("Step subject is required."); return; }
    if (!editingStep.html_body?.trim()) { setError("Step HTML is required."); return; }
    setError(null);
    setIsSavingStep(true);
    try {
      const api = await loadWheelApi();
      if (!api.upsertSequenceStep) throw new Error("Missing upsertSequenceStep helper.");
      const saved = await api.upsertSequenceStep(password, {
        id: editingStep.id,
        stepNumber: editingStep.step_number ?? sequenceSteps.length + 1,
        subject: editingStep.subject.trim(),
        htmlBody: editingStep.html_body.trim(),
        attachments: editingStep.attachments ?? [],
      });
      setSequenceSteps((current) => {
        const existing = current.find((s) => s.id === saved.id);
        const updated = existing
          ? current.map((s) => (s.id === saved.id ? saved : s))
          : [...current, saved];
        return updated.sort((a, b) => a.step_number - b.step_number);
      });
      setEditingStep(null);
      setSequenceStepFileName("");
      setNotice(`Step ${saved.step_number} saved.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save step.");
    } finally {
      setIsSavingStep(false);
    }
  }

  async function handleDeleteSequenceStep(stepId: string) {
    setError(null);
    setIsDeletingStepId(stepId);
    try {
      const api = await loadWheelApi();
      if (!api.deleteSequenceStep) throw new Error("Missing deleteSequenceStep helper.");
      await api.deleteSequenceStep(password, stepId);
      setSequenceSteps((current) => current.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, step_number: i + 1 })));
      setNotice("Step removed and sequence renumbered.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete step.");
    } finally {
      setIsDeletingStepId(null);
    }
  }

  async function handleSequenceAttachmentUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const loaded: SequenceAttachment[] = await Promise.all(
      files.map((file) =>
        new Promise<SequenceAttachment>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(",")[1];
            resolve({ filename: file.name, content: base64, content_type: file.type || "application/octet-stream", size: file.size });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
      )
    );
    setEditingStep((current) =>
      current ? { ...current, attachments: [...(current.attachments ?? []), ...loaded] } : current
    );
    event.target.value = "";
  }

  async function handleSequenceStepHtmlUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) { setSequenceStepFileName(""); return; }
    if (!file.name.toLowerCase().endsWith(".html") && file.type !== "text/html") {
      setError("Please upload a .html file for the step template.");
      return;
    }
    if (file.size > 250_000) { setError("HTML file must be under 250 KB."); return; }
    const content = await file.text();
    setSequenceStepFileName(file.name);
    setEditingStep((current) => current ? ({
      ...current,
      html_body: content,
      subject: current.subject || file.name.replace(/\.html?$/i, "").replace(/[-_]+/g, " "),
    }) : current);
  }

  return (
    <main className="admin-wheel-shell">
      <Header dateLabel="Admin Wheel" />

      <section className="admin-wheel-hero">
        <div>
          <p className="admin-wheel-kicker">Prize Operations</p>
          <h1>
            Wheel
            <br />
            <em>Admin</em>
          </h1>
        </div>
        <div className="admin-wheel-summary" aria-live="polite">
          <span>
            {activeTab === "wheel"
              ? `${prizes.length} prizes`
              : activeTab === "doctors"
                ? `${doctors.length} doctors`
                : activeTab === "newsletter"
                  ? `${selectedDoctorIds.length} selected`
                  : activeTab === "sms"
                    ? `${selectedSmsDoctorIds.length} selected`
                    : activeTab === "sequence"
                      ? `${sequenceSteps.length} steps`
                      : registrationEmail.enabled
                        ? "enabled"
                        : "disabled"}
          </span>
          <strong>
            {activeTab === "wheel"
              ? activeWeightTotal
              : activeTab === "doctors"
                ? doctors.length
                : activeTab === "newsletter"
                  ? selectedDoctorIds.length
                  : activeTab === "sms"
                    ? selectedSmsDoctorIds.length
                    : activeTab === "sequence"
                      ? sequenceProgress.length
                      : registrationEmail.attachments.length}
          </strong>
          <span>
            {activeTab === "wheel"
              ? "active weight"
              : activeTab === "doctors"
                ? "registrations"
                : activeTab === "newsletter"
                  ? "newsletter recipients"
                  : activeTab === "sms"
                    ? "SMS recipients"
                    : activeTab === "sequence"
                      ? "enrolled doctors"
                      : "attachments"}
          </span>
        </div>
      </section>

      <nav className="admin-tabs" aria-label="Admin sections">
        <button
          className={activeTab === "wheel" ? "active" : ""}
          onClick={() => setActiveTab("wheel")}
          type="button"
        >
          Wheel
        </button>
        <button
          className={activeTab === "doctors" ? "active" : ""}
          onClick={() => setActiveTab("doctors")}
          type="button"
        >
          Doctors
        </button>
        <button
          className={activeTab === "newsletter" ? "active" : ""}
          onClick={() => setActiveTab("newsletter")}
          type="button"
        >
          Newsletter
        </button>
        <button
          className={activeTab === "sms" ? "active" : ""}
          onClick={() => setActiveTab("sms")}
          type="button"
        >
          SMS Blast
        </button>
        <button
          className={activeTab === "sequence" ? "active" : ""}
          onClick={() => setActiveTab("sequence")}
          type="button"
        >
          Email Sequence
        </button>
        <button
          disabled
          title="Replaced by Email Sequence"
          style={{ opacity: 0.4, cursor: "not-allowed" }}
          type="button"
        >
          Registration Email
        </button>
      </nav>

      <form className="admin-wheel-auth" onSubmit={handleUnlock}>
        <label htmlFor="admin-password">Admin password</label>
        <div className="admin-wheel-auth-row">
          <input
            className="admin-hidden-username"
            type="text"
            name="username"
            autoComplete="username"
            value="gutguard-admin"
            readOnly
            aria-hidden="true"
            tabIndex={-1}
          />
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            placeholder="Enter password"
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="submit" disabled={isLoading || password.trim().length === 0}>
            {isLoading ? "Loading" : isUnlocked ? "Refresh" : "Unlock"}
          </button>
        </div>
      </form>

      {error ? <div className="admin-wheel-alert error">{error}</div> : null}
      {notice ? <div className="admin-wheel-alert">{notice}</div> : null}
      {newsletterToast ? (
        <div className={`admin-toast ${newsletterToast.tone}`} role="status" aria-live="polite">
          <div>
            <strong>{newsletterToast.title}</strong>
            <span>{newsletterToast.message}</span>
          </div>
          <button type="button" onClick={() => setNewsletterToast(null)} aria-label="Dismiss notification">
            Close
          </button>
        </div>
      ) : null}

      {isUnlocked && activeTab === "wheel" ? (
        <>
          <section className="admin-wheel-panel">
            <div className="admin-wheel-panel-head">
              <div>
                <p className="admin-wheel-kicker">Current Wheel</p>
                <h2>Prizes and Stock</h2>
              </div>
              <p>{activeWeightTotal > 0 ? "Odds recalculate from active, in-stock weight." : "No active stock available."}</p>
            </div>

            <div className="admin-wheel-list">
              {prizes.map((prize, index) => {
                const odds = getPrizeOdds(prize, activeWeightTotal);
                const saveKey = prize.id ?? prize.label;

                return (
                  <article className="admin-wheel-prize" key={prize.id ?? `${prize.label}-${index}`}>
                    <div className="admin-wheel-prize-main">
                      <label>
                        Label
                        <input value={prize.label} onChange={(event) => updatePrize(index, { label: event.target.value })} />
                      </label>
                      <label>
                        Note
                        <textarea value={prize.note} onChange={(event) => updatePrize(index, { note: event.target.value })} />
                      </label>
                    </div>

                    <div className="admin-wheel-grid">
                      <label>
                        Color
                        <input
                          type="color"
                          value={prize.color}
                          onChange={(event) => updatePrize(index, { color: event.target.value })}
                        />
                      </label>
                      <label>
                        Text
                        <input type="color" value={prize.text} onChange={(event) => updatePrize(index, { text: event.target.value })} />
                      </label>
                      <label>
                        Weight
                        <input
                          type="number"
                          min="0"
                          value={prize.chance_weight}
                          onChange={(event) => updatePrize(index, { chance_weight: toNumber(event.target.value) })}
                        />
                      </label>
                      <label>
                        Total
                        <input
                          type="number"
                          min="0"
                          value={prize.total_stock}
                          onChange={(event) => updatePrize(index, { total_stock: toNumber(event.target.value) })}
                        />
                      </label>
                      <label>
                        Remaining
                        <input
                          type="number"
                          min="0"
                          value={prize.remaining_stock}
                          onChange={(event) => updatePrize(index, { remaining_stock: toNumber(event.target.value) })}
                        />
                      </label>
                      <label>
                        Sort
                        <input
                          type="number"
                          value={prize.sort_order}
                          onChange={(event) => updatePrize(index, { sort_order: toNumber(event.target.value) })}
                        />
                      </label>
                    </div>

                    <div className="admin-wheel-prize-footer">
                      <label className="admin-wheel-toggle">
                        <input
                          type="checkbox"
                          checked={prize.is_active}
                          onChange={(event) => updatePrize(index, { is_active: event.target.checked })}
                        />
                        Active
                      </label>
                      <div className="admin-wheel-odds">
                        <span>Odds</span>
                        <strong>{odds.toFixed(2)}%</strong>
                      </div>
                      <button type="button" onClick={() => handleSave(prize)} disabled={savingId === saveKey}>
                        {savingId === saveKey ? "Saving" : "Save"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="admin-wheel-panel">
            <div className="admin-wheel-panel-head">
              <div>
                <p className="admin-wheel-kicker">New Prize</p>
                <h2>Create Segment</h2>
              </div>
            </div>

            <form className="admin-wheel-create" onSubmit={handleCreate}>
              <label>
                Label
                <input required value={newPrize.label} onChange={(event) => setNewPrize({ ...newPrize, label: event.target.value })} />
              </label>
              <label>
                Note
                <textarea value={newPrize.note} onChange={(event) => setNewPrize({ ...newPrize, note: event.target.value })} />
              </label>
              <div className="admin-wheel-grid">
                <label>
                  Color
                  <input type="color" value={newPrize.color} onChange={(event) => setNewPrize({ ...newPrize, color: event.target.value })} />
                </label>
                <label>
                  Text
                  <input type="color" value={newPrize.text} onChange={(event) => setNewPrize({ ...newPrize, text: event.target.value })} />
                </label>
                <label>
                  Weight
                  <input
                    type="number"
                    min="0"
                    value={newPrize.chance_weight}
                    onChange={(event) => setNewPrize({ ...newPrize, chance_weight: toNumber(event.target.value) })}
                  />
                </label>
                <label>
                  Total
                  <input
                    type="number"
                    min="0"
                    value={newPrize.total_stock}
                    onChange={(event) => setNewPrize({ ...newPrize, total_stock: toNumber(event.target.value) })}
                  />
                </label>
                <label>
                  Remaining
                  <input
                    type="number"
                    min="0"
                    value={newPrize.remaining_stock}
                    onChange={(event) => setNewPrize({ ...newPrize, remaining_stock: toNumber(event.target.value) })}
                  />
                </label>
                <label>
                  Sort
                  <input
                    type="number"
                    value={newPrize.sort_order}
                    onChange={(event) => setNewPrize({ ...newPrize, sort_order: toNumber(event.target.value) })}
                  />
                </label>
              </div>
              <label className="admin-wheel-toggle">
                <input
                  type="checkbox"
                  checked={newPrize.is_active}
                  onChange={(event) => setNewPrize({ ...newPrize, is_active: event.target.checked })}
                />
                Active on wheel
              </label>
              <button type="submit" disabled={isCreating || newPrize.label.trim().length === 0}>
                {isCreating ? "Creating" : "Create prize"}
              </button>
            </form>
          </section>
        </>
      ) : null}

      {isUnlocked && activeTab === "doctors" ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">Registered Doctors</p>
              <h2>Doctor Directory</h2>
            </div>
            <div className="admin-doctor-actions">
              <label htmlFor="doctor-search">
                Search
                <input
                  id="doctor-search"
                  type="search"
                  value={doctorSearch}
                  placeholder="Name, email, TikTok, clinic..."
                  onChange={(event) => {
                    setDoctorSearch(event.target.value);
                    setDoctorPage(1);
                  }}
                />
              </label>
              <button type="button" onClick={refreshDoctors} disabled={isLoading}>
                {isLoading ? "Refreshing" : "Refresh"}
              </button>
            </div>
          </div>

          <div className="admin-doctor-list">
            {visibleDoctors.length > 0 ? (
              visibleDoctors.map((doctor) => {
                const qrMode = doctorQrModes[doctor.id] ?? "shop";
                const qrUrl = getDoctorQrUrl(doctor, qrMode);

                return (
                  <article className="admin-doctor-row" key={doctor.id}>
                    <div className="admin-doctor-primary">
                      <strong>{doctor.full_name || "Unnamed doctor"}</strong>
                      <span>@{doctor.tiktok_username || "no-handle"}</span>
                      <div
                        className="admin-doctor-qr-toggle"
                        role="group"
                        aria-label={`QR type for ${doctor.full_name || "doctor"}`}
                      >
                        <button
                          type="button"
                          className={qrMode === "shop" ? "active" : ""}
                          aria-pressed={qrMode === "shop"}
                          onClick={() => setDoctorQrModes((current) => ({ ...current, [doctor.id]: "shop" }))}
                        >
                          Shop referral
                        </button>
                        <button
                          type="button"
                          className={qrMode === "profile" ? "active" : ""}
                          aria-pressed={qrMode === "profile"}
                          onClick={() => setDoctorQrModes((current) => ({ ...current, [doctor.id]: "profile" }))}
                        >
                          TikTok route
                        </button>
                      </div>
                      {qrUrl ? (
                        <div className="admin-doctor-qr">
                          <QRCodeSVG
                            id={getDoctorQrElementId(doctor.id, qrMode)}
                            className="admin-doctor-qr-code"
                            value={qrUrl}
                            size={108}
                            marginSize={2}
                          />
                          <div>
                            <small>{qrMode === "shop" ? "Shop referral route" : "TikTok redirect route"}</small>
                            <code>{qrUrl}</code>
                            <div className="admin-doctor-qr-actions">
                              <button type="button" onClick={() => copyDoctorQrUrl(qrUrl)}>
                                Copy QR link
                              </button>
                              <button
                                type="button"
                                className="icon-only"
                                title="Download QR code"
                                aria-label={`Download QR code for ${doctor.full_name || "doctor"}`}
                                onClick={() => downloadDoctorQr(doctor, qrUrl, qrMode)}
                              >
                                <DownloadIcon />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="admin-doctor-qr-missing">Run the QR redirect SQL to create this doctor&apos;s route.</p>
                      )}
                    </div>
                    <dl className="admin-doctor-details">
                      <div>
                        <dt>Email</dt>
                        <dd>{doctor.email || "--"}</dd>
                      </div>
                      <div>
                        <dt>Mobile</dt>
                        <dd>{doctor.mobile || "--"}</dd>
                      </div>
                      <div>
                        <dt>Redirect</dt>
                        <dd>{doctor.redirect_url || "--"}</dd>
                      </div>
                      <div>
                        <dt>Specialty</dt>
                        <dd>{doctor.specialty || "--"}</dd>
                      </div>
                      <div>
                        <dt>Clinic</dt>
                        <dd>{doctor.practice_location || "--"}</dd>
                      </div>
                      <div>
                        <dt>Prize</dt>
                        <dd>{doctor.prize_label || "Not spun"}</dd>
                      </div>
                      <div>
                        <dt>Registered</dt>
                        <dd>{formatAdminDate(doctor.created_at)}</dd>
                      </div>
                    </dl>
                    <div className="admin-doctor-row-actions">
                      <button type="button" onClick={() => openDoctorEditor(doctor)}>
                        Edit
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="admin-wheel-empty">
                <p>{doctors.length > 0 ? "No doctors match that search." : "No doctor registrations found."}</p>
              </div>
            )}
          </div>

          <div className="admin-pagination">
            <p>
              Showing {visibleDoctors.length > 0 ? (doctorPage - 1) * doctorPageSize + 1 : 0}
              {"-"}
              {Math.min(doctorPage * doctorPageSize, filteredDoctors.length)} of {filteredDoctors.length}
            </p>
            <div className="admin-pagination-controls">
              <label htmlFor="doctor-page-size">
                Show
                <select
                  id="doctor-page-size"
                  value={doctorPageSize}
                  onChange={(event) => {
                    setDoctorPageSize(Number(event.target.value));
                    setDoctorPage(1);
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setDoctorPage((current) => Math.max(1, current - 1))}
                disabled={doctorPage <= 1}
              >
                Previous
              </button>
              <span>
                Page {doctorPage} of {totalDoctorPages}
              </span>
              <button
                type="button"
                onClick={() => setDoctorPage((current) => Math.min(totalDoctorPages, current + 1))}
                disabled={doctorPage >= totalDoctorPages}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {isUnlocked && activeTab === "newsletter" ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">Bulk Email</p>
              <h2>Newsletter Send</h2>
            </div>
            <div className="admin-doctor-actions">
              <label htmlFor="newsletter-search">
                Search recipients
                <input
                  id="newsletter-search"
                  type="search"
                  value={newsletterSearch}
                  placeholder="Name, email, TikTok, clinic..."
                  onChange={(event) => {
                    setNewsletterSearch(event.target.value);
                    setNewsletterPage(1);
                  }}
                />
              </label>
              <button type="button" onClick={refreshNewsletterHistory} disabled={isLoading}>
                Refresh history
              </button>
            </div>
          </div>

          <div className="admin-newsletter-upload">
            <label htmlFor="newsletter-subject">
              Newsletter subject
              <input
                id="newsletter-subject"
                value={newsletterSubject}
                placeholder="GutGuard Doctors Newsletter"
                onChange={(event) => {
                  setNewsletterSubject(event.target.value);
                  setShowNewsletterConfirm(false);
                }}
              />
            </label>
            <label htmlFor="newsletter-html-file">
              Upload HTML file
              <input id="newsletter-html-file" type="file" accept=".html,text/html" onChange={handleNewsletterUpload} />
            </label>
            <button
              className="admin-newsletter-upload-action"
              type="button"
              onClick={() => setShowNewsletterPreview(true)}
              disabled={newsletterHtml.trim().length === 0}
            >
              Preview HTML
            </button>
            <a
              className="admin-newsletter-download"
              href="/sample-upload-newsletter.html"
              download="sample-upload-newsletter.html"
            >
              Download sample HTML
            </a>
            <div className="admin-newsletter-placeholder-box">
              <p>{newsletterFileName ? `Loaded ${newsletterFileName}` : "No newsletter uploaded yet."}</p>
              {newsletterFileError ? <strong>{newsletterFileError}</strong> : null}
              <span>Available placeholders</span>
              <div>
                {PLACEHOLDER_TOKENS.map((token) => (
                  <code key={token}>{token}</code>
                ))}
              </div>
              {detectedPlaceholders.length > 0 ? (
                <>
                  <span>Detected in uploaded HTML</span>
                  <div>
                    {detectedPlaceholders.map((token) => (
                      <code key={token}>{token}</code>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="admin-newsletter-toolbar">
            <label className="admin-newsletter-select-all">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleVisibleNewsletterDoctors}
              />
              Select visible recipients
            </label>
            <div className="admin-newsletter-sendbox">
              <p>{selectedDoctorIds.length} selected</p>
              <button
                type="button"
                onClick={handleNewsletterSend}
                disabled={isNewsletterSending || !canSendNewsletter}
              >
                {isNewsletterSending ? "Sending" : "Review and send"}
              </button>
            </div>
          </div>

          {selectedDoctors.length > 0 ? (
            <div className="admin-newsletter-selected">
              <p>Selected emails</p>
              <div>
                {selectedDoctors.map((doctor) => (
                  <span key={doctor.id}>{doctor.email}</span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="admin-doctor-list">
            {visibleNewsletterDoctors.length > 0 ? (
              visibleNewsletterDoctors.map((doctor) => {
                const latestSend = latestNewsletterByDoctor[doctor.id];
                const doctorHistory = newsletterHistoryByDoctor[doctor.id] ?? [];
                const latestResult = newsletterResults.find((result) => result.doctorId === doctor.id);

                return (
                  <article className="admin-doctor-row newsletter" key={doctor.id}>
                    <label className="admin-newsletter-recipient">
                      <input
                        type="checkbox"
                        checked={selectedDoctorIds.includes(doctor.id)}
                        onChange={() => toggleNewsletterDoctor(doctor.id)}
                      />
                      <span>
                        <strong>{doctor.full_name || "Unnamed doctor"}</strong>
                        <em>{doctor.email}</em>
                      </span>
                    </label>
                    <dl className="admin-doctor-details">
                      <div>
                        <dt>TikTok</dt>
                        <dd>@{doctor.tiktok_username || "no-handle"}</dd>
                      </div>
                      <div>
                        <dt>Clinic</dt>
                        <dd>{doctor.practice_location || "--"}</dd>
                      </div>
                      <div>
                        <dt>Last newsletter</dt>
                        <dd>
                          {doctorHistory.length > 1 ? (
                            <button
                              className="admin-history-link"
                              type="button"
                              onClick={() => setHistoryDoctorId(doctor.id)}
                            >
                              {doctorHistory.length} newsletters sent
                            </button>
                          ) : latestSend ? (
                            `${latestSend.newsletter_title || latestSend.subject} - ${formatAdminDate(latestSend.sent_at)}`
                          ) : (
                            "Never sent"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Send result</dt>
                        <dd>{latestResult ? formatSendResult(latestResult) : "--"}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })
            ) : (
              <div className="admin-wheel-empty">
                <p>No email-ready doctors match that search.</p>
              </div>
            )}
          </div>

          <div className="admin-pagination">
            <p>
              Showing {visibleNewsletterDoctors.length > 0 ? (newsletterPage - 1) * newsletterPageSize + 1 : 0}
              {"-"}
              {Math.min(newsletterPage * newsletterPageSize, filteredNewsletterDoctors.length)} of{" "}
              {filteredNewsletterDoctors.length}
            </p>
            <div className="admin-pagination-controls">
              <label htmlFor="newsletter-page-size">
                Show
                <select
                  id="newsletter-page-size"
                  value={newsletterPageSize}
                  onChange={(event) => {
                    setNewsletterPageSize(Number(event.target.value));
                    setNewsletterPage(1);
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setNewsletterPage((current) => Math.max(1, current - 1))}
                disabled={newsletterPage <= 1}
              >
                Previous
              </button>
              <span>
                Page {newsletterPage} of {totalNewsletterPages}
              </span>
              <button
                type="button"
                onClick={() => setNewsletterPage((current) => Math.min(totalNewsletterPages, current + 1))}
                disabled={newsletterPage >= totalNewsletterPages}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {isUnlocked && activeTab === "sms" ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">Bulk SMS</p>
              <h2>SMS Blast</h2>
            </div>
            <div className="admin-registration-email-status">
              <span>Provider ready</span>
              <p>
                {selectedSmsDoctorIds.length} selected / {smsSegmentInfo.segments} estimated segment
                {smsSegmentInfo.segments === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="admin-registration-email-grid admin-sms-grid">
            <div className="admin-registration-email-main">
              <label htmlFor="sms-title">
                Campaign title
                <input
                  id="sms-title"
                  value={smsTitle}
                  placeholder="GutGuard Doctors SMS"
                  onChange={(event) => {
                    setSmsTitle(event.target.value);
                    setShowSmsConfirm(false);
                  }}
                />
              </label>
              <label htmlFor="sms-message">
                SMS message
                <textarea
                  id="sms-message"
                  value={smsMessage}
                  placeholder="Hi {{doctor_name}}, your GutGuard update..."
                  onChange={(event) => {
                    setSmsMessage(event.target.value);
                    setShowSmsConfirm(false);
                  }}
                />
              </label>
              <p className="admin-sms-provider-note">
                Provider-ready only. Configure an SMS gateway before live sending.
              </p>
            </div>

            <aside className="admin-registration-email-side">
              <div className="admin-newsletter-placeholder-box admin-sms-side-box">
                <p>SMS provider is not configured yet.</p>
                <div className="admin-sms-metrics" aria-live="polite">
                  <strong>{smsSegmentInfo.characters}</strong>
                  <span>characters</span>
                  <strong>{smsSegmentInfo.segments}</strong>
                  <span>estimated SMS segment{smsSegmentInfo.segments === 1 ? "" : "s"}</span>
                </div>
                <span>Available placeholders</span>
                <div>
                  {SMS_PLACEHOLDER_TOKENS.map((token) => (
                    <code key={token}>{token}</code>
                  ))}
                </div>
                {detectedSmsPlaceholders.length > 0 ? (
                  <>
                    <span>Detected in message</span>
                    <div>
                      {detectedSmsPlaceholders.map((token) => (
                        <code key={token}>{token}</code>
                      ))}
                    </div>
                  </>
                ) : null}
                {smsMessage.trim().length > 0 ? (
                  <>
                    <span>Preview</span>
                    <p>{smsPreview}</p>
                  </>
                ) : null}
              </div>
            </aside>
          </div>

          <div className="admin-registration-email-actions admin-sms-recipient-actions">
            <label htmlFor="sms-search">
              Search recipients
              <input
                id="sms-search"
                type="search"
                value={smsSearch}
                placeholder="Name, mobile, TikTok, clinic..."
                onChange={(event) => {
                  setSmsSearch(event.target.value);
                  setSmsPage(1);
                }}
              />
            </label>
            <button type="button" onClick={refreshSmsHistory} disabled={isLoading}>
              Refresh history
            </button>
            <button
              type="button"
              onClick={handleSmsSend}
              disabled={isSmsSending || !canSendSms}
            >
              {isSmsSending ? "Sending" : "Review and send"}
            </button>
          </div>

          <div className="admin-newsletter-toolbar">
            <label className="admin-newsletter-select-all">
              <input
                type="checkbox"
                checked={allVisibleSmsSelected}
                onChange={toggleVisibleSmsDoctors}
              />
              Select visible recipients
            </label>
            <div className="admin-newsletter-sendbox">
              <p>{selectedSmsDoctorIds.length} selected</p>
            </div>
          </div>

          {selectedSmsDoctors.length > 0 ? (
            <div className="admin-newsletter-selected">
              <p>Selected mobiles</p>
              <div>
                {selectedSmsDoctors.map((doctor) => (
                  <span key={doctor.id}>{normalizeSmsMobile(doctor.mobile) || doctor.mobile}</span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="admin-doctor-list">
            {visibleSmsDoctors.length > 0 ? (
              visibleSmsDoctors.map((doctor) => {
                const latestSend = latestSmsByDoctor[doctor.id];
                const doctorHistory = smsHistoryByDoctor[doctor.id] ?? [];
                const latestResult = smsResults.find((result) => result.doctorId === doctor.id);

                return (
                  <article className="admin-doctor-row newsletter" key={doctor.id}>
                    <label className="admin-newsletter-recipient">
                      <input
                        type="checkbox"
                        checked={selectedSmsDoctorIds.includes(doctor.id)}
                        onChange={() => toggleSmsDoctor(doctor.id)}
                      />
                      <span>
                        <strong>{doctor.full_name || "Unnamed doctor"}</strong>
                        <em>{normalizeSmsMobile(doctor.mobile) || doctor.mobile}</em>
                      </span>
                    </label>
                    <dl className="admin-doctor-details">
                      <div>
                        <dt>TikTok</dt>
                        <dd>@{doctor.tiktok_username || "no-handle"}</dd>
                      </div>
                      <div>
                        <dt>Clinic</dt>
                        <dd>{doctor.practice_location || "--"}</dd>
                      </div>
                      <div>
                        <dt>Last SMS</dt>
                        <dd>
                          {doctorHistory.length > 1 ? (
                            <button
                              className="admin-history-link"
                              type="button"
                              onClick={() => setSmsHistoryDoctorId(doctor.id)}
                            >
                              {doctorHistory.length} SMS blasts sent
                            </button>
                          ) : latestSend ? (
                            `${latestSend.sms_campaign_title || "SMS blast"} - ${formatAdminDate(latestSend.sent_at)}`
                          ) : (
                            "Never sent"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Send result</dt>
                        <dd>{latestResult ? formatSmsResult(latestResult) : "--"}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })
            ) : (
              <div className="admin-wheel-empty">
                <p>No mobile-ready doctors match that search.</p>
              </div>
            )}
          </div>

          <div className="admin-pagination">
            <p>
              Showing {visibleSmsDoctors.length > 0 ? (smsPage - 1) * smsPageSize + 1 : 0}
              {"-"}
              {Math.min(smsPage * smsPageSize, filteredSmsDoctors.length)} of {filteredSmsDoctors.length}
            </p>
            <div className="admin-pagination-controls">
              <label htmlFor="sms-page-size">
                Show
                <select
                  id="sms-page-size"
                  value={smsPageSize}
                  onChange={(event) => {
                    setSmsPageSize(Number(event.target.value));
                    setSmsPage(1);
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setSmsPage((current) => Math.max(1, current - 1))}
                disabled={smsPage <= 1}
              >
                Previous
              </button>
              <span>
                Page {smsPage} of {totalSmsPages}
              </span>
              <button
                type="button"
                onClick={() => setSmsPage((current) => Math.min(totalSmsPages, current + 1))}
                disabled={smsPage >= totalSmsPages}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {isUnlocked && activeTab === "registrationEmail" ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">Automatic Email</p>
              <h2>Registration Email</h2>
            </div>
            <div className="admin-registration-email-status">
              <span>{registrationEmail.enabled ? "Enabled" : "Disabled"}</span>
              {registrationEmail.updatedAt ? <small>Updated {formatAdminDate(registrationEmail.updatedAt)}</small> : null}
            </div>
          </div>

          <div className="admin-registration-email-grid">
            <div className="admin-registration-email-main">
              <label className="admin-wheel-toggle registration-email-toggle">
                <input
                  type="checkbox"
                  checked={registrationEmail.enabled}
                  onChange={(event) => requestRegistrationEmailToggle(event.target.checked)}
                />
                Send automatically after registration
              </label>

              <label htmlFor="registration-email-subject">
                Subject
                <input
                  id="registration-email-subject"
                  value={registrationEmail.subject}
                  placeholder="Welcome to GutGuard Doctors"
                  onChange={(event) => setRegistrationEmail({ ...registrationEmail, subject: event.target.value })}
                />
              </label>

              <label htmlFor="registration-email-reply-to">
                Reply-to email
                <input
                  id="registration-email-reply-to"
                  type="email"
                  value={registrationEmail.replyTo}
                  placeholder="hello@gutguard.ph"
                  onChange={(event) => setRegistrationEmail({ ...registrationEmail, replyTo: event.target.value })}
                />
              </label>

              <label htmlFor="registration-email-from">
                From label
                <input id="registration-email-from" value={registrationEmail.fromLabel ?? "Configured in Edge Function"} readOnly />
              </label>

              <label htmlFor="registration-email-body-text">
                Body text
                <textarea
                  id="registration-email-body-text"
                  value={registrationEmail.bodyText}
                  placeholder="Write the email message here if you do not want to upload an HTML template."
                  onChange={(event) => setRegistrationEmail({ ...registrationEmail, bodyText: event.target.value })}
                />
              </label>

              <div className="admin-newsletter-upload registration-email-upload">
                <label htmlFor="registration-email-html-file">
                  Upload HTML template
                  <input
                    id="registration-email-html-file"
                    type="file"
                    accept=".html,text/html"
                    onChange={handleRegistrationEmailUpload}
                  />
                </label>
                <label htmlFor="registration-email-attachments">
                  Upload attachments
                  <input
                    id="registration-email-attachments"
                    type="file"
                    accept=".pdf,application/pdf,.png,image/png,.jpg,.jpeg,image/jpeg"
                    multiple
                    onChange={handleRegistrationAttachmentUpload}
                  />
                </label>
                <div className="registration-email-template-actions">
                  <button
                    className="admin-newsletter-upload-action"
                    type="button"
                    onClick={() => setShowRegistrationEmailPreview(true)}
                    disabled={registrationEmail.html.trim().length === 0}
                  >
                    Preview HTML
                  </button>
                  <button
                    className="admin-newsletter-upload-action"
                    type="button"
                    onClick={() => setShowRegistrationEmailRemoveHtmlConfirm(true)}
                    disabled={registrationEmail.html.trim().length === 0 || isRegistrationEmailRemovingHtml}
                  >
                    Remove HTML
                  </button>
                </div>
              </div>

              <div className="admin-registration-email-actions">
                <button
                  type="button"
                  onClick={saveRegistrationEmailSettings}
                  disabled={isRegistrationEmailSaving || !canSaveRegistrationEmail}
                >
                  {isRegistrationEmailSaving ? "Saving" : "Save settings"}
                </button>
                <label htmlFor="registration-email-test">
                  Test email
                  <input
                    id="registration-email-test"
                    type="email"
                    value={registrationEmailTestAddress}
                    placeholder="you@example.com"
                    onChange={(event) => setRegistrationEmailTestAddress(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={sendRegistrationEmailTest}
                  disabled={isRegistrationEmailTesting || !canTestRegistrationEmail}
                >
                  {isRegistrationEmailTesting ? "Sending" : "Send test"}
                </button>
              </div>
            </div>

            <aside className="admin-registration-email-side">
              <div className="admin-newsletter-placeholder-box">
                <div className="admin-registration-html-status">
                  <p>{registrationEmailFileName || "No registration HTML uploaded yet."}</p>
                </div>
                {registrationEmailFileError ? <strong>{registrationEmailFileError}</strong> : null}
                {registrationAttachmentError ? <strong>{registrationAttachmentError}</strong> : null}
                <span>Available placeholders</span>
                <div>
                  {REGISTRATION_EMAIL_TOKENS.map((token) => (
                    <code key={token}>{token}</code>
                  ))}
                </div>
                {detectedRegistrationEmailPlaceholders.length > 0 ? (
                  <>
                    <span>Detected in uploaded HTML</span>
                    <div>
                      {detectedRegistrationEmailPlaceholders.map((token) => (
                        <code key={token}>{token}</code>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="admin-registration-attachments">
                <span>Attachments</span>
                {registrationEmail.attachments.length > 0 ? (
                  registrationEmail.attachments.map((attachment, index) => (
                    <article key={attachment.path ?? attachment.id ?? `${attachment.filename}-${index}`}>
                      <div>
                        <strong>{attachment.filename}</strong>
                        <small>
                          {attachment.contentType} - {formatFileSize(attachment.size)}
                        </small>
                      </div>
                      <button type="button" onClick={() => removeRegistrationAttachment(index)}>
                        Remove
                      </button>
                    </article>
                  ))
                ) : (
                  <p>No attachments uploaded.</p>
                )}
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      {isUnlocked && activeTab === "sequence" ? (
        <section className="admin-wheel-panel">
          <div className="admin-wheel-panel-head">
            <div>
              <p className="admin-wheel-kicker">Drip Campaign</p>
              <h2>Email Sequence</h2>
            </div>
            <div className="admin-wheel-panel-actions">
              <button
                type="button"
                onClick={() => {
                  setEditingStep({ step_number: sequenceSteps.length + 1, subject: "", html_body: "", attachments: [] });
                  setSequenceStepFileName("");
                }}
                disabled={!!editingStep}
              >
                + Add Step
              </button>
              <button type="button" onClick={refreshSequence} disabled={isSequenceLoading}>
                {isSequenceLoading ? "Loading…" : "Refresh"}
              </button>
              <a
                href="/sample-upload-newsletter.html"
                download="sequence-template.html"
                className="admin-wheel-btn"
                style={{ textDecoration: "none" }}
              >
                Download Template
              </a>
            </div>
          </div>

          {/* Step list */}
          <div className="admin-sequence-steps">
            <h3>Steps ({sequenceSteps.length})</h3>
            {sequenceSteps.length === 0 && !isSequenceLoading ? (
              <p style={{ color: "#888", fontSize: 14 }}>No steps yet. Click &quot;+ Add Step&quot; to create the first email in the sequence.</p>
            ) : null}
            {sequenceSteps.map((step) => (
              <article
                key={step.id}
                draggable={!editingStep && !isReordering}
                onDragStart={() => setDragStepId(step.id ?? null)}
                onDragOver={(e) => { e.preventDefault(); setDragOverStepId(step.id ?? null); }}
                onDragLeave={() => setDragOverStepId(null)}
                onDrop={() => step.id && handleDropStep(step.id)}
                onDragEnd={() => { setDragStepId(null); setDragOverStepId(null); }}
                className="admin-sequence-step-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px solid #eee",
                  opacity: dragStepId === step.id ? 0.4 : 1,
                  borderTop: dragOverStepId === step.id && dragStepId !== step.id ? "2px solid #0608a9" : undefined,
                  cursor: editingStep || isReordering ? "default" : "grab",
                  transition: "opacity 0.15s",
                }}
              >
                <span style={{ color: "#bbb", fontSize: 16, userSelect: "none", cursor: "inherit" }}>⠿</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: "#0608a9", minWidth: 28 }}>#{step.step_number}</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 15 }}>{step.subject}</strong>
                  <br />
                  <small style={{ color: "#888" }}>{step.html_body ? `${step.html_body.length.toLocaleString()} chars` : "No HTML"}</small>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewStep(step)}
                  disabled={!step.html_body}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingStep(step); setSequenceStepFileName(""); }}
                  disabled={!!editingStep || isReordering}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => step.id && handleDeleteSequenceStep(step.id)}
                  disabled={!!editingStep || isReordering || isDeletingStepId === step.id}
                  style={{ color: "#c0392b" }}
                >
                  {isDeletingStepId === step.id ? "Removing…" : "Remove"}
                </button>
              </article>
            ))}
          </div>

          {/* Inline step editor */}
          {editingStep ? (
            <div className="admin-sequence-editor" style={{ marginTop: 24, padding: 20, background: "#f9f8f5", border: "1px solid #ddd6c8" }}>
              <h3 style={{ marginTop: 0 }}>{editingStep.id ? `Editing Step #${editingStep.step_number}` : `New Step #${editingStep.step_number}`}</h3>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Subject line</span>
                <input
                  type="text"
                  value={editingStep.subject ?? ""}
                  onChange={(e) => setEditingStep((current) => current ? { ...current, subject: e.target.value } : current)}
                  placeholder="Email subject…"
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", fontSize: 14, border: "1px solid #ccc", borderRadius: 4 }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>HTML template (.html file)</span>
                <br />
                <small style={{ color: "#888" }}>
                  Use <code>{"{{sequence_click_url}}"}</code> for the click-tracking button URL. Download the{" "}
                  <a href="/sample-upload-newsletter.html" download>sample template</a> for reference.
                </small>
                <input
                  type="file"
                  accept=".html,text/html"
                  onChange={handleSequenceStepHtmlUpload}
                  style={{ display: "block", marginTop: 8 }}
                />
                {sequenceStepFileName ? (
                  <small style={{ color: "#0608a9" }}>Loaded: {sequenceStepFileName}</small>
                ) : editingStep.html_body ? (
                  <small style={{ color: "#888" }}>{editingStep.html_body.length.toLocaleString()} chars loaded (upload a new file to replace)</small>
                ) : null}
              </label>
              <label style={{ display: "block", marginBottom: 4, marginTop: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Attachments</span>
                <br />
                <small style={{ color: "#888" }}>Any file type, any number. Doctors receive these as email attachments.</small>
                <input type="file" multiple onChange={handleSequenceAttachmentUpload} style={{ display: "block", marginTop: 8 }} />
              </label>
              {(editingStep.attachments ?? []).length > 0 ? (
                <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
                  {(editingStep.attachments ?? []).map((att, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13 }}>
                      <span>📎 {att.filename}</span>
                      <small style={{ color: "#888" }}>({(att.size / 1024).toFixed(0)} KB)</small>
                      <button
                        type="button"
                        onClick={() => setEditingStep((cur) => cur ? { ...cur, attachments: (cur.attachments ?? []).filter((_, j) => j !== i) } : cur)}
                        style={{ color: "#c0392b", fontSize: 12, padding: "1px 6px" }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button type="button" onClick={handleSaveSequenceStep} disabled={isSavingStep}>
                  {isSavingStep ? "Saving…" : "Save Step"}
                </button>
                <button type="button" onClick={() => { setEditingStep(null); setSequenceStepFileName(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {/* Doctor progress */}
          {sequenceProgress.length > 0 ? (
            <div className="admin-sequence-progress" style={{ marginTop: 32 }}>
              <h3>Enrolled Doctors ({sequenceProgress.length})</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
                    <th style={{ padding: "8px 10px" }}>Doctor</th>
                    <th style={{ padding: "8px 10px" }}>Step</th>
                    <th style={{ padding: "8px 10px" }}>Status</th>
                    <th style={{ padding: "8px 10px" }}>Last Clicked</th>
                    <th style={{ padding: "8px 10px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sequenceProgress.map((row) => {
                    const lastClick = row.email_sequence_sends
                      .map((s) => s.clicked_at)
                      .filter(Boolean)
                      .sort()
                      .at(-1);
                    const resendKey = `resend-${row.doctor_id}-${row.current_step}`;
                    const nextKey = `next-${row.doctor_id}-${row.current_step + 1}`;
                    const isBusy = resendingKey === resendKey || resendingKey === nextKey;
                    const isCompleted = row.status === "completed";
                    return (
                      <tr key={row.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "10px 10px" }}>
                          <strong>{row.doctor_registrations?.full_name ?? row.doctor_id}</strong>
                          <br />
                          <small style={{ color: "#888" }}>{row.doctor_registrations?.email ?? ""}</small>
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          Step {row.current_step} of {sequenceTotalSteps}
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: 99,
                            fontSize: 12,
                            fontWeight: 700,
                            background: isCompleted ? "#d4edda" : "#cce5ff",
                            color: isCompleted ? "#155724" : "#004085",
                          }}>
                            {row.status}
                          </span>
                        </td>
                        <td style={{ padding: "10px 10px", color: "#888" }}>
                          {lastClick ? formatAdminDate(lastClick) : "—"}
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          {isCompleted ? (
                            <span style={{ color: "#888", fontSize: 12 }}>Sequence done</span>
                          ) : (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleResendStep(row.doctor_id, row.current_step, resendKey)}
                                style={{ fontSize: 12, minHeight: 32, padding: "6px 10px" }}
                                title={`Resend Step ${row.current_step} email`}
                              >
                                {resendingKey === resendKey ? "Sending…" : `↺ Resend Step ${row.current_step}`}
                              </button>
                              {row.current_step < sequenceTotalSteps ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleResendStep(row.doctor_id, row.current_step + 1, nextKey)}
                                  style={{ fontSize: 12, minHeight: 32, padding: "6px 10px", background: "#0608a9" }}
                                  title={`Skip to Step ${row.current_step + 1}`}
                                >
                                  {resendingKey === nextKey ? "Sending…" : `→ Send Step ${row.current_step + 1}`}
                                </button>
                              ) : null}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {showRegistrationEmailPreview ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section
            className="admin-modal admin-newsletter-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-email-preview-title"
          >
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">Registration Email Preview</p>
                <h2 id="registration-email-preview-title">{registrationEmail.subject || "Uploaded HTML"}</h2>
              </div>
              <button type="button" onClick={() => setShowRegistrationEmailPreview(false)}>
                Close
              </button>
            </div>
            <iframe
              className="admin-newsletter-preview-frame"
              title="Registration email HTML preview"
              sandbox=""
              srcDoc={registrationEmailPreviewHtml}
            />
          </section>
        </div>
      ) : null}

      {showRegistrationEmailToggleConfirm ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-email-toggle-title"
          >
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">Confirm Change</p>
                <h2 id="registration-email-toggle-title">
                  {pendingRegistrationEmailEnabled ? "Enable registration email?" : "Disable registration email?"}
                </h2>
              </div>
              <button type="button" onClick={() => setShowRegistrationEmailToggleConfirm(false)}>
                Close
              </button>
            </div>
            <div className="admin-modal-body">
              <p>
                {pendingRegistrationEmailEnabled
                  ? "New doctor registrations will receive this saved email automatically."
                  : "New doctor registrations will no longer receive the automatic registration email."}
              </p>
            </div>
            <div className="admin-modal-actions">
              <button type="button" onClick={() => setShowRegistrationEmailToggleConfirm(false)}>
                Cancel
              </button>
              <button type="button" onClick={confirmRegistrationEmailToggle}>
                Confirm
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showRegistrationEmailRemoveHtmlConfirm ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-email-remove-html-title"
          >
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">Remove Template</p>
                <h2 id="registration-email-remove-html-title">Remove saved HTML?</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowRegistrationEmailRemoveHtmlConfirm(false)}
                disabled={isRegistrationEmailRemovingHtml}
              >
                Close
              </button>
            </div>
            <div className="admin-modal-body">
              <p>
                This will remove the uploaded registration email HTML. If body text is filled in, automatic emails
                can still send using that text. If body text is empty, automatic sending will be disabled until a new
                body or HTML template is added.
              </p>
            </div>
            <div className="admin-modal-actions">
              <button
                type="button"
                onClick={() => setShowRegistrationEmailRemoveHtmlConfirm(false)}
                disabled={isRegistrationEmailRemovingHtml}
              >
                Cancel
              </button>
              <button type="button" onClick={removeRegistrationEmailHtml} disabled={isRegistrationEmailRemovingHtml}>
                {isRegistrationEmailRemovingHtml ? "Removing" : "Remove HTML"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showNewsletterPreview ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section
            className="admin-modal admin-newsletter-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="newsletter-preview-title"
          >
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">Newsletter Preview</p>
                <h2 id="newsletter-preview-title">{newsletterSubject || "Uploaded HTML"}</h2>
              </div>
              <button type="button" onClick={() => setShowNewsletterPreview(false)}>
                Close
              </button>
            </div>
            <iframe
              className="admin-newsletter-preview-frame"
              title="Newsletter HTML preview"
              sandbox=""
              srcDoc={previewHtml}
            />
          </section>
        </div>
      ) : null}

      {showNewsletterConfirm ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="newsletter-confirm-title">
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">Confirm Newsletter</p>
                <h2 id="newsletter-confirm-title">Send to {selectedDoctors.length} doctors</h2>
              </div>
              <button type="button" onClick={() => setShowNewsletterConfirm(false)}>
                Close
              </button>
            </div>
            <div className="admin-modal-body">
              <dl className="admin-confirm-summary">
                <div>
                  <dt>Subject</dt>
                  <dd>{newsletterSubject}</dd>
                </div>
                <div>
                  <dt>HTML file</dt>
                  <dd>{newsletterFileName || "Uploaded HTML"}</dd>
                </div>
              </dl>
              <div className="admin-email-list">
                {selectedDoctors.map((doctor) => (
                  <span key={doctor.id}>{doctor.email}</span>
                ))}
              </div>
            </div>
            <div className="admin-modal-actions">
              <button type="button" onClick={() => setShowNewsletterConfirm(false)}>
                Cancel
              </button>
              <button type="button" onClick={confirmNewsletterSend} disabled={isNewsletterSending}>
                {isNewsletterSending ? "Sending" : "Send newsletter"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showSmsConfirm ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="sms-confirm-title">
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">Confirm SMS Blast</p>
                <h2 id="sms-confirm-title">Send to {selectedSmsDoctors.length} doctors</h2>
              </div>
              <button type="button" onClick={() => setShowSmsConfirm(false)}>
                Close
              </button>
            </div>
            <div className="admin-modal-body">
              <dl className="admin-confirm-summary">
                <div>
                  <dt>Campaign</dt>
                  <dd>{smsTitle}</dd>
                </div>
                <div>
                  <dt>Segments</dt>
                  <dd>
                    {smsSegmentInfo.characters} characters / {smsSegmentInfo.segments} estimated segment
                    {smsSegmentInfo.segments === 1 ? "" : "s"}
                  </dd>
                </div>
                <div>
                  <dt>Message</dt>
                  <dd>{smsPreview}</dd>
                </div>
              </dl>
              <p className="admin-sms-compliance">Only send to doctors who agreed to receive updates.</p>
              <div className="admin-email-list">
                {selectedSmsDoctors.map((doctor) => (
                  <span key={doctor.id}>{normalizeSmsMobile(doctor.mobile) || doctor.mobile}</span>
                ))}
              </div>
            </div>
            <div className="admin-modal-actions">
              <button type="button" onClick={() => setShowSmsConfirm(false)}>
                Cancel
              </button>
              <button type="button" onClick={confirmSmsSend} disabled={isSmsSending}>
                {isSmsSending ? "Sending" : "Send SMS blast"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {historyDoctor ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="newsletter-history-title">
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">Newsletter History</p>
                <h2 id="newsletter-history-title">{historyDoctor.full_name || "Unnamed doctor"}</h2>
              </div>
              <button type="button" onClick={() => setHistoryDoctorId(null)}>
                Close
              </button>
            </div>
            <div className="admin-history-list">
              {historyItems.map((item) => (
                <article key={item.id}>
                  <strong>{item.newsletter_title || item.subject}</strong>
                  <span>
                    {item.status} - {formatAdminDate(item.sent_at)}
                  </span>
                  {item.error_message ? <p>{item.error_message}</p> : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {smsHistoryDoctor ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="sms-history-title">
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">SMS History</p>
                <h2 id="sms-history-title">{smsHistoryDoctor.full_name || "Unnamed doctor"}</h2>
              </div>
              <button type="button" onClick={() => setSmsHistoryDoctorId(null)}>
                Close
              </button>
            </div>
            <div className="admin-history-list">
              {smsHistoryItems.map((item) => (
                <article key={item.id}>
                  <strong>{item.sms_campaign_title || "SMS blast"}</strong>
                  <span>
                    {item.status} - {formatAdminDate(item.sent_at)}
                  </span>
                  <p>{item.message}</p>
                  {item.error_message ? <p>{item.error_message}</p> : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {editingDoctor ? (
        <div className="admin-modal-backdrop" role="presentation">
          <form className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="doctor-edit-title" onSubmit={saveDoctorEdit}>
            <div className="admin-modal-head">
              <div>
                <p className="admin-wheel-kicker">Edit Doctor</p>
                <h2 id="doctor-edit-title">Registration Details</h2>
              </div>
              <button type="button" onClick={() => setEditingDoctor(null)}>
                Close
              </button>
            </div>
            <div className="admin-edit-grid">
              <label>
                Name
                <input
                  required
                  value={editingDoctor.full_name}
                  onChange={(event) => setEditingDoctor({ ...editingDoctor, full_name: event.target.value })}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={editingDoctor.email}
                  onChange={(event) => setEditingDoctor({ ...editingDoctor, email: event.target.value })}
                />
              </label>
              <label>
                Mobile
                <input
                  required
                  value={editingDoctor.mobile}
                  onChange={(event) => setEditingDoctor({ ...editingDoctor, mobile: event.target.value })}
                />
              </label>
              <label>
                TikTok username
                <input
                  required
                  value={editingDoctor.tiktok_username}
                  onChange={(event) => setEditingDoctor({ ...editingDoctor, tiktok_username: event.target.value })}
                />
              </label>
              <label>
                Routing slug
                <input value={editingDoctor.routing_slug || ""} readOnly />
              </label>
              <label className="admin-edit-wide">
                Redirect link
                <input
                  type="url"
                  value={editingDoctor.redirect_url || ""}
                  placeholder="https://www.tiktok.com/@gutguardph"
                  onChange={(event) => setEditingDoctor({ ...editingDoctor, redirect_url: event.target.value })}
                />
              </label>
              <label>
                Specialty
                <input
                  required
                  value={editingDoctor.specialty}
                  onChange={(event) => setEditingDoctor({ ...editingDoctor, specialty: event.target.value })}
                />
              </label>
              <label>
                Clinic location
                <input
                  required
                  value={editingDoctor.practice_location}
                  onChange={(event) => setEditingDoctor({ ...editingDoctor, practice_location: event.target.value })}
                />
              </label>
            </div>
            <div className="admin-modal-actions">
              <button type="button" onClick={() => setEditingDoctor(null)}>
                Cancel
              </button>
              <button type="submit" disabled={isDoctorSaving}>
                {isDoctorSaving ? "Saving" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {!isUnlocked ? (
        <section className="admin-wheel-empty">
          <p>Enter the admin password to load wheel prizes and doctor registrations.</p>
        </section>
      ) : null}

      {previewStep ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onClick={() => setPreviewStep(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 6, width: "100%", maxWidth: 700, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #eee" }}>
              <strong style={{ fontSize: 15 }}>Preview — Step #{previewStep.step_number}: {previewStep.subject}</strong>
              <button type="button" onClick={() => setPreviewStep(null)} style={{ fontSize: 18, background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>
            <iframe
              title="Step preview"
              style={{ flex: 1, border: "none", minHeight: 500 }}
              srcDoc={previewStep.html_body
                .replace(/\{\{\s*doctor_name\s*\}\}/g, "Sample Doctor")
                .replace(/\{\{\s*doctor_email\s*\}\}/g, "doctor@clinic.com")
                .replace(/\{\{\s*doctor_mobile\s*\}\}/g, "09171234567")
                .replace(/\{\{\s*tiktok_username\s*\}\}/g, "gutguardph")
                .replace(/\{\{\s*specialty\s*\}\}/g, "Gastroenterology")
                .replace(/\{\{\s*clinic_location\s*\}\}/g, "Makati City")
                .replace(/\{\{\s*registered_at\s*\}\}/g, "Jun 20, 2026")
                .replace(/\{\{\s*prize_label\s*\}\}/g, "Tote Bag")
                .replace(/\{\{\s*next_step_number\s*\}\}/g, String(previewStep.step_number + 1))
                .replace(/\{\{\s*sequence_click_url\s*\}\}/g, "#")}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}

function formatAdminDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatSendResult(result: NewsletterSendResult) {
  if (result.status === "sent") return "Sent";
  if (result.status === "skipped") return `Skipped${result.error ? ` - ${result.error}` : ""}`;
  return `Failed${result.error ? ` - ${result.error}` : ""}`;
}

function formatSmsResult(result: SmsSendResult) {
  if (result.status === "sent") return "Sent";
  if (result.status === "skipped") return `Skipped${result.error ? ` - ${result.error}` : ""}`;
  return `Failed${result.error ? ` - ${result.error}` : ""}`;
}

function renderNewsletterPreview(html: string) {
  const replacements: Record<string, string> = {
    doctor_name: "Dr. Maria Santos",
    doctor_email: "doctor@example.com",
    doctor_mobile: "09171234567",
    tiktok_username: "gutguarddoctor",
    specialty: "Internal Medicine",
    clinic_location: "Makati City",
    registered_at: "Jun 12, 2026",
    prize_label: "GutGuard Tote",
  };

  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in replacements)) return match;
    return escapeHtml(replacements[key]);
  });
}

function renderSmsPreview(message: string) {
  const replacements: Record<string, string> = {
    doctor_name: "Dr. Maria Santos",
    doctor_mobile: "+639171234567",
    tiktok_username: "gutguarddoctor",
    specialty: "Internal Medicine",
    clinic_location: "Makati City",
    registered_at: "Jun 12, 2026",
    prize_label: "GutGuard Tote",
  };

  return message.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in replacements)) return match;
    return replacements[key];
  });
}

function getSmsSegmentInfo(message: string) {
  const usesUnicode = /[^\u0000-\u007f]/.test(message);
  const singleLimit = usesUnicode ? 70 : 160;
  const multipartLimit = usesUnicode ? 67 : 153;
  const characters = message.length;

  return {
    characters,
    segments: characters <= singleLimit ? Math.max(1, characters === 0 ? 0 : 1) : Math.ceil(characters / multipartLimit),
  };
}

function normalizeSmsMobile(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^639\d{9}$/.test(digits)) return `+${digits}`;
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
  return "";
}

function renderRegistrationEmailPreview(html: string) {
  const replacements: Record<string, string> = {
    doctor_name: "Dr. Maria Santos",
    doctor_email: "doctor@example.com",
    doctor_mobile: "09171234567",
    tiktok_username: "gutguarddoctor",
    specialty: "Internal Medicine",
    clinic_location: "Makati City",
    routing_url: "https://gut-guard-doctors-html.vercel.app/dr/maria-santos",
    redirect_url: "https://www.tiktok.com/@gutguarddoctor",
    registered_at: "Jun 12, 2026",
  };

  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in replacements)) return match;
    return escapeHtml(replacements[key]);
  });
}

function renderBodyTextPreview(value: string) {
  if (!value.trim()) return "";

  const body = escapeHtml(value)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return `<div style="font-family:Arial,sans-serif;color:#0F0F18;line-height:1.6">${body}</div>`;
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.readAsDataURL(file);
  });
}

function slugifyDownloadName(value: string | null | undefined) {
  const slug = (value ?? "doctor")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "doctor";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
