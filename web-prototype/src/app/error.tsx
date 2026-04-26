"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="boot-screen error">
      <section className="login-card">
        <h1>Something went wrong</h1>
        <p>The page failed to load correctly. Try again to recover the workspace.</p>
        <button type="button" onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
