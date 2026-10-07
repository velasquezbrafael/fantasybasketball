import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card p-10 text-center space-y-4">
      <p className="font-display text-6xl tracking-wide text-gradient">404</p>
      <p className="text-muted text-sm">That page doesn&rsquo;t exist, or the team it points to isn&rsquo;t in the league.</p>
      <Link href="/" className="inline-block text-sm text-accent hover:underline">
        ← Back to the dashboard
      </Link>
    </div>
  );
}
