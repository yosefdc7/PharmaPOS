"use client";

export default function OfflinePage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f6f7f9", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", padding: "2rem", maxWidth: "400px" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📡</div>
        <h1 style={{ fontSize: "1.5rem", color: "#111827", marginBottom: "0.5rem" }}>You're Offline</h1>
        <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
          PharmaPOS is an offline-first app. Your data is stored locally and will sync when you're back online.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#1F7ED6",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
