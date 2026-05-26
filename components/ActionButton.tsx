import type { ButtonHTMLAttributes, ReactNode } from "react";

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  main: ReactNode;
  sub: string;
  icon: ReactNode;
};

export default function ActionButton({
  main,
  sub,
  icon,
  className = "",
  ...props
}: ActionButtonProps) {
  return (
    <button className={`action ${className}`.trim()} {...props}>
      <span className="action-label">
        <span className="action-label-main">{main}</span>
        <span className="action-label-sub">{sub}</span>
      </span>
      <span className="action-arrow">{icon}</span>
    </button>
  );
}
