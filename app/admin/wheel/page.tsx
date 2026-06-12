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
  getRegistrationEmailSettings?: (adminPassword: string) => Promise<RegistrationEmailSettings>;
  saveRegistrationEmailSettings?: (
    adminPassword: string,
    settings: RegistrationEmailSettings,
  ) => Promise<RegistrationEmailSettings>;
  sendRegistrationEmailTest?: (adminPassword: string, testEmail: string) => Promise<{ sent: boolean; resendId?: string }>;
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

function getDoctorQrUrl(doctor: AdminDoctorRegistration) {
  if (!doctor.routing_slug) return "";
  return `${PUBLIC_SITE_ORIGIN}/dr/${encodeURIComponent(doctor.routing_slug)}`;
}

function getDoctorQrElementId(doctorId: string) {
  return `doctor-qr-${doctorId}`;
}

export default function AdminWheelPage() {
  const [activeTab, setActiveTab] = useState<"wheel" | "doctors" | "newsletter" | "registrationEmail">("wheel");
  const [password, setPassword] = useState("");
  const [prizes, setPrizes] = useState<AdminWheelPrize[]>([]);
  const [doctors, setDoctors] = useState<AdminDoctorRegistration[]>([]);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [doctorPage, setDoctorPage] = useState(1);
  const [doctorPageSize, setDoctorPageSize] = useState(10);
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
  const [registrationEmail, setRegistrationEmail] = useState<RegistrationEmailSettings>(emptyRegistrationEmailSettings);
  const [registrationEmailFileName, setRegistrationEmailFileName] = useState("");
  const [registrationEmailFileError, setRegistrationEmailFileError] = useState<string | null>(null);
  const [registrationAttachmentError, setRegistrationAttachmentError] = useState<string | null>(null);
  const [showRegistrationEmailPreview, setShowRegistrationEmailPreview] = useState(false);
  const [showRegistrationEmailToggleConfirm, setShowRegistrationEmailToggleConfirm] = useState(false);
  const [pendingRegistrationEmailEnabled, setPendingRegistrationEmailEnabled] = useState(false);
  const [registrationEmailTestAddress, setRegistrationEmailTestAddress] = useState("");
  const [isRegistrationEmailSaving, setIsRegistrationEmailSaving] = useState(false);
  const [isRegistrationEmailTesting, setIsRegistrationEmailTesting] = useState(false);
  const [historyDoctorId, setHistoryDoctorId] = useState<string | null>(null);
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
  const detectedRegistrationEmailPlaceholders = useMemo(() => {
    return Array.from(new Set(registrationEmail.html.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ?? [])).map((token) =>
      token.replace(/\s+/g, ""),
    );
  }, [registrationEmail.html]);
  const registrationEmailPreviewHtml = useMemo(
    () => renderRegistrationEmailPreview(registrationEmail.html),
    [registrationEmail.html],
  );
  const canSaveRegistrationEmail =
    !registrationEmail.enabled ||
    (registrationEmail.subject.trim().length > 0 && registrationEmail.html.trim().length > 0);
  const canTestRegistrationEmail =
    registrationEmail.subject.trim().length > 0 &&
    registrationEmail.html.trim().length > 0 &&
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

      const [loadedPrizes, loadedDoctors, loadedNewsletterHistory, loadedRegistrationEmail] = await Promise.all([
        api.getWheelPrizes(password),
        api.getDoctorRegistrations ? api.getDoctorRegistrations(password) : Promise.resolve([]),
        api.getNewsletterSendHistory ? api.getNewsletterSendHistory(password) : Promise.resolve([]),
        api.getRegistrationEmailSettings
          ? api.getRegistrationEmailSettings(password)
          : Promise.resolve(emptyRegistrationEmailSettings),
      ]);
      setPrizes(loadedPrizes.sort((a, b) => a.sort_order - b.sort_order));
      setDoctors(loadedDoctors);
      setNewsletterHistory(loadedNewsletterHistory);
      setRegistrationEmail(loadedRegistrationEmail);
      setRegistrationEmailFileName(loadedRegistrationEmail.html ? "Saved registration email HTML" : "");
      setDoctorPage(1);
      setNewsletterPage(1);
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
    if (registrationEmail.enabled && (!registrationEmail.subject.trim() || !registrationEmail.html.trim())) {
      setError("Add a subject and HTML template before enabling the registration email.");
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

  async function sendRegistrationEmailTest() {
    if (!canTestRegistrationEmail) {
      setError("Enter a subject, upload an HTML template, and add a test email.");
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

  function downloadDoctorQr(doctor: AdminDoctorRegistration, qrUrl: string) {
    setError(null);
    setNotice(null);

    const svg = document.getElementById(getDoctorQrElementId(doctor.id));
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
    link.download = `${doctor.routing_slug || slugifyDownloadName(doctor.full_name)}-qr.svg`;
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
                  : registrationEmail.attachments.length}
          </strong>
          <span>
            {activeTab === "wheel"
              ? "active weight"
              : activeTab === "doctors"
                ? "registrations"
                : activeTab === "newsletter"
                  ? "newsletter recipients"
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
          className={activeTab === "registrationEmail" ? "active" : ""}
          onClick={() => setActiveTab("registrationEmail")}
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
                const qrUrl = getDoctorQrUrl(doctor);

                return (
                  <article className="admin-doctor-row" key={doctor.id}>
                    <div className="admin-doctor-primary">
                      <strong>{doctor.full_name || "Unnamed doctor"}</strong>
                      <span>@{doctor.tiktok_username || "no-handle"}</span>
                      {qrUrl ? (
                        <div className="admin-doctor-qr">
                          <QRCodeSVG
                            id={getDoctorQrElementId(doctor.id)}
                            className="admin-doctor-qr-code"
                            value={qrUrl}
                            size={108}
                            marginSize={2}
                          />
                          <div>
                            <small>Permanent QR route</small>
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
                                onClick={() => downloadDoctorQr(doctor, qrUrl)}
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
                <button
                  className="admin-newsletter-upload-action"
                  type="button"
                  onClick={() => setShowRegistrationEmailPreview(true)}
                  disabled={registrationEmail.html.trim().length === 0}
                >
                  Preview HTML
                </button>
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
                <p>{registrationEmailFileName || "No registration HTML uploaded yet."}</p>
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
