export function SpotlightCard({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        "group relative overflow-hidden rounded-2xl border border-subtle bg-surface " +
        "transition-all duration-200 ease-out " +
        "hover:-translate-y-0.5 hover:border-gold-soft " +
        "before:absolute before:inset-y-0 before:left-0 before:w-[2px] " +
        "before:bg-gold before:opacity-0 before:transition-opacity before:duration-200 " +
        "hover:before:opacity-100 " +
        className
      }
    >
      {children}
    </div>
  );
}
