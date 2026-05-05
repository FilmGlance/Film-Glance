// app/global-error.tsx — App Router error boundary at the root level.
// This MUST include its own html/body (it replaces the entire layout
// when the root layout itself errors). Overrides Next 16's auto-generated
// /_global-error which threw the same workStore invariant as
// /_not-found during the v6.0.0 migration prerender.
"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: "32px",
          background: "#050505",
          color: "#f0f0f0",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Syne', sans-serif",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            fontSize: "clamp(40px, 6vw, 72px)",
            color: "#FFD700",
            margin: 0,
            letterSpacing: -1,
          }}
        >
          Something broke.
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "rgba(255, 255, 255, 0.62)",
            marginTop: 16,
            marginBottom: 28,
            maxWidth: 480,
            lineHeight: 1.5,
          }}
        >
          A glitch in the projector. Try again — if it happens twice, please reload.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "12px 28px",
            borderRadius: 999,
            border: "none",
            background: "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)",
            color: "#0a0805",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            letterSpacing: 0.4,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
