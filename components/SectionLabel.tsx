type SectionLabelProps = {
  number: string;
  children: React.ReactNode;
};

export default function SectionLabel({ number, children }: SectionLabelProps) {
  return (
    <div className="section-label">
      <span className="section-label-num">{number}</span>
      {children}
    </div>
  );
}
