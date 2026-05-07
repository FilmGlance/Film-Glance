"use client";

// components/SiteHeader.jsx
//
// Shared site header. Renders the Film Glance brand mark + primary nav with
// the same visual treatment as the existing header inside components/film-glance.jsx,
// so /boxoffice (and any future page) stays visually consistent with /.
//
// This is a STATELESS variant — it doesn't know about the signed-in user,
// favourites count, or the in-page sign-in modal. Sign In + Favourites both
// navigate to / where the full state-aware experience lives. The brand
// link goes to the landing page.
//
// Activate the relevant nav button by passing `active` ("boxoffice", "discuss", etc.).

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Film, MessageSquare, ArrowRight, TrendingUp, Heart, LogIn, Compass } from "lucide-react";

export default function SiteHeader({ active = null }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 8);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navBtnBase = {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "7px 15px",
    borderRadius: 9,
    border: "1px solid rgba(255, 215, 0, 0.18)",
    background: "rgba(255, 215, 0, 0.03)",
    color: "#FFD700",
    fontSize: 12,
    fontWeight: 600,
    textDecoration: "none",
    fontFamily: "'Syne', sans-serif",
    letterSpacing: 0.2,
  };

  const activeBg = "rgba(255, 215, 0, 0.10)";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "18px 32px",
        borderBottom: scrolled
          ? "1px solid rgba(255, 215, 0, 0.14)"
          : "1px solid rgba(255, 255, 255, 0.04)",
        background: scrolled ? "rgba(5, 5, 5, 0.78)" : "rgba(5, 5, 5, 0.55)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
        boxShadow: scrolled
          ? "0 1px 0 rgba(255, 215, 0, 0.06), 0 8px 32px rgba(0, 0, 0, 0.35)"
          : "none",
        transition: "border-color 0.4s ease, background 0.4s ease, box-shadow 0.4s ease",
        transform: "translateZ(0)",
        willChange: "transform",
      }}
    >
      <Link
        href="/preview-landing"
        style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "#fff" }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "linear-gradient(135deg, rgba(255,215,0,0.20), rgba(255,165,0,0.06))",
            border: "1px solid rgba(255, 215, 0, 0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 18px rgba(255, 215, 0, 0.10)",
          }}
        >
          <Film size={15} style={{ color: "#FFD700" }} />
        </div>
        <span
          className="nav-brand"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: -0.4,
            whiteSpace: "nowrap",
          }}
        >
          Film <span style={{ color: "#FFD700" }}>Glance</span>
        </span>
      </Link>

      <nav aria-label="Primary" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link
          href="/discuss"
          className="nav-btn nav-discuss-btn"
          aria-label="Open Film Glance Discussion Forum"
          style={{ ...navBtnBase, background: active === "discuss" ? activeBg : navBtnBase.background }}
        >
          <MessageSquare size={13} />
          <span className="nav-forum-label">Discussion Forum</span>
          <ArrowRight size={11} className="arrow" style={{ marginLeft: 1 }} />
        </Link>

        <Link
          href="/discover"
          className="nav-btn nav-discover-btn"
          aria-label="Discover films on Film Glance"
          aria-current={active === "discover" ? "page" : undefined}
          style={{ ...navBtnBase, background: active === "discover" ? activeBg : navBtnBase.background }}
        >
          <Compass size={13} />
          <span className="nav-forum-label">Discover</span>
        </Link>

        <Link
          href="/boxoffice"
          className="nav-btn nav-boxoffice-btn"
          aria-label="Open Box Office page"
          aria-current={active === "boxoffice" ? "page" : undefined}
          style={{ ...navBtnBase, background: active === "boxoffice" ? activeBg : navBtnBase.background }}
        >
          <TrendingUp size={13} />
          <span className="nav-forum-label">Box Office</span>
        </Link>

        <Link
          href="/?favourites=1"
          className="nav-btn"
          aria-label="Open your favourites"
          style={{ ...navBtnBase, background: active === "favourites" ? activeBg : navBtnBase.background }}
        >
          <Heart size={13} />
          <span className="nav-forum-label">Favourites</span>
        </Link>

        <Link
          href="/?signin=1"
          className="nav-btn"
          aria-label="Sign in to Film Glance"
          style={{ ...navBtnBase, padding: "7px 16px" }}
        >
          <LogIn size={12} />
          <span className="nav-account-label">Sign In</span>
        </Link>
      </nav>

      <style jsx global>{`
        @media (max-width: 520px) {
          .nav-forum-label { display: none !important; }
        }
        /* v5.12.1: nav buttons stay visible on mobile (icon-only via the
           ≤520px .nav-forum-label rule above). Mobile parity is mandatory —
           nav links must never be hidden on smaller viewports. */
        @media (max-width: 560px) {
          .nav-account-label { display: none !important; }
          .nav-btn { padding: 7px 9px !important; gap: 5px !important; }
          .nav-brand { font-size: 17px !important; }
        }
      `}</style>
    </header>
  );
}
