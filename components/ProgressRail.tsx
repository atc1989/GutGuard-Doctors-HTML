import type { Screen } from "@/lib/types";

type ProgressRailProps = {
  screen: Screen;
};

export default function ProgressRail({ screen }: ProgressRailProps) {
  const fillHeight = screen === 1 ? "0%" : screen === 2 ? "50%" : "100%";

  function dotClass(dot: 1 | 2 | 3) {
    if (screen === dot || (screen === 4 && dot === 3)) return "rail-dot active";
    if (screen > dot) return "rail-dot done";
    return "rail-dot";
  }

  return (
    <div className="rail" aria-hidden="true">
      <div className="rail-fill" style={{ height: fillHeight }} />
      <div className={dotClass(1)} style={{ top: "0%" }} />
      <div className={dotClass(2)} style={{ top: "50%" }} />
      <div className={dotClass(3)} style={{ top: "100%" }} />
    </div>
  );
}
