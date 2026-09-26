"use client";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-lg font-semibold text-gray-900">Something went wrong</h1>
      <p className="text-sm text-gray-600">{error.message || "An unexpected error occurred."}</p>
      <button
        onClick={reset}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Try again
      </button>
    </div>
  );
}
