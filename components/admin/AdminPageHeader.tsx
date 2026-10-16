import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  /** Small uppercase line above the title, e.g. "Prize operations". */
  kicker: string;
  title: string;
  description?: string;
  /** Right-aligned actions, e.g. a link to the live shop. */
  children?: ReactNode;
};

// ponytail: reuses the dashboard's .admin-overview-hero rules rather than a second header
// design system. Rename both together if the "overview" prefix ever stops fitting.
export default function AdminPageHeader({ kicker, title, description, children }: AdminPageHeaderProps) {
  return (
    <section className="admin-overview-hero">
      <div>
        <p className="admin-overview-date">{kicker}</p>
        <h1 className="admin-overview-title">{title}</h1>
        {description ? <p className="admin-overview-sub">{description}</p> : null}
      </div>
      {children ? <div className="admin-overview-hero-actions">{children}</div> : null}
    </section>
  );
}
