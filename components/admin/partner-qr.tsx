"use client";

import { useRef } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { QR_LOGO_PROPS, getPartnerQrLink, useCopy, type PartnerQrMode } from "@/components/partner/shared";

const QR_RENDER_PX = 1024;

/**
 * One partner QR (Shop, Join or Landing) with its link, Share link and Download PNG. Drawn at 1024px with
 * the logo so the PNG matches what partners get. `fileName` and `margin` keep each page's
 * downloads identical to what it produced before.
 */
export function PartnerQrCard({
  partner,
  mode,
  label,
  fileName,
  margin = 4,
  children,
}: {
  partner: { id: string; routing_slug: string; partner_code?: number | null };
  mode: PartnerQrMode;
  label: string;
  fileName: string;
  margin?: number;
  children?: React.ReactNode;
}) {
  const link = getPartnerQrLink(partner, mode);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { copied, share } = useCopy();

  function download() {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = fileName;
    anchor.click();
  }

  return (
    <figure className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4">
      <figcaption className="text-[13px] font-medium">{label}</figcaption>
      <QRCodeSVG value={link} size={QR_RENDER_PX} {...QR_LOGO_PROPS} marginSize={margin} style={{ width: "100%", height: "auto" }} />
      <div ref={canvasRef} hidden>
        <QRCodeCanvas value={link} size={QR_RENDER_PX} {...QR_LOGO_PROPS} marginSize={margin} />
      </div>
      <code className="truncate rounded-md bg-chrome px-2 py-1 text-xs" title={link}>
        {link}
      </code>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1 shadow-none" title="Share link" onClick={() => share(link)}>
          <Share2 strokeWidth={1.5} />
          {copied ? "Copied" : "Share"}
        </Button>
        <Button type="button" variant="outline" size="sm" className="flex-1 shadow-none" title="Download PNG" onClick={download}>
          <Download strokeWidth={1.5} />
          Download
        </Button>
      </div>
      {children}
    </figure>
  );
}
