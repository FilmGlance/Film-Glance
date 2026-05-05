// app/not-found.tsx — App Router convention: nested component, NOT
// a full-page wrapper (root layout provides html/body). Overrides the
// default /_not-found which threw a workStore invariant during the
// v6.0.0 Next 16 migration prerender.
import Link from "next/link";

export const metadata = {
  title: "Not Found — Film Glance",
};

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Syne', sans-serif",
        textAlign: "center",
        padding: "32px",
        color: "#f0f0f0",
      }}
    >
      <h1
        style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: "italic",
          fontSize: "clamp(48px, 8vw, 96px)",
          color: "#FFD700",
          margin: 0,
          letterSpacing: -1,
        }}
      >
        404
      </h1>
      <p
        style={{
          fontSize: 18,
          color: "rgba(255, 255, 255, 0.72)",
          marginTop: 16,
          marginBottom: 32,
        }}
      >
        That film couldn&apos;t be found.
      </p>
      <Link
        href="/"
        style={{
          padding: "12px 28px",
          borderRadius: 999,
          background: "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)",
          color: "#0a0805",
          fontWeight: 700,
          fontSize: 14,
          textDecoration: "none",
          letterSpacing: 0.4,
        }}
      >
        Back to home
      </Link>
    </div>
  );
}
