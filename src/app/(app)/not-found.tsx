import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <FileQuestion className="w-12 h-12 text-secondary mb-4" />
      <h1 className="text-xl font-semibold text-text mb-2">Page not found</h1>
      <p className="text-sm text-muted mb-6">The page you're looking for doesn't exist.</p>
      <Link
        href="/media"
        className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-primary text-on-primary hover:bg-[var(--color-primary-hover)] transition-colors"
      >
        Go to Media
      </Link>
    </div>
  );
}
