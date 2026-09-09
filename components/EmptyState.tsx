export default function EmptyState({
  title = "No data yet",
  detail = "Run the sync job to pull data from ESPN — see README.md for setup.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="card p-8 text-center">
      <p className="text-lg font-medium">{title}</p>
      <p className="text-muted mt-1 text-sm">{detail}</p>
    </div>
  );
}
