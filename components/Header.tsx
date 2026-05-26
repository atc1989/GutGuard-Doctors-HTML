import Image from "next/image";

type HeaderProps = {
  dateLabel: string;
};

export default function Header({ dateLabel }: HeaderProps) {
  return (
    <header className="masthead">
      <div className="masthead-logos">
        <div className="masthead-logo gg">
          <Image src="/gutguard-logo.png" alt="GutGuard" width={30} height={36} priority />
        </div>
        <span className="masthead-x">×</span>
        <div className="masthead-logo tt">
          <Image src="/tiktok-logo.png" alt="TikTok" width={24} height={30} priority />
        </div>
      </div>
      <div className="masthead-text">
        <div className="masthead-name">
          Doctors&apos; TikTok
          <br />
          Affiliate Program
        </div>
      </div>
      <div className="masthead-edition">
        Vol. 1 · No. 1
        <br />
        <span>{dateLabel}</span>
      </div>
    </header>
  );
}
