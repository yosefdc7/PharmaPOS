"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="boot-screen error">
          <section className="login-card">
            <h1>Application error</h1>
            <p>The app shell encountered an unrecoverable error. Retry to restart the POS.</p>
            <button type="button" onClick={reset}>Restart app</button>
          </section>
        </main>
      </body>
    </html>
  );
}
