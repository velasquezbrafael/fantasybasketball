export default function EmptyState({
  title = "No data yet",
  detail = "Check back once this season's data has synced.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="card p-8 text-center">
      <div
        className="mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-3"
        style={{ background: "var(--surface-2)" }}
      >
        <span
          className="w-6 h-6 rounded-full block relative"
          style={{ border: "2px solid var(--muted)" }}
        >
          <span
            className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1.5px]"
            style={{ background: "var(--muted)" }}
          />
          <span
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1.5px]"
            style={{ background: "var(--muted)" }}
          />
        </span>
      </div>
      <p className="text-lg font-medium">{title}</p>
      {detail && <p className="text-muted mt-1 text-sm">{detail}</p>}
    </div>
  );
}
