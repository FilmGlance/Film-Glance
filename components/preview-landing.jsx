"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Film,
  Search,
  MessageSquare,
  ArrowRight,
  Star,
  Mail,
  LogIn,
  BarChart3,
  Flame,
  Youtube,
  Users,
  Award,
  DollarSign,
  Tv,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  X,
  User,
  Heart,
} from "lucide-react";
import { FloatingParticles } from "@/components/ui/floating-particles";
import { supabase } from "@/lib/supabase-browser";

/* ─────────────────────────────────────────────────────────────
   SOURCES — shown in the ticker (glyph + name only).
   ───────────────────────────────────────────────────────────── */
const SOURCES = [
  { key: "rt", name: "Rotten Tomatoes" },
  { key: "meta", name: "Metacritic" },
  { key: "imdb", name: "IMDb" },
  { key: "letterboxd", name: "Letterboxd" },
  { key: "tmdb", name: "TMDB" },
  { key: "trakt", name: "Trakt" },
  { key: "simkl", name: "Simkl" },
];

/* ─────────────────────────────────────────────────────────────
   Source glyphs — monochrome SVG, currentColor-driven.
   ───────────────────────────────────────────────────────────── */
const Glyphs = {
  rt: () => (
    <svg width="40" height="40" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="13" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 6 Q 12 3.5 14.5 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9.5 5.5 Q 8 3.5 6 4.2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </svg>
  ),
  meta: () => (
    <svg width="40" height="40" viewBox="0 0 22 22" aria-hidden="true">
      <polygon points="11,2 19,6.5 19,15.5 11,20 3,15.5 3,6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <text x="11" y="14" textAnchor="middle" fontFamily="'Playfair Display', serif" fontSize="9" fontWeight="700" fill="currentColor">M</text>
    </svg>
  ),
  imdb: () => (
    <svg width="58" height="40" viewBox="0 0 32 22" aria-hidden="true">
      <rect x="1" y="4" width="30" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <text x="16" y="14.5" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="8" fontWeight="900" fill="currentColor" letterSpacing="0.3">IMDb</text>
    </svg>
  ),
  letterboxd: () => (
    <svg width="58" height="40" viewBox="0 0 32 22" aria-hidden="true">
      <circle cx="8" cy="11" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="16" cy="11" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="24" cy="11" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  tmdb: () => (
    <svg width="40" height="40" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="2" y="5" width="18" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <polygon points="9,8.5 14.5,11 9,13.5" fill="currentColor" />
    </svg>
  ),
  trakt: () => (
    <svg width="40" height="40" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.5 11 L9.8 14.2 L15.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  simkl: () => (
    <svg width="40" height="40" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11" cy="11" r="2.8" fill="currentColor" />
    </svg>
  ),
};

/* ─────────────────────────────────────────────────────────────
   FEATURES — film strip frames.
   ───────────────────────────────────────────────────────────── */
const FEATURES = [
  { Icon: Star,       title: "True Average Rating",  body: "Every major rating averaged into one honest score." },
  { Icon: BarChart3,  title: "Source Breakdown",     body: "See every individual score, broken out by platform." },
  { Icon: Flame,      title: "Movie Hot Take",       body: "A one-line verdict distilled from every review out there." },
  { Icon: Youtube,    title: "Video Reviews",        body: "The most-watched YouTube reviews, ready to play." },
  { Icon: Users,      title: "Full Cast",            body: "Every lead actor, with their photo and credits." },
  { Icon: Award,      title: "Awards & Accolades",   body: "Oscars, festival wins, and critics' prizes tracked automatically." },
  { Icon: DollarSign, title: "Production Budget",    body: "Budget and box office side by side — see if it was worth it." },
  { Icon: Tv,         title: "Where To Watch",       body: "Streaming, rental, or purchase across every major service." },
  { Icon: Sparkles,   title: "Recommendations",      body: "Films like the one you just searched, based on audience overlap." },
];

/* ─────────────────────────────────────────────────────────────
   Letter-by-letter awakening for the hero headline.
   NOTE: no filter:blur here — filter on a child span creates a
   new stacking context that breaks the parent's background-clip:text
   gradient fill in Chromium. Opacity + translateY only.
   ───────────────────────────────────────────────────────────── */
function LetterLine({ text, offset = 0, italic = false, className, style }) {
  return (
    <span
      className={className}
      style={{ fontStyle: italic ? "italic" : "normal", display: "block", ...style }}
    >
      {text.split("").map((ch, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            opacity: 0,
            animation: `letterIn 0.85s cubic-bezier(0.16, 1, 0.3, 1) ${offset + i * 0.028}s forwards`,
          }}
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   Ornamental divider — hairline gold rules flanking a Playfair ◆.
   ───────────────────────────────────────────────────────────── */
function Ornament({ marginTop = 0, marginBottom = 0, size = 14 }) {
  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        marginTop,
        marginBottom,
        opacity: 0.55,
      }}
    >
      <span
        style={{
          width: 86,
          height: 1,
          background:
            "linear-gradient(to right, transparent, rgba(255, 215, 0, 0.38), transparent)",
        }}
      />
      <span
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: size,
          color: "rgba(255, 215, 0, 0.62)",
          lineHeight: 1,
          transform: "translateY(-1px)",
          textShadow: "0 0 14px rgba(255, 215, 0, 0.35)",
        }}
      >
        ◆
      </span>
      <span
        style={{
          width: 86,
          height: 1,
          background:
            "linear-gradient(to right, transparent, rgba(255, 215, 0, 0.38), transparent)",
        }}
      />
    </div>
  );
}

export default function PreviewLanding() {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const inputRef = useRef(null);

  /* ─── Auth state (identical pattern to the production FilmGlance
         component so behavior + styling stay consistent). ─── */
  const [authUser, setAuthUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPw, setAuthPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [authErr, setAuthErr] = useState(null);
  const [authNotice, setAuthNotice] = useState(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ─── Supabase session: load on mount + subscribe to changes. ─── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuthUser({ email: session.user.email, id: session.user.id });
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setAuthUser({ email: session.user.email, id: session.user.id });
        setShowAuth(false);
        setAuthEmail("");
        setAuthPw("");
        setAuthErr(null);
        if (event === "SIGNED_IN") {
          setAuthNotice("You're signed in! Welcome back to Film Glance.");
          setTimeout(() => setAuthNotice(null), 4000);
        }
      } else {
        setAuthUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  /* ─── Auth handlers — mirror FilmGlance exactly. ─── */
  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
  };
  const loginWithEmail = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthErr(error.message);
  };
  const signUpWithEmail = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthErr(error.message);
      return;
    }
    setShowAuth(false);
    setAuthEmail("");
    setAuthPw("");
    setAuthErr(null);
    setAuthNotice("Check your email for a verification link to activate your account.");
    setTimeout(() => setAuthNotice(null), 8000);
  };
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Logout error:", e);
    }
    setAuthUser(null);
    setShowAccountMenu(false);
  };

  const tickerSources = [...SOURCES, ...SOURCES];
  const filmFrames = [...FEATURES, ...FEATURES];

  /* Icon-led high-level steps — intentionally shorter than the
     film-strip details that follow in "What You'll Find". */
  const HOW = [
    {
      Icon: Search,
      title: "Search",
      body: "Stop going to an endless amount of movie sites to find out if it's good.\nLook for a movie here and we do the leg-work by pulling those scores and averaging them out to create one TRUE rating score.",
    },
    {
      Icon: Star,
      title: "Glance",
      body: "Additionally, we also bring you every interesting movie fact you can think of.",
    },
    {
      Icon: MessageSquare,
      title: "Discuss",
      body: "Join our forum to connect, discuss and share insights on movies and the industry with fellow movie diehards.",
    },
  ];

  const footerLinks = [
    { Icon: Search, label: "Search", href: "/" },
    { Icon: MessageSquare, label: "Discussion Forum", href: "/discuss" },
    { Icon: Mail, label: "Contact", href: "mailto:support@filmglance.com", external: true },
    { Icon: LogIn, label: "Sign In", href: "/" },
  ];

  return (
    <div
      onClick={() => showAccountMenu && setShowAccountMenu(false)}
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "#fff",
        fontFamily: "'Syne', sans-serif",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,700&family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #050505; }
        ::selection { background: rgba(255, 215, 0, 0.22); color: #fff; }

        /* ── Atmosphere: spotlight, vignette, grain ── */
        .bg-spotlight {
          position: fixed;
          top: -30vh;
          left: 50%;
          width: 150vw;
          height: 130vh;
          transform: translateX(-50%);
          background:
            radial-gradient(ellipse 55% 48% at 50% 0%,
              rgba(255, 220, 120, 0.13) 0%,
              rgba(232, 160, 0, 0.06) 22%,
              rgba(232, 160, 0, 0.02) 42%,
              transparent 65%);
          pointer-events: none;
          z-index: 1;
          animation: spotlightWarm 2.8s ease-out both;
        }
        @keyframes spotlightWarm {
          from { opacity: 0; transform: translateX(-50%) scale(1.04); filter: blur(12px); }
          to   { opacity: 1; transform: translateX(-50%) scale(1); filter: blur(0); }
        }
        .bg-vignette {
          position: fixed;
          inset: 0;
          background: radial-gradient(ellipse 110% 85% at 50% 50%,
            transparent 52%,
            rgba(0, 0, 0, 0.45) 85%,
            rgba(0, 0, 0, 0.85) 100%);
          pointer-events: none;
          z-index: 5;
        }
        .bg-grain {
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.85'/></svg>");
          mix-blend-mode: overlay;
          opacity: 0.085;
          pointer-events: none;
          z-index: 6;
        }

        /* ── WebGL particles wrapper ── */
        .fg-particles-wrap {
          position: fixed;
          inset: 0;
          z-index: 3;
          pointer-events: none;
          opacity: 0;
          animation: softFade 1.8s ease-out 0.4s forwards;
        }

        /* ── Animations ── */
        @keyframes letterIn {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes softFade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes goldShimmer {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        @keyframes haloBreathe {
          0%, 100% { text-shadow: 0 0 10px rgba(255, 215, 0, 0.22); }
          50%      { text-shadow: 0 0 18px rgba(255, 215, 0, 0.32); }
        }

        /* ── Hero accent: gradient text + breathing halo ── */
        .hero-accent {
          background: linear-gradient(135deg, #FFE27A 0%, #FFD700 32%, #E8A000 62%, #FFD700 100%);
          background-size: 220% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: goldShimmer 6s ease-in-out infinite, haloBreathe 5s ease-in-out infinite;
        }

        /* ── Ticker ── */
        .ticker-viewport {
          overflow: hidden;
          mask-image: linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%);
          -webkit-mask-image: linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%);
        }
        .ticker-track {
          display: inline-flex;
          gap: 64px;
          align-items: center;
          white-space: nowrap;
          animation: ticker 44s linear infinite;
          color: rgba(255, 255, 255, 0.34);
          will-change: transform;
        }
        .ticker-track:hover { animation-play-state: paused; }
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          padding: 0 4px;
          transition: color 0.5s ease, transform 0.5s ease;
        }
        .ticker-item:hover {
          color: rgba(255, 215, 0, 0.9);
          transform: translateY(-1px);
        }

        /* ── Conic gold aura on the search bar ── */
        .glow-wrap { position: relative; }
        .glow-layer {
          position: absolute;
          z-index: 1;
          overflow: hidden;
          height: 100%;
          width: 100%;
          border-radius: 18px;
          pointer-events: none;
        }
        .glow-layer::before {
          content: '';
          position: absolute;
          z-index: -1;
          width: 900px;
          height: 900px;
          top: 50%;
          left: 50%;
          background-repeat: no-repeat;
          transform: translate(-50%, -50%) rotate(60deg);
          transition: all 2.2s ease;
        }
        .glow-1 { max-height: 80px; filter: blur(4px); }
        .glow-1::before { background: conic-gradient(#000, #b8860b 5%, #000 40%, #000 50%, #E8A000 62%, #000 88%); }
        .glow-wrap:hover .glow-1::before,
        .glow-wrap:focus-within .glow-1::before { transform: translate(-50%, -50%) rotate(420deg); transition-duration: 4.2s; }
        .glow-2 { max-height: 74px; filter: blur(3px); }
        .glow-2::before {
          width: 700px; height: 700px;
          background: conic-gradient(rgba(0,0,0,0), #ffe082, rgba(0,0,0,0) 10%, rgba(0,0,0,0) 50%, #ffd54f, rgba(0,0,0,0) 60%);
          transform: translate(-50%, -50%) rotate(83deg);
          filter: brightness(1.3);
        }
        .glow-wrap:hover .glow-2::before,
        .glow-wrap:focus-within .glow-2::before { transform: translate(-50%, -50%) rotate(443deg); transition-duration: 4.2s; }
        .glow-core { max-height: 66px; filter: blur(0.5px); }
        .glow-core::before {
          width: 700px; height: 700px;
          background: conic-gradient(#0a0a0a, #b8860b 5%, #0a0a0a 14%, #0a0a0a 50%, #E8A000 60%, #0a0a0a 64%);
          filter: brightness(1.35);
          transform: translate(-50%, -50%) rotate(70deg);
        }
        .glow-wrap:hover .glow-core::before,
        .glow-wrap:focus-within .glow-core::before { transform: translate(-50%, -50%) rotate(430deg); transition-duration: 4.2s; }
        .glow-mask {
          position: absolute; width: 38px; height: 22px; background: #E8A000;
          top: 12px; left: 10px; filter: blur(28px); opacity: 0.55;
          transition: opacity 2s; pointer-events: none; z-index: 3;
        }
        .glow-wrap:hover .glow-mask,
        .glow-wrap:focus-within .glow-mask { opacity: 0; }

        /* ── Nav button hover ── */
        .nav-btn { transition: border-color 0.35s ease, background 0.35s ease, box-shadow 0.35s ease; }
        .nav-btn:hover {
          border-color: rgba(255, 215, 0, 0.55) !important;
          background: rgba(255, 215, 0, 0.08) !important;
          box-shadow: 0 0 22px rgba(255, 215, 0, 0.22), 0 0 48px rgba(255, 215, 0, 0.08);
        }
        .nav-btn .arrow { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .nav-btn:hover .arrow { transform: translateX(3px); }

        /* ── Footer link hover ── */
        .footer-link {
          display: inline-flex; align-items: center; gap: 7px;
          color: rgba(255, 255, 255, 0.52); text-decoration: none;
          transition: color 0.3s ease, transform 0.3s ease;
        }
        .footer-link:hover { color: #FFD700; transform: translateY(-1px); }

        /* ── How-it-works card hover ── */
        .how-card { transition: all 0.45s cubic-bezier(0.16, 1, 0.3, 1); }
        .how-card:hover {
          border-color: rgba(255, 215, 0, 0.22) !important;
          transform: translateY(-4px);
          box-shadow: 0 18px 52px rgba(255, 215, 0, 0.09), 0 0 0 1px rgba(255, 215, 0, 0.06) inset;
        }
        .how-card:hover .how-icon { color: #FFE27A; filter: drop-shadow(0 0 18px rgba(255, 215, 0, 0.45)); }
        .how-icon {
          color: #FFD700;
          filter: drop-shadow(0 0 12px rgba(255, 215, 0, 0.22));
          transition: color 0.4s ease, filter 0.4s ease;
        }

        /* ─────────── FILM STRIP (What You'll Find) ─────────── */
        .strip-outer {
          position: relative;
          margin: 24px 0 48px;
          background:
            linear-gradient(to bottom,
              rgba(255, 215, 0, 0.055) 0%,
              rgba(255, 215, 0, 0.08) 18%,
              rgba(14, 12, 6, 0.7) 18%,
              rgba(14, 12, 6, 0.7) 82%,
              rgba(255, 215, 0, 0.08) 82%,
              rgba(255, 215, 0, 0.055) 100%);
          border-top: 1px solid rgba(255, 215, 0, 0.14);
          border-bottom: 1px solid rgba(255, 215, 0, 0.14);
          box-shadow:
            0 0 60px rgba(255, 215, 0, 0.04),
            inset 0 1px 0 rgba(255, 215, 0, 0.05),
            inset 0 -1px 0 rgba(255, 215, 0, 0.05);
        }

        .sprocket-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 18px;
          height: 28px;
          gap: 10px;
        }
        .sprocket-hole {
          flex: 1;
          min-width: 14px;
          max-width: 22px;
          height: 12px;
          background: #050505;
          border-radius: 2px;
          box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.8);
        }

        .film-track-viewport {
          overflow: hidden;
          mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
          -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
        }
        .film-track {
          display: inline-flex;
          animation: filmScroll 56s linear infinite;
          will-change: transform;
        }
        .film-track:hover { animation-play-state: paused; }
        @keyframes filmScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .film-frame {
          flex-shrink: 0;
          width: 244px;
          height: 180px;
          padding: 26px 24px;
          text-align: left;
          border-right: 1px solid rgba(255, 215, 0, 0.09);
          background: rgba(10, 10, 10, 0.4);
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }
        .film-frame::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 60% at 50% 50%, rgba(255, 215, 0, 0.06) 0%, transparent 70%);
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
        }
        .film-frame:hover::before { opacity: 1; }
        .film-frame:hover {
          background: rgba(22, 18, 6, 0.6);
          box-shadow:
            inset 0 0 28px rgba(255, 215, 0, 0.08),
            inset 0 0 0 1px rgba(255, 215, 0, 0.14);
        }
        .film-frame:hover .film-icon {
          color: #FFE27A;
          filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.55));
          transform: scale(1.08) translateY(-1px);
        }
        .film-icon {
          color: rgba(255, 215, 0, 0.78);
          filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.24));
          margin-bottom: 14px;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          display: block;
        }
        .film-title {
          font-family: 'Playfair Display', serif;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.2px;
          margin-bottom: 8px;
          color: #fff;
          line-height: 1.18;
        }
        .film-body {
          font-family: 'Syne', sans-serif;
          font-size: 12.5px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.58);
          line-height: 1.5;
        }
        .film-frame-num {
          position: absolute;
          top: 12px;
          right: 14px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          letter-spacing: 1.5px;
          color: rgba(255, 215, 0, 0.28);
          font-weight: 600;
        }

        /* ── Responsive ── */
        @media (max-width: 860px) {
          .hero-h1 { font-size: clamp(44px, 13vw, 74px) !important; letter-spacing: -1.2px !important; }
          .how-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
          .ticker-track { gap: 44px !important; animation-duration: 32s !important; }
          .film-frame { width: 210px !important; padding: 22px 20px !important; }
          .film-title { font-size: 15.5px !important; }
          .footer-nav { gap: 18px !important; font-size: 12px !important; }
        }
        @media (max-width: 520px) {
          .nav-forum-label { display: none !important; }
          .hero-section { padding-top: 44px !important; padding-bottom: 36px !important; }
          .section-how { padding: 24px 20px 48px !important; }
          .how-card { padding: 24px 22px !important; }
          .film-frame { width: 190px !important; height: 170px !important; }
          .sprocket-row { padding: 5px 12px !important; }
          .footer-nav { flex-direction: column !important; gap: 14px !important; }
        }

        /* ── Reduced motion ── */
        @media (prefers-reduced-motion: reduce) {
          .ticker-track,
          .bg-spotlight,
          .hero-accent,
          .fg-particles-wrap,
          .film-track { animation: none !important; }
          .hero-h1 span,
          form.hero-search { opacity: 1 !important; animation: none !important; }
        }
      `,
        }}
      />

      {/* ─────────────── Atmosphere layers ─────────────── */}
      <div className="bg-spotlight" aria-hidden="true" />
      <div className="fg-particles-wrap" aria-hidden="true">
        <FloatingParticles
          particleCount={3500}
          particleColor1="#FFD700"
          particleColor2="#FFE4A0"
          cameraDistance={1000}
          rotationSpeed={0.06}
          particleSize={14}
          antigravityForce={30}
          activationRate={30}
        />
      </div>
      <div className="bg-vignette" aria-hidden="true" />
      <div className="bg-grain" aria-hidden="true" />

      {/* ─────────────── Header ─────────────── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: scrolled ? "13px 32px" : "18px 32px",
          borderBottom: scrolled
            ? "1px solid rgba(255, 215, 0, 0.14)"
            : "1px solid rgba(255, 255, 255, 0.04)",
          background: scrolled ? "rgba(5, 5, 5, 0.78)" : "rgba(5, 5, 5, 0.55)",
          backdropFilter: "blur(24px) saturate(1.4)",
          WebkitBackdropFilter: "blur(24px) saturate(1.4)",
          boxShadow: scrolled
            ? "0 1px 0 rgba(255, 215, 0, 0.06), 0 8px 32px rgba(0, 0, 0, 0.35)"
            : "none",
          transition: "padding 0.35s ease, border-color 0.4s ease, background 0.4s ease, box-shadow 0.4s ease",
        }}
      >
        <Link href="/preview-landing" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "#fff" }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, rgba(255,215,0,0.20), rgba(255,165,0,0.06))",
              border: "1px solid rgba(255, 215, 0, 0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 18px rgba(255, 215, 0, 0.10)",
            }}
          >
            <Film size={15} style={{ color: "#FFD700" }} />
          </div>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 700, letterSpacing: -0.4 }}>
            Film <span style={{ color: "#FFD700" }}>Glance</span>
          </span>
        </Link>

        <nav aria-label="Primary" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/discuss"
            className="nav-btn"
            aria-label="Open Film Glance Discussion Forum"
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "7px 15px", borderRadius: 9,
              border: "1px solid rgba(255, 215, 0, 0.18)",
              background: "rgba(255, 215, 0, 0.03)",
              color: "#FFD700", fontSize: 12, fontWeight: 600,
              textDecoration: "none", fontFamily: "'Syne', sans-serif", letterSpacing: 0.2,
            }}
          >
            <MessageSquare size={13} />
            <span className="nav-forum-label">Discussion Forum</span>
            <ArrowRight size={11} className="arrow" style={{ marginLeft: 1 }} />
          </Link>
          {authUser && (
            <Link
              href="/#favourites"
              className="nav-btn"
              aria-label="Open your favourites"
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "7px 15px", borderRadius: 9,
                border: "1px solid rgba(255, 215, 0, 0.18)",
                background: "rgba(255, 215, 0, 0.03)",
                color: "#FFD700", fontSize: 12, fontWeight: 600,
                textDecoration: "none", fontFamily: "'Syne', sans-serif", letterSpacing: 0.2,
              }}
            >
              <Heart size={13} />
              <span className="nav-forum-label">Favourites</span>
            </Link>
          )}
          {authUser ? (
            <div style={{ position: "relative" }}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowAccountMenu(!showAccountMenu); }}
                className="nav-btn"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "7px 16px", borderRadius: 9,
                  border: "1px solid rgba(255, 215, 0, 0.18)",
                  background: "rgba(255, 215, 0, 0.03)",
                  color: "#FFD700", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'Syne', sans-serif", letterSpacing: 0.2,
                }}
              >
                <User size={12} /> My Account
              </button>
              {showAccountMenu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute", top: 42, right: 0,
                    background: "#0a0a0a",
                    border: "1px solid rgba(255, 215, 0, 0.12)",
                    borderRadius: 12, padding: "10px 0", minWidth: 220,
                    zIndex: 100, animation: "softFade 0.2s ease-out",
                  }}
                >
                  <div style={{ padding: "6px 16px 10px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <p style={{ fontSize: 10.5, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {authUser.email}
                    </p>
                  </div>
                  <button
                    onClick={() => { setShowAccountMenu(false); logout(); }}
                    style={{
                      width: "100%", padding: "10px 16px",
                      background: "none", border: "none",
                      color: "#ef4444", fontSize: 12, fontWeight: 600,
                      cursor: "pointer", textAlign: "left",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    <X size={12} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="nav-btn"
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "7px 16px", borderRadius: 9,
                border: "1px solid rgba(255, 215, 0, 0.18)",
                background: "rgba(255, 215, 0, 0.03)",
                color: "#FFD700", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "'Syne', sans-serif", letterSpacing: 0.2,
              }}
            >
              <LogIn size={12} />
              Sign In
            </button>
          )}
        </nav>
      </header>

      {/* ─────────────── Main ─────────────── */}
      <main style={{ position: "relative", zIndex: 10 }}>
        {/* ─────────── Hero ─────────── */}
        <section
          className="hero-section"
          aria-label="Hero"
          style={{
            textAlign: "center",
            padding: "clamp(80px, 14vh, 160px) 24px 72px",
            maxWidth: 920, margin: "0 auto", position: "relative",
          }}
        >
          <h1
            className="hero-h1"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(52px, 8.6vw, 104px)",
              fontWeight: 700, lineHeight: 1.02, letterSpacing: -1.8,
              marginBottom: 44,
            }}
          >
            <LetterLine text="Every Film." offset={0.15} />
            <span
              className="hero-accent"
              style={{
                fontStyle: "italic",
                display: "block",
                opacity: 0,
                animation: "softFade 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.9s forwards",
              }}
            >
              One True Rating Score.
            </span>
          </h1>

          <form
            action="/"
            method="get"
            className="hero-search"
            style={{
              position: "relative", maxWidth: 640, margin: "0 auto",
              opacity: 0,
              animation: "softFade 1.1s cubic-bezier(0.16, 1, 0.3, 1) 1.6s forwards",
            }}
            onSubmit={(e) => { if (!query.trim()) e.preventDefault(); }}
          >
            <div className="glow-wrap" style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <div className="glow-layer glow-1" />
              <div className="glow-layer glow-2" />
              <div className="glow-layer glow-core" />
              <div className="glow-mask" />
              <div style={{ position: "relative", width: "100%", zIndex: 2 }}>
                <Search
                  size={18}
                  style={{
                    position: "absolute", left: 20, top: "50%",
                    transform: "translateY(-50%)",
                    color: isFocused ? "rgba(255, 215, 0, 0.85)" : "#3a3a3a",
                    pointerEvents: "none", zIndex: 3,
                    transition: "color 0.35s ease",
                  }}
                />
                <input
                  ref={inputRef}
                  name="q"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Search any film ever made…"
                  aria-label="Search any film"
                  autoComplete="off"
                  spellCheck="false"
                  style={{
                    width: "100%",
                    padding: "20px 132px 20px 52px",
                    background: "#050505", border: "none", borderRadius: 16,
                    color: "#fff", fontSize: 16,
                    fontFamily: "'Syne', sans-serif", outline: "none",
                  }}
                />
                <button
                  type="submit"
                  aria-label="Glance"
                  style={{
                    position: "absolute", right: 7, top: "50%",
                    transform: "translateY(-50%)",
                    padding: "11px 28px", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg, #FFD700 0%, #E8A000 100%)",
                    color: "#050505", fontSize: 13.5, fontWeight: 700, letterSpacing: 0.6,
                    cursor: "pointer", fontFamily: "'Syne', sans-serif",
                    boxShadow: "0 4px 20px rgba(255, 215, 0, 0.28), 0 0 0 1px rgba(255, 215, 0, 0.15) inset",
                    zIndex: 3,
                  }}
                >
                  Glance
                </button>
              </div>
            </div>
          </form>
        </section>

        <Ornament marginTop={0} marginBottom={0} />

        {/* ─────────── Ticker ─────────── */}
        <section
          aria-label="Review sites included"
          style={{
            position: "relative",
            padding: "20px 0 22px",
            borderTop: "1px solid rgba(255, 255, 255, 0.04)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
            background: "rgba(10, 10, 10, 0.42)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            opacity: 0,
            animation: "softFade 1.2s ease-out 2.2s forwards",
          }}
        >
          <div
            style={{
              textAlign: "center", marginBottom: 18,
              fontFamily: "'Playfair Display', serif",
              fontSize: 22, fontWeight: 600,
              fontStyle: "italic",
              letterSpacing: -0.2,
              color: "rgba(255, 215, 0, 0.78)",
            }}
          >
            Review Sites Included
          </div>
          <div className="ticker-viewport">
            <div className="ticker-track">
              {tickerSources.map((src, i) => {
                const GlyphComp = Glyphs[src.key];
                return (
                  <div
                    key={`${src.key}-${i}`}
                    className="ticker-item"
                    aria-hidden={i >= SOURCES.length ? "true" : "false"}
                  >
                    <GlyphComp />
                    <span
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: 16, fontWeight: 600, letterSpacing: 0.2,
                      }}
                    >
                      {src.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <Ornament marginTop={32} marginBottom={0} />

        {/* ─────────── How It Works ─────────── */}
        <section
          className="section-how"
          aria-label="How it works"
          style={{ maxWidth: 1060, margin: "0 auto", padding: "32px 24px 56px" }}
        >
          <div style={{ textAlign: "center", marginBottom: 38 }}>
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 28, fontWeight: 600,
                fontStyle: "italic",
                letterSpacing: -0.4,
                color: "rgba(255, 215, 0, 0.85)",
              }}
            >
              How It Works
            </div>
          </div>

          <div
            className="how-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}
          >
            {HOW.map((s) => {
              const Icon = s.Icon;
              return (
                <article
                  key={s.title}
                  className="how-card"
                  style={{
                    padding: "30px 28px",
                    background: "rgba(10, 10, 10, 0.5)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    borderRadius: 16,
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    textAlign: "center",
                  }}
                >
                  <Icon size={26} strokeWidth={1.5} className="how-icon" style={{ marginBottom: 18 }} />
                  <h3
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: 26, fontWeight: 700, letterSpacing: -0.4,
                      marginBottom: 10,
                    }}
                  >
                    {s.title}
                  </h3>
                  <span
                    aria-hidden="true"
                    style={{
                      display: "block",
                      width: 44,
                      height: 1,
                      background:
                        "linear-gradient(to right, rgba(255, 215, 0, 0.05), rgba(255, 215, 0, 0.65), rgba(255, 215, 0, 0.05))",
                      margin: "0 auto 18px",
                      boxShadow: "0 0 8px rgba(255, 215, 0, 0.28)",
                    }}
                  />
                  <p
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: 17,
                      fontWeight: 400,
                      color: "rgba(255, 242, 220, 0.88)",
                      lineHeight: 1.7,
                      letterSpacing: 0.1,
                    }}
                  >
                    {s.body.split("\n").map((line, i) => (
                      <span
                        key={i}
                        style={{
                          display: "block",
                          marginTop: i === 0 ? 0 : 16,
                        }}
                      >
                        {line}
                      </span>
                    ))}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <Ornament marginTop={0} marginBottom={0} />

        {/* ─────────── What You'll Find (Film Strip) ─────────── */}
        <section
          aria-label="What you'll find in every film glance"
          style={{ padding: "40px 0 20px" }}
        >
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 28, fontWeight: 600,
                fontStyle: "italic",
                letterSpacing: -0.4,
                color: "rgba(255, 215, 0, 0.85)",
              }}
            >
              What You'll Find
            </div>
            <p
              style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: 13, fontWeight: 500,
                color: "rgba(255, 255, 255, 0.42)",
                marginTop: 8,
                letterSpacing: 0.2,
              }}
            >
              Inside every Glance.
            </p>
          </div>

          <div className="strip-outer">
            {/* Top sprockets */}
            <div className="sprocket-row" aria-hidden="true">
              {Array.from({ length: 32 }).map((_, i) => (
                <span key={`st-${i}`} className="sprocket-hole" />
              ))}
            </div>

            {/* Film track */}
            <div className="film-track-viewport">
              <div className="film-track">
                {filmFrames.map((f, i) => {
                  const Icon = f.Icon;
                  const isClone = i >= FEATURES.length;
                  return (
                    <article
                      key={`frame-${i}`}
                      className="film-frame"
                      aria-hidden={isClone ? "true" : "false"}
                    >
                      <Icon size={26} strokeWidth={1.6} className="film-icon" />
                      <h3 className="film-title">{f.title}</h3>
                      <p className="film-body">{f.body}</p>
                    </article>
                  );
                })}
              </div>
            </div>

            {/* Bottom sprockets */}
            <div className="sprocket-row" aria-hidden="true">
              {Array.from({ length: 32 }).map((_, i) => (
                <span key={`sb-${i}`} className="sprocket-hole" />
              ))}
            </div>
          </div>
        </section>

        <Ornament marginTop={0} marginBottom={0} />

        {/* ─────────── Footer ─────────── */}
        <footer
          style={{
            borderTop: "1px solid rgba(255, 255, 255, 0.04)",
            padding: "32px 24px 40px",
            textAlign: "center",
            position: "relative",
            background: "linear-gradient(to top, rgba(15, 12, 5, 0.6), rgba(5, 5, 5, 0))",
          }}
        >
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 22, fontWeight: 700,
              letterSpacing: -0.4, marginBottom: 18,
            }}
          >
            Film <span style={{ color: "#FFD700" }}>Glance</span>
          </div>

          <nav
            aria-label="Footer"
            className="footer-nav"
            style={{
              display: "flex", justifyContent: "center", alignItems: "center",
              gap: 28,
              fontFamily: "'Syne', sans-serif",
              fontSize: 12.5, fontWeight: 500,
              flexWrap: "wrap", marginBottom: 20,
            }}
          >
            {footerLinks.map((link) => {
              const Icon = link.Icon;
              const content = (
                <>
                  <Icon size={13} strokeWidth={1.8} />
                  {link.label}
                </>
              );
              return link.external ? (
                <a key={link.label} href={link.href} className="footer-link">
                  {content}
                </a>
              ) : (
                <Link key={link.label} href={link.href} className="footer-link">
                  {content}
                </Link>
              );
            })}
          </nav>

          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10, fontWeight: 500,
              letterSpacing: 2.4, textTransform: "uppercase",
              color: "rgba(255, 255, 255, 0.32)",
            }}
          >
            © 2026 Film Glance · Every Film. One True Rating Score.
          </div>
        </footer>
      </main>

      {/* ─────────────── Auth Modal ─────────────── */}
      {showAuth && (
        <div
          onClick={() => setShowAuth(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0, 0, 0, 0.88)",
            backdropFilter: "blur(22px)",
            WebkitBackdropFilter: "blur(22px)",
            animation: "softFade 0.25s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 390,
              background: "#070707",
              borderRadius: 20,
              border: "1px solid rgba(255, 215, 0, 0.07)",
              padding: "36px 30px",
              position: "relative",
            }}
          >
            <button
              onClick={() => setShowAuth(false)}
              aria-label="Close"
              style={{
                position: "absolute", top: 14, right: 14,
                background: "none", border: "none",
                color: "#444", cursor: "pointer",
              }}
            >
              <X size={17} />
            </button>

            <div style={{ textAlign: "center", marginBottom: 26 }}>
              <div
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  margin: "0 auto 12px",
                  background: "linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,165,0,0.06))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid rgba(255, 215, 0, 0.1)",
                }}
              >
                <Film size={20} style={{ color: "#FFD700" }} />
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#fff", margin: 0 }}>
                {authMode === "signup" ? "Create Account" : "Welcome Back"}
              </h2>
              <p style={{ color: "#444", fontSize: 12, marginTop: 6 }}>
                {authMode === "signup" ? "Sign up to start rating" : "Sign in to continue"}
              </p>
            </div>

            <button
              onClick={loginWithGoogle}
              style={{
                width: "100%", padding: "10px", borderRadius: 11,
                border: "1px solid #1e1e1e", background: "#0c0c0c",
                color: "#ccc", fontSize: 12.5, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 9, marginBottom: 16,
              }}
            >
              Continue with Google
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
              <span style={{ color: "#333", fontSize: 11 }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <div style={{ position: "relative" }}>
                <Mail size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#333" }} />
                <input
                  type="email"
                  placeholder="Email address"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px 10px 36px",
                    borderRadius: 10, border: "1px solid #1a1a1a",
                    background: "#0a0a0a", color: "#fff", fontSize: 13,
                    fontFamily: "system-ui, -apple-system, sans-serif",
                  }}
                />
              </div>
              <div style={{ position: "relative" }}>
                <Lock size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#333" }} />
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Password"
                  value={authPw}
                  onChange={(e) => setAuthPw(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      authMode === "signup"
                        ? signUpWithEmail(authEmail, authPw)
                        : loginWithEmail(authEmail, authPw);
                    }
                  }}
                  style={{
                    width: "100%", padding: "10px 36px 10px 36px",
                    borderRadius: 10, border: "1px solid #1a1a1a",
                    background: "#0a0a0a", color: "#fff", fontSize: 13,
                    fontFamily: "system-ui, -apple-system, sans-serif",
                  }}
                />
                <button
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute", right: 10, top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none",
                    color: "#333", cursor: "pointer",
                  }}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {authErr && (
              <p style={{ color: "#ef4444", fontSize: 11, marginBottom: 10, textAlign: "center" }}>
                {authErr}
              </p>
            )}

            <button
              onClick={() => {
                authMode === "signup"
                  ? signUpWithEmail(authEmail, authPw)
                  : loginWithEmail(authEmail, authPw);
              }}
              style={{
                width: "100%", padding: "12px",
                borderRadius: 11, border: "none",
                background: "linear-gradient(135deg, #FFD700, #E8A000)",
                color: "#050505", fontSize: 13.5, fontWeight: 700,
                cursor: "pointer", marginBottom: 14,
              }}
            >
              {authMode === "signup" ? "Create Account" : "Sign In"}
            </button>

            <p style={{ textAlign: "center", fontSize: 11.5, color: "#444" }}>
              {authMode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
              <span
                onClick={() => {
                  setAuthMode(authMode === "signup" ? "signin" : "signup");
                  setAuthErr(null);
                }}
                style={{ color: "#FFD700", cursor: "pointer", fontWeight: 600 }}
              >
                {authMode === "signup" ? "Sign In" : "Sign Up"}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* ─────────────── Auth Notice Toast ─────────────── */}
      {authNotice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed", top: 24, left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1100,
            padding: "12px 22px",
            background: "rgba(10, 10, 10, 0.92)",
            border: "1px solid rgba(255, 215, 0, 0.25)",
            borderRadius: 12,
            color: "#fff",
            fontFamily: "'Syne', sans-serif",
            fontSize: 13, fontWeight: 500,
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5), 0 0 24px rgba(255, 215, 0, 0.15)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            animation: "softFade 0.3s ease-out",
          }}
        >
          {authNotice}
        </div>
      )}
    </div>
  );
}
