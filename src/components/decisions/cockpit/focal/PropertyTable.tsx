/**
 * PropertyTable / Prop — PostHog-style property rows (label | value) for the
 * focal panes. Values can be read-only nodes or inline editors; the table is
 * agnostic. Borders are flat hairlines (structure, not palette).
 */
interface PropProps {
  label: string;
  children: React.ReactNode;
}

export function Prop({ label, children }: PropProps) {
  return (
    <div className="ck-prop">
      <span className="ck-prop-label">{label}</span>
      <div className="ck-prop-value">{children}</div>
    </div>
  );
}

export function PropertyTable({ children }: { children: React.ReactNode }) {
  return <div className="ck-prop-table">{children}</div>;
}
