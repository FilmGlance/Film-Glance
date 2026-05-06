import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Search, Star, ExternalLink, X, ChevronDown, Zap, Crown,
  Eye, EyeOff, Mail, Lock, User, Film, TrendingUp, Loader2, Check,
  Users, RefreshCw, Play, Tv, DollarSign, Award, Heart, Trash2,
  MessageSquare, ArrowRight, ChevronRight, LogIn, BarChart3, Flame, Video, Sparkles,
  ThumbsUp, ThumbsDown, Clock, Calendar, Trophy, Globe, Quote,
  Music, BookOpen, Gauge,
  Camera, Wand2, Lightbulb, Activity, Ghost, Swords, Palette, Scroll, Mic,
  Folder, FolderPlus, FolderOpen, FolderInput, Pencil, Plus, Inbox, Library,
  Menu
} from "lucide-react";
import { supabase } from "@/lib/supabase-browser";
import { GridBackground } from "@/components/ui/grid-background";
import { isValidYouTubeId } from "@/lib/sanitize";
const FG_VERSION = "5.12.0";

/* ═══════════════════════════════════════════════════════════════════════════
   NEW LANDING DATA + HELPERS (promoted from /preview-landing)
   ═══════════════════════════════════════════════════════════════════════════ */
const SOURCES = [
  { key: "rt", name: "Rotten Tomatoes" },
  { key: "meta", name: "Metacritic" },
  { key: "imdb", name: "IMDb" },
  { key: "letterboxd", name: "Letterboxd" },
  { key: "tmdb", name: "TMDB" },
  { key: "trakt", name: "Trakt" },
  { key: "simkl", name: "Simkl" },
];

const Glyphs = {
  rt: () => (<svg width="40" height="40" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="13" r="7" fill="none" stroke="currentColor" strokeWidth="1.4"/><path d="M11 6 Q 12 3.5 14.5 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M9.5 5.5 Q 8 3.5 6 4.2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/></svg>),
  meta: () => (<svg width="40" height="40" viewBox="0 0 22 22" aria-hidden="true"><polygon points="11,2 19,6.5 19,15.5 11,20 3,15.5 3,6.5" fill="none" stroke="currentColor" strokeWidth="1.4"/><text x="11" y="14" textAnchor="middle" fontFamily="'Playfair Display', serif" fontSize="9" fontWeight="700" fill="currentColor">M</text></svg>),
  imdb: () => (<svg width="58" height="40" viewBox="0 0 32 22" aria-hidden="true"><rect x="1" y="4" width="30" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.4"/><text x="16" y="14.5" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="8" fontWeight="900" fill="currentColor" letterSpacing="0.3">IMDb</text></svg>),
  letterboxd: () => (<svg width="58" height="40" viewBox="0 0 32 22" aria-hidden="true"><circle cx="8" cy="11" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4"/><circle cx="16" cy="11" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4"/><circle cx="24" cy="11" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4"/></svg>),
  tmdb: () => (<svg width="40" height="40" viewBox="0 0 22 22" aria-hidden="true"><rect x="2" y="5" width="18" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.4"/><polygon points="9,8.5 14.5,11 9,13.5" fill="currentColor"/></svg>),
  trakt: () => (<svg width="40" height="40" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="1.4"/><path d="M6.5 11 L9.8 14.2 L15.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  simkl: () => (<svg width="40" height="40" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="1.4"/><circle cx="11" cy="11" r="2.8" fill="currentColor"/></svg>),
};

const FEATURES = [
  { Icon: Star,       title: "True Average Rating",  body: "Every major rating averaged into one honest score." },
  { Icon: BarChart3,  title: "Source Breakdown",     body: "See every individual score, broken out by platform." },
  { Icon: Flame,      title: "Movie Hot Take",       body: "A one-line verdict distilled from every review out there." },
  { Icon: Video,    title: "Video Reviews",        body: "The most-watched YouTube reviews, ready to play." },
  { Icon: Users,      title: "Full Cast",            body: "Every lead actor, with their photo and credits." },
  { Icon: Award,      title: "Awards & Accolades",   body: "Oscars, festival wins, and critics' prizes tracked automatically." },
  { Icon: DollarSign, title: "Production Budget",    body: "Budget and box office side by side — see if it was worth it." },
  { Icon: Tv,         title: "Where To Watch",       body: "Streaming, rental, or purchase across every major service." },
  { Icon: Sparkles,   title: "Recommendations",      body: "Films like the one you just searched, based on audience overlap." },
];

function LetterLine({ text, offset = 0, className, style }) {
  return (
    <span className={className} style={{ display: "block", ...style }}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          style={{ display: "inline-block" }}
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}

function Ornament({ marginTop = 0, marginBottom = 0 }) {
  return (
    <div aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginTop, marginBottom, opacity: 0.55 }}>
      <span style={{ width: 86, height: 1, background: "linear-gradient(to right, transparent, rgba(255, 215, 0, 0.38), transparent)" }} />
      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, color: "rgba(255, 215, 0, 0.62)", lineHeight: 1, transform: "translateY(-1px)", textShadow: "0 0 14px rgba(255, 215, 0, 0.35)" }}>◆</span>
      <span style={{ width: 86, height: 1, background: "linear-gradient(to right, transparent, rgba(255, 215, 0, 0.38), transparent)" }} />
    </div>
  );
}
if (typeof window !== "undefined") window.__FG = FG_VERSION;

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const COLORS = [
  ["#0f0326","#2d1160","#7c3aed"],["#031526","#0c3a6e","#2563eb"],
  ["#260505","#6e1212","#dc2626"],["#032612","#0c5a2e","#16a34a"],
  ["#261a03","#6e4a0c","#d97706"],["#1a0326","#4a0c6e","#9333ea"],
  ["#032626","#0c5a5a","#0d9488"],["#1a1a03","#5a5a0c","#ca8a04"],
  ["#03061a","#0c125a","#4f46e5"],["#260f05","#6e3012","#ea580c"],
  ["#0d0326","#2a0c6e","#7c3aed"],["#031a1a","#0c4a4a","#0891b2"],
];

const IMG = "https://image.tmdb.org/t/p/";

/* ═══════════════════════════════════════════════════════════════════════════
   POSTER — real image attempt + SVG fallback
   ═══════════════════════════════════════════════════════════════════════════ */
function PosterCard({ title, year, genre, posterUrl }) {
  const [imgOk, setImgOk] = useState(false);
  const [imgFail, setImgFail] = useState(false);
  const [bg, mid, hi] = COLORS[hash(title) % COLORS.length];
  const h = hash(title);
  const g = (genre || "Film").split(" ")[0].toUpperCase();
  const short = title.length > 22 ? title.substring(0, 20) + "..." : title;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", borderRadius: 12, background: bg }}>
      {posterUrl && !imgFail && (
        <img
          src={posterUrl}
          alt={title}
          referrerPolicy="no-referrer"
          onLoad={() => setImgOk(true)}
          onError={() => setImgFail(true)}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", zIndex: imgOk ? 2 : 0, opacity: imgOk ? 1 : 0,
            transition: "opacity 0.4s"
          }}
        />
      )}
      {!imgOk && (
        <div style={{ position: "absolute", inset: 0, zIndex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 12 }}>
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(160deg, ${bg} 0%, ${mid} 50%, ${bg} 100%)`
          }} />
          <div style={{
            position: "absolute", top: -20, right: -20, width: 100, height: 100,
            borderRadius: "50%", background: `radial-gradient(circle, ${hi}18, transparent)`
          }} />
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "60%",
            background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)"
          }} />
          {/* Genre badge */}
          <div style={{
            position: "absolute", top: 12, left: 12,
            fontSize: 7, letterSpacing: 2, color: hi, textTransform: "uppercase",
            fontWeight: 700, fontFamily: "monospace", opacity: 0.5
          }}>{g}</div>
          {/* Decorative lines */}
          <div style={{
            position: "absolute", top: 24, left: 12, width: 28, height: 2,
            borderRadius: 1, background: hi, opacity: 0.2
          }} />
          {/* Film icon placeholder */}
          <div style={{
            position: "absolute", top: "35%", left: "50%", transform: "translate(-50%, -50%)",
            width: 40, height: 40, borderRadius: 10, border: `1px solid ${hi}33`,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.2)"
          }}>
            <Film size={18} style={{ color: hi, opacity: 0.4 }} />
          </div>
          {/* Title + year */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              fontFamily: "'Playfair Display',serif", fontSize: title.length > 18 ? 13 : 16,
              fontWeight: 700, color: "#fff", lineHeight: 1.15, marginBottom: 4,
              textShadow: "0 2px 8px rgba(0,0,0,0.6)"
            }}>{short}</div>
            <div style={{
              fontSize: 9, color: "rgba(255,255,255,0.4)",
              fontFamily: "'JetBrains Mono',monospace", fontWeight: 600
            }}>{year}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CAST MEMBER — real headshot attempt + initial avatar fallback
   ═══════════════════════════════════════════════════════════════════════════ */
function CastMember({ name, character, img, idx, visible }) {
  const [hov, setHov] = useState(false);
  const [imgOk, setImgOk] = useState(false);
  const [imgFail, setImgFail] = useState(false);
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const hue = hash(name) % 360;
  const hasImg = img && img.length > 5;

  return (
    <div
      className="fg-cast-member"
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.95)",
        transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${idx * 0.04 + 0.05}s`,
        minWidth: 116, maxWidth: 130, flexShrink: 0, width: "calc(25% - 10px)"
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div className="fg-cast-circle" style={{
        width: 96, height: 96, borderRadius: "50%", overflow: "hidden",
        background: `linear-gradient(135deg, hsl(${hue},22%,13%), hsl(${hue},28%,22%))`,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: `2px solid ${hov ? "rgba(255,215,0,0.6)" : `hsla(${hue},20%,32%,0.4)`}`,
        transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
        transform: hov ? "scale(1.07) translateY(-3px)" : "scale(1)",
        boxShadow: hov
          ? "0 14px 38px rgba(255,215,0,0.22), 0 0 0 5px rgba(255,215,0,0.07), inset 0 0 0 1px rgba(255,215,0,0.22)"
          : "0 6px 18px rgba(0,0,0,0.5)",
        position: "relative"
      }}>
        {hasImg && !imgFail && (
          <img
            src={img} alt={name} referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={() => setImgOk(true)}
            onError={() => setImgFail(true)}
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", opacity: imgOk ? 1 : 0, transition: "opacity 0.3s", zIndex: 2
            }}
          />
        )}
        {!imgOk && (
          <span style={{
            fontSize: 28, fontWeight: 700,
            color: hov ? "#FFD700" : `hsl(${hue},18%,58%)`,
            fontFamily: "'Playfair Display',serif",
            transition: "color 0.2s", letterSpacing: 1.4, zIndex: 1
          }}>{initials}</span>
        )}
      </div>
      <div style={{ textAlign: "center", lineHeight: 1.25, width: "100%", marginTop: 6 }}>
        <div className="fg-cast-name" style={{
          fontFamily: "'Syne',sans-serif",
          fontSize: 13, fontWeight: 700,
          letterSpacing: 0.15,
          color: hov ? "#FFD700" : "rgba(255,255,255,0.92)",
          transition: "color 0.25s",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
        }}>{name}</div>
        <div className="fg-cast-char" style={{
          fontFamily: "'Playfair Display',serif",
          fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 3, fontStyle: "italic",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
        }}>{character}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STREAMING PLATFORMS
   ═══════════════════════════════════════════════════════════════════════════ */
function StreamingBadge({ platform, url, type, logo_path, idx, visible, title }) {
  const [hov, setHov] = useState(false);
  const href = url || "#";
  const logoUrl = logo_path ? `https://image.tmdb.org/t/p/w45${logo_path}` : null;
  const typeLabel = type === "rent" ? "Rent" : type === "buy" ? "Buy" : "";
  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer"
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 11,
        padding: "13px 19px", borderRadius: 12,
        background: hov
          ? "linear-gradient(135deg, rgba(255,215,0,0.14), rgba(255,165,0,0.06))"
          : "rgba(0,0,0,0.45)",
        border: `1px solid ${hov ? "rgba(255,215,0,0.45)" : "rgba(255,255,255,0.07)"}`,
        boxShadow: hov
          ? "0 12px 30px rgba(0,0,0,0.55), 0 0 28px rgba(255,215,0,0.16), inset 0 1px 0 rgba(255,215,0,0.14)"
          : "0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)",
        textDecoration: "none", cursor: "pointer",
        opacity: visible ? 1 : 0,
        transform: visible ? (hov ? "translateY(-3px)" : "translateY(0)") : "translateY(8px)",
        transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${idx * 0.05}s, transform 0.3s cubic-bezier(0.16,1,0.3,1)`,
      }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt="" style={{ width: 26, height: 26, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} onError={e => e.target.style.display = "none"} />
      ) : (
        <div style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Play size={12} fill={hov ? "#FFD700" : "rgba(255,255,255,0.65)"} stroke={hov ? "#FFD700" : "rgba(255,255,255,0.65)"} />
        </div>
      )}
      <span style={{
        fontFamily: "'Syne',sans-serif",
        fontSize: 15, fontWeight: 700,
        color: hov ? "#FFD700" : "rgba(255,255,255,0.92)",
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
        transition: "color 0.3s ease",
      }}>{platform}</span>
      {typeLabel && (
        <span style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 11, fontWeight: 700,
          color: hov ? "rgba(255,215,0,0.85)" : "rgba(255,255,255,0.55)",
          letterSpacing: 0.9, textTransform: "uppercase",
          padding: "3px 8px", borderRadius: 5,
          background: hov ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${hov ? "rgba(255,215,0,0.22)" : "rgba(255,255,255,0.06)"}`,
          transition: "all 0.3s ease",
        }}>{typeLabel}</span>
      )}
      <ExternalLink size={12} style={{ color: hov ? "#FFD700" : "rgba(255,255,255,0.4)", opacity: hov ? 0.95 : 0.5, transition: "color 0.3s, opacity 0.25s, transform 0.25s", transform: hov ? "translate(2px,-2px)" : "translate(0,0)" }} />
    </a>
  );
}



function streamingSearchUrl(platform, title) {
  const t = encodeURIComponent(title);
  const p = platform.toLowerCase();
  if (p === "netflix") return `https://www.netflix.com/search?q=${t}`;
  if (p === "hulu") return `https://www.hulu.com/search?q=${t}`;
  if (p.includes("disney")) return `https://www.disneyplus.com/search/${t}`;
  if (p.includes("prime") || p.includes("amazon")) return `https://www.amazon.com/s?k=${t}&i=instant-video`;
  if (p === "max" || p.includes("hbo")) return `https://play.max.com/search?q=${t}`;
  if (p === "tubi") return `https://tubitv.com/search/${t}`;
  if (p.includes("apple")) return `https://tv.apple.com/search?term=${t}`;
  if (p === "peacock") return `https://www.peacocktv.com/search?q=${t}`;
  if (p.includes("paramount")) return `https://www.paramountplus.com/search/${t}/`;
  if (p.includes("pluto")) return `https://pluto.tv/search/details/${t}`;
  return `https://www.justwatch.com/us/search?q=${t}`;
}

async function enrichCachedMovie(title, year, castNames) {
  try {
    const r = await fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, year, cast: castNames }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}


function formatBoxOfficeVal(val, label) {
  if (!val || val === "N/A" || val === "$N/A") return "N/A";
  const s = String(val).trim();
  const lbl = label.toLowerCase();
  const isROI = lbl.includes("roi");
  const isDays = lbl.includes("days");
  const isTheater = lbl.includes("theater count");
  const isDollar = lbl.includes("budget") || lbl.includes("gross") || lbl.includes("opening") || lbl.includes("domestic") || lbl.includes("international") || lbl.includes("worldwide") || lbl.includes("pta");

  // Extract number from any format ($150,000,000 or 150000000 or $150M etc.)
  const raw = s.replace(/[$,]/g, "");
  // Handle pre-formatted shorthand like "150M" or "2.5B"
  let num = NaN;
  const shortMatch = raw.match(/^([\d.]+)\s*([BMK])/i);
  if (shortMatch) {
    const base = parseFloat(shortMatch[1]);
    const suffix = shortMatch[2].toUpperCase();
    if (suffix === "B") num = base * 1e9;
    else if (suffix === "M") num = base * 1e6;
    else if (suffix === "K") num = base * 1e3;
  } else {
    num = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  }

  // ROI — keep as percentage
  if (isROI) {
    if (!isNaN(num)) return num >= 1 ? `${Math.round(num)}%` : `${Math.round(num * 100)}%`;
    if (s.endsWith("%")) return s;
    return s;
  }
  // Days — add weeks
  if (isDays) {
    const dayNum = parseInt(s.replace(/[^0-9]/g, ""));
    if (!isNaN(dayNum) && dayNum > 0) {
      const weeks = Math.floor(dayNum / 7);
      return `${dayNum} days / ${weeks} weeks`;
    }
    return s;
  }
  // Theater count — just format with commas
  if (isTheater) {
    if (!isNaN(num)) return Math.round(num).toLocaleString();
    return s;
  }
  // Dollar values — format with M/K and 2 decimals
  if (isDollar) {
    if (isNaN(num)) return s;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  }
  if (!isNaN(num)) return Number.isInteger(num) ? num.toLocaleString() : s;
  return s;
}

/* Normalize whatever Claude/cache returned for a rank field into a clean
   '#N all-time' / 'Top X%' / etc. display form. Cached older entries
   sometimes return just '1' (no context) or numeric ranks — wrap them. */
function formatRank(rank, label) {
  if (rank === null || rank === undefined) return null;
  const s = String(rank).trim();
  if (!s || s === "0" || /^n\.?a\.?$/i.test(s) || s === "#N/A" || /^(unknown|none|null|unranked|not ?ranked)$/i.test(s) || /^[—–-]+$/.test(s)) return null;
  // Already prefixed with # or contains "all-time" / "top" / "widest" / "longest" / a percent → return as-is
  if (s.startsWith("#") || /\b(all.time|top\s*\d|widest|longest)\b/i.test(s) || /%/.test(s)) return s;
  // Bare number → format based on what kind of stat the row is
  if (/^\d{1,5}$/.test(s)) {
    const lbl = (label || "").toLowerCase();
    if (lbl.includes("theater count")) return `#${s} widest release`;
    if (lbl.includes("days")) return `#${s} longest run`;
    return `#${s} all-time`;
  }
  // Numeric with comma → "1,200" → "#1,200 all-time"
  if (/^\d{1,3}(,\d{3})+$/.test(s)) return `#${s} all-time`;
  // Anything else (descriptive phrase) → return as-is
  return s;
}

function BoxOfficeRow({ label, val, rank, idx, visible }) {
  const hasVal = val && val !== "N/A" && val !== "$N/A";
  const cleanRank = formatRank(rank, label);
  const hasRank = !!cleanRank;
  const formatted = formatBoxOfficeVal(val, label);
  const lbl = label.toLowerCase();
  const isROIPositive = lbl.includes("roi") && /^\d+%/.test(formatted) && parseInt(formatted) >= 100;
  // Every row treated identically — no gold tint variants. Positive ROI keeps
  // its green semantic color, everything else is white-on-dark, consistent.
  const valColor = isROIPositive ? "#22c55e" : "rgba(255,255,255,0.94)";
  const Icon = lbl.includes("budget") ? DollarSign
    : lbl.includes("opening") ? Sparkles
    : lbl.includes("per-theater") || lbl.includes("pta") ? BarChart3
    : lbl.includes("domestic") ? Flame
    : lbl.includes("international") ? Globe
    : lbl.includes("worldwide") ? Globe
    : lbl.includes("roi") ? TrendingUp
    : lbl.includes("theater count") ? Tv
    : lbl.includes("days") ? Calendar
    : DollarSign;
  return (
    <div className="fg-boxoffice-row" style={{
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14,
      padding: "18px 20px", borderRadius: 11,
      background: idx % 2 === 0 ? "rgba(255,255,255,0.022)" : "transparent",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(8px)",
      transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${idx * 0.04}s`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: 1 }}>
        <div className="fg-boxoffice-icon" style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.72)",
        }}>
          <Icon size={17} />
        </div>
        <span className="fg-boxoffice-label" style={{
          fontFamily: "'Syne',sans-serif",
          fontSize: 16,
          color: "rgba(255,255,255,0.82)",
          fontWeight: 600,
          letterSpacing: 0.2,
          minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
        }}>{label}</span>
      </div>
      <span className="fg-boxoffice-value" style={{
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 17,
        color: valColor,
        fontWeight: 700,
        letterSpacing: 0.4,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}>
        {formatted}
        {hasVal && hasRank && (
          <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 500, fontSize: 13, marginLeft: 7 }}>/ {cleanRank}</span>
        )}
      </span>
    </div>
  );
}

/* Floating section navigator — appears on the left edge of the result page,
   lists every populated section, scrolls smoothly to the section on click,
   and highlights the active section as the user scrolls (IntersectionObserver).
   Hidden under 1280px viewport (no room beside the centered 720px main column). */
function ResultSidebar({ result, sections }) {
  const [active, setActive] = useState(sections[0]?.id || "");
  const [mobileOpen, setMobileOpen] = useState(false);
  // The previous IntersectionObserver implementation had two failure modes:
  // (1) early-returned when no entries were intersecting, leaving the
  //     highlight stuck during scrolls between section boundaries; and
  // (2) sorted by `boundingClientRect.top` ascending, which picks the
  //     section with the MOST-NEGATIVE top — the section furthest above the
  //     viewport — instead of the one the user is actually reading. That
  //     caused the highlight to occasionally jump BACKWARDS as the user
  //     scrolled forward (visible in v5.11.0 staging testing).
  //
  // The replacement walks sections in document order on every scroll tick
  // (rAF-throttled) and picks the deepest section whose top has crossed a
  // trigger line just under the sticky header. This is the pattern used by
  // most documentation sites and never mistracks.
  useEffect(() => {
    const triggerY = 140;
    let rafId = null;
    const compute = () => {
      rafId = null;
      let activeId = sections[0]?.id || "";
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= triggerY) {
          activeId = s.id;
        } else {
          break; // sections are in document order — stop once we pass triggerY
        }
      }
      setActive(prev => prev === activeId ? prev : activeId);
    };
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(compute);
    };
    compute(); // initial sync
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.title, sections.length]);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const offset = 110;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
    setMobileOpen(false);
  };

  const navList = (
    <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {sections.map(s => {
        const Icon = s.icon;
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className={`fg-side-link ${isActive ? "active" : ""}`}
            style={{
              display: "flex", alignItems: "center", gap: 11,
              padding: "11px 13px", borderRadius: 10,
              background: isActive ? "linear-gradient(135deg, rgba(255,215,0,0.13), rgba(255,165,0,0.04))" : "transparent",
              border: `1px solid ${isActive ? "rgba(255,215,0,0.30)" : "transparent"}`,
              color: isActive ? "#FFD700" : "rgba(255,255,255,0.62)",
              fontFamily: "'Syne',sans-serif",
              fontSize: 13.5, fontWeight: isActive ? 700 : 500,
              letterSpacing: 0.2,
              textAlign: "left", cursor: "pointer",
              // Narrowed from `all` to specific properties so a fast active
              // toggle doesn't ripple `transition: all`-driven changes through
              // every animatable prop simultaneously (the visible "twitch" in
              // v5.11.0 staging testing was the sidebar items pulsing).
              transition: "background 0.25s ease, border-color 0.25s ease, color 0.25s ease, box-shadow 0.3s ease",
              boxShadow: isActive ? "0 0 22px rgba(255,215,0,0.10), inset 0 1px 0 rgba(255,215,0,0.08)" : "none",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            <Icon size={14} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar — fixed left of the main column. Hidden under
          1380px viewport via `.fg-sidebar` @media rule. */}
      <aside className="fg-sidebar" aria-label="Movie sections" style={{
        position: "fixed",
        // Anchored to the LEFT of the main column: sidebar's right edge sits 24px
        // from the main column's left edge. Main column is centered with max-width
        // 720px so its left edge is at viewport-50% - 360px.
        // Sidebar right (from viewport-right) = viewport - (50% - 360) - SIDEBAR_WIDTH(264)
        // ... easier expressed via right anchor: 50% + 360 + 24.
        right: "calc(50% + 384px)",
        top: 110,
        zIndex: 30,
        width: 264,
        maxHeight: "calc(100vh - 140px)",
        overflowY: "auto",
        overflowX: "hidden",
        background: "rgba(8,6,2,0.82)",
        backdropFilter: "blur(28px) saturate(1.1)",
        WebkitBackdropFilter: "blur(28px) saturate(1.1)",
        border: "1px solid rgba(255,215,0,0.10)",
        borderRadius: 16,
        padding: "12px 10px",
        boxShadow: "0 24px 70px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,215,0,0.04)",
        animation: "softFade 0.55s cubic-bezier(0.16,1,0.3,1) 0.35s both",
      }}>
        {navList}
      </aside>

      {/* Mobile / tablet — Floating Action Button (≤1379px). Tap opens
          a card-style popover anchored above the FAB listing every
          populated section. Tapping a section smooth-scrolls and closes
          the popover (handled inside scrollTo). The IntersectionObserver
          highlight from the desktop sidebar carries over via shared
          `.fg-side-link.active` styling. */}
      <button
        type="button"
        className="fg-sidebar-fab"
        aria-label="Open section navigation"
        aria-expanded={mobileOpen}
        aria-haspopup="menu"
        onClick={() => setMobileOpen(o => !o)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {mobileOpen && (
        <>
          <div
            className="fg-sidebar-fab-backdrop"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="fg-sidebar-fab-popover" role="menu" aria-label="Movie sections">
            {navList}
          </div>
        </>
      )}
    </>
  );
}

/* Pick a contextual Lucide icon for a Hot Take bullet based on what the
   statement is actually about. The 'Thumbs Up' / 'Thumbs Down' branding
   stays at the SECTION level — these per-row icons reflect the content of
   each individual statement (acting, plot, music, visuals, etc.). Specific
   compound phrases like "visual effects" must be matched BEFORE the general
   "visual" or "effects" patterns, hence the deliberate order below. */
function pickHotTakeIcon(text, positive) {
  const t = (text || "").toLowerCase();

  // ── HIGH-PRIORITY COMPOUND PHRASES (must run before generic single-word matches) ──
  // "X to watch" → Eye (viewing experience)
  if (/\b((un)?comfortable|hard|difficult|easy|painful|tough|joy|joyful) to watch\b/.test(t)) return Eye;
  // Character writing / motivation / development → Scroll (script weakness/strength)
  // Catches "Villain motivation could be more developed", "Underwritten antagonist", etc.
  if (/\b(motivation[s]?|under(developed|written)|character (?:develop|arc|writing|motivation)|villain|protagonist|antagonist|hero[s']*)\b/.test(t)) return Scroll;
  // "middle act" / "third act" / "first act" → Clock (story-pacing context, not "act" as in acting)
  if (/\b(middle|first|second|third|final|opening|closing)\s+act\b/.test(t)) return Clock;
  // Visual effects / VFX / CGI → Wand2
  if (/\b(visual ?effects?|v ?fx|cgi|special effects?|practical effects?|computer.generated|set ?piece[s]?|spectacle)\b/.test(t)) return Wand2;
  // Action choreography / fight / chase → Swords
  if (/\b(action(?: choreograph| sequence)?|chase|fight(ing|s)?|stunt|battle|combat|brawl|gunplay|shootout|martial.arts|swordplay)\b/.test(t)) return Swords;
  // Sound design (before music)
  if (/\b(sound ?design|sound ?effects?|sound ?mixing|sonic|audio (mix|design))\b/.test(t)) return Mic;
  // Dialogue
  if (/\b(dialog(ue)?|line[s]?\s+(?:of|are|feel)|quip|monolog|conversation|banter|exposit(ion|ory)?|heavy.handed)\b/.test(t)) return MessageSquare;

  // ── ROLE / CRAFT ──
  // Acting / performance / cast / chemistry → Users
  // (Bare "act" intentionally NOT here — too many false positives like
  // "middle act" pacing references; specific compound act-pacing match
  // already fires above. Acting here requires explicit suffix.)
  if (/\b(acting|actor|actress|actors|actresses|perform(ance|er|ed|ances|ers)|cast(ing)?|chemistry|leads?|portray(al|ed|ing)?|ensemble|on.screen|charisma)\b/.test(t)) return Users;
  // Directing → Film
  if (/\b(direct(or|ion|ed|ing|ors)?|filmmak(er|ers|ing)?|auteur|helm(ed|ing)?)\b/.test(t)) return Film;
  // Cinematography → Camera
  if (/\b(cinematograph(y|er)?|camera ?(work)?|shot[s]?|fram(e|ed|ing)|lens|composition)\b/.test(t)) return Camera;
  // Animation / character design / production design / costume design / art direction → Palette
  if (/\b(animat(ion|ed)|character design|costume design|production design|set design|art direction|hand.drawn)\b/.test(t)) return Palette;
  // Music / score → Music
  if (/\b(music(al)?|score|soundtrack|composer|song|theme ?song|orchestra)\b/.test(t)) return Music;
  // Plot / story / script (no "premise" — that's Lightbulb)
  if (/\b(plot|story(line|telling)?|script|screenplay|narrative|structure|arc[s]?|twist|writing|prose)\b/.test(t)) return Scroll;

  // ── EMOTION / HEART (broad — also catches hope/friendship/love themes) ──
  if (/\b(emotion(al|s)?|heart(felt|breaking|warming|wrenching)?|moving|touching|tear|love|romance|romantic|tender|poignant|relat(e|able)|hope(ful)?|friendship|brotherhood|sisterhood|kindness|compassion|humanity|courage|faith|redemption|bond|connection|forgive(ness)?|grief|loss|family)\b/.test(t)) return Heart;

  // ── EXPERIENCE / TONE qualifiers ──
  // Pacing / runtime → Clock
  if (/\b(pac(e|ing|ed)|rhythm|drag(s|ged|ging)?|slow|sluggish|brisk|momentum|runtime|drawn.out|overstay|sluggish|too long|too short)\b/.test(t)) return Clock;
  // Horror / dark / disturbing → Ghost
  if (/\b(scary|terrify|fright|horror|haunt|chilling|dread|disturb(ing)?|macabre|grisly|gore|gory|nightmare|sinister)\b/.test(t)) return Ghost;
  // Tension / thrill / suspense → Zap
  if (/\b(tension|thrill(er|ing)?|suspense(ful)?|edge.of|adrenaline|gripping|riveting|propuls|electrifying|intense|nail.biting)\b/.test(t)) return Zap;
  // Comedy / humor / wit / charm → Sparkles
  if (/\b(comed(y|ic)?|funny|laugh|hilari|humou?r(ous)?|joke|wit(ty)?|charming|amusing|delightful|whimsical)\b/.test(t)) return Sparkles;

  // ── INTELLECT / IDEAS ──
  // Theme / philosophy / commentary / consciousness / transcendent
  if (/\b(theme[s]?|philosoph(y|ical)?|commentary|metaphor|allegory|symbolism|ideology|message|nuance|provocat|though(t|tful)|meditation|exploration|examin|consciousness|transcend(ent|s)?|existential|profound|insight)\b/.test(t)) return Lightbulb;
  // Originality / classic / timeless
  if (/\b(original(ity)?|innovat|unique|fresh|inventive|trailblaz|groundbreak|paradigm|reinvent|revolutionary|defin(ed|es) a generation|timeless|classic|enduring|ageless|stand(s)? the test)\b/.test(t)) return Sparkles;

  // ── EXTERNAL / META ──
  // Awards
  if (/\b(award|oscar|nomin|emmy|golden ?globe|prestige|critic.darling|festival|bafta|cannes)\b/.test(t)) return Trophy;
  // Box office / commercial
  if (/\b(box office|gross|opening|million|billion|blockbuster|hit|flop|commercial|revenue|earn(ed|ings))\b/.test(t)) return DollarSign;
  // Cultural / social
  if (/\b(cultur(e|al)|social|society|generation|consumer|masculin|feminin|gender|race|class|identity|political|polariz|divisive|controvers|timely|dated|aged|critique)\b/.test(t)) return Globe;
  // Audience / fan reception
  if (/\b(audience|viewer|fan(s)?|crowd|popular|reception|demographic|embraced|appeal)\b/.test(t)) return Users;

  // ── ATMOSPHERIC / BROAD (last) ──
  // Setting/location/scene/world → Eye (visual content)
  if (/\b(scene[s]?|setting|location|world.building|world|backdrop|vista|landscape|prison|hospital|school|courtroom|battlefield|wilderness|desert|island|space|underwater)\b/.test(t)) return Eye;
  // Tone / mood / atmosphere / discomfort → Activity
  if (/\b(tone|mood|atmosphere|atmospheric|vibe|ambien|energy|uncomfortable|unsettl|intens|brood)\b/.test(t)) return Activity;
  // Visual style / aesthetic / color → Palette
  if (/\b(visual|aesthetic|colou?r|stylized|style|imagery|set design|production design|art direction|costume)\b/.test(t)) return Palette;
  // Subtle / nuanced detail → Eye
  if (/\b(subtle|nuanced|layered|texture|rich(ness)?|depth|observ|detail)\b/.test(t)) return Eye;

  // Default → sentiment thumb
  return positive ? ThumbsUp : ThumbsDown;
}

function HotTakeRow({ text, idx, positive, visible, delay }) {
  const Icon = pickHotTakeIcon(text, positive);
  const accent = positive ? "34,197,94" : "239,68,68";
  const accentHex = positive ? "#22c55e" : "#ef4444";
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 14,
      padding: "18px 20px", borderRadius: 12,
      fontFamily: "'Syne',sans-serif",
      fontSize: 17, lineHeight: 1.55, color: "rgba(255,255,255,0.92)",
      background: "rgba(0,0,0,0.42)",
      border: `1px solid rgba(${accent},0.14)`,
      borderLeft: `3px solid rgba(${accent},0.65)`,
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(8px)",
      transition: `all 0.45s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      letterSpacing: 0.05,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `linear-gradient(135deg, rgba(${accent},0.16), rgba(${accent},0.04))`,
        border: `1px solid rgba(${accent},0.32)`,
        color: accentHex,
        boxShadow: `0 0 14px rgba(${accent},0.18), inset 0 1px 0 rgba(${accent},0.22)`,
        marginTop: 1,
      }}>
        <Icon size={15} strokeWidth={2.1} />
      </div>
      <span style={{ flex: 1 }}>{text}</span>
    </div>
  );
}

/* Returns runtime in "120 min · 2h 0m" form regardless of input shape.
   API may give "120 min" (cache) or "2h 0m" (TMDB-formatted) — we want both. */
function formatRuntimeBoth(rt) {
  if (!rt) return null;
  const s = String(rt).trim();
  // Try to extract minutes
  let totalMins = null;
  const minMatch = s.match(/^(\d+)\s*min/i);
  if (minMatch) totalMins = parseInt(minMatch[1]);
  if (totalMins === null) {
    const hmMatch = s.match(/^(\d+)\s*h(?:\s*(\d+)\s*m)?/i);
    if (hmMatch) totalMins = parseInt(hmMatch[1]) * 60 + (hmMatch[2] ? parseInt(hmMatch[2]) : 0);
  }
  if (totalMins === null || totalMins <= 0) return s;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const hm = h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
  return `${totalMins} min · ${hm}`;
}

/* Trim DYM suggestion overviews to a clean fixed length so every card
   has the same visible body height. Targets ~200 chars, prefers ending
   at the last full sentence (. ! ?) within range; otherwise breaks at
   the last word boundary and appends an ellipsis. Returns the original
   string unchanged if it's already short enough. */
function trimOverview(text, maxChars = 200) {
  if (!text || text.length <= maxChars) return text || "";
  const cut = text.substring(0, maxChars);
  const lastSentence = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf("! "),
    cut.lastIndexOf("? ")
  );
  if (lastSentence > maxChars * 0.55) {
    return text.substring(0, lastSentence + 1);
  }
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? text.substring(0, lastSpace) : cut).replace(/[,;:\s]+$/, "") + "…";
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUGGESTIONS — popular movie titles for search chips
   ═══════════════════════════════════════════════════════════════════════════ */
const SUGGESTIONS = [
  "Inception", "The Dark Knight", "Interstellar", "Pulp Fiction", "The Matrix",
  "The Shawshank Redemption", "Fight Club", "Goodfellas", "The Godfather",
  "Forrest Gump", "Parasite", "The Social Network", "Whiplash", "Gladiator",
  "Se7en", "Schindler's List", "Saving Private Ryan", "Avatar",
  "Django Unchained", "The Wolf of Wall Street"
];
// Session-only runtime cache (populated as user searches, not persisted)
const DB = {};
// [ARCHIVED — PRICING DORMANT] Search limit for free tier. Uncomment atLimit logic to re-enable.
const FREE_LIMIT = 8;

/* ═══════════════════════════════════════════════════════════════════════════
   CLIENT CACHE — v5.10.40 localStorage layer for last 50 movie searches.
   Hit: render instantly, no network call. Miss: normal flow + cache write.
   Server cache (Supabase 30-day TTL) still owns canonical truth — this is a
   prefetch-style fast path for movies the user already saw this device.
   ═══════════════════════════════════════════════════════════════════════════ */
const FG_CLIENT_CACHE_KEY = "fg_movie_cache_v1";
const FG_CLIENT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FG_CLIENT_CACHE_MAX = 50;

function readClientCache() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return {};
    const raw = window.localStorage.getItem(FG_CLIENT_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function getClientCachedMovie(query) {
  const all = readClientCache();
  const entry = all[query];
  if (!entry) return null;
  if (Date.now() - entry.ts > FG_CLIENT_CACHE_TTL_MS) return null;
  return entry.mv;
}

function setClientCachedMovie(query, mv) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const all = readClientCache();
    all[query] = { mv, ts: Date.now() };
    // LRU prune — keep newest 50 by timestamp
    const keys = Object.keys(all);
    if (keys.length > FG_CLIENT_CACHE_MAX) {
      keys.sort((a, b) => (all[b].ts || 0) - (all[a].ts || 0));
      const trimmed = {};
      for (const k of keys.slice(0, FG_CLIENT_CACHE_MAX)) trimmed[k] = all[k];
      window.localStorage.setItem(FG_CLIENT_CACHE_KEY, JSON.stringify(trimmed));
      return;
    }
    window.localStorage.setItem(FG_CLIENT_CACHE_KEY, JSON.stringify(all));
  } catch {
    // localStorage quota exceeded or disabled — silently no-op
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   API — calls /api/search backend (proxies Anthropic + TMDB enrichment)
   ═══════════════════════════════════════════════════════════════════════════ */
async function fetchMovieAPI(title, authToken) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const headers = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

    const r = await fetch("/api/search", {
      method: "POST",
      headers,
      signal: ctrl.signal,
      body: JSON.stringify({ query: title }),
    });
    clearTimeout(timer);

    if (r.status === 403) {
      const err = await r.json();
      if (err.code === "SEARCH_LIMIT_REACHED") return { limitReached: true };
    }
    if (r.status === 429) {
      const err = await r.json().catch(() => ({}));
      if (err.code === "DAILY_LIMIT_REACHED") {
        return { dailyLimitReached: true, searches_used: err.searches_used, daily_limit: err.daily_limit };
      }
      // Per-minute throttle (10s of requests in <60s). Distinct from
      // DAILY_LIMIT_REACHED — temporary, not a hard cap.
      const retryAfter = parseInt(r.headers.get("Retry-After") || "60", 10);
      return { rateLimited: true, retryAfter };
    }
    if (!r.ok) return null;

    const mv = await r.json();
    // v5.12.3 — pass through the ambiguity picker payload before the
    // title/sources sanity check (no `title` field on this shape).
    if (mv && mv.ambiguous && Array.isArray(mv.candidates)) return mv;
    if (!mv.title || (!mv.coming_soon && (!mv.sources || mv.sources.length === 0))) return null;

    // Construct image URLs from TMDB paths
    // Always prefer TMDB poster_path
    if (mv.poster_path) mv.poster = IMG + "w500" + mv.poster_path;
    if (mv.cast) {
      mv.cast = mv.cast.map(c => ({
        name: c.name,
        character: c.character,
        img: c.profile_path ? IMG + "w185" + c.profile_path : (c.img || "")
      }));
    }
    // Use TMDB streaming if available, otherwise JustWatch fallback
    if (mv.streaming && Array.isArray(mv.streaming) && mv.streaming.length > 0) {
      // streaming from TMDB enrichment already has platform/url/type
    } else {
      mv.streaming = [{ platform: "JustWatch", url: `https://www.justwatch.com/us/search?q=${encodeURIComponent(mv.title)}`, type: "stream" }];
    }
    return mv;
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

// Ensures all result properties are safe to render — prevents crashes from unexpected API data
function normalizeResult(mv) {
  if (!mv) return null;
  const r = { ...mv };
  // Ensure score exists
  if (!r.score || typeof r.score !== 'object') {
    r.score = r.sources ? calcScore(r.sources) : { ten: 0, stars: 0, count: 0 };
  }
  if (typeof r.score.ten === 'undefined') r.score.ten = 0;
  if (typeof r.score.stars === 'undefined') r.score.stars = 0;
  // Ensure genre is a string
  if (Array.isArray(r.genre)) r.genre = r.genre.join(" · ");
  if (r.genre && typeof r.genre !== 'string') r.genre = String(r.genre);
  // Ensure arrays
  if (!Array.isArray(r.cast)) r.cast = [];
  if (!Array.isArray(r.sources)) r.sources = [];
  if (!Array.isArray(r.streaming)) r.streaming = [];
  if (!Array.isArray(r.awards)) r.awards = [];
  if (!Array.isArray(r.recommendations)) r.recommendations = [];
  if (!Array.isArray(r.video_reviews)) r.video_reviews = [];
  // Ensure trailer_key is string or null
  if (r.trailer_key && typeof r.trailer_key !== 'string') r.trailer_key = null;
  // Ensure boxOffice is object or null
  if (r.boxOffice && typeof r.boxOffice !== 'object') r.boxOffice = null;
  // Ensure strings
  if (typeof r.title !== 'string') r.title = String(r.title || "Unknown");
  if (typeof r.year !== 'number' && typeof r.year !== 'string') r.year = 0;
  if (typeof r.year === 'string') r.year = parseInt(r.year) || 0;
  if (r.runtime && typeof r.runtime !== 'string') r.runtime = String(r.runtime) + " min";
  // Preserve disclaimer from API
  if (mv.disclaimer) r.disclaimer = mv.disclaimer;
  // Preserve coming_soon fields from API (v5.7)
  if (mv.coming_soon) {
    r.coming_soon = true;
    r.release_date = mv.release_date || null;
  }
  // Preserve hot_take from API
  if (mv.hot_take && typeof mv.hot_take === 'object') {
    r.hot_take = {
      good: Array.isArray(mv.hot_take.good) ? mv.hot_take.good.filter(s => typeof s === 'string') : [],
      bad: Array.isArray(mv.hot_take.bad) ? mv.hot_take.bad.filter(s => typeof s === 'string') : [],
    };
  }
  return r;
}

function calcScore(sources) {
  if (!sources || !Array.isArray(sources) || sources.length === 0) return { ten: 0, stars: 0, count: 0 };
  const valid = sources.filter(s => s && typeof s.score !== 'undefined' && s.score !== null && s.max > 0);
  if (valid.length === 0) return { ten: 0, stars: 0, count: 0 };
  const n = valid.map(s => {
    let score = typeof s.score === 'string' ? parseFloat(s.score) : s.score;
    let max = typeof s.max === 'string' ? parseFloat(s.max) : s.max;
    if (isNaN(score) || isNaN(max) || max === 0) return null;
    // Auto-correct mismatched scale: if score > max, infer the correct max
    // e.g., score: 92, max: 10 → likely meant max: 100
    if (score > max) {
      if (score <= 100 && (max === 5 || max === 10)) max = 100;
      else score = max; // cap at max as fallback
    }
    const pct = max === 100 ? score : max === 10 ? score * 10 : max === 5 ? score * 20 : (score / max) * 100;
    // Clamp to 0-100
    return Math.min(100, Math.max(0, pct));
  }).filter(v => v !== null && !isNaN(v));
  if (n.length === 0) return { ten: 0, stars: 0, count: sources.length };
  const m = n.reduce((a, b) => a + b, 0) / n.length;
  return {
    ten: Math.min(10, Math.round((m / 10) * 10) / 10),
    stars: Math.min(5, Math.round((m / 20) * 2) / 2),
    count: sources.length
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SMALL UI COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */
function StarDisplay({ rating, sz = 18 }) {
  const out = [];
  // Filled stars get a gold drop-shadow glow; empty stars stay flat dim gold.
  const glow = { filter: "drop-shadow(0 0 6px rgba(255,215,0,0.65))" };
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) out.push(<Star key={i} size={sz} fill="#FFD700" stroke="#FFD700" style={glow} />);
    else if (i - 0.5 <= rating) out.push(
      <span key={i} style={{ position: "relative", display: "inline-block", width: sz, height: sz }}>
        <Star size={sz} fill="none" stroke="rgba(255,215,0,0.25)" style={{ position: "absolute" }} />
        <span style={{ position: "absolute", overflow: "hidden", width: "50%" }}>
          <Star size={sz} fill="#FFD700" stroke="#FFD700" style={glow} />
        </span>
      </span>
    );
    else out.push(<Star key={i} size={sz} fill="none" stroke="rgba(255,215,0,0.25)" />);
  }
  return <div style={{ display: "flex", gap: 2, alignItems: "center" }}>{out}</div>;
}

function Skeleton() {
  return (
    <div style={{ animation: "pulse 1.5s ease-in-out infinite", padding: 28 }}>
      <div style={{ display: "flex", gap: 22 }}>
        <div style={{ width: 120, height: 180, borderRadius: 12, background: "#151515", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: "55%", height: 24, borderRadius: 6, background: "#151515", marginBottom: 10 }} />
          <div style={{ width: "38%", height: 14, borderRadius: 5, background: "#151515", marginBottom: 22 }} />
          <div style={{ width: "28%", height: 46, borderRadius: 10, background: "#151515", marginBottom: 10 }} />
          <div style={{ width: "40%", height: 14, borderRadius: 5, background: "#151515" }} />
        </div>
      </div>
    </div>
  );
}

function cleanSourceType(t) {
  if (!t) return null;
  let s = String(t).trim();
  // Strip every noise word the user called out
  s = s.replace(/\b(score|rating|percentage|pct|source|rank|points?|stars?|votes?)\b/gi, "")
       .replace(/\s+/g, " ").trim();
  // Map quirky leftovers to clean labels
  if (/^meta$/i.test(s)) s = "Critics";
  if (/^tomato(meter)?$/i.test(s)) s = "Critics";
  if (/^popcorn(meter)?$/i.test(s)) s = "Audience";
  if (/^user[s]?$/i.test(s)) s = "Audience";
  // Empty or just one-letter junk → don't render a type at all
  return s.length >= 2 ? s : null;
}

function SourceRow({ source, idx, visible }) {
  const score = typeof source.score === 'string' ? parseFloat(source.score) : source.score;
  const max = typeof source.max === 'string' ? parseFloat(source.max) : source.max;
  const norm = (!isNaN(score) && !isNaN(max) && max > 0) ? (max === 100 ? score : max === 10 ? score * 10 : max === 5 ? score * 20 : (score / max) * 100) : 0;
  const clr = norm >= 80 ? "#22c55e" : norm >= 60 ? "#eab308" : norm >= 40 ? "#f97316" : "#ef4444";
  const [h, setH] = useState(false);
  // Extract domain for the favicon — use Google's s2 service which works for
  // ~all major movie review sites without us hosting any logo files ourselves.
  let logoUrl = null;
  try {
    if (source.url) {
      const dom = new URL(source.url).hostname.replace(/^www\./, "");
      logoUrl = `https://www.google.com/s2/favicons?domain=${dom}&sz=64`;
    }
  } catch { /* ignore malformed urls */ }
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer"
      className="fg-source-row"
      style={{
        display: "grid", gridTemplateColumns: "auto 1fr 88px 1fr 28px", alignItems: "center", gap: 14,
        padding: "16px 18px", borderRadius: 11,
        background: h ? "rgba(22,18,6,0.7)" : "rgba(0,0,0,0.42)",
        border: `1px solid ${h ? "rgba(255,215,0,0.32)" : "rgba(255,255,255,0.06)"}`,
        textDecoration: "none", color: "#fff", cursor: "pointer",
        opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${idx * 0.05}s`,
        boxShadow: h ? "0 12px 30px rgba(0,0,0,0.5), 0 0 28px rgba(255,215,0,0.08), inset 0 1px 0 rgba(255,215,0,0.06)" : "none",
      }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
    >
      {/* Logo chip — site favicon, themed black-at-rest gold-on-hover */}
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: h ? "rgba(255,215,0,0.10)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${h ? "rgba(255,215,0,0.32)" : "rgba(255,255,255,0.07)"}`,
        transition: "all 0.3s ease",
        overflow: "hidden",
      }}>
        {logoUrl ? (
          <img src={logoUrl} alt="" loading="lazy" style={{ width: 22, height: 22, objectFit: "contain", borderRadius: 4 }} onError={e => { e.target.style.display = "none"; }} />
        ) : (
          <Film size={14} style={{ color: h ? "#FFD700" : "rgba(255,255,255,0.4)" }} />
        )}
      </div>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, color: h ? "#FFD700" : "rgba(255,255,255,0.96)", letterSpacing: 0.1, transition: "color 0.25s" }}>{source.name}</span>
        {(() => {
          const t = cleanSourceType(source.type);
          return t ? (
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "rgba(255,255,255,0.5)", letterSpacing: 1, textTransform: "uppercase" }}>{t}</span>
          ) : null;
        })()}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 19, color: clr, textAlign: "right", letterSpacing: 0.3 }}>
        {source.score}<span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>/{source.max}</span>
      </div>
      <div style={{ position: "relative", height: 7, borderRadius: 3.5, background: "rgba(0,0,0,0.6)", overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6)" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 3.5,
          background: `linear-gradient(90deg, ${clr}66 0%, ${clr} 60%, ${clr}dd 100%)`,
          boxShadow: `0 0 10px ${clr}55`,
          width: visible ? `${Math.min(norm, 100)}%` : "0%",
          transition: `width 0.85s cubic-bezier(0.16,1,0.3,1) ${idx * 0.05 + 0.25}s`,
        }} />
      </div>
      <ExternalLink size={14} style={{ color: h ? "#FFD700" : "rgba(255,255,255,0.34)", transition: "color 0.25s, transform 0.25s", transform: h ? "translate(2px,-2px)" : "translate(0,0)" }} />
    </a>
  );
}

function Accordion({ id, icon, label, count, open, toggle, children }) {
  return (
    <div id={id} style={{
      borderTop: "1px solid rgba(255,215,0,0.06)",
      background: open ? "linear-gradient(180deg, rgba(255,215,0,0.018) 0%, transparent 40%)" : "transparent",
      transition: "background 0.4s ease",
      scrollMarginTop: 110,
    }}>
      <button onClick={toggle} style={{
        width: "100%", padding: "20px 28px", background: "none", border: "none",
        color: open ? "#FFD700" : "rgba(255,255,255,0.55)",
        fontFamily: "'Playfair Display',serif",
        fontStyle: "italic",
        fontSize: 19, fontWeight: 600,
        letterSpacing: -0.2,
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "color 0.3s ease",
        position: "relative",
      }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.color = "rgba(255,215,0,0.78)"; }}
        onMouseLeave={e => { e.currentTarget.style.color = open ? "#FFD700" : "rgba(255,255,255,0.55)"; }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28, borderRadius: 8,
            background: open ? "linear-gradient(135deg, rgba(255,215,0,0.16), rgba(255,165,0,0.04))" : "rgba(255,255,255,0.03)",
            border: open ? "1px solid rgba(255,215,0,0.28)" : "1px solid rgba(255,255,255,0.06)",
            color: open ? "#FFD700" : "rgba(255,255,255,0.6)",
            transition: "all 0.3s ease",
            flexShrink: 0,
          }}>{icon}</span>
          <span>{label}</span>
        </span>
        <ChevronDown size={16} style={{
          transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1), color 0.3s ease",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          color: open ? "#FFD700" : "rgba(255,255,255,0.4)",
        }} />
      </button>
      <div style={{ maxHeight: open ? 1600 : 0, overflow: "hidden", transition: "max-height 0.6s cubic-bezier(0.16,1,0.3,1)" }}>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════════════════ */
export default function FilmGlance() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [srcOpen, setSrcOpen] = useState(true);
  const [castOpen, setCastOpen] = useState(true);
  const [watchOpen, setWatchOpen] = useState(true);
  const [boxOfficeOpen, setBoxOfficeOpen] = useState(true);
  const [awardsOpen, setAwardsOpen] = useState(true);
  const [reviewsOpen, setReviewsOpen] = useState(true);
  const [hotTakeOpen, setHotTakeOpen] = useState(true);
  const [videoModal, setVideoModal] = useState(null); // { id, title } or null
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPw, setAuthPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [pendingSearch, setPendingSearch] = useState(null);
  const [authNotice, setAuthNotice] = useState(null);
  const [showPrice, setShowPrice] = useState(false);
  const [showFavs, setShowFavs] = useState(false);
  const [favorites, setFavorites] = useState([]);
  // Favourites — folder organization (v5.10.30)
  const [folders, setFolders] = useState([]);             // [{ id, name, position }]
  const [activeFolderId, setActiveFolderId] = useState("all"); // "all" | "unsorted" | folder.id
  const [newFolderInput, setNewFolderInput] = useState(null); // null | "" (open with empty)
  const [renamingFolderId, setRenamingFolderId] = useState(null);
  const [renamingFolderName, setRenamingFolderName] = useState("");
  const [deleteFolderTarget, setDeleteFolderTarget] = useState(null); // folder obj or null
  const [moveMenuFavKey, setMoveMenuFavKey] = useState(null); // `${title}-${year}` of fav whose move-menu is open
  const [folderError, setFolderError] = useState(null);
  // Heart-click → "Save to library" modal: the movieResult being added (null = closed).
  const [saveToFolderTarget, setSaveToFolderTarget] = useState(null);
  const [saveToFolderNewName, setSaveToFolderNewName] = useState(null); // null when not adding a new folder, "" when input open
  const [plan, setPlan] = useState("free");
  const [searches, setSearches] = useState(0);
  const [showSug, setShowSug] = useState(false);
  const [errMsg, setErrMsg] = useState(null);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  // v5.12.3 — exact-title ambiguity picker. When the search route detects 2+
  // released films sharing the same canonical title, it returns
  // {ambiguous: true, candidates: [...]} and we render a chooser instead of
  // the result page. Click-through re-runs the search with the year suffix,
  // and the existing year-hint path in lib/tmdb.ts searchMovie picks the
  // disambiguated film cleanly.
  const [ambiguousMatches, setAmbiguousMatches] = useState(null);
  const inputRef = useRef(null);
  const scrollTrackRef = useRef(null);
  const [scrollPct, setScrollPct] = useState(0);
  const [isDraggingScroll, setIsDraggingScroll] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  // Portrait viewports (or touch-only devices) get the flythrough starfield
  // because the orbital FloatingParticles' antigravity motion reads as a
  // dominant "upward stream" on tall narrow viewports. Landscape keeps the
  // orbital drift that works when the horizontal span is wide.
  const [isPortrait, setIsPortrait] = useState(false);
  useEffect(() => {
    const check = () => {
      if (typeof window === "undefined") return;
      const portrait = window.innerHeight >= window.innerWidth;
      const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      setIsPortrait(portrait || coarse);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);
  const remain = FREE_LIMIT - searches;
  // [ARCHIVED — PRICING DORMANT] To re-enable: const atLimit = plan === "free" && remain <= 0;
  const atLimit = false;

  // Helper: load profile + favorites for a session
  const loadUserData = async (session) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_id, searches_this_month, search_month")
        .eq("id", session.user.id)
        .single();
      if (profile) {
        const unlimitedPlans = ["pro_monthly", "pro_annual", "unlimited"];
        setPlan(unlimitedPlans.includes(profile.plan_id) ? "pro" : profile.plan_id);
        const currentMonth = new Date().toISOString().slice(0, 7);
        setSearches(profile.search_month === currentMonth ? profile.searches_this_month : 0);
      }
      // Favourites + folders load in parallel — each is a small query and the
      // page can't render either correctly without both.
      const [favRes, folderRes] = await Promise.all([
        supabase
          .from("favorites")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("favorite_folders")
          .select("id, name, position, created_at")
          .eq("user_id", session.user.id)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);
      if (favRes.error) console.error("Load favorites error:", favRes.error);
      if (folderRes.error) console.error("Load folders error:", folderRes.error);
      if (favRes.data) {
        setFavorites(favRes.data.map(f => ({
          title: f.title, year: f.year, genre: f.genre,
          poster: f.poster_url, score: { ten: f.score_ten, stars: f.score_stars },
          searchKey: f.search_key,
          folderId: f.folder_id || null,
          runtime: f.runtime || null,
          director: f.director || null,
          overview: f.overview || null,
        })));
      }
      if (folderRes.data) {
        setFolders(folderRes.data.map(fld => ({
          id: fld.id, name: fld.name, position: fld.position,
        })));
      }

      // After the cache backfill (migration 012), any favourite still missing
      // director / runtime / overview is one whose movie isn't in our cache.
      // Fire a single Sonnet batch enrichment in the background and patch
      // local state when it returns. Silent on failure — these columns are
      // optional and the cards render gracefully without them.
      if (favRes.data) {
        const stale = favRes.data.filter((f) =>
          !f.director || f.runtime == null || !f.overview
        );
        if (stale.length > 0) {
          const items = stale.slice(0, 20).map((f) => ({ title: f.title, year: f.year }));
          const token = session.access_token;
          fetch("/api/enrich-favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ items }),
          })
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
              if (!data || !Array.isArray(data.enriched)) return;
              setFavorites((prev) => prev.map((fav) => {
                const hit = data.enriched.find((e) =>
                  e.title === fav.title && (e.year ?? null) === (fav.year ?? null)
                );
                if (!hit) return fav;
                return {
                  ...fav,
                  director: fav.director || hit.director,
                  runtime: fav.runtime != null ? fav.runtime : hit.runtime,
                  overview: fav.overview || hit.overview,
                };
              }));
            })
            .catch((err) => console.warn("[enrich-favorites] background fetch failed:", err.message));
        }
      }
    } catch (e) { console.error("loadUserData error:", e); }
  };

  // Supabase auth listener — syncs session, loads profile + favorites
  useEffect(() => {
    // Check for existing session on page load (handles Google OAuth redirect)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ email: session.user.email, id: session.user.id, _session: session });
        loadUserData(session);
        // Deep-link: /#favourites opens the favourites view (requires sign-in,
        // hence handled here once the session is confirmed).
        if (typeof window !== "undefined" && window.location.hash === "#favourites") {
          setShowFavs(true);
          history.replaceState(null, "", window.location.pathname + window.location.search);
        }
      } else if (typeof window !== "undefined" && window.location.hash === "#favourites") {
        // No session yet — prompt sign-in; after sign-in, user can click the
        // Favourites tab on this page to reach the view.
        setShowAuth(true);
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser({ email: session.user.email, id: session.user.id, _session: session });
        await loadUserData(session);
        setShowAuth(false);
        setDailyLimitReached(false);
        setAuthEmail(""); setAuthPw(""); setErrMsg(null);
        // Show sign-in notification (only for explicit sign-in, not page reload)
        if (event === "SIGNED_IN") {
          setAuthNotice("You're signed in! Welcome back to Film Glance.");
          setTimeout(() => setAuthNotice(null), 4000);
        }
      } else {
        setUser(null); setPlan("free"); setSearches(0); setFavorites([]); setFolders([]); setActiveFolderId("all");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Move-to-folder popover — close when the user clicks outside the popover
  // and outside the move button that opens it. A document-level mousedown is
  // used (not a fixed-position backdrop div) because the card has its own
  // stacking context via `isolation: isolate`, which would have placed any
  // root-level backdrop on top of the popover itself.
  useEffect(() => {
    if (!moveMenuFavKey) return;
    if (typeof document === "undefined") return;
    const handler = (e) => {
      const t = e.target;
      if (t && typeof t.closest === "function") {
        if (t.closest(".fg-move-pop") || t.closest(".fg-fav-move")) return;
      }
      setMoveMenuFavKey(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moveMenuFavKey]);

  // Reset transient folder UI state when the user closes the favourites view.
  useEffect(() => {
    if (showFavs) return;
    setMoveMenuFavKey(null);
    setNewFolderInput(null);
    setRenamingFolderId(null);
    setRenamingFolderName("");
    setDeleteFolderTarget(null);
    setFolderError(null);
  }, [showFavs]);

  // Handle URL entry: ?q=<query> auto-triggers search, #signin auto-opens auth
  // modal, #favourites auto-opens the favourites view (when signed in).
  // Runs once per mount via the ref guard. Used by /preview-landing (and anywhere
  // else) to deep-link into the app without reimplementing the flows.
  // Deps are intentionally empty ([]) — doSearch/setShowAuth/etc. are referenced
  // through the callback closure at effect-run time (post-mount), which avoids
  // the TDZ crash that would occur if this ran before const doSearch is bound.
  const autoHandledRef = useRef(false);
  useEffect(() => {
    if (autoHandledRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get("q")?.trim();
    if (urlQuery) {
      autoHandledRef.current = true;
      setQuery(urlQuery);
      doSearch(urlQuery);
      return;
    }
    if (window.location.hash === "#signin") {
      autoHandledRef.current = true;
      setShowAuth(true);
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    // #favourites handled inside the auth listener once the session loads,
    // because opening the favourites view requires a signed-in user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll tracking for gold scrollbar (window scroll).
  // v5.10.39 perf: rAF-throttle so multiple scroll events collapse into
  // one work batch per animation frame (60Hz max instead of unbounded
  // hundreds per second). scrollPct rounded to 1% precision so React
  // skips re-renders when the rounded value hasn't changed — that drops
  // scroll-induced re-renders from thousands to ~100 over a full page
  // scroll. setHeaderScrolled is already cheap because React no-ops
  // setState when the boolean value matches the current state.
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const raw = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
        setScrollPct(Math.round(raw * 100) / 100);
        setHeaderScrolled(window.scrollY > 8);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [result]);

  // Drag-to-scroll for gold scrollbar
  useEffect(() => {
    if (!isDraggingScroll) return;
    const onMove = (e) => {
      const track = scrollTrackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      window.scrollTo(0, pct * (document.documentElement.scrollHeight - window.innerHeight));
    };
    const onUp = () => setIsDraggingScroll(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isDraggingScroll]);

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const loginWithEmail = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErrMsg(error.message);
  };

  const signUpWithEmail = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { setErrMsg(error.message); return; }
    setShowAuth(false);
    setAuthEmail(""); setAuthPw(""); setErrMsg(null);
    setAuthNotice("Check your email for a verification link to activate your account.");
    setTimeout(() => setAuthNotice(null), 8000);
  };

  const logout = async () => {
    try { await supabase.auth.signOut(); } catch (e) { console.error("Logout error:", e); }
    setUser(null); setSearches(0); setPlan("free"); setFavorites([]);
    setShowAccountMenu(false); setShowFavs(false); setResult(null);
  };

  const doSearch = useCallback(async (sq) => {
    const q = (sq || query).trim().toLowerCase();
    if (!q) return;

    // [ARCHIVED — AUTH GATE REMOVED IN v5.4]
    // Anonymous users can now search with a 15/day limit.
    // Auth is prompted only when daily limit is reached or for favorites.

    // [ARCHIVED — PRICING DORMANT] if (atLimit) { setShowPrice(true); return; }

    // v5.10.40 client-cache fast path — if this query was searched on this
    // device within the last hour, render immediately. Skips the loading
    // overlay entirely. Server cache (Supabase) still owns canonical truth.
    const cachedMv = getClientCachedMovie(q);
    if (cachedMv) {
      setVideoModal(null); setShowSug(false); setErrMsg(null); setSuggestions([]); setDailyLimitReached(false);
      try {
        if (cachedMv.coming_soon) {
          setResult(normalizeResult(cachedMv));
        } else if (cachedMv.sources && cachedMv.sources.length > 0) {
          setResult(normalizeResult({ ...cachedMv, score: cachedMv.score || calcScore(cachedMv.sources) }));
        }
        DB[q] = cachedMv;
        return;
      } catch { /* fall through to normal flow on parse error */ }
    }

    setLoading(true); setResult(null); setVideoModal(null); setShowSug(false); setErrMsg(null); setSuggestions([]); setDailyLimitReached(false); setAmbiguousMatches(null);

    // Backend API lookup (handles: server cache → Anthropic → TMDB image enrichment)
    setLoadMsg("Scanning Movie Studio Vault...");
    try {
      const token = user?._session?.access_token || null;
      const mv = await fetchMovieAPI(q, token);

      // [ARCHIVED — PRICING DORMANT] Uncomment to re-enable limit enforcement:
      // if (mv && mv.limitReached) { setShowPrice(true); setLoading(false); return; }

      // Daily limit reached — show notification + auth modal
      if (mv && mv.dailyLimitReached) {
        setDailyLimitReached(true);
        setPendingSearch(q);
        setShowAuth(true);
        setLoading(false);
        return;
      }

      // Per-minute rate limit — temporary, surface a clear "slow down" message
      // instead of the misleading "no results" path.
      if (mv && mv.rateLimited) {
        const wait = Math.max(1, mv.retryAfter || 60);
        setErrMsg(`Searching too fast — try again in ${wait} second${wait === 1 ? "" : "s"}.`);
        setResult({ notFound: true, query: q });
        setLoading(false);
        return;
      }

      // v5.12.3 — ambiguity picker: 2+ released films share the same exact
      // canonical title. Render the chooser instead of running the pipeline.
      if (mv && mv.ambiguous && Array.isArray(mv.candidates) && mv.candidates.length >= 2) {
        setAmbiguousMatches({ query: q, candidates: mv.candidates });
        setLoading(false);
        return;
      }

      if (mv && mv.coming_soon) {
        // v5.7: Unreleased movie — display Coming Soon page
        try {
          const res = normalizeResult(mv);
          setResult(res);
        } catch (parseErr) {
          console.error("Coming soon parse error:", parseErr);
          setResult({ notFound: true, query: q });
        }
        DB[q] = mv;
        setClientCachedMovie(q, mv);
      } else if (mv && mv.sources && mv.sources.length > 0) {
        try {
          const res = normalizeResult({ ...mv, score: mv.score || calcScore(mv.sources) });
          setResult(res);
          // Only enrich if cached data is missing TMDB fields (poster, trailer, video reviews, recommendations)
          const needsEnrich = !res.poster || !res.trailer_key || !res.video_reviews?.length || !res.recommendations?.length;
          if (needsEnrich) {
            enrichCachedMovie(res.title, res.year, res.cast?.map(c => ({ name: c.name, character: c.character }))).then(tmdb => {
            if (!tmdb) return;
            setResult(prev => {
              if (!prev || prev.title !== res.title) return prev;
              const updated = { ...prev };
              if (tmdb.poster_path) updated.poster = IMG + "w500" + tmdb.poster_path;
              if (tmdb.cast && tmdb.cast.length > 0) {
                updated.cast = tmdb.cast.map((tc, i) => ({
                  name: tc.name,
                  character: tc.character || prev.cast?.[i]?.character || "",
                  img: tc.profile_path ? IMG + "w185" + tc.profile_path : (prev.cast?.[i]?.img || "")
                }));
              }
              if (tmdb.streaming && tmdb.streaming.length > 0) updated.streaming = tmdb.streaming;
              updated.trailer_key = tmdb.trailer_key || null;
              updated.recommendations = tmdb.recommendations || [];
              updated.video_reviews = tmdb.video_reviews || [];
              return updated;
            });
          }).catch(err => console.error("[FG] Enrich error:", err));
          }
        } catch (parseErr) {
          console.error("Result parse error:", parseErr);
          setErrMsg("Could not display this movie. Try a different title.");
          setResult({ notFound: true, query: q });
        }
        // [ARCHIVED — PRICING DORMANT] if (plan === "free") setSearches(c => c + 1);
        DB[q] = mv; // Client-side session cache (in-memory)
        setClientCachedMovie(q, mv); // v5.10.40 — persist across sessions
      } else {
        setErrMsg("Could not find this movie. Check spelling or try the full title.");
        setResult({ notFound: true, query: q });
        // Fetch "Did you mean?" suggestions from TMDB
        try {
          const sugRes = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
          if (sugRes.ok) {
            const { suggestions: sugs } = await sugRes.json();
            if (sugs && sugs.length > 0) setSuggestions(sugs);
          }
        } catch (e) { /* silent */ }
      }
    } catch (e) {
      setErrMsg("Search timed out. Please try again.");
      setResult({ notFound: true, query: q });
    }
    setLoading(false);
  }, [query, atLimit, user, plan]);

  // Auto-trigger pending search after login
  useEffect(() => {
    if (user && pendingSearch) {
      const q = pendingSearch;
      setPendingSearch(null);
      setQuery(q);
      setTimeout(() => doSearch(q), 300);
    }
  }, [user, pendingSearch, doSearch]);

  const filt = query.length > 0
    ? SUGGESTIONS.filter(s => s.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : SUGGESTIONS.slice(0, 8);

  const resetHome = () => { setResult(null); setShowPrice(false); setShowFavs(false); setQuery(""); setLoading(false); setErrMsg(null); setSuggestions([]); setDailyLimitReached(false); setAmbiguousMatches(null); };

  const toggleFav = async (movieResult) => {
    if (!user) { setShowAuth(true); return; }
    // Normalize values for DB
    const title = String(movieResult.title || "");
    const year = typeof movieResult.year === 'string' ? parseInt(movieResult.year) || 0 : (movieResult.year || 0);

    const exists = favorites.find(f => f.title === title && f.year === year);
    if (exists) {
      // Remove favourite — unchanged path.
      const prevFavs = [...favorites];
      setFavorites(prev => prev.filter(f => !(f.title === title && f.year === year)));
      try {
        const { error } = await supabase.from("favorites").delete().eq("user_id", user.id).eq("title", title).eq("year", year);
        if (error) { console.error("Remove fav error:", error); setFavorites(prevFavs); }
      } catch (e) { console.error("Remove fav exception:", e); setFavorites(prevFavs); }
      return;
    }
    // Add path — open the "Save to library" picker so the user can choose
    // a destination folder (Unsorted, an existing folder, or a brand-new
    // folder created inline). Actual DB insert happens in confirmSaveFav.
    setFolderError(null);
    setSaveToFolderNewName(null);
    setSaveToFolderTarget(movieResult);
  };

  // Performs the actual insert for the movie that's currently in the
  // Save-to-library picker. folderId === null routes the fav to "Unsorted".
  const confirmSaveFav = async (folderId) => {
    const movieResult = saveToFolderTarget;
    if (!movieResult || !user) return;
    const title = String(movieResult.title || "");
    const year = typeof movieResult.year === 'string' ? parseInt(movieResult.year) || 0 : (movieResult.year || 0);
    const genre = Array.isArray(movieResult.genre) ? movieResult.genre.join(" · ") : String(movieResult.genre || "");

    // Coerce runtime to int minutes regardless of upstream shape.
    const runtimeMin = (() => {
      const r = movieResult.runtime;
      if (typeof r === "number" && r > 0) return Math.round(r);
      if (typeof r === "string") {
        const m = r.match(/(\d+)\s*min/i);
        if (m) return parseInt(m[1], 10);
        const hm = r.match(/(\d+)\s*h\s*(\d+)?/i);
        if (hm) return parseInt(hm[1], 10) * 60 + (parseInt(hm[2] || "0", 10));
      }
      return null;
    })();
    const director = typeof movieResult.director === "string" && movieResult.director.trim()
      ? movieResult.director.trim()
      : null;
    const overview = typeof movieResult.description === "string" && movieResult.description.trim()
      ? movieResult.description.trim()
      : null;

    const newFav = {
      title, year, genre,
      poster: movieResult.poster || "",
      score: movieResult.score || { ten: 0, stars: 0 },
      searchKey: title.toLowerCase(),
      folderId: folderId || null,
      runtime: runtimeMin, director, overview,
    };
    const prevFavs = [...favorites];
    setFavorites(prev => [...prev, newFav]);
    setSaveToFolderTarget(null);
    setSaveToFolderNewName(null);
    try {
      const { error } = await supabase.from("favorites").insert({
        user_id: user.id, title, year,
        genre, poster_url: movieResult.poster || "",
        score_ten: movieResult.score?.ten || 0, score_stars: movieResult.score?.stars || 0,
        search_key: title.toLowerCase(),
        folder_id: folderId || null,
        runtime: runtimeMin, director, overview,
      });
      if (error) { console.error("Add fav error:", error, "Data:", { title, year, genre, folderId }); setFavorites(prevFavs); }
    } catch (e) { console.error("Add fav exception:", e); setFavorites(prevFavs); }
  };

  // "Save to a brand-new folder" path inside the heart-click picker.
  // Creates the folder first, then chains the favourite insert with the
  // returned folder id. If folder creation fails (validation, duplicate,
  // RLS) we surface the error and leave the modal open.
  const saveToNewFolder = async (rawName) => {
    const newId = await createFolder(rawName);
    if (newId) {
      await confirmSaveFav(newId);
    }
  };

  const isFav = (r) => {
    if (!r) return false;
    const title = String(r.title || "");
    const year = typeof r.year === 'string' ? parseInt(r.year) || 0 : (r.year || 0);
    return favorites.some(f => f.title === title && f.year === year);
  };

  const removeFav = async (fav, e) => {
    e.stopPropagation();
    if (!user) return;
    const prevFavs = [...favorites];
    setFavorites(prev => prev.filter(f => !(f.title === fav.title && f.year === fav.year)));
    try {
      const { error } = await supabase.from("favorites").delete().eq("user_id", user.id).eq("title", fav.title).eq("year", fav.year);
      if (error) { console.error("Remove fav error:", error); setFavorites(prevFavs); }
    } catch (e2) { console.error("Remove fav exception:", e2); setFavorites(prevFavs); }
  };

  const loadFav = (fav) => {
    setShowFavs(false);
    setQuery(fav.title);
    doSearch(fav.title.toLowerCase());
  };

  // ─── Folder helpers (v5.10.30) ───────────────────────────────────────────
  // Same optimistic-update + revert-on-error pattern as toggleFav/removeFav so
  // the UI always reflects the user's intent immediately and self-heals if
  // the network or RLS rejects the write.

  // Returns the new folder's id on success (so callers can chain — e.g. the
  // heart-click "Save to new folder" flow). Returns null on validation
  // failure or RLS rejection.
  const createFolder = async (rawName) => {
    if (!user) return null;
    const name = (rawName || "").trim().slice(0, 60);
    if (!name) { setFolderError("Folder name can't be empty."); return null; }
    if (folders.some(f => f.name.toLowerCase() === name.toLowerCase())) {
      setFolderError("You already have a folder with that name.");
      return null;
    }
    setFolderError(null);
    const tempId = `temp-${Date.now()}`;
    const position = folders.length;
    const optimistic = { id: tempId, name, position };
    const prev = [...folders];
    setFolders([...folders, optimistic]);
    try {
      const { data, error } = await supabase
        .from("favorite_folders")
        .insert({ user_id: user.id, name, position })
        .select("id, name, position")
        .single();
      if (error) {
        console.error("Create folder error:", error);
        setFolders(prev);
        setFolderError(error.code === "23505" ? "You already have a folder with that name." : "Couldn't create folder.");
        return null;
      }
      setFolders(curr => curr.map(f => f.id === tempId ? { id: data.id, name: data.name, position: data.position } : f));
      setActiveFolderId(data.id);
      setNewFolderInput(null);
      return data.id;
    } catch (e) {
      console.error("Create folder exception:", e);
      setFolders(prev);
      setFolderError("Couldn't create folder.");
      return null;
    }
  };

  const renameFolder = async (folderId, rawName) => {
    if (!user) return;
    const name = (rawName || "").trim().slice(0, 60);
    if (!name) { setFolderError("Folder name can't be empty."); return; }
    if (folders.some(f => f.id !== folderId && f.name.toLowerCase() === name.toLowerCase())) {
      setFolderError("You already have a folder with that name.");
      return;
    }
    setFolderError(null);
    const prev = [...folders];
    setFolders(curr => curr.map(f => f.id === folderId ? { ...f, name } : f));
    setRenamingFolderId(null);
    setRenamingFolderName("");
    try {
      const { error } = await supabase
        .from("favorite_folders")
        .update({ name })
        .eq("id", folderId)
        .eq("user_id", user.id);
      if (error) {
        console.error("Rename folder error:", error);
        setFolders(prev);
        setFolderError("Couldn't rename folder.");
      }
    } catch (e) {
      console.error("Rename folder exception:", e);
      setFolders(prev);
      setFolderError("Couldn't rename folder.");
    }
  };

  const deleteFolder = async (folder) => {
    if (!user || !folder) return;
    const prevFolders = [...folders];
    const prevFavs = [...favorites];
    setFolders(curr => curr.filter(f => f.id !== folder.id));
    setFavorites(curr => curr.map(f => f.folderId === folder.id ? { ...f, folderId: null } : f));
    if (activeFolderId === folder.id) setActiveFolderId("all");
    setDeleteFolderTarget(null);
    try {
      const { error } = await supabase
        .from("favorite_folders")
        .delete()
        .eq("id", folder.id)
        .eq("user_id", user.id);
      if (error) {
        console.error("Delete folder error:", error);
        setFolders(prevFolders);
        setFavorites(prevFavs);
        setFolderError("Couldn't delete folder.");
      }
    } catch (e) {
      console.error("Delete folder exception:", e);
      setFolders(prevFolders);
      setFavorites(prevFavs);
      setFolderError("Couldn't delete folder.");
    }
  };

  const moveFavToFolder = async (fav, folderId) => {
    if (!user) return;
    const prev = [...favorites];
    setFavorites(curr => curr.map(f =>
      f.title === fav.title && f.year === fav.year ? { ...f, folderId: folderId || null } : f
    ));
    setMoveMenuFavKey(null);
    try {
      const { error } = await supabase
        .from("favorites")
        .update({ folder_id: folderId || null })
        .eq("user_id", user.id)
        .eq("title", fav.title)
        .eq("year", fav.year);
      if (error) {
        console.error("Move fav error:", error);
        setFavorites(prev);
        setFolderError("Couldn't move that film.");
      }
    } catch (e) {
      console.error("Move fav exception:", e);
      setFavorites(prev);
      setFolderError("Couldn't move that film.");
    }
  };

  return (
    <div onClick={() => showAccountMenu && setShowAccountMenu(false)} style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "'Syne',sans-serif" }}>
      {/* dangerouslySetInnerHTML — without this, JSX text-node escaping
          turns `'` into `&#x27;` on SSR but not on client, breaking the
          @import url('...') in the first line of this stylesheet (the
          browser then tries to fetch a URL with literal &#x27; characters
          and the page hard-crashes during hydration). Same fix used by
          preview-landing.jsx — see PR #37 era of the conversation log. */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 18px rgba(255,215,0,0.05); } 50% { box-shadow: 0 0 40px rgba(255,215,0,0.1); } }
        @keyframes countUp { from { opacity: 0; transform: scale(0.55) translateY(5px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder { color: #3a3a3a; } input:focus { outline: none; }
        ::-webkit-scrollbar { width: 0px; height: 0px; }
        .fg-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .fg-scroll::-webkit-scrollbar { display: none; }
        .castscroll::-webkit-scrollbar { height: 0px; }

        /* Gold glowing search bar */
        .glow-wrap { position: relative; }
        .glow-layer { position: absolute; z-index: 1; overflow: hidden; height: 100%; width: 100%; border-radius: 14px; }
        .glow-layer::before { content: ''; position: absolute; z-index: -1; width: 800px; height: 800px; background-repeat: no-repeat; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(60deg); transition: all 2s ease; }
        .glow-1 { max-height: 70px; filter: blur(3px); }
        .glow-1::before { background: conic-gradient(#000, #b8860b 5%, #000 38%, #000 50%, #E8A000 60%, #000 87%); }
        .glow-wrap:hover .glow-1::before { transform: translate(-50%, -50%) rotate(-120deg); }
        .glow-wrap:focus-within .glow-1::before { transform: translate(-50%, -50%) rotate(420deg); transition-duration: 4s; }
        .glow-2 { max-height: 66px; filter: blur(3px); }
        .glow-2::before { width: 600px; height: 600px; background: conic-gradient(rgba(0,0,0,0), #6b4f12, rgba(0,0,0,0) 10%, rgba(0,0,0,0) 50%, #8b6914, rgba(0,0,0,0) 60%); transform: translate(-50%, -50%) rotate(82deg); }
        .glow-wrap:hover .glow-2::before { transform: translate(-50%, -50%) rotate(-98deg); }
        .glow-wrap:focus-within .glow-2::before { transform: translate(-50%, -50%) rotate(442deg); transition-duration: 4s; }
        .glow-3 { max-height: 66px; filter: blur(3px); }
        .glow-3::before { width: 600px; height: 600px; background: conic-gradient(rgba(0,0,0,0), #6b4f12, rgba(0,0,0,0) 10%, rgba(0,0,0,0) 50%, #8b6914, rgba(0,0,0,0) 60%); transform: translate(-50%, -50%) rotate(82deg); }
        .glow-wrap:hover .glow-3::before { transform: translate(-50%, -50%) rotate(-98deg); }
        .glow-wrap:focus-within .glow-3::before { transform: translate(-50%, -50%) rotate(442deg); transition-duration: 4s; }
        .glow-4 { max-height: 63px; filter: blur(2px); border-radius: 12px; }
        .glow-4::before { width: 600px; height: 600px; background: conic-gradient(rgba(0,0,0,0) 0%, #ffe082, rgba(0,0,0,0) 8%, rgba(0,0,0,0) 50%, #ffd54f, rgba(0,0,0,0) 58%); filter: brightness(1.4); transform: translate(-50%, -50%) rotate(83deg); }
        .glow-wrap:hover .glow-4::before { transform: translate(-50%, -50%) rotate(-97deg); }
        .glow-wrap:focus-within .glow-4::before { transform: translate(-50%, -50%) rotate(443deg); transition-duration: 4s; }
        .glow-5 { max-height: 59px; filter: blur(0.5px); }
        .glow-5::before { width: 600px; height: 600px; background: conic-gradient(#0a0a0a, #b8860b 5%, #0a0a0a 14%, #0a0a0a 50%, #E8A000 60%, #0a0a0a 64%); filter: brightness(1.3); transform: translate(-50%, -50%) rotate(70deg); }
        .glow-wrap:hover .glow-5::before { transform: translate(-50%, -50%) rotate(-110deg); }
        .glow-wrap:focus-within .glow-5::before { transform: translate(-50%, -50%) rotate(430deg); transition-duration: 4s; }
        .glow-mask { position: absolute; width: 30px; height: 20px; background: #E8A000; top: 10px; left: 8px; filter: blur(24px); opacity: 0.6; transition: opacity 2s; pointer-events: none; z-index: 3; }
        .glow-wrap:hover .glow-mask { opacity: 0; }

        /* Did You Mean — premium suggestion cards (v3, spotlight + conic border) */
        @property --dym-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes dymBorderRotate { to { --dym-angle: 360deg; } }

        .dym-card,
        .fg-fav-card {
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.025);
          isolation: isolate;
        }
        .dym-card > *,
        .fg-fav-card > * { position: relative; z-index: 2; }

        /* Cursor-following spotlight — radial glow tracks --mx/--my from
           onPointerMove on the button. Idle: invisible. Hover: blooms in. */
        .dym-card::before,
        .fg-fav-card::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          background: radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%),
            rgba(255, 215, 0, 0.14) 0%,
            rgba(255, 215, 0, 0.06) 28%,
            transparent 65%);
          opacity: 0;
          transition: opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none;
          z-index: 1;
        }
        .dym-card:hover::before,
        .dym-card:focus-visible::before,
        .fg-fav-card:hover::before,
        .fg-fav-card:focus-within::before { opacity: 1; }

        /* Animated conic-gradient border — gold sweep around the card edge.
           Built from a 1px ring + mask-composite trick so the gradient only
           paints on the perimeter, never on the interior surface. */
        .dym-card::after,
        .fg-fav-card::after {
          content: '';
          position: absolute; inset: -1px;
          border-radius: inherit;
          padding: 1px;
          background: conic-gradient(from var(--dym-angle, 0deg),
            transparent 0%,
            rgba(255, 215, 0, 0.95) 8%,
            rgba(255, 220, 120, 0.55) 14%,
            transparent 28%,
            transparent 100%);
          -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
                  mask-composite: exclude;
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
          z-index: 1;
        }
        .dym-card:hover::after,
        .dym-card:focus-visible::after,
        .fg-fav-card:hover::after,
        .fg-fav-card:focus-within::after {
          opacity: 1;
          animation: dymBorderRotate 4s linear infinite;
        }

        .dym-card:hover,
        .fg-fav-card:hover {
          background: rgba(14, 11, 4, 0.78) !important;
          transform: translateY(-3px);
          box-shadow: 0 22px 48px rgba(0, 0, 0, 0.6), 0 0 60px rgba(255, 215, 0, 0.07), inset 0 0 0 1px rgba(255, 215, 0, 0.06);
        }
        .dym-card:hover .dym-chevron {
          transform: translateX(4px);
          color: rgba(255, 215, 0, 0.96) !important;
        }
        .dym-card:hover .dym-poster,
        .fg-fav-card:hover .dym-poster { transform: scale(1.04); }
        .dym-card:active,
        .fg-fav-card:active {
          transform: translateY(-1px);
          filter: brightness(0.96);
          transition-duration: 0.08s !important;
        }
        .dym-card:focus-visible,
        .fg-fav-card:focus-within { outline: none; }
        .dym-poster { transition: transform 0.55s cubic-bezier(0.16, 1, 0.3, 1); }

        /* Search-again — minimalist text-button with center-out underline */
        .dym-retry::after {
          content: '';
          position: absolute;
          left: 32px; right: 32px; bottom: 4px;
          height: 1px;
          background: rgba(255, 215, 0, 0.55);
          transform: scaleX(0);
          transform-origin: center;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .dym-retry:hover { color: #FFD700 !important; }
        .dym-retry:hover::after { transform: scaleX(1); }

        /* Letterbox rails — top/bottom hairlines bookending the panel */
        @keyframes dymRailIn { from { transform: scaleX(0); opacity: 0; } to { transform: scaleX(1); opacity: 1; } }
        .dym-rail {
          height: 1px;
          background: linear-gradient(to right, transparent 0%, rgba(255, 215, 0, 0.32) 18%, rgba(255, 215, 0, 0.32) 82%, transparent 100%);
          transform-origin: center;
          animation: dymRailIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .dym-rail-top { animation-delay: 0.05s; }
        .dym-rail-bot { animation-delay: 0.15s; }

        /* Static gold gradient for the headline — no infinite shimmer animation
           (the page is a "we couldn't find it" moment; restraint reads as
           sophisticated, not boastful like the landing hero shimmer). */
        .dym-headline {
          background: linear-gradient(135deg, #FFE6A0 0%, #FFD700 38%, #E8A000 78%, #FFD700 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          text-shadow: none;
        }

        @media (max-width: 520px) {
          .dym-card { gap: 16px !important; padding: 16px 16px 16px 14px !important; }
          .dym-poster-wrap { width: 100px !important; height: 150px !important; }
          .dym-title { font-size: 17px !important; }
        }

        /* ─── Favourites page (v5.10.30) ────────────────────────────────────
           Reuses the DYM card frame (selectors above) so the cursor-following
           gold spotlight and the rotating conic-gradient border come for free.
           These rules add: the score column on the right, the trash + move
           buttons in the bottom-right, the folder chip bar, and the move
           popover. */

        /* Score column — replaces the chevron at the right edge of the card.
           Big Playfair gold-gradient number, matching the result-page True
           Movie Rating treatment but sized down. */
        .fg-fav-score {
          font-family: 'Playfair Display', serif;
          font-weight: 700;
          font-size: 56px;
          line-height: 1;
          letter-spacing: -1.4px;
          background: linear-gradient(135deg, #FFE6A0 0%, #FFD700 38%, #E8A000 78%, #FFD700 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          text-shadow: 0 0 24px rgba(255, 215, 0, 0.18);
          transition: text-shadow 0.4s ease, transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .fg-fav-card:hover .fg-fav-score {
          text-shadow: 0 0 38px rgba(255, 215, 0, 0.42), 0 0 80px rgba(255, 215, 0, 0.18);
          transform: scale(1.04);
        }
        .fg-fav-score-suffix {
          color: rgba(255, 215, 0, 0.42);
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.4px;
          margin-left: 2px;
          align-self: baseline;
        }

        /* Card-bottom action row — trash + move button. Idle: dim. Hover the
           card: cluster lifts to legible. Each button has its own hover tint. */
        .fg-fav-actions {
          position: absolute;
          right: 14px;
          bottom: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
          opacity: 0.55;
          transition: opacity 0.35s ease;
          z-index: 4;
        }
        .fg-fav-card:hover .fg-fav-actions { opacity: 1; }
        .fg-fav-actions button {
          background: transparent;
          border: 1px solid transparent;
          padding: 7px;
          border-radius: 8px;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.42);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: color 0.25s ease, background 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
        }
        .fg-fav-actions .fg-fav-move:hover {
          color: #FFD700;
          background: rgba(255, 215, 0, 0.06);
          border-color: rgba(255, 215, 0, 0.22);
          transform: translateY(-1px);
        }
        .fg-fav-actions .fg-fav-trash:hover {
          color: #ff6b6b;
          background: rgba(255, 80, 80, 0.06);
          border-color: rgba(255, 80, 80, 0.22);
          transform: translateY(-1px);
        }

        /* Folder chip currently containing this fav — bottom-left of the card.
           Clickable shortcut to filter to that folder. Stays subtle so it
           doesn't compete with the title/poster. */
        .fg-fav-folder-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px 4px 8px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 1.1px;
          text-transform: uppercase;
          color: rgba(255, 215, 0, 0.78);
          background: rgba(255, 215, 0, 0.06);
          border: 1px solid rgba(255, 215, 0, 0.18);
          border-radius: 6px;
          cursor: pointer;
          transition: color 0.25s ease, background 0.25s ease, border-color 0.25s ease;
        }
        .fg-fav-folder-tag:hover {
          color: #FFD700;
          background: rgba(255, 215, 0, 0.12);
          border-color: rgba(255, 215, 0, 0.42);
        }

        /* Move-to-folder popover */
        .fg-move-pop {
          position: absolute;
          right: 14px;
          bottom: 56px;
          width: 240px;
          background: rgba(10, 8, 4, 0.96);
          border: 1px solid rgba(255, 215, 0, 0.22);
          border-radius: 12px;
          box-shadow: 0 22px 56px rgba(0, 0, 0, 0.7), 0 0 32px rgba(255, 215, 0, 0.08);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          padding: 6px;
          z-index: 50;
          animation: softFade 0.22s ease-out both;
          max-height: 280px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 215, 0, 0.32) transparent;
        }
        .fg-move-pop::-webkit-scrollbar { width: 4px; }
        .fg-move-pop::-webkit-scrollbar-thumb { background: rgba(255, 215, 0, 0.32); border-radius: 2px; }
        .fg-move-pop-row {
          display: flex; align-items: center; gap: 10px;
          width: 100%;
          padding: 9px 12px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.82);
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.2px;
          text-align: left;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }
        .fg-move-pop-row:hover {
          background: rgba(255, 215, 0, 0.06);
          color: #FFD700;
          border-color: rgba(255, 215, 0, 0.18);
        }
        .fg-move-pop-row.active {
          color: #FFD700;
          background: rgba(255, 215, 0, 0.08);
          border-color: rgba(255, 215, 0, 0.22);
        }
        .fg-move-pop-row.muted { color: rgba(255, 255, 255, 0.52); }
        .fg-move-pop-row .check { margin-left: auto; color: #FFD700; }
        .fg-move-pop-divider {
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(255, 215, 0, 0.18), transparent);
          margin: 6px 4px;
        }

        /* ─── Shiny chip system (favourites page) ─────────────────────────
           Adapted from aliimam/shiny-button (21st.dev). Same layered
           conic-gradient border + dotted ::before shimmer + ::after arc
           gleam + span::before breathe pulse, recolored to Film Glance
           gold. Applied to every folder-related chip on the favourites
           surface (filter bar + new-folder pill + the heart-click folder
           picker buttons). */
        @property --fg-shiny-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @property --fg-shiny-offset {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @property --fg-shiny-pct {
          syntax: '<percentage>';
          initial-value: 5%;
          inherits: false;
        }
        @property --fg-shiny-shine {
          syntax: '<color>';
          initial-value: #FFFFFF;
          inherits: false;
        }
        @keyframes fgShinyAngle { to { --fg-shiny-angle: 360deg; } }
        @keyframes fgShinyArc   { to { rotate: 360deg; } }
        @keyframes fgShinyBreathe { from, to { scale: 1; } 50% { scale: 1.2; } }

        /* Bar layout */
        .fg-folder-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          padding: 0 4px;
          margin-bottom: 22px;
        }

        /* Base shiny chip — used by filter chips, +New folder pill, and the
           folder-picker rows on the result page. */
        .fg-shiny {
          --shiny-bg: #0a0805;
          --shiny-bg-sub: #1a1308;
          --shiny-fg: rgba(255, 255, 255, 0.86);
          --shiny-hi: #FFD700;
          --shiny-hi-soft: #FFE89A;
          --shiny-anim: fgShinyAngle linear infinite;
          --shiny-dur: 3s;
          --shiny-ring: 1.5px;
          --shiny-trans: 600ms cubic-bezier(0.25, 1, 0.5, 1);
          isolation: isolate;
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.2px;
          line-height: 1.2;
          color: var(--shiny-fg);
          border: 1px solid transparent;
          border-radius: 999px;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          background:
            linear-gradient(var(--shiny-bg), var(--shiny-bg)) padding-box,
            conic-gradient(
              from calc(var(--fg-shiny-angle) - var(--fg-shiny-offset)),
              transparent,
              var(--shiny-hi) var(--fg-shiny-pct),
              var(--fg-shiny-shine) calc(var(--fg-shiny-pct) * 2),
              var(--shiny-hi) calc(var(--fg-shiny-pct) * 3),
              transparent calc(var(--fg-shiny-pct) * 4)
            ) border-box;
          box-shadow: inset 0 0 0 1px var(--shiny-bg-sub);
          transition: var(--shiny-trans);
          transition-property: --fg-shiny-offset, --fg-shiny-pct, --fg-shiny-shine, color, transform;
        }
        .fg-shiny > * { position: relative; z-index: 1; }
        .fg-shiny:active { translate: 0 1px; }

        /* Dotted shimmer — slow rotating arc of dots inside the chip. */
        .fg-shiny::before,
        .fg-shiny::after,
        .fg-shiny .fg-shiny-label::before {
          content: '';
          pointer-events: none;
          position: absolute;
          inset-inline-start: 50%;
          inset-block-start: 50%;
          translate: -50% -50%;
          z-index: -1;
        }
        .fg-shiny::before {
          --size: calc(100% - 6px);
          --pos: 2px;
          --space: calc(var(--pos) * 2);
          width: var(--size);
          height: var(--size);
          background: radial-gradient(
            circle at var(--pos) var(--pos),
            rgba(255, 240, 180, 0.95) calc(var(--pos) / 4),
            transparent 0
          ) padding-box;
          background-size: var(--space) var(--space);
          background-repeat: space;
          mask-image: conic-gradient(
            from calc(var(--fg-shiny-angle) + 45deg),
            black,
            transparent 12% 88%,
            black
          );
          border-radius: inherit;
          opacity: 0.32;
        }

        /* Inner gleam — slim gold streak rotating slowly. Kept low-opacity
           and narrow so the chip never reads as a filled gold pill. */
        .fg-shiny::after {
          width: 130%;
          aspect-ratio: 1;
          background: linear-gradient(
            -50deg,
            transparent 38%,
            var(--shiny-hi) 50%,
            transparent 62%
          );
          mask-image: radial-gradient(circle at bottom, transparent 52%, black);
          opacity: 0.18;
          animation: fgShinyArc linear infinite var(--shiny-dur);
        }
        .fg-shiny.active::after,
        .fg-shiny.fg-shiny-cta::after { opacity: 0.22; }
        .fg-shiny .fg-shiny-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          z-index: 1;
        }
        .fg-shiny .fg-shiny-label::before {
          --size: calc(100% + 0.6rem);
          width: var(--size);
          height: var(--size);
          box-shadow: inset 0 -1.6ex 1.4rem 3px var(--shiny-hi);
          border-radius: inherit;
          opacity: 0;
          transition: opacity var(--shiny-trans);
          animation: calc(var(--shiny-dur) * 1.5) fgShinyBreathe linear infinite;
        }
        .fg-shiny,
        .fg-shiny::before,
        .fg-shiny::after {
          animation: var(--shiny-anim) var(--shiny-dur),
            var(--shiny-anim) calc(var(--shiny-dur) / 0.4) reverse paused;
          animation-composition: add;
        }
        .fg-shiny:is(:hover, :focus-visible, :focus-within) {
          --fg-shiny-pct: 18%;
          --fg-shiny-offset: 90deg;
          --fg-shiny-shine: var(--shiny-hi-soft);
          color: #FFFFFF;
        }
        .fg-shiny:is(:hover, :focus-visible, :focus-within),
        .fg-shiny:is(:hover, :focus-visible, :focus-within)::before,
        .fg-shiny:is(:hover, :focus-visible, :focus-within)::after {
          animation-play-state: running;
        }
        /* Hover bottom-glow stays subtle so the chip never reads as
           "filled". Active and CTA variants below explicitly leave the
           inset glow at 0 — they signal state via the rotating shine on
           the perimeter, not via a fill. */
        .fg-shiny:is(:hover, :focus-visible, :focus-within) .fg-shiny-label::before { opacity: 0.22; }

        /* Active filter chip — animation always running + gold text +
           slightly thicker rotating shine band on the perimeter. NO inset
           bottom-glow (was creating the heavy yellow fill the user
           flagged). */
        .fg-shiny.active {
          --shiny-fg: #FFD700;
          --fg-shiny-pct: 7%;
          --fg-shiny-shine: var(--shiny-hi-soft);
          --shiny-bg-sub: #1f1604;
          color: #FFD700;
        }
        .fg-shiny.active,
        .fg-shiny.active::before,
        .fg-shiny.active::after { animation-play-state: running; }
        .fg-shiny.active .fg-shiny-label::before { opacity: 0; }

        /* Primary CTA variant (+ New folder, "New folder…" save-row in the
           heart-click picker) — same treatment as active, no inset glow. */
        .fg-shiny.fg-shiny-cta {
          --shiny-bg-sub: #1f1604;
          --fg-shiny-pct: 7%;
          color: #FFD700;
        }
        .fg-shiny.fg-shiny-cta,
        .fg-shiny.fg-shiny-cta::before,
        .fg-shiny.fg-shiny-cta::after { animation-play-state: running; }
        .fg-shiny.fg-shiny-cta .fg-shiny-label::before { opacity: 0; }

        /* List-row variant — used for the heart-click "Add to Favorites"
           rows (Unsorted + each folder). Hover would otherwise widen the
           shine band to 18% and light up the inset bottom-glow at 0.22,
           painting the row's bottom edge yellow. This modifier locks both
           to their rest-state values so hover never reads as a fill.
           Rotating perimeter shine + dotted ::before shimmer + arc gleam
           still play on hover via :focus-within → animation-play-state. */
        .fg-shiny.fg-shiny-flat:is(:hover, :focus-visible, :focus-within) {
          --fg-shiny-pct: 7%;
          --fg-shiny-shine: var(--shiny-hi);
          color: var(--shiny-fg);
        }
        .fg-shiny.fg-shiny-flat:is(:hover, :focus-visible, :focus-within) .fg-shiny-label::before { opacity: 0; }

        /* Count badge inside a chip */
        .fg-shiny .count {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.6px;
          color: rgba(255, 215, 0, 0.78);
          background: rgba(255, 215, 0, 0.10);
          padding: 2px 7px;
          border-radius: 999px;
          line-height: 1;
        }
        .fg-shiny.active .count { color: #FFD700; background: rgba(255, 215, 0, 0.20); }

        /* Hover-revealed rename + delete actions on folder chips */
        .fg-folder-chip-actions {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          margin-left: 4px;
          opacity: 0;
          max-width: 0;
          overflow: hidden;
          transition: opacity 0.25s ease, max-width 0.25s ease;
        }
        .fg-shiny:hover .fg-folder-chip-actions,
        .fg-shiny:focus-within .fg-folder-chip-actions {
          opacity: 1;
          max-width: 60px;
        }
        .fg-folder-chip-actions button {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.52);
          padding: 3px;
          border-radius: 4px;
          cursor: pointer;
          display: inline-flex;
          transition: color 0.2s ease, background 0.2s ease;
        }
        .fg-folder-chip-actions button:hover { background: rgba(255, 215, 0, 0.14); color: #FFD700; }
        .fg-folder-chip-actions .fg-fold-del:hover { background: rgba(255, 80, 80, 0.14); color: #ff6b6b; }

        /* Inline rename / new-folder input — styled to match the shiny chips */
        .fg-folder-input {
          background: #0a0805;
          border: 1px solid rgba(255, 215, 0, 0.55);
          border-radius: 999px;
          padding: 8px 14px;
          color: #FFD700;
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.2px;
          outline: none;
          width: 200px;
          box-shadow: 0 0 22px rgba(255, 215, 0, 0.22), inset 0 1px 0 rgba(255, 215, 0, 0.18);
        }
        .fg-folder-input::placeholder { color: rgba(255, 215, 0, 0.42); }

        /* Confirm-delete modal */
        .fg-fav-modal-back {
          position: fixed; inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 100;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          animation: fadeIn 0.2s ease-out;
        }
        .fg-fav-modal {
          width: 100%;
          max-width: 420px;
          background: rgba(10, 8, 4, 0.96);
          border: 1px solid rgba(255, 215, 0, 0.22);
          border-radius: 16px;
          padding: 26px 28px 22px;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.75), 0 0 60px rgba(255, 215, 0, 0.05);
          animation: slideUp 0.32s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Mobile tweaks */
        /* Mobile favs card — shrink poster + tighter horizontal layout per
           v5.10.35 mobile pass. The 130×195 desktop poster + 22px gaps were
           overflowing 360–414px viewports, causing the cards to render off-
           screen (the leftmost flex children kept their intrinsic content
           width because none had min-width:0 on the cross-axis). New
           geometry at ≤640px: 78×117 poster, 12px gap, 12px padding,
           always-visible action cluster (no hover-reveal — touch has no
           hover state). Score column drops 56→38, minWidth 92→60. Folder
           tag pill goes 11→9.5. */
        @media (max-width: 640px) {
          /* Card frame — leave 36px bottom padding so the absolute-positioned
             action cluster (right:14, bottom:12) doesn't overlap content. */
          .fg-fav-card { gap: 12px !important; padding: 12px 12px 38px 12px !important; }
          .fg-fav-card .dym-poster-wrap { width: 78px !important; height: 117px !important; }
          .fg-fav-title { font-size: 15px !important; margin-bottom: 6px !important; }
          .fg-fav-score { font-size: 38px !important; }
          .fg-fav-score-col { padding-right: 2px !important; min-width: 56px !important; }
          /* Actions always visible on touch (no hover state on a phone). */
          .fg-fav-card .fg-fav-actions { opacity: 1 !important; gap: 4px !important; right: 8px !important; bottom: 8px !important; }
          .fg-fav-card .fg-fav-actions button { padding: 6px !important; }
          .fg-fav-folder-tag { font-size: 9.5px !important; padding: 2px 7px !important; }
        }

        /* Reduced-motion: kill animations on the new surfaces too.
           v5.10.36 fix: same opacity:0-stuck issue as .dym-card. Favs
           cards have inline opacity:0 paired with a softFade animation;
           when animations are killed by reduce-motion the cards stay
           invisible. Force opacity:1 so the static fallback renders. */
        @media (prefers-reduced-motion: reduce) {
          .fg-fav-card,
          .fg-fav-card:hover,
          .fg-fav-card:active,
          .fg-fav-card .dym-poster,
          .fg-fav-score,
          .fg-shiny,
          .fg-shiny::before,
          .fg-shiny::after,
          .fg-shiny .fg-shiny-label::before {
            animation: none !important;
            transform: none !important;
            transition: none !important;
          }
          .fg-fav-card { opacity: 1 !important; }
        }

        /* Result page — recommendation cards (premium hover) */
        .fg-rec-card:hover {
          border-color: rgba(255,215,0,0.42) !important;
          background: rgba(22,18,6,0.82) !important;
          box-shadow: 0 16px 40px rgba(0,0,0,0.6), 0 0 32px rgba(255,215,0,0.10), inset 0 0 0 1px rgba(255,215,0,0.05) !important;
          transform: translateY(-3px) !important;
        }
        .fg-rec-card:hover .fg-rec-poster { transform: scale(1.06); }
        .fg-rec-card:focus-visible {
          outline: none;
          border-color: rgba(255,215,0,0.6) !important;
          box-shadow: 0 0 0 2px rgba(255,215,0,0.32), 0 16px 40px rgba(0,0,0,0.6) !important;
        }

        /* Result page — video review cards */
        .fg-vid-card:hover {
          border-color: rgba(255,215,0,0.4) !important;
          background: rgba(22,18,6,0.82) !important;
          box-shadow: 0 16px 40px rgba(0,0,0,0.6), 0 0 30px rgba(255,215,0,0.10) !important;
          transform: translateY(-3px) !important;
        }
        .fg-vid-card:hover .fg-vid-thumb { transform: scale(1.05); }
        .fg-vid-card:hover .fg-vid-play {
          transform: translate(-50%,-50%) scale(1.1);
          box-shadow: 0 12px 36px rgba(0,0,0,0.7), 0 0 40px rgba(255,215,0,0.5) !important;
        }
        .fg-vid-card:focus-visible { outline: none; border-color: rgba(255,215,0,0.6) !important; }

        /* Watch Trailer CTA — bright gold gradient with pulsing glow */
        @keyframes trailerPulse {
          0%, 100% { box-shadow: 0 0 16px rgba(255,215,0,0.45), 0 0 32px rgba(255,215,0,0.18), inset 0 1px 0 rgba(255,255,255,0.32); }
          50% { box-shadow: 0 0 28px rgba(255,215,0,0.7), 0 0 56px rgba(255,215,0,0.36), inset 0 1px 0 rgba(255,255,255,0.42); }
        }
        .fg-trailer-cta:hover {
          background: linear-gradient(135deg, #FFE89A 0%, #FFD700 48%, #FFC300 100%) !important;
          transform: translateY(-2px);
          box-shadow: 0 0 36px rgba(255,215,0,0.85), 0 0 70px rgba(255,215,0,0.42), inset 0 1px 0 rgba(255,255,255,0.5) !important;
          animation-play-state: paused;
        }

        /* Floating section nav — visibility + thin gold scrollbar */
        .fg-sidebar { display: block; scrollbar-width: thin; scrollbar-color: rgba(255,215,0,0.32) transparent; }
        .fg-sidebar::-webkit-scrollbar { width: 5px; }
        .fg-sidebar::-webkit-scrollbar-track { background: transparent; }
        .fg-sidebar::-webkit-scrollbar-thumb {
          background: rgba(255,215,0,0.32);
          border-radius: 3px;
        }
        .fg-sidebar::-webkit-scrollbar-thumb:hover { background: rgba(255,215,0,0.55); }
        /* Sidebar width 264 + 24 gap + 360 (half main col) needs 648 each side
           plus a small viewport-edge cushion. Min ~1380px viewport before the
           left-of-main positioning has room to fit. */
        @media (max-width: 1379px) {
          .fg-sidebar { display: none !important; }
        }
        /* Floating Action Button — replaces the sidebar at ≤1379px so
           movie-page section navigation isn't lost on tablets/phones.
           At ≥1380px the FAB is hidden (sidebar takes over). Position:
           bottom-right, clear of the gold scroll indicator at right:4.
           v5.10.36 hardening: bumped z-index 210→250 (above the
           scrollPct>0.8 bottom-fade at z:150 and any other fixed chrome),
           bottom uses max(28px, env(safe-area-inset-bottom)) so the FAB
           clears mobile Chrome's appearing address bar + iOS home
           indicator on devices with safe-area insets. */
        .fg-sidebar-fab {
          display: none;
          position: fixed;
          right: 18px;
          bottom: max(28px, env(safe-area-inset-bottom, 28px));
          z-index: 250;
          width: 52px; height: 52px;
          border-radius: 50%;
          background: linear-gradient(135deg, #FFE89A 0%, #FFD700 48%, #E8A000 100%);
          color: #050505;
          border: 1px solid rgba(255, 215, 0, 0.65);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.55), 0 0 36px rgba(255, 215, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.32);
          cursor: pointer;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;
        }
        .fg-sidebar-fab:active { transform: translateY(1px) scale(0.96); }
        .fg-sidebar-fab:focus-visible {
          outline: 2px solid rgba(255, 215, 0, 0.7);
          outline-offset: 3px;
        }
        .fg-sidebar-fab-backdrop {
          position: fixed; inset: 0; z-index: 245;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          animation: fadeIn 0.18s ease-out;
        }
        .fg-sidebar-fab-popover {
          position: fixed;
          right: 18px;
          bottom: calc(max(28px, env(safe-area-inset-bottom, 28px)) + 64px);
          z-index: 255;
          width: min(280px, calc(100vw - 36px));
          max-height: calc(100vh - 140px);
          overflow-y: auto;
          background: rgba(8, 6, 2, 0.96);
          backdrop-filter: blur(24px) saturate(1.1);
          -webkit-backdrop-filter: blur(24px) saturate(1.1);
          border: 1px solid rgba(255, 215, 0, 0.18);
          border-radius: 14px;
          padding: 10px 8px;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 215, 0, 0.06);
          animation: slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (max-width: 1379px) {
          .fg-sidebar-fab { display: inline-flex !important; }
        }
        .fg-side-link:not(.active):hover {
          background: rgba(255,215,0,0.05) !important;
          border-color: rgba(255,215,0,0.14) !important;
          color: rgba(255,215,0,0.9) !important;
        }

        /* Result-page meta chips — dark at rest, gold-glow on hover
           (matches the .newl-how-card behavior on the landing). */
        .fg-meta-chip:hover {
          border-color: rgba(255,215,0,0.42) !important;
          background: linear-gradient(135deg, rgba(255,215,0,0.10), rgba(255,165,0,0.03)) !important;
          color: #FFD700 !important;
          box-shadow: 0 0 22px rgba(255,215,0,0.18), inset 0 1px 0 rgba(255,215,0,0.14) !important;
          transform: translateY(-2px);
        }
        .fg-meta-chip:hover svg { color: #FFD700; }

        /* Hero poster — gold glow on hover */
        .fg-hero-poster:hover {
          transform: translateY(-4px) scale(1.015) !important;
          box-shadow:
            0 28px 72px rgba(0,0,0,0.7),
            0 0 100px rgba(255,215,0,0.32),
            0 0 0 1px rgba(255,215,0,0.55),
            inset 0 0 0 1px rgba(255,215,0,0.18) !important;
        }

        /* Mobile: hero stacks vertically with smaller poster.
           v5.10.35 fix: align-items center (cross-axis center for the
           text column under flex-direction:column) was preventing the text
           column from stretching to full width — long taglines + long
           director names then overflowed the card and caused the entire
           text content to render off-screen on movies like Pulp Fiction.
           Switched to stretch (default flex behaviour for cross-axis)
           and added explicit guards on the text column children:
             - .fg-hero-text-col widens to 100%
             - title h2 gets word-break + overflow-wrap so long titles
               don't push the row past the viewport
             - tagline drops white-space:nowrap so it can wrap instead
               of trying to fit on one line and trigger horizontal overflow
             - meta-row chips already have flex-wrap:wrap; that stays
           Smaller padding on the outer card too — desktop's 30px sides
           was eating viewport. */
        @media (max-width: 640px) {
          .fg-hero-grid { flex-direction: column !important; gap: 18px !important; align-items: stretch !important; }
          .fg-hero-poster { width: 178px !important; height: 267px !important; align-self: center !important; }
          .fg-hero-text-col { width: 100% !important; min-width: 0 !important; }
          .fg-hero-title { font-size: 26px !important; word-break: break-word !important; overflow-wrap: anywhere !important; }
          .fg-hero-tagline { white-space: normal !important; overflow: visible !important; text-overflow: clip !important; }
          .fg-hero-meta { justify-content: flex-start !important; gap: 6px !important; }
          .fg-hero-meta .fg-meta-chip { font-size: 12px !important; padding: 5px 10px !important; }
          .fg-hero-director { white-space: normal !important; max-width: 100% !important; }
          .fg-result-card-inner { padding: 20px 16px 22px !important; }

        }
        /* Source breakdown rows — compressed inline at ≤700px. Pulled out
           of the 640 hero block to its own @media so wider phones (480-
           700) also get the treatment. v5.10.36: bumped breakpoint
           640→700, added !important on every text property, added a
           min-width:0 guard on the name container so flex items can
           shrink properly. Original desktop columns:
             auto | 1fr (name) | 88px (score) | 1fr (bar) | 28px (link)
           with 14px gaps + 18px padding — needs ~480px to fit without
           name + score colliding. Mobile columns:
             28px chip | minmax(0,1fr) | auto score | 44px bar | 14px link
           with 8px gaps + 10/12px padding. Name truncates via ellipsis. */
        @media (max-width: 700px) {
          .fg-source-row {
            grid-template-columns: 28px minmax(0, 1fr) auto 44px 14px !important;
            gap: 8px !important;
            padding: 10px 12px !important;
          }
          .fg-source-row > div:nth-child(1) { width: 28px !important; height: 28px !important; border-radius: 7px !important; }
          .fg-source-row > div:nth-child(1) img { width: 18px !important; height: 18px !important; }
          .fg-source-row > div:nth-child(2) { min-width: 0 !important; }
          .fg-source-row > div:nth-child(2) > span:first-child {
            font-size: 13px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            display: block !important;
            min-width: 0 !important;
          }
          .fg-source-row > div:nth-child(2) > span:nth-child(2) { font-size: 9px !important; letter-spacing: 0.6px !important; }
          .fg-source-row > div:nth-child(3) { font-size: 14px !important; min-width: 0 !important; white-space: nowrap !important; }

          /* True Rating Score — center the score number + description on
             mobile per user feedback (v5.10.36). Desktop layout is
             score-on-left + description-on-right with flex-wrap so they
             stack on mobile; before this rule the wrapped items aligned
             flex-start (left edge of panel), now they center. */
          .fg-score-row { justify-content: center !important; gap: 18px !important; }
          .fg-score-num-wrap { width: 100% !important; min-width: 0 !important; }
          .fg-score-desc-wrap { width: 100% !important; min-width: 0 !important; align-items: center !important; text-align: center !important; }

          /* ═══ v5.10.37 Phase 2 mobile pass — sections that didn't have
             breakpoints yet (cast / awards / box-office / thumbs / watch).
             User-approved patterns:
               - Cast: shrink first (96→64 circle), let existing
                 even-rows-vs-scroll fallback handle non-divisible counts.
               - Box Office: drop the value's white-space:nowrap so long
                 values wrap inline (plain wrapping per user spec — no
                 special rank-suffix formatting).
               - Awards / Thumbs / Watch: shrink-and-fit (smaller padding,
                 fonts, icon chips). ═══ */

          /* Cast — circles 96→64, container width gets compact, name and
             character text scale down. With smaller circles, more counts
             will fit a clean grid; counts that don't will fall back to
             horizontal-scroll mode (existing fg-scroll wrapper). */
          .fg-cast-member { min-width: 76px !important; max-width: 90px !important; width: calc(25% - 8px) !important; gap: 4px !important; }
          .fg-cast-circle { width: 64px !important; height: 64px !important; }
          .fg-cast-circle span { font-size: 20px !important; }
          .fg-cast-name { font-size: 11.5px !important; }
          .fg-cast-char { font-size: 10.5px !important; margin-top: 1px !important; }

          /* Box Office row — shrink-and-fit. Value drops nowrap so long
             "X / #N rank suffix" values wrap inline (plain wrapping). */
          .fg-boxoffice-row { padding: 12px 14px !important; gap: 10px !important; }
          .fg-boxoffice-icon { width: 32px !important; height: 32px !important; }
          .fg-boxoffice-icon svg { width: 14px !important; height: 14px !important; }
          .fg-boxoffice-label { font-size: 13.5px !important; letter-spacing: 0.1px !important; }
          .fg-boxoffice-value { font-size: 14.5px !important; white-space: normal !important; text-align: right !important; }
          .fg-boxoffice-value > span { font-size: 11.5px !important; margin-left: 4px !important; }

          /* Awards row — smaller padding, smaller chip + name fonts. */
          .fg-awards-row { padding: 11px 14px !important; }
          .fg-awards-row > div:first-child { gap: 8px !important; }
          .fg-awards-chip { font-size: 10.5px !important; padding: 3px 8px !important; letter-spacing: 1.0px !important; }
          .fg-awards-name { font-size: 13.5px !important; }
          .fg-awards-detail { font-size: 12.5px !important; line-height: 1.45 !important; }

          /* Thumbs Up / Down section headers — icon chip 40→32, italic
             title 26→22, and tighten the marginLeft on the caption. */
          .fg-thumbs-icon { width: 32px !important; height: 32px !important; border-radius: 9px !important; }
          .fg-thumbs-icon svg { width: 16px !important; height: 16px !important; }
          .fg-thumbs-title { font-size: 22px !important; }
          .fg-thumbs-caption { margin-left: 44px !important; font-size: 10.5px !important; }
          .fg-thumbs-wrap { padding-left: 14px !important; padding-right: 14px !important; }

          /* Where to Watch container — reduce side padding 26→14 so the
             pills get more horizontal room before wrapping. */
          .fg-watch-wrap { padding-left: 14px !important; padding-right: 14px !important; gap: 8px !important; }

          /* Universal: any accordion content block tagged with
             .fg-accord-content gets reduced side padding on mobile.
             (Sections that already have specific rules above override
             this.) */
          .fg-accord-content { padding-left: 14px !important; padding-right: 14px !important; }
        }

        /* Respect reduced-motion preference — disable stagger, rail sweep,
           hover translate. Keep static layout, no animation. v5.10.36 fix:
           cards have inline opacity:0 paired with a softFade animation
           that transitions opacity 0 → 1. When animations are killed by
           reduce-motion (Android battery saver, Samsung OneUI default,
           iOS low-power), the cards stay at opacity:0 and never appear.
           Force opacity:1 here so the static fallback is visible. Same
           treatment for fg-fav-card below. */
        @media (prefers-reduced-motion: reduce) {
          .dym-card,
          .dym-card:hover,
          .dym-card:active,
          .dym-card .dym-poster,
          .dym-rail,
          .dym-chevron {
            animation: none !important;
            transform: none !important;
            transition: none !important;
          }
          .dym-card { opacity: 1 !important; }
          .dym-rail { transform: scaleX(1) !important; opacity: 1 !important; }
        }

        /* Unified header nav — matches /preview-landing */
        .nav-btn { transition: border-color 0.35s ease, background 0.35s ease, box-shadow 0.35s ease; }
        .nav-btn:hover {
          border-color: rgba(255, 215, 0, 0.55) !important;
          background: rgba(255, 215, 0, 0.08) !important;
          box-shadow: 0 0 22px rgba(255, 215, 0, 0.22), 0 0 48px rgba(255, 215, 0, 0.08);
        }
        .nav-btn .arrow { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .nav-btn:hover .arrow { transform: translateX(3px); }
        @media (max-width: 520px) {
          .nav-forum-label { display: none !important; }
        }
        /* v5.10.36 — bumped breakpoint 480→560 (was missing modern
           phones in the 481-540px logical-width range; user reported
           "Film/Glance" still wrapping on a phone they tested). At
           ≤560px: drop the Discussion Forum chat-icon button entirely
           (forum is still reachable via /discuss URL), make the My
           Account / Sign In button icon-only (label hidden), and
           tighten button padding so the "Film Glance" brand-mark stops
           wrapping onto two lines. Also tighten header padding. */
        /* v5.12.1: nav buttons stay visible on mobile (icon-only via the
           ≤520px .nav-forum-label rule above). Mobile parity is mandatory —
           nav links must never be hidden on smaller viewports. */
        @media (max-width: 560px) {
          .nav-account-label { display: none !important; }
          .nav-btn { padding: 7px 9px !important; gap: 5px !important; }
          .nav-brand { font-size: 17px !important; }
        }

        /* ═══ NEW LANDING: atmosphere, hero accent, ticker, how-it-works, film-strip ═══ */
        .bg-spotlight {
          position: fixed; top: -30vh; left: 50%;
          width: 150vw; height: 130vh;
          transform: translateX(-50%);
          background: radial-gradient(ellipse 55% 48% at 50% 0%, rgba(255, 220, 120, 0.13) 0%, rgba(232, 160, 0, 0.06) 22%, rgba(232, 160, 0, 0.02) 42%, transparent 65%);
          pointer-events: none; z-index: 1;
        }
        .bg-vignette {
          position: fixed; inset: 0;
          background: radial-gradient(ellipse 110% 85% at 50% 50%, transparent 52%, rgba(0, 0, 0, 0.45) 85%, rgba(0, 0, 0, 0.85) 100%);
          pointer-events: none; z-index: 5;
        }
        .bg-grain {
          position: fixed; inset: 0;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.85'/></svg>");
          mix-blend-mode: overlay; opacity: 0.085;
          pointer-events: none; z-index: 6;
        }
        .fg-particles-wrap {
          position: fixed; inset: 0; z-index: 3;
          pointer-events: none;
          /* Default opacity: 1 (visible). No fade-in animation — we previously
             had opacity:0 + softFade, which left the container invisible forever
             on devices reporting prefers-reduced-motion (Android battery saver,
             Samsung OneUI, etc.). Always visible is the correct default. */
        }

        @keyframes letterIn { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes softFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes goldShimmer { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes haloBreathe { 0%, 100% { text-shadow: 0 0 10px rgba(255, 215, 0, 0.22); } 50% { text-shadow: 0 0 18px rgba(255, 215, 0, 0.32); } }

        /* Hero second-line gold accent — static gradient. The previous
           goldShimmer (background-position oscillation) + haloBreathe
           (text-shadow pulse) infinite loops were removed per user
           feedback ("the title should be there when the site loads, no
           animations"). The static gradient itself is still there — it's
           the brand colour, not an animation. The below-fold "Review
           Sites Included" + "What You'll Find" sections keep their
           animations as the user requested. */
        .hero-accent {
          background: linear-gradient(135deg, #FFE27A 0%, #FFD700 32%, #E8A000 62%, #FFD700 100%);
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent; color: transparent;
          text-shadow: 0 0 14px rgba(255, 215, 0, 0.26);
        }

        .ticker-viewport { overflow: hidden; mask-image: linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%); -webkit-mask-image: linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%); }
        .ticker-track { display: inline-flex; gap: 64px; align-items: center; white-space: nowrap; animation: tickerScroll 44s linear infinite; color: rgba(255, 255, 255, 0.34); will-change: transform; }
        .ticker-track:hover { animation-play-state: paused; }
        @keyframes tickerScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ticker-item { display: inline-flex; align-items: center; gap: 14px; padding: 0 4px; transition: color 0.5s ease, transform 0.5s ease; }
        .ticker-item:hover { color: rgba(255, 215, 0, 0.9); transform: translateY(-1px); }

        .newl-how-card { transition: all 0.45s cubic-bezier(0.16, 1, 0.3, 1); text-align: center; }
        .newl-how-card:hover { border-color: rgba(255, 215, 0, 0.22) !important; transform: translateY(-4px); box-shadow: 0 18px 52px rgba(255, 215, 0, 0.09), 0 0 0 1px rgba(255, 215, 0, 0.06) inset; }
        .newl-how-card:hover .newl-how-icon { color: #FFE27A; filter: drop-shadow(0 0 18px rgba(255, 215, 0, 0.45)); }
        .newl-how-icon { color: #FFD700; filter: drop-shadow(0 0 12px rgba(255, 215, 0, 0.22)); transition: color 0.4s ease, filter 0.4s ease; }

        .strip-outer {
          position: relative; margin: 24px 0 48px;
          background: linear-gradient(to bottom, rgba(255, 215, 0, 0.055) 0%, rgba(255, 215, 0, 0.08) 18%, rgba(14, 12, 6, 0.7) 18%, rgba(14, 12, 6, 0.7) 82%, rgba(255, 215, 0, 0.08) 82%, rgba(255, 215, 0, 0.055) 100%);
          border-top: 1px solid rgba(255, 215, 0, 0.14); border-bottom: 1px solid rgba(255, 215, 0, 0.14);
          box-shadow: 0 0 60px rgba(255, 215, 0, 0.04), inset 0 1px 0 rgba(255, 215, 0, 0.05), inset 0 -1px 0 rgba(255, 215, 0, 0.05);
        }
        .sprocket-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 18px; height: 28px; gap: 10px; }
        .sprocket-hole { flex: 1; min-width: 14px; max-width: 22px; height: 12px; background: #050505; border-radius: 2px; box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.8); }
        .film-track-viewport { overflow: hidden; mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%); -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%); }
        .film-track { display: inline-flex; animation: filmScroll 56s linear infinite; will-change: transform; }
        .film-track:hover { animation-play-state: paused; }
        @keyframes filmScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .film-frame { flex-shrink: 0; width: 244px; height: 180px; padding: 26px 24px; text-align: left; border-right: 1px solid rgba(255, 215, 0, 0.09); background: rgba(10, 10, 10, 0.4); transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); position: relative; overflow: hidden; }
        .film-frame::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 80% 60% at 50% 50%, rgba(255, 215, 0, 0.06) 0%, transparent 70%); opacity: 0; transition: opacity 0.5s ease; pointer-events: none; }
        .film-frame:hover::before { opacity: 1; }
        .film-frame:hover { background: rgba(22, 18, 6, 0.6); box-shadow: inset 0 0 28px rgba(255, 215, 0, 0.08), inset 0 0 0 1px rgba(255, 215, 0, 0.14); }
        .film-frame:hover .film-icon { color: #FFE27A; filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.55)); transform: scale(1.08) translateY(-1px); }
        .film-icon { color: rgba(255, 215, 0, 0.78); filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.24)); margin-bottom: 14px; transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); display: block; }
        .film-title { font-family: 'Playfair Display', serif; font-size: 17px; font-weight: 700; letter-spacing: -0.2px; margin-bottom: 8px; color: #fff; line-height: 1.18; }
        .film-body { font-family: 'Syne', sans-serif; font-size: 12.5px; font-weight: 500; color: rgba(255, 255, 255, 0.58); line-height: 1.5; }

        @media (max-width: 860px) {
          .newl-how-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
          .ticker-track { gap: 44px !important; animation-duration: 32s !important; }
          .film-frame { width: 210px !important; padding: 22px 20px !important; }
          .film-title { font-size: 15.5px !important; }
        }

        /* v5.10.38 Phase 3 — landing-page ticker + film-strip animations
           weren't perceptibly moving on narrow phones. Root cause: 56s /
           32s durations across track widths that translateX(-50%) means
           ~13–36 px/s perceived motion. With a 360px viewport masked
           14% / 10% on each edge, the user sees ~2 items at a time
           moving at glacial pace — looks frozen. Fix: speed both up,
           shrink film-frame, narrow the masks. ticker also drops gap
           further so more items occupy the visible window. */
        @media (max-width: 640px) {
          .ticker-viewport { mask-image: linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%) !important; -webkit-mask-image: linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%) !important; }
          .ticker-track { gap: 32px !important; animation-duration: 22s !important; }
          .ticker-item { gap: 10px !important; }
          .ticker-item span { font-size: 14px !important; }
          .film-track-viewport { mask-image: linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%) !important; -webkit-mask-image: linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%) !important; }
          .film-track { animation-duration: 28s !important; }
          .film-frame { width: 170px !important; height: 158px !important; padding: 18px 16px !important; }
          .film-title { font-size: 14px !important; margin-bottom: 6px !important; }
          .film-body { font-size: 11.5px !important; line-height: 1.45 !important; }
        }
      ` }} />

      {/* Header — matches /preview-landing for cross-page consistency.
          v5.10.39: header padding locked at 18px constant (was toggling
          18→13 on scroll, the 5px height change was reflowing the whole
          page on every scroll-threshold crossing). Visual feedback that
          you've scrolled is preserved via background/border/box-shadow
          toggle — just no height change. translateZ(0) + will-change
          force GPU layer promotion so backdrop-filter doesn't recompute
          against changing underlying content on every scroll frame. */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "18px 32px",
          borderBottom: headerScrolled
            ? "1px solid rgba(255, 215, 0, 0.14)"
            : "1px solid rgba(255, 255, 255, 0.04)",
          background: headerScrolled ? "rgba(5, 5, 5, 0.78)" : "rgba(5, 5, 5, 0.55)",
          backdropFilter: "blur(24px) saturate(1.4)",
          WebkitBackdropFilter: "blur(24px) saturate(1.4)",
          boxShadow: headerScrolled
            ? "0 1px 0 rgba(255, 215, 0, 0.06), 0 8px 32px rgba(0, 0, 0, 0.35)"
            : "none",
          transition: "border-color 0.4s ease, background 0.4s ease, box-shadow 0.4s ease",
          transform: "translateZ(0)",
          willChange: "transform",
        }}
      >
        <Link href="/preview-landing" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "#fff" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, rgba(255,215,0,0.20), rgba(255,165,0,0.06))", border: "1px solid rgba(255, 215, 0, 0.18)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(255, 215, 0, 0.10)" }}>
            <Film size={15} style={{ color: "#FFD700" }} />
          </div>
          <span className="nav-brand" style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 700, letterSpacing: -0.4, whiteSpace: "nowrap" }}>
            Film <span style={{ color: "#FFD700" }}>Glance</span>
          </span>
        </Link>

        <nav aria-label="Primary" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/discuss"
            className="nav-btn nav-discuss-btn"
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
          <Link
            href="/boxoffice"
            className="nav-btn nav-boxoffice-btn"
            aria-label="Open Box Office page"
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "7px 15px", borderRadius: 9,
              border: "1px solid rgba(255, 215, 0, 0.18)",
              background: "rgba(255, 215, 0, 0.03)",
              color: "#FFD700", fontSize: 12, fontWeight: 600,
              textDecoration: "none", fontFamily: "'Syne', sans-serif", letterSpacing: 0.2,
            }}
          >
            <TrendingUp size={13} />
            <span className="nav-forum-label">Box Office</span>
          </Link>
          {user && (
            <button
              onClick={() => { setShowFavs(!showFavs); setShowPrice(false); setResult(null); setLoading(false); }}
              className="nav-btn"
              aria-label="Open your favourites"
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "7px 15px", borderRadius: 9,
                border: "1px solid rgba(255, 215, 0, 0.18)",
                background: showFavs ? "rgba(255, 215, 0, 0.08)" : "rgba(255, 215, 0, 0.03)",
                color: "#FFD700", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "'Syne', sans-serif", letterSpacing: 0.2,
              }}
            >
              <Heart size={13} />
              <span className="nav-forum-label">Favourites</span>
              {favorites.length > 0 && (
                <span style={{ fontSize: 9, background: "rgba(255,215,0,0.14)", color: "#FFD700", padding: "1px 5px", borderRadius: 6, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                  {favorites.length}
                </span>
              )}
            </button>
          )}
          {user ? (
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
                <User size={12} /> <span className="nav-account-label">My Account</span>
              </button>
              {showAccountMenu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute", top: 42, right: 0,
                    background: "#0a0a0a", border: "1px solid rgba(255, 215, 0, 0.12)",
                    borderRadius: 12, padding: "10px 0", minWidth: 220, zIndex: 100,
                    animation: "fadeIn 0.2s",
                  }}
                >
                  <div style={{ padding: "6px 16px 10px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <p style={{ fontSize: 10.5, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</p>
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
              <span className="nav-account-label">Sign In</span>
            </button>
          )}
        </nav>
      </header>

      {/* ───── Atmosphere layers — only on the idle landing ───── */}
      {!result && !loading && !showFavs && !ambiguousMatches && (
        <>
          <div className="bg-spotlight" aria-hidden="true" />
          <div className="fg-particles-wrap" aria-hidden="true">
            <GridBackground />
          </div>
          <div className="bg-vignette" aria-hidden="true" />
          <div className="bg-grain" aria-hidden="true" />
        </>
      )}

      {/* Video Modal */}
      {videoModal && (
        <div onClick={() => setVideoModal(null)} style={{
          position: "fixed", inset: 0, zIndex: 1200,
          background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20, animation: "fadeIn 0.2s",
        }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 720, position: "relative" }}>
            <button onClick={() => setVideoModal(null)} style={{
              position: "absolute", top: -36, right: 0, background: "none", border: "none",
              color: "#888", cursor: "pointer", fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <X size={14} /> Close
            </button>
            <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,215,0,0.1)", aspectRatio: "16/9", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
              {isValidYouTubeId(videoModal.id) ? (
                <iframe
                  src={`https://www.youtube.com/embed/${videoModal.id}?autoplay=1&rel=0&modestbranding=1`}
                  title={videoModal.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ width: "100%", height: "100%", border: "none" }}
                />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "#888", fontSize: 13 }}>
                  Video unavailable
                </div>
              )}
            </div>
            <p style={{ textAlign: "center", color: "#666", fontSize: 11, marginTop: 10, fontWeight: 500 }}>{videoModal.title}</p>
          </div>
        </div>
      )}

      {/* "Add to Favorites" — heart-click folder picker (v5.10.31).
          Always available regardless of view, so user can favourite from
          the result page or anywhere with a heart button. Click any row to
          save instantly to that destination; "+ New folder…" reveals an
          inline input that creates the folder + saves in one step. */}
      {saveToFolderTarget && (
        <div
          className="fg-fav-modal-back"
          onClick={() => { setSaveToFolderTarget(null); setSaveToFolderNewName(null); setFolderError(null); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="fg-save-fav-title"
        >
          <div className="fg-fav-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h3
              id="fg-save-fav-title"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontStyle: "italic",
                fontSize: 32,
                fontWeight: 600,
                color: "#FFD700",
                letterSpacing: -0.6,
                marginBottom: 10,
                lineHeight: 1.08,
                textAlign: "center",
              }}
            >
              Add to Favorites
            </h3>
            <p style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 17,
              color: "rgba(255, 255, 255, 0.78)",
              lineHeight: 1.5,
              marginBottom: 4,
              textAlign: "center",
            }}>
              Pick or create a folder to save this favorite.
            </p>
            {folderError && (
              <p style={{
                color: "#ff8b8b",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: 0.6,
                margin: "10px 0 0",
              }}>{folderError}</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>
              <button
                type="button"
                className="fg-shiny fg-shiny-flat"
                onClick={() => confirmSaveFav(null)}
                style={{ justifyContent: "center", padding: "13px 18px", fontSize: 16 }}
              >
                <span className="fg-shiny-label" style={{ justifyContent: "center" }}>
                  <Inbox size={16} aria-hidden="true" />
                  <span>Unsorted</span>
                </span>
              </button>
              {folders.map((fld) => (
                <button
                  key={fld.id}
                  type="button"
                  className="fg-shiny fg-shiny-flat"
                  onClick={() => confirmSaveFav(fld.id)}
                  style={{ justifyContent: "center", padding: "13px 18px", fontSize: 16 }}
                >
                  <span className="fg-shiny-label" style={{ justifyContent: "center" }}>
                    <Folder size={16} aria-hidden="true" />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>{fld.name}</span>
                  </span>
                </button>
              ))}
              {saveToFolderNewName === null ? (
                <button
                  type="button"
                  className="fg-shiny fg-shiny-cta"
                  onClick={() => { setSaveToFolderNewName(""); setFolderError(null); }}
                  style={{ justifyContent: "center", padding: "13px 18px", fontSize: 16 }}
                >
                  <span className="fg-shiny-label" style={{ justifyContent: "center" }}>
                    <FolderPlus size={16} aria-hidden="true" />
                    <span>New folder…</span>
                  </span>
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                  <input
                    autoFocus
                    value={saveToFolderNewName}
                    onChange={(e) => setSaveToFolderNewName(e.target.value.slice(0, 60))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && saveToFolderNewName.trim()) saveToNewFolder(saveToFolderNewName);
                      if (e.key === "Escape") { setSaveToFolderNewName(null); setFolderError(null); }
                    }}
                    className="fg-folder-input"
                    placeholder="Folder name…"
                    maxLength={60}
                    style={{ flex: 1, width: "auto" }}
                    aria-label="New folder name"
                  />
                  <button
                    type="button"
                    className="fg-shiny fg-shiny-cta"
                    onClick={() => { if (saveToFolderNewName.trim()) saveToNewFolder(saveToFolderNewName); }}
                    style={{ padding: "8px 16px" }}
                  >
                    <span className="fg-shiny-label">
                      <Check size={13} aria-hidden="true" />
                      <span>Save</span>
                    </span>
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setSaveToFolderTarget(null); setSaveToFolderNewName(null); setFolderError(null); }}
              style={{
                marginTop: 18,
                width: "100%",
                padding: "13px 18px",
                background: "transparent",
                border: "1px solid rgba(255, 255, 255, 0.10)",
                borderRadius: 999,
                color: "rgba(255, 255, 255, 0.62)",
                fontFamily: "'Syne', sans-serif",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: 0.4,
                cursor: "pointer",
                transition: "border-color 0.25s, color 0.25s",
                textAlign: "center",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)"; e.currentTarget.style.color = "rgba(255,255,255,0.92)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "rgba(255,255,255,0.62)"; }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Notification Banner */}
      {authNotice && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 1100, background: "#0a0a0a", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 12, padding: "14px 24px", maxWidth: 420, display: "flex", alignItems: "center", gap: 10, animation: "slideUp 0.4s", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          <Mail size={16} style={{ color: "#FFD700", flexShrink: 0 }} />
          <p style={{ fontSize: 12.5, color: "#ccc", lineHeight: 1.4 }}>{authNotice}</p>
          <button onClick={() => setAuthNotice(null)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", flexShrink: 0 }}><X size={14} /></button>
        </div>
      )}

      {/* Daily Limit Reached Banner */}
      {dailyLimitReached && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 1100,
          background: "#0a0a0a", border: "1px solid rgba(255,215,0,0.25)", borderRadius: 14,
          padding: "18px 24px", maxWidth: 440, width: "calc(100% - 32px)",
          display: "flex", alignItems: "center", gap: 14,
          animation: "slideUp 0.4s", boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,165,0,0.06))",
            border: "1px solid rgba(255,215,0,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Zap size={16} style={{ color: "#FFD700" }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 3, fontFamily: "'Syne',sans-serif" }}>Daily search limit reached</p>
            <p style={{ fontSize: 11.5, color: "#888", lineHeight: 1.4 }}>Sign up for free to unlock unlimited searches!</p>
          </div>
          <button
            onClick={() => { setDailyLimitReached(false); setShowAuth(true); }}
            style={{
              padding: "8px 16px", borderRadius: 9, border: "none", flexShrink: 0,
              background: "linear-gradient(135deg, #FFD700, #E8A000)",
              color: "#050505", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >Sign Up Free</button>
          <button onClick={() => setDailyLimitReached(false)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", flexShrink: 0, padding: 2 }}><X size={14} /></button>
        </div>
      )}

      {/* Auth Modal */}
      {showAuth && (
        <div onClick={() => setShowAuth(false)} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.88)", backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", animation: "fadeIn 0.25s" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 390, background: "#070707", borderRadius: 20, border: "1px solid rgba(255,215,0,0.07)", padding: "36px 30px", position: "relative", animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
            <button onClick={() => setShowAuth(false)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#444", cursor: "pointer" }}><X size={17} /></button>
            <div style={{ textAlign: "center", marginBottom: 26 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, margin: "0 auto 12px", background: "linear-gradient(135deg,rgba(255,215,0,0.12),rgba(255,165,0,0.06))", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,215,0,0.1)" }}><Film size={20} style={{ color: "#FFD700" }} /></div>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: "#fff", margin: 0 }}>{authMode === "signup" ? "Create Account" : "Welcome Back"}</h2>
              <p style={{ color: "#444", fontSize: 12, marginTop: 6 }}>{authMode === "signup" ? "Sign up to start rating" : "Sign in to continue"}</p>
            </div>
            <button style={{ width: "100%", padding: "10px", borderRadius: 11, border: "1px solid #1e1e1e", background: "#0c0c0c", color: "#ccc", fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginBottom: 16 }}
              onClick={loginWithGoogle}>Continue with Google</button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
              <span style={{ color: "#333", fontSize: 11 }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <div style={{ position: "relative" }}>
                <Mail size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#333" }} />
                <input type="email" placeholder="Email address" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid #1a1a1a", background: "#0a0a0a", color: "#fff", fontSize: 13, fontFamily: "system-ui, -apple-system, sans-serif" }} />
              </div>
              <div style={{ position: "relative" }}>
                <Lock size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#333" }} />
                <input type={showPw ? "text" : "password"} placeholder="Password" value={authPw} onChange={e => setAuthPw(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { authMode === "signup" ? signUpWithEmail(authEmail, authPw) : loginWithEmail(authEmail, authPw); } }}
                  style={{ width: "100%", padding: "10px 36px 10px 36px", borderRadius: 10, border: "1px solid #1a1a1a", background: "#0a0a0a", color: "#fff", fontSize: 13, fontFamily: "system-ui, -apple-system, sans-serif" }} />
                <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#333", cursor: "pointer" }}>
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {errMsg && <p style={{ color: "#ef4444", fontSize: 11, marginBottom: 10, textAlign: "center" }}>{errMsg}</p>}
            <button onClick={() => { authMode === "signup" ? signUpWithEmail(authEmail, authPw) : loginWithEmail(authEmail, authPw); }}
              style={{ width: "100%", padding: "12px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#FFD700,#E8A000)", color: "#050505", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>
              {authMode === "signup" ? "Create Account" : "Sign In"}
            </button>
            <p style={{ textAlign: "center", fontSize: 11.5, color: "#444" }}>
              {authMode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
              <span onClick={() => { setAuthMode(authMode === "signup" ? "signin" : "signup"); setErrMsg(null); }}
                style={{ color: "#FFD700", cursor: "pointer", fontWeight: 600 }}>
                {authMode === "signup" ? "Sign In" : "Sign Up"}
              </span>
            </p>
          </div>
        </div>
      )}

      {showFavs ? (() => {
        // Derive view state for the favourites surface.
        const folderById = (id) => folders.find(f => f.id === id);
        const unsortedFavs = favorites.filter(f => !f.folderId);
        const inFolderCount = (folderId) => favorites.filter(f => f.folderId === folderId).length;
        const visibleFavs = activeFolderId === "all"
          ? favorites
          : activeFolderId === "unsorted"
            ? unsortedFavs
            : favorites.filter(f => f.folderId === activeFolderId);
        const activeFolderName = activeFolderId === "all"
          ? null
          : activeFolderId === "unsorted"
            ? "Unsorted"
            : (folderById(activeFolderId)?.name || null);
        const totalCount = favorites.length;
        const showFolderBar = totalCount > 0 || folders.length > 0 || newFolderInput !== null;

        return (
          <div style={{ padding: "32px 18px 56px", maxWidth: 760, margin: "0 auto", animation: "fadeIn 0.5s" }}>
            <div className="dym-rail dym-rail-top" aria-hidden="true" />

            {/* Header — italic Playfair gold headline + mono diagnostic line.
                Mirrors the DYM/"Did you mean…" header pattern but tonally
                celebratory rather than apologetic. */}
            <div style={{ textAlign: "center", padding: "32px 12px 22px" }}>
              <h2
                className="dym-headline"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontStyle: "italic",
                  fontSize: "clamp(34px, 6.4vw, 52px)",
                  fontWeight: 600,
                  letterSpacing: -0.9,
                  lineHeight: 1.02,
                  margin: 0,
                  animation: "softFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both",
                }}
              >
                Your Favourites
              </h2>
            </div>

            {/* Folder filter bar — All / Unsorted / per-folder chips / + New Folder.
                Hidden entirely when no favourites and no folders exist. */}
            {showFolderBar && (
              <div className="fg-folder-bar" role="tablist" aria-label="Filter favourites by folder">
                <button
                  type="button"
                  className={`fg-shiny${activeFolderId === "all" ? " active" : ""}`}
                  onClick={() => setActiveFolderId("all")}
                  role="tab"
                  aria-selected={activeFolderId === "all"}
                >
                  <span className="fg-shiny-label">
                    <Library size={13} aria-hidden="true" />
                    <span>All</span>
                    <span className="count">{totalCount}</span>
                  </span>
                </button>
                {(folders.length > 0 || unsortedFavs.length > 0) && (
                  <button
                    type="button"
                    className={`fg-shiny${activeFolderId === "unsorted" ? " active" : ""}`}
                    onClick={() => setActiveFolderId("unsorted")}
                    role="tab"
                    aria-selected={activeFolderId === "unsorted"}
                  >
                    <span className="fg-shiny-label">
                      <Inbox size={13} aria-hidden="true" />
                      <span>Unsorted</span>
                      <span className="count">{unsortedFavs.length}</span>
                    </span>
                  </button>
                )}
                {folders.map((fld) => {
                  const isActive = activeFolderId === fld.id;
                  const isRenaming = renamingFolderId === fld.id;
                  // Outer is a <span>, not a <button>, so we can nest the
                  // rename + delete <button> children without violating the
                  // "no button-in-button" HTML rule. The inner button hosts
                  // the filter click and is the .fg-shiny-label so the
                  // breathe pulse ::before still anchors there.
                  return (
                    <span
                      key={fld.id}
                      className={`fg-shiny${isActive ? " active" : ""}`}
                      style={{ paddingRight: isRenaming ? 6 : undefined }}
                    >
                      {isRenaming ? (
                        <span className="fg-shiny-label">
                          {isActive ? <FolderOpen size={13} aria-hidden="true" /> : <Folder size={13} aria-hidden="true" />}
                          <input
                            autoFocus
                            value={renamingFolderName}
                            onChange={(e) => setRenamingFolderName(e.target.value.slice(0, 60))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") renameFolder(fld.id, renamingFolderName);
                              if (e.key === "Escape") { setRenamingFolderId(null); setRenamingFolderName(""); setFolderError(null); }
                            }}
                            onBlur={() => { if (renamingFolderName.trim()) renameFolder(fld.id, renamingFolderName); else { setRenamingFolderId(null); setRenamingFolderName(""); } }}
                            className="fg-folder-input"
                            style={{ width: 130, padding: "4px 10px", fontSize: 13 }}
                            maxLength={60}
                            aria-label={`Rename folder ${fld.name}`}
                          />
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="fg-shiny-label"
                            onClick={() => setActiveFolderId(fld.id)}
                            role="tab"
                            aria-selected={isActive}
                            style={{ all: "unset", display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                          >
                            {isActive ? <FolderOpen size={13} aria-hidden="true" /> : <Folder size={13} aria-hidden="true" />}
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200, whiteSpace: "nowrap" }}>{fld.name}</span>
                            <span className="count">{inFolderCount(fld.id)}</span>
                          </button>
                          <span className="fg-folder-chip-actions" aria-hidden="false">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setRenamingFolderId(fld.id); setRenamingFolderName(fld.name); setFolderError(null); }}
                              title={`Rename ${fld.name}`}
                              aria-label={`Rename ${fld.name}`}
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              type="button"
                              className="fg-fold-del"
                              onClick={(e) => { e.stopPropagation(); setDeleteFolderTarget(fld); }}
                              title={`Delete ${fld.name}`}
                              aria-label={`Delete ${fld.name}`}
                            >
                              <Trash2 size={11} />
                            </button>
                          </span>
                        </>
                      )}
                    </span>
                  );
                })}
                {newFolderInput !== null ? (
                  <input
                    autoFocus
                    value={newFolderInput}
                    onChange={(e) => setNewFolderInput(e.target.value.slice(0, 60))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createFolder(newFolderInput);
                      if (e.key === "Escape") { setNewFolderInput(null); setFolderError(null); }
                    }}
                    onBlur={() => { if (newFolderInput.trim()) createFolder(newFolderInput); else { setNewFolderInput(null); setFolderError(null); } }}
                    className="fg-folder-input"
                    placeholder="Folder name…"
                    maxLength={60}
                    aria-label="New folder name"
                  />
                ) : (
                  <button
                    type="button"
                    className="fg-shiny fg-shiny-cta"
                    onClick={() => { setNewFolderInput(""); setFolderError(null); }}
                    aria-label="Create new folder"
                  >
                    <span className="fg-shiny-label">
                      <FolderPlus size={13} aria-hidden="true" />
                      <span>New folder</span>
                    </span>
                  </button>
                )}
              </div>
            )}

            {folderError && (
              <p
                role="alert"
                style={{
                  textAlign: "center",
                  color: "#ff8b8b",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  letterSpacing: 0.6,
                  marginTop: -8,
                  marginBottom: 14,
                }}
              >
                {folderError}
              </p>
            )}

            {/* Empty state — varies by active filter. The "no favourites at all"
                copy preserves the spirit of the original (search → tap heart). */}
            {visibleFavs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "70px 20px 30px", animation: "softFade 0.55s ease-out 0.4s both" }}>
                {totalCount === 0 ? (
                  <>
                    <Heart size={42} stroke="rgba(255, 215, 0, 0.32)" strokeWidth={1.2} style={{ marginBottom: 18 }} aria-hidden="true" />
                    <p style={{
                      fontFamily: "'Playfair Display', serif", fontStyle: "italic",
                      fontSize: 22, fontWeight: 600, color: "rgba(255, 215, 0, 0.85)",
                      marginBottom: 10, letterSpacing: -0.3,
                    }}>
                      No favourites yet.
                    </p>
                    <p style={{
                      fontFamily: "'Syne', sans-serif", fontSize: 14,
                      color: "rgba(255, 255, 255, 0.52)", lineHeight: 1.55, maxWidth: 320, margin: "0 auto",
                    }}>
                      Search for a film and tap the heart to keep it here.
                    </p>
                  </>
                ) : activeFolderId === "unsorted" ? (
                  <>
                    <Inbox size={36} stroke="rgba(255, 215, 0, 0.42)" strokeWidth={1.3} style={{ marginBottom: 16 }} aria-hidden="true" />
                    <p style={{
                      fontFamily: "'Playfair Display', serif", fontStyle: "italic",
                      fontSize: 20, fontWeight: 600, color: "rgba(255, 215, 0, 0.85)",
                      marginBottom: 8, letterSpacing: -0.3,
                    }}>
                      Everything is filed.
                    </p>
                    <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: "rgba(255, 255, 255, 0.5)" }}>
                      Nice. Every favourite lives in a folder.
                    </p>
                  </>
                ) : (
                  <>
                    <Folder size={36} stroke="rgba(255, 215, 0, 0.42)" strokeWidth={1.3} style={{ marginBottom: 16 }} aria-hidden="true" />
                    <p style={{
                      fontFamily: "'Playfair Display', serif", fontStyle: "italic",
                      fontSize: 20, fontWeight: 600, color: "rgba(255, 215, 0, 0.85)",
                      marginBottom: 8, letterSpacing: -0.3,
                    }}>
                      No films in this folder yet.
                    </p>
                    <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: "rgba(255, 255, 255, 0.55)", lineHeight: 1.5, maxWidth: 320, margin: "0 auto" }}>
                      Move a favourite here using the <FolderInput size={11} style={{ display: "inline", verticalAlign: "-1px", color: "rgba(255, 215, 0, 0.85)" }} aria-hidden="true" /> icon on any card.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 4px", marginBottom: 28 }}>
                {visibleFavs.map((fav, i) => {
                  const favKey = `${fav.title}-${fav.year}`;
                  const tagFolder = fav.folderId ? folderById(fav.folderId) : null;
                  const score = fav.score?.ten;
                  const showScore = typeof score === "number" && score > 0;
                  const directorMaxWidth = 240;
                  const isMoveOpen = moveMenuFavKey === favKey;
                  return (
                    <div
                      key={favKey}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${fav.title}${fav.year ? ` (${fav.year})` : ""}`}
                      onClick={() => loadFav(fav)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); loadFav(fav); } }}
                      onPointerMove={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
                      }}
                      className="fg-fav-card"
                      style={{
                        display: "flex", alignItems: "center", gap: 22,
                        padding: "20px 22px 20px 22px",
                        background: "rgba(10, 8, 4, 0.62)",
                        border: "1px solid rgba(255, 215, 0, 0.10)",
                        borderRadius: 14,
                        cursor: "pointer",
                        width: "100%",
                        textAlign: "left",
                        position: "relative",
                        // overflow:visible so the move-to-folder popover can
                        // float above adjacent cards without being clipped.
                        opacity: 0,
                        animation: `softFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.28 + i * 0.06}s both`,
                        transition: "transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.4s ease, box-shadow 0.4s ease, background 0.4s ease",
                      }}
                    >
                      {/* Poster — same dimensions and treatment as DYM */}
                      <div className="dym-poster-wrap" style={{
                        width: 130, height: 195,
                        borderRadius: 8,
                        background: "rgba(255, 255, 255, 0.03)",
                        flexShrink: 0,
                        overflow: "hidden",
                        position: "relative",
                        boxShadow: "0 10px 28px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05)",
                      }}>
                        {fav.poster ? (
                          <img
                            className="dym-poster"
                            src={fav.poster}
                            alt=""
                            loading="lazy"
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                          />
                        ) : (
                          <div className="dym-poster" style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Film size={28} style={{ color: "rgba(255, 255, 255, 0.18)" }} aria-hidden="true" />
                          </div>
                        )}
                      </div>

                      {/* Title block + chips + overview */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="fg-fav-title" style={{
                          fontFamily: "'Syne', sans-serif",
                          fontSize: 20, fontWeight: 700,
                          color: "#fff",
                          letterSpacing: -0.3,
                          lineHeight: 1.22,
                          marginBottom: 10,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {fav.title}
                        </div>
                        <div style={{
                          display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
                          marginBottom: (fav.overview || fav.director || fav.runtime) ? 12 : 0,
                        }}>
                          {fav.year ? (
                            <span style={{
                              display: "inline-block",
                              fontSize: 14, fontWeight: 700, letterSpacing: 1,
                              color: "rgba(255, 215, 0, 0.88)",
                              fontFamily: "'JetBrains Mono', monospace",
                              background: "rgba(255, 215, 0, 0.08)",
                              padding: "5px 13px", borderRadius: 6,
                              border: "1px solid rgba(255, 215, 0, 0.18)",
                            }}>{fav.year}</span>
                          ) : null}
                          {fav.runtime ? (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              fontSize: 14, fontWeight: 600, letterSpacing: 0.4,
                              color: "rgba(255, 255, 255, 0.78)",
                              fontFamily: "'JetBrains Mono', monospace",
                              background: "rgba(255, 255, 255, 0.05)",
                              padding: "5px 13px", borderRadius: 6,
                              border: "1px solid rgba(255, 255, 255, 0.10)",
                            }}>
                              {fav.runtime >= 60
                                ? `${fav.runtime} min · ${Math.floor(fav.runtime / 60)}h ${fav.runtime % 60}m`
                                : `${fav.runtime} min`}
                            </span>
                          ) : null}
                          {fav.director ? (
                            <span style={{
                              fontSize: 15, fontWeight: 500,
                              color: "rgba(255, 255, 255, 0.7)",
                              fontFamily: "'Syne', sans-serif",
                              letterSpacing: 0.15,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              maxWidth: directorMaxWidth,
                            }}>
                              <span style={{ color: "rgba(255, 215, 0, 0.62)", fontWeight: 600 }}>Directed by</span>&nbsp;{fav.director}
                            </span>
                          ) : null}
                        </div>
                        {fav.overview ? (
                          <p style={{
                            margin: 0,
                            fontFamily: "'Syne', sans-serif",
                            fontSize: 14.5,
                            fontWeight: 400,
                            color: "rgba(255, 255, 255, 0.72)",
                            lineHeight: 1.55,
                            letterSpacing: 0.1,
                            paddingRight: 12,
                          }}>
                            {trimOverview(fav.overview, 180)}
                          </p>
                        ) : (
                          fav.genre ? (
                            <p style={{
                              margin: 0,
                              fontFamily: "'Syne', sans-serif",
                              fontSize: 13,
                              fontWeight: 500,
                              color: "rgba(255, 255, 255, 0.42)",
                              letterSpacing: 0.2,
                            }}>
                              {fav.genre}
                            </p>
                          ) : null
                        )}
                        {tagFolder && (
                          <button
                            type="button"
                            className="fg-fav-folder-tag"
                            onClick={(e) => { e.stopPropagation(); setActiveFolderId(tagFolder.id); }}
                            title={`Filter to ${tagFolder.name}`}
                            style={{ marginTop: 12 }}
                            aria-label={`Filter favourites by folder ${tagFolder.name}`}
                          >
                            <FolderOpen size={11} aria-hidden="true" />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{tagFolder.name}</span>
                          </button>
                        )}
                      </div>

                      {/* Score column — replaces the DYM chevron */}
                      <div className="fg-fav-score-col" style={{
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "center",
                        paddingRight: 8,
                        minWidth: 92,
                      }}>
                        {showScore ? (
                          <>
                            <span className="fg-fav-score">{Number(score).toFixed(1)}</span>
                            <span className="fg-fav-score-suffix">/10</span>
                          </>
                        ) : (
                          <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11,
                            color: "rgba(255, 255, 255, 0.32)",
                            letterSpacing: 1.4,
                            textTransform: "uppercase",
                          }}>
                            no score
                          </span>
                        )}
                      </div>

                      {/* Action cluster — bottom-right of card */}
                      <div className="fg-fav-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="fg-fav-move"
                          onClick={(e) => { e.stopPropagation(); setMoveMenuFavKey(isMoveOpen ? null : favKey); }}
                          title="Move to folder"
                          aria-label="Move to folder"
                          aria-haspopup="menu"
                          aria-expanded={isMoveOpen}
                        >
                          <FolderInput size={14} />
                        </button>
                        <button
                          type="button"
                          className="fg-fav-trash"
                          onClick={(e) => removeFav(fav, e)}
                          title="Remove from favourites"
                          aria-label={`Remove ${fav.title} from favourites`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Move-to-folder popover */}
                      {isMoveOpen && (
                        <div className="fg-move-pop" role="menu" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className={`fg-move-pop-row${!fav.folderId ? " active" : " muted"}`}
                            onClick={() => moveFavToFolder(fav, null)}
                            role="menuitem"
                          >
                            <Inbox size={14} aria-hidden="true" />
                            <span>Unsorted</span>
                            {!fav.folderId && <Check size={14} className="check" aria-hidden="true" />}
                          </button>
                          {folders.length > 0 && <div className="fg-move-pop-divider" aria-hidden="true" />}
                          {folders.map((fld) => (
                            <button
                              key={fld.id}
                              type="button"
                              className={`fg-move-pop-row${fav.folderId === fld.id ? " active" : ""}`}
                              onClick={() => moveFavToFolder(fav, fld.id)}
                              role="menuitem"
                            >
                              {fav.folderId === fld.id ? <FolderOpen size={14} aria-hidden="true" /> : <Folder size={14} aria-hidden="true" />}
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fld.name}</span>
                              {fav.folderId === fld.id && <Check size={14} className="check" aria-hidden="true" />}
                            </button>
                          ))}
                          <div className="fg-move-pop-divider" aria-hidden="true" />
                          <button
                            type="button"
                            className="fg-move-pop-row"
                            onClick={() => { setMoveMenuFavKey(null); setNewFolderInput(""); setFolderError(null); }}
                            role="menuitem"
                          >
                            <FolderPlus size={14} aria-hidden="true" />
                            <span>New folder…</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="dym-rail dym-rail-bot" style={{ marginTop: 12 }} aria-hidden="true" />

            {/* Confirm-delete folder modal */}
            {deleteFolderTarget && (
              <div
                className="fg-fav-modal-back"
                onClick={() => setDeleteFolderTarget(null)}
                role="dialog"
                aria-modal="true"
                aria-labelledby="fg-fav-del-title"
              >
                <div className="fg-fav-modal" onClick={(e) => e.stopPropagation()}>
                  <h3
                    id="fg-fav-del-title"
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontStyle: "italic",
                      fontSize: 24,
                      fontWeight: 600,
                      color: "#FFD700",
                      letterSpacing: -0.4,
                      marginBottom: 10,
                    }}
                  >
                    Delete &ldquo;{deleteFolderTarget.name}&rdquo;?
                  </h3>
                  <p style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: 14,
                    color: "rgba(255, 255, 255, 0.72)",
                    lineHeight: 1.55,
                    marginBottom: 22,
                  }}>
                    The {inFolderCount(deleteFolderTarget.id)} {inFolderCount(deleteFolderTarget.id) === 1 ? "film" : "films"} inside will move to <span style={{ color: "rgba(255, 215, 0, 0.85)" }}>Unsorted</span>. The folder itself can&rsquo;t be undone.
                  </p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => setDeleteFolderTarget(null)}
                      style={{
                        padding: "10px 20px",
                        background: "transparent",
                        border: "1px solid rgba(255, 255, 255, 0.14)",
                        borderRadius: 10,
                        color: "rgba(255, 255, 255, 0.72)",
                        fontFamily: "'Syne', sans-serif",
                        fontSize: 13.5,
                        fontWeight: 600,
                        letterSpacing: 0.2,
                        cursor: "pointer",
                        transition: "border-color 0.25s, color 0.25s, background 0.25s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.32)"; e.currentTarget.style.color = "#fff"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; e.currentTarget.style.color = "rgba(255,255,255,0.72)"; }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFolder(deleteFolderTarget)}
                      style={{
                        padding: "10px 20px",
                        background: "linear-gradient(135deg, rgba(255, 80, 80, 0.18), rgba(220, 40, 40, 0.10))",
                        border: "1px solid rgba(255, 80, 80, 0.45)",
                        borderRadius: 10,
                        color: "#ff8b8b",
                        fontFamily: "'Syne', sans-serif",
                        fontSize: 13.5,
                        fontWeight: 700,
                        letterSpacing: 0.2,
                        cursor: "pointer",
                        transition: "background 0.25s, border-color 0.25s, color 0.25s, transform 0.25s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(255, 80, 80, 0.28), rgba(220, 40, 40, 0.14))"; e.currentTarget.style.color = "#ffb6b6"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(255, 80, 80, 0.18), rgba(220, 40, 40, 0.10))"; e.currentTarget.style.color = "#ff8b8b"; e.currentTarget.style.transform = "translateY(0)"; }}
                    >
                      Delete folder
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        );
      })() : (
        <main style={{ maxWidth: (result || loading || ambiguousMatches) ? 720 : 1200, margin: "0 auto", padding: "0 16px", position: "relative", zIndex: 10, transition: "max-width 0.3s ease" }}>
          {/* Search area */}
          <div style={{ textAlign: "center", paddingTop: (result || loading || ambiguousMatches) ? 12 : 90, transition: "padding-top 0.5s cubic-bezier(0.16,1,0.3,1)", marginBottom: (result || loading || ambiguousMatches) ? 10 : 32, ...((result || loading || ambiguousMatches) ? { position: "sticky", top: 61, zIndex: 40, background: "rgba(5,5,5,0.7)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", paddingBottom: 12, marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16, ...(result && !loading ? { borderBottom: "1px solid rgba(255,215,0,0.04)" } : {}) } : {}) }}>
            {!result && !loading && !ambiguousMatches && (
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(52px, 8.6vw, 104px)", fontWeight: 700, lineHeight: 1.02, letterSpacing: -1.8, marginBottom: 44 }}>
                <LetterLine text="Every Film." offset={0.15} />
                <span
                  className="hero-accent"
                  style={{ fontStyle: "italic", display: "block", lineHeight: 1.18, paddingBottom: "0.08em" }}
                >
                  One True Rating Score.
                </span>
              </h1>
            )}
            <div style={{ position: "relative", maxWidth: 640, margin: "0 auto" }}>
              <div className="glow-wrap" style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="glow-layer glow-1" />
                <div className="glow-layer glow-2" />
                <div className="glow-layer glow-3" />
                <div className="glow-layer glow-4" />
                <div className="glow-layer glow-5" />
                <div className="glow-mask" />
                <div style={{ position: "relative", width: "100%", zIndex: 2 }}>
                  <Search size={18} style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", color: "#3a3a3a", pointerEvents: "none", zIndex: 3 }} />
                  <input ref={inputRef} type="text" value={query}
                    onChange={e => { setQuery(e.target.value); setShowSug(true); }}
                    onFocus={() => setShowSug(true)}
                    onBlur={() => setTimeout(() => setShowSug(false), 180)}
                    onKeyDown={e => { if (e.key === "Enter") doSearch(); }}
                    placeholder="Search any movie..."
                    style={{ width: "100%", padding: "18px 120px 18px 48px", background: "#050505", border: "none", borderRadius: 14, color: "#fff", fontSize: 16, fontFamily: "'Syne',sans-serif", outline: "none" }}
                  />
                  <button onClick={() => doSearch()} disabled={loading}
                    style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", padding: "10px 24px", borderRadius: 11, border: "none", background: loading ? "#222" : "linear-gradient(135deg,#FFD700,#E8A000)", color: loading ? "#777" : "#050505", fontSize: 13.5, fontWeight: 700, cursor: loading ? "default" : "pointer", display: "flex", alignItems: "center", gap: 5, zIndex: 3 }}>
                    {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : "Glance"}
                  </button>
                </div>
              </div>
              {showSug && !loading && !result && filt.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 5, background: "#090909", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12, overflow: "hidden", zIndex: 20, animation: "slideUp 0.2s", boxShadow: "0 12px 36px rgba(0,0,0,0.5)", maxHeight: 280, overflowY: "auto" }}>
                  {filt.map(s => (
                    <button key={s}
                      onMouseDown={e => { e.preventDefault(); setQuery(s); setShowSug(false); setTimeout(() => doSearch(s), 40); }}
                      style={{ width: "100%", padding: "10px 16px", background: "none", border: "none", color: "#999", fontSize: 12.5, cursor: "pointer", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.02)", display: "flex", alignItems: "center", gap: 8 }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,215,0,0.03)"; e.currentTarget.style.color = "#FFD700"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#999"; }}
                    >
                      <Film size={12} style={{ opacity: 0.3 }} /> {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Loading video now rendered as a global overlay at the bottom of
              the component tree — so it appears regardless of whether the
              user is in favs view, signed in/out, or any other state. */}

          {/* v5.12.3 — Same-title ambiguity picker. Surfaces when 2+ released
              films share the EXACT same canonical title (Carrie 1976/2002/2013,
              Pet Sematary 1989/2019, The Mummy 1932/1999/2017, Halloween
              1978/2018, etc.). Reuses the dym-card visual treatment for site
              consistency. Click → re-search with "title YEAR" so the year-hint
              path in lib/tmdb.ts searchMovie picks the disambiguated film. */}
          {ambiguousMatches && (
            <div style={{ padding: "32px 0 36px", animation: "fadeIn 0.5s ease-out" }}>
              <div className="dym-rail dym-rail-top" aria-hidden="true" />

              <div style={{ textAlign: "center", padding: "36px 18px 24px" }}>
                <p
                  style={{
                    margin: 0,
                    padding: "0 16px",
                    color: "rgba(255, 255, 255, 0.78)",
                    fontSize: 11.5,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 700,
                    letterSpacing: 1.6,
                    textTransform: "uppercase",
                    wordBreak: "break-word",
                    animation: "softFade 0.5s ease-out 0.1s both",
                  }}
                >
                  <span style={{ color: "rgba(255, 215, 0, 0.85)" }}>searched&nbsp;&middot;&nbsp;</span>
                  <span style={{ color: "#fff", textTransform: "none", letterSpacing: 0.2, fontSize: 12.5, fontWeight: 700 }}>&ldquo;{ambiguousMatches.query}&rdquo;</span>
                </p>

                <h2
                  className="dym-headline"
                  style={{
                    marginTop: 14,
                    fontFamily: "'Playfair Display', serif",
                    fontStyle: "italic",
                    fontSize: "clamp(30px, 6vw, 44px)",
                    fontWeight: 600,
                    letterSpacing: -0.8,
                    lineHeight: 1.05,
                    margin: "14px 0 0",
                    animation: "softFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.18s both",
                  }}
                >
                  There are a few with that name…
                </h2>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 4px", marginBottom: 28 }}>
                {ambiguousMatches.candidates.map((c, i) => {
                  const ariaLabel = `${c.title} (${c.year || "year unknown"})${c.director ? `, directed by ${c.director}` : ""}`;
                  return (
                    <button
                      key={`${c.tmdb_id}-${i}`}
                      onClick={() => {
                        const disambiguated = c.year ? `${c.title} ${c.year}` : c.title;
                        setAmbiguousMatches(null);
                        setQuery(disambiguated);
                        doSearch(disambiguated);
                      }}
                      onPointerMove={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
                      }}
                      aria-label={ariaLabel}
                      className="dym-card"
                      style={{
                        display: "flex", alignItems: "center", gap: 22,
                        padding: "20px 22px 20px 22px",
                        background: "rgba(10, 8, 4, 0.62)",
                        border: "1px solid rgba(255, 215, 0, 0.10)",
                        borderRadius: 14,
                        cursor: "pointer",
                        width: "100%",
                        textAlign: "left",
                        position: "relative",
                        overflow: "hidden",
                        opacity: 0,
                        animation: `softFade 0.55s cubic-bezier(0.16, 1, 0.3, 1) ${0.42 + i * 0.08}s both`,
                        transition: "transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.4s ease, box-shadow 0.4s ease, background 0.4s ease, filter 0.2s ease",
                      }}
                    >
                      <div className="dym-poster-wrap" style={{
                        width: 130, height: 195,
                        borderRadius: 8,
                        background: "rgba(255, 255, 255, 0.03)",
                        flexShrink: 0,
                        overflow: "hidden",
                        position: "relative",
                        boxShadow: "0 10px 28px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05)",
                      }}>
                        {c.poster_path ? (
                          <img
                            className="dym-poster"
                            src={IMG + "w342" + c.poster_path}
                            alt=""
                            loading="lazy"
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        ) : (
                          <div className="dym-poster" style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Film size={28} style={{ color: "rgba(255, 255, 255, 0.18)" }} aria-hidden="true" />
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="dym-title" style={{
                          fontFamily: "'Syne', sans-serif",
                          fontSize: 20, fontWeight: 700,
                          color: "#fff",
                          letterSpacing: -0.3,
                          lineHeight: 1.22,
                          marginBottom: 10,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {c.title}
                        </div>
                        <div style={{
                          display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
                          marginBottom: (c.overview || c.director) ? 12 : 0,
                        }}>
                          {c.year && (
                            <span style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 11,
                              fontWeight: 600,
                              letterSpacing: 1.2,
                              color: "#FFD700",
                              padding: "4px 10px",
                              borderRadius: 999,
                              background: "rgba(255, 215, 0, 0.06)",
                              border: "1px solid rgba(255, 215, 0, 0.18)",
                            }}>{c.year}</span>
                          )}
                          {c.runtime && (
                            <span style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 11,
                              fontWeight: 600,
                              letterSpacing: 1.2,
                              color: "rgba(255, 255, 255, 0.66)",
                              padding: "4px 10px",
                              borderRadius: 999,
                              background: "rgba(255, 255, 255, 0.04)",
                              border: "1px solid rgba(255, 255, 255, 0.08)",
                            }}>{c.runtime}</span>
                          )}
                          {c.director && (
                            <span style={{
                              fontFamily: "'Syne', sans-serif",
                              fontSize: 12.5,
                              color: "rgba(255, 255, 255, 0.62)",
                              fontStyle: "italic",
                            }}>Directed by {c.director}</span>
                          )}
                        </div>
                        {c.overview && (
                          <div style={{
                            fontFamily: "'Syne', sans-serif",
                            fontSize: 13.5,
                            color: "rgba(255, 255, 255, 0.62)",
                            lineHeight: 1.45,
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}>
                            {c.overview}
                          </div>
                        )}
                      </div>

                      <ChevronRight
                        size={20}
                        className="dym-chevron"
                        style={{
                          color: "rgba(255, 215, 0, 0.32)",
                          flexShrink: 0,
                          transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1), color 0.3s ease",
                        }}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>

              <div className="dym-rail dym-rail-bottom" aria-hidden="true" />
            </div>
          )}

          {/* Result */}
          {/* Coming Soon — Unreleased Movie (v5.7) */}
          {result && !result.notFound && result.coming_soon && (
            <div style={{ background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 17, overflow: "hidden", animation: "slideUp 0.5s cubic-bezier(0.16,1,0.3,1)" }}>
              <div style={{ padding: "24px 26px 22px" }}>
                <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
                  <div style={{ width: 130, height: 195, borderRadius: 12, overflow: "hidden", flexShrink: 0, boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)", animation: "fadeIn 0.5s both", position: "relative" }}>
                    <PosterCard title={result.title} year={result.year} genre={result.genre} posterUrl={result.poster} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)", padding: "20px 8px 8px", display: "flex", justifyContent: "center" }}>
                      <span style={{ fontSize: 7.5, letterSpacing: 2, fontWeight: 700, textTransform: "uppercase", color: "#FFD700", fontFamily: "'JetBrains Mono',monospace", background: "rgba(0,0,0,0.5)", padding: "3px 8px", borderRadius: 4 }}>Unreleased</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                    <div style={{ marginBottom: 8, animation: "fadeIn 0.5s 0.1s both" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: "linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,165,0,0.06))", border: "1px solid rgba(255,215,0,0.25)" }}>
                        <Zap size={11} color="#FFD700" />
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase", color: "#FFD700", fontFamily: "'JetBrains Mono',monospace" }}>Coming Soon</span>
                      </span>
                    </div>
                    {result.tagline && (
                      <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 11, fontStyle: "italic", color: "rgba(255,255,255,0.45)", marginBottom: 7, animation: "fadeIn 0.6s 0.15s both", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        "{result.tagline}"
                      </p>
                    )}
                    <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(20px,3.2vw,28px)", fontWeight: 700, lineHeight: 1.12, marginBottom: 3, animation: "fadeIn 0.5s 0.2s both" }}>{result.title}</h2>
                    <p style={{ color: "#aaa", fontSize: 12, marginBottom: 2, animation: "fadeIn 0.5s 0.25s both" }}>
                      {result.year}{result.director ? ` · ${result.director}` : ""}{result.runtime ? ` · ${result.runtime}` : ""}
                    </p>
                    {result.genre && <p style={{ color: "#666", fontSize: 11, marginBottom: 8, letterSpacing: 0.7, animation: "fadeIn 0.5s 0.3s both" }}>{result.genre}</p>}
                    {result.description && <p style={{ color: "rgba(255,255,255,0.92)", fontSize: 12.5, lineHeight: 1.55, marginBottom: 14, animation: "fadeIn 0.5s 0.35s both" }}>{result.description}</p>}

                    {/* Ratings Not Available */}
                    <div style={{ animation: "fadeIn 0.5s 0.4s both" }}>
                      <p style={{ fontSize: 10, letterSpacing: 1.8, color: "rgba(255,215,0,0.5)", textTransform: "uppercase", fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", marginBottom: 10 }}>Ratings Not Yet Available</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ display: "flex", gap: 3 }}>
                          {[0,1,2,3,4].map(i => (
                            <div key={i} style={{ width: 22, height: 22, borderRadius: 3, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }} />
                          ))}
                        </div>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>—/10</span>
                      </div>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 10, lineHeight: 1.5, fontStyle: "italic" }}>
                        Scores from every major review site will appear here after this film is released.
                      </p>
                    </div>

                    {/* Release Date */}
                    {result.release_date && (
                      <div style={{ background: "rgba(255,215,0,0.04)", border: "1px solid rgba(255,215,0,0.12)", borderRadius: 12, padding: "14px 18px", marginTop: 14, animation: "fadeIn 0.5s 0.45s both" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <Zap size={13} color="#FFD700" />
                          <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#FFD700", fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>Release Date</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: "#fff" }}>
                            {new Date(result.release_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                          </span>
                          {(() => {
                            const days = Math.ceil((new Date(result.release_date + "T00:00:00") - new Date()) / (1000 * 60 * 60 * 24));
                            return days > 0 ? <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono',monospace" }}>({days} days away)</span> : null;
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Trailer button if available */}
                    {result.trailer_key && (
                      <div style={{ marginTop: 14, animation: "fadeIn 0.5s 0.5s both" }}>
                        <button
                          onClick={() => setVideoModal({ id: result.trailer_key, title: `${result.title} — Official Trailer` })}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "8px 16px", borderRadius: 8,
                            background: "linear-gradient(135deg,rgba(255,215,0,0.1),rgba(255,165,0,0.05))",
                            border: "1px solid rgba(255,215,0,0.2)",
                            color: "#FFD700", fontSize: 11, fontWeight: 700, cursor: "pointer",
                            transition: "all 0.25s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,215,0,0.08)"; e.currentTarget.style.borderColor = "rgba(255,215,0,0.6)"; e.currentTarget.style.boxShadow = "0 0 20px rgba(255,215,0,0.25), 0 0 40px rgba(255,215,0,0.1)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg,rgba(255,215,0,0.1),rgba(255,165,0,0.05))"; e.currentTarget.style.borderColor = "rgba(255,215,0,0.2)"; e.currentTarget.style.boxShadow = "none"; }}
                        >
                          <Play size={11} fill="#FFD700" stroke="#FFD700" />
                          Watch Trailer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Cast section for unreleased movies */}
              {result.cast && result.cast.length > 0 && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.035)", padding: "16px 26px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <Users size={13} color="#FFD700" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: 0.5 }}>Cast</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {result.cast.slice(0, 8).map((c, i) => {
                      const img = c.img || (c.profile_path ? IMG + "w185" + c.profile_path : "");
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, animation: `fadeIn 0.4s ${i * 0.05}s both` }}>
                          {img ? (
                            <img src={img} alt={c.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,0.06)" }} />
                          ) : (
                            <div style={{ width: 36, height: 36, borderRadius: "50%", background: `hsl(${hash(c.name || "A") % 360}, 30%, 18%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              {(c.name || "?")[0]}
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#fff" }}>{c.name}</div>
                            <div style={{ fontSize: 10, color: "#555" }}>{c.character}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Streaming / Where to Watch if available */}
              {result.streaming && result.streaming.length > 0 && (
                <Accordion id="fg-watch" icon={<Tv size={14} />} label="Where to Watch" open={watchOpen} toggle={() => setWatchOpen(!watchOpen)}>
                  <div className="fg-watch-wrap" style={{ padding: "14px 26px 26px", display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {result.streaming.map((s, i) => <StreamingBadge key={`${s.platform}-${i}`} platform={s.platform} url={s.url} type={s.type} logo_path={s.logo_path} title={result.title} idx={i} visible={watchOpen} />)}
                  </div>
                </Accordion>
              )}

              {/* Recommendations if available */}
              {result.recommendations && result.recommendations.length > 0 && (
                <Accordion icon={<Film size={13} />} label="You Might Also Like" open={true} toggle={() => {}}>
                  <div style={{ padding: "8px 18px 22px", display: "flex", gap: 10 }}>
                    {result.recommendations.map((rec, i) => (
                      <button key={`${rec.title}-${i}`}
                        onClick={() => { setQuery(rec.title); doSearch(rec.title.toLowerCase()); }}
                        style={{ flex: 1, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, overflow: "hidden", cursor: "pointer", padding: 0, textAlign: "left", transition: "all 0.3s", animation: `fadeIn 0.5s ${0.1 + i * 0.1}s both` }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,215,0,0.15)"; e.currentTarget.style.background = "rgba(255,215,0,0.03)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)"; e.currentTarget.style.background = "rgba(255,255,255,0.015)"; }}
                      >
                        <div style={{ position: "relative", aspectRatio: "16/9", background: "#111" }}>
                          {rec.poster_path ? (
                            <img src={`https://image.tmdb.org/t/p/w300${rec.poster_path}`} alt={rec.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Film size={18} style={{ color: "#222" }} /></div>
                          )}
                        </div>
                        <div style={{ padding: "6px 8px 8px" }}>
                          <p style={{ fontSize: 10, fontWeight: 600, color: "#aaa", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.title}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </Accordion>
              )}
            </div>
          )}

          {/* Normal result — Released Movie */}
          {result && !result.notFound && !result.coming_soon && (
            <ResultSidebar result={result} sections={[
              { id: "fg-overview", label: "Movie Overview", icon: Film, show: true },
              { id: "fg-score", label: "True Rating Score", icon: Gauge, show: result.score && typeof result.score.ten !== "undefined" },
              { id: "fg-sources", label: "Source Breakdown", icon: BarChart3, show: result.sources && result.sources.length > 0 },
              { id: "fg-hottake", label: "Thumbs Up & Down", icon: ThumbsUp, show: result.hot_take && (result.hot_take.good?.length > 0 || result.hot_take.bad?.length > 0) },
              { id: "fg-videos", label: "Video Reviews", icon: Video, show: result.video_reviews && result.video_reviews.length > 0 },
              { id: "fg-cast", label: "Cast", icon: Users, show: result.cast && result.cast.length > 0 },
              { id: "fg-awards", label: "Awards", icon: Trophy, show: result.awards && result.awards.length > 0 },
              { id: "fg-boxoffice", label: "Production & Run", icon: DollarSign, show: !!result.boxOffice },
              { id: "fg-watch", label: "Where to Watch", icon: Tv, show: result.streaming && result.streaming.length > 0 },
              { id: "fg-recs", label: "You Might Also Like", icon: Sparkles, show: result.recommendations && result.recommendations.length > 0 },
            ].filter(s => s.show)} />
          )}
          {result && !result.notFound && !result.coming_soon && (
            <div id="fg-overview" className="fg-result-card" style={{
              background: "linear-gradient(180deg, rgba(14,11,4,0.72) 0%, rgba(8,6,2,0.78) 100%)",
              border: "1px solid rgba(255,215,0,0.10)",
              borderRadius: 18, overflow: "hidden",
              animation: "slideUp 0.5s cubic-bezier(0.16,1,0.3,1)",
              backdropFilter: "blur(24px) saturate(1.1)", WebkitBackdropFilter: "blur(24px) saturate(1.1)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.55), 0 0 90px rgba(255,215,0,0.04), inset 0 1px 0 rgba(255,215,0,0.08)",
              position: "relative",
            }}>
              {/* Top sheen — subtle gold gradient on header for cinematic feel */}
              <div aria-hidden="true" style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 220,
                background: "radial-gradient(ellipse 80% 80% at 50% 0%, rgba(255,215,0,0.06), transparent 60%)",
                pointerEvents: "none", zIndex: 0,
              }} />

              <div className="fg-result-card-inner" style={{ padding: "32px 30px 28px", position: "relative", zIndex: 1 }}>
                <div className="fg-hero-grid" style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
                  <div className="fg-hero-poster" style={{
                    width: 210, height: 315,
                    borderRadius: 14, overflow: "hidden", flexShrink: 0,
                    boxShadow: "0 18px 56px rgba(0,0,0,0.65), 0 0 60px rgba(255,215,0,0.08), 0 0 0 1px rgba(255,215,0,0.10), inset 0 0 0 1px rgba(255,255,255,0.04)",
                    animation: "fadeIn 0.5s both",
                    position: "relative",
                    cursor: "default",
                    transition: "all 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}>
                    <PosterCard title={result.title} year={result.year} genre={result.genre} posterUrl={result.poster} />
                  </div>

                  <div className="fg-hero-text-col" style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                    {result.tagline && (
                      <p className="fg-hero-tagline" style={{
                        fontFamily: "'Playfair Display',serif",
                        fontSize: 14,
                        color: "rgba(255,215,0,0.65)",
                        letterSpacing: 0.2,
                        marginBottom: 11,
                        animation: "fadeIn 0.6s 0.1s both",
                        overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                      }}>
                        &ldquo;{result.tagline}&rdquo;
                      </p>
                    )}

                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 11, animation: "fadeIn 0.5s 0.15s both" }}>
                      <h2 className="fg-hero-title" style={{
                        fontFamily: "'Playfair Display',serif",
                        fontSize: "clamp(26px, 4vw, 40px)",
                        fontWeight: 700, lineHeight: 1.06,
                        letterSpacing: -1,
                        flex: 1,
                        minWidth: 0,
                        background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.78) 100%)",
                        WebkitBackgroundClip: "text", backgroundClip: "text",
                        WebkitTextFillColor: "transparent", color: "transparent",
                      }}>{result.title}</h2>
                      {user && (
                        <button onClick={() => toggleFav(result)} aria-label={isFav(result) ? "Remove from favourites" : "Add to favourites"} style={{
                          background: isFav(result) ? "linear-gradient(135deg, rgba(255,215,0,0.16), rgba(255,165,0,0.06))" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${isFav(result) ? "rgba(255,215,0,0.42)" : "rgba(255,255,255,0.08)"}`,
                          borderRadius: 10, cursor: "pointer", padding: 9, flexShrink: 0,
                          transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.06)"; e.currentTarget.style.borderColor = "rgba(255,215,0,0.6)"; e.currentTarget.style.boxShadow = "0 0 24px rgba(255,215,0,0.18)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.borderColor = isFav(result) ? "rgba(255,215,0,0.42)" : "rgba(255,255,255,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
                        >
                          <Heart size={17} fill={isFav(result) ? "#FFD700" : "none"} stroke="#FFD700" strokeWidth={isFav(result) ? 0 : 1.8} />
                        </button>
                      )}
                    </div>

                    {/* Meta chips — dark-at-rest, gold-on-hover (How It Works pattern from landing) */}
                    <div className="fg-hero-meta" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 14, animation: "fadeIn 0.5s 0.2s both" }}>
                      {result.year && (
                        <span className="fg-meta-chip" style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: 14, fontWeight: 700, letterSpacing: 1,
                          color: "rgba(255,255,255,0.88)",
                          background: "rgba(0,0,0,0.45)",
                          padding: "7px 13px", borderRadius: 7,
                          border: "1px solid rgba(255,255,255,0.08)",
                          transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
                        }}>
                          <Calendar size={12} style={{ opacity: 0.7 }} />
                          {result.year}
                        </span>
                      )}
                      {result.runtime && (
                        <span className="fg-meta-chip" style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: 14, fontWeight: 700, letterSpacing: 0.5,
                          color: "rgba(255,255,255,0.88)",
                          background: "rgba(0,0,0,0.45)",
                          padding: "7px 13px", borderRadius: 7,
                          border: "1px solid rgba(255,255,255,0.08)",
                          transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
                        }}>
                          <Clock size={12} style={{ opacity: 0.7 }} />
                          {formatRuntimeBoth(result.runtime)}
                        </span>
                      )}
                      {result.director && (
                        <span className="fg-hero-director" style={{
                          fontFamily: "'Syne',sans-serif",
                          fontSize: 15, fontWeight: 500,
                          color: "rgba(255,255,255,0.78)",
                          letterSpacing: 0.15,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          maxWidth: 360,
                        }}>
                          <span style={{ color: "rgba(255,215,0,0.7)", fontWeight: 600 }}>Directed by</span>&nbsp;{result.director}
                        </span>
                      )}
                      {result.trailer_key && (
                        <button
                          onClick={() => setVideoModal({ id: result.trailer_key, title: `${result.title} — Official Trailer` })}
                          className="fg-trailer-cta"
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 8,
                            padding: "8px 16px", borderRadius: 8,
                            background: "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)",
                            border: "1px solid rgba(255,215,0,0.85)",
                            color: "#0a0a0a",
                            fontFamily: "'Syne',sans-serif",
                            fontSize: 12, fontWeight: 700,
                            letterSpacing: 0.5, textTransform: "uppercase",
                            cursor: "pointer",
                            boxShadow: "0 0 14px rgba(255,215,0,0.42), 0 0 28px rgba(255,215,0,0.16), inset 0 1px 0 rgba(255,255,255,0.3)",
                            animation: "trailerPulse 2.6s ease-in-out infinite",
                            transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s ease",
                          }}
                        >
                          <Play size={11} fill="#0a0a0a" stroke="#0a0a0a" />
                          Watch Trailer
                        </button>
                      )}
                    </div>

                    {result.genre && (
                      <p style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 11.5, fontWeight: 600,
                        letterSpacing: 1.6, textTransform: "uppercase",
                        marginBottom: 16,
                        animation: "fadeIn 0.5s 0.25s both",
                      }}>{result.genre}</p>
                    )}

                    {result.description && (
                      <p style={{
                        fontFamily: "'Syne',sans-serif",
                        color: "rgba(255,255,255,0.9)",
                        fontSize: 16, lineHeight: 1.6,
                        marginBottom: 24,
                        animation: "fadeIn 0.5s 0.3s both",
                        letterSpacing: 0.1,
                      }}>{result.description}</p>
                    )}

                  </div>
                </div>

                {/* Score block — section-header style (icon + italic Playfair title)
                    matching the rest of the page's accordion sections, then the
                    visual gauge + stars below. Trailer button has moved into the
                    hero meta row above. */}
                {(() => {
                  return (
                    <div id="fg-score" style={{
                      marginTop: 26,
                      padding: "22px 24px 24px",
                      borderRadius: 14,
                      scrollMarginTop: 110,
                      background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 100%)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderTop: "1px solid rgba(255,215,0,0.14)",
                      boxShadow: "inset 0 1px 0 rgba(255,215,0,0.04), 0 12px 32px rgba(0,0,0,0.4)",
                      animation: "fadeIn 0.5s 0.32s both",
                      position: "relative",
                    }}>
                      {/* Section-header — same style as Accordion labels */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 32, height: 32, borderRadius: 9,
                          background: "linear-gradient(135deg, rgba(255,215,0,0.18), rgba(255,165,0,0.04))",
                          border: "1px solid rgba(255,215,0,0.32)",
                          color: "#FFD700",
                          flexShrink: 0,
                          boxShadow: "0 0 18px rgba(255,215,0,0.12), inset 0 1px 0 rgba(255,215,0,0.18)",
                        }}>
                          <Gauge size={16} />
                        </span>
                        <h3 style={{
                          margin: 0,
                          fontFamily: "'Playfair Display',serif",
                          fontStyle: "italic",
                          fontSize: 22, fontWeight: 600,
                          color: "#FFD700",
                          letterSpacing: -0.3,
                          lineHeight: 1.1,
                        }}>True Movie Rating Score</h3>
                      </div>

                      {/* Body — huge glowing score number on the left, tagline + stars on the right */}
                      <div className="fg-score-row" style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
                        {/* Massive gold score number — replaces the gauge.
                            line-height bumped 0.9 → 1.05 + paddingBottom on
                            the score span so descenders ("3", "5", etc.)
                            sit fully inside the line box and aren't clipped
                            by the parent's overflow. */}
                        <div className="fg-score-num-wrap" style={{
                          flexShrink: 0,
                          display: "inline-flex",
                          alignItems: "baseline",
                          minWidth: 180,
                          padding: "12px 16px 18px",
                          justifyContent: "center",
                          animation: "fadeIn 0.6s 0.4s both",
                        }}>
                          <span style={{
                            fontFamily: "'Playfair Display',serif",
                            fontSize: 124, fontWeight: 700,
                            background: "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)",
                            WebkitBackgroundClip: "text", backgroundClip: "text",
                            WebkitTextFillColor: "transparent", color: "transparent",
                            lineHeight: 1.05, letterSpacing: -3.5,
                            paddingBottom: "0.12em",
                            filter: "drop-shadow(0 0 28px rgba(255,215,0,0.65)) drop-shadow(0 0 80px rgba(255,215,0,0.32))",
                          }}>{result.score.ten}</span>
                          <span style={{
                            fontFamily: "'Playfair Display',serif",
                            fontSize: 38, fontWeight: 600,
                            color: "rgba(255,255,255,0.42)",
                            marginLeft: 6,
                            letterSpacing: -0.5,
                          }}>/ 10</span>
                        </div>
                        <div className="fg-score-desc-wrap" style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 14 }}>
                          <p style={{
                            fontFamily: "'Syne',sans-serif",
                            fontStyle: "normal",
                            fontSize: 19, fontWeight: 500,
                            color: "rgba(255,255,255,0.88)",
                            lineHeight: 1.45, margin: 0,
                            letterSpacing: 0.05,
                          }}>Rating score comes from the average of all major movie review sites.</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                            <StarDisplay rating={result.score.stars} sz={22} />
                            <span style={{
                              color: "rgba(255,255,255,0.72)",
                              fontSize: 15, fontWeight: 700,
                              fontFamily: "'JetBrains Mono',monospace", letterSpacing: 0.4,
                            }}>{result.score.stars}/5</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>


              {result.sources && Array.isArray(result.sources) && result.sources.length > 0 && (
              <Accordion id="fg-sources" icon={<BarChart3 size={14} />} label="Source Breakdown" open={srcOpen} toggle={() => setSrcOpen(!srcOpen)}>
                <div className="fg-accord-content" style={{ padding: "8px 22px 22px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {[...result.sources].sort((a, b) => {
                    const as = typeof a.score === 'string' ? parseFloat(a.score) : a.score;
                    const am = typeof a.max === 'string' ? parseFloat(a.max) : a.max;
                    const bs = typeof b.score === 'string' ? parseFloat(b.score) : b.score;
                    const bm = typeof b.max === 'string' ? parseFloat(b.max) : b.max;
                    const na = am === 100 ? as : am === 10 ? as * 10 : am === 5 ? as * 20 : am > 0 ? (as / am) * 100 : 0;
                    const nb = bm === 100 ? bs : bm === 10 ? bs * 10 : bm === 5 ? bs * 20 : bm > 0 ? (bs / bm) * 100 : 0;
                    return nb - na;
                  }).map((s, i) => <SourceRow key={`${s.name}-${s.type}-${i}`} source={s} idx={i} visible={srcOpen} />)}
                  {/* Disclaimer */}
                  {result.disclaimer && (
                    <p style={{
                      fontSize: 10, color: "#555", fontStyle: "italic", marginTop: 10,
                      lineHeight: 1.45, textAlign: "center", padding: "0 4px",
                    }}>
                      {result.disclaimer}
                    </p>
                  )}
                </div>
              </Accordion>
              )}

              {/* Movie Hot Take */}
              {result.hot_take && (result.hot_take.good?.length > 0 || result.hot_take.bad?.length > 0) && (
                <Accordion id="fg-hottake" icon={<ThumbsUp size={14} />} label="Thumbs Up & Thumbs Down" open={hotTakeOpen} toggle={() => setHotTakeOpen(!hotTakeOpen)}>
                  <div className="fg-thumbs-wrap" style={{ padding: "12px 26px 28px" }}>
                    {result.hot_take.good?.length > 0 && (
                      <div style={{ marginBottom: result.hot_take.bad?.length > 0 ? 28 : 0 }}>
                        <div style={{ marginBottom: 18 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div className="fg-thumbs-icon" style={{
                              width: 40, height: 40, borderRadius: 11,
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                              background: "linear-gradient(135deg, rgba(34,197,94,0.22), rgba(22,163,74,0.08))",
                              border: "1px solid rgba(34,197,94,0.4)",
                              boxShadow: "0 0 24px rgba(34,197,94,0.18), inset 0 1px 0 rgba(34,197,94,0.22)",
                            }}>
                              <ThumbsUp size={19} stroke="#22c55e" strokeWidth={2.2} />
                            </div>
                            <span className="fg-thumbs-title" style={{
                              fontFamily: "'Playfair Display',serif",
                              fontStyle: "italic",
                              fontSize: 26, fontWeight: 600, letterSpacing: -0.4,
                              color: "#22c55e", lineHeight: 1,
                            }}>The Good</span>
                          </div>
                          <span className="fg-thumbs-caption" style={{
                            display: "block",
                            fontFamily: "'JetBrains Mono',monospace",
                            fontSize: 11, fontWeight: 600,
                            color: "rgba(34,197,94,0.62)",
                            letterSpacing: 1.4, textTransform: "uppercase",
                            marginTop: 9,
                            marginLeft: 54,
                          }}>What works</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {result.hot_take.good.map((point, i) => (
                            <HotTakeRow
                              key={`good-${i}`} text={point} idx={i} positive={true}
                              visible={hotTakeOpen}
                              delay={i * 0.06}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {result.hot_take.good?.length > 0 && result.hot_take.bad?.length > 0 && (
                      <div style={{ height: 1, background: "linear-gradient(to right, transparent, rgba(255,215,0,0.22), transparent)", margin: "22px 4px" }} />
                    )}
                    {result.hot_take.bad?.length > 0 && (
                      <div>
                        <div style={{ marginBottom: 18 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div className="fg-thumbs-icon" style={{
                              width: 40, height: 40, borderRadius: 11,
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                              background: "linear-gradient(135deg, rgba(239,68,68,0.22), rgba(220,38,38,0.08))",
                              border: "1px solid rgba(239,68,68,0.4)",
                              boxShadow: "0 0 24px rgba(239,68,68,0.18), inset 0 1px 0 rgba(239,68,68,0.22)",
                            }}>
                              <ThumbsDown size={19} stroke="#ef4444" strokeWidth={2.2} />
                            </div>
                            <span className="fg-thumbs-title" style={{
                              fontFamily: "'Playfair Display',serif",
                              fontStyle: "italic",
                              fontSize: 26, fontWeight: 600, letterSpacing: -0.4,
                              color: "#ef4444", lineHeight: 1,
                            }}>The Bad</span>
                          </div>
                          <span className="fg-thumbs-caption" style={{
                            display: "block",
                            fontFamily: "'JetBrains Mono',monospace",
                            fontSize: 11, fontWeight: 600,
                            color: "rgba(239,68,68,0.62)",
                            letterSpacing: 1.4, textTransform: "uppercase",
                            marginTop: 9,
                            marginLeft: 54,
                          }}>What doesn't work</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {result.hot_take.bad.map((point, i) => (
                            <HotTakeRow
                              key={`bad-${i}`} text={point} idx={i} positive={false}
                              visible={hotTakeOpen}
                              delay={(result.hot_take.good?.length || 0) * 0.06 + i * 0.06}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Accordion>
              )}

              {/* Video Reviews — bigger thumbnails, refined play affordance */}
              {result.video_reviews && result.video_reviews.length > 0 && (
                <Accordion id="fg-videos" icon={<Video size={14} />} label="Video Reviews" open={reviewsOpen} toggle={() => setReviewsOpen(!reviewsOpen)}>
                  <div className="fg-accord-content" style={{ padding: "10px 26px 26px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
                    {result.video_reviews.map((vr, i) => (
                      <button key={vr.video_id}
                        onClick={() => setVideoModal({ id: vr.video_id, title: vr.title })}
                        className="fg-vid-card"
                        style={{
                          background: "rgba(10,8,4,0.55)", border: "1px solid rgba(255,215,0,0.08)",
                          borderRadius: 12, overflow: "hidden", cursor: "pointer", padding: 0, textAlign: "left",
                          opacity: reviewsOpen ? 1 : 0,
                          transform: reviewsOpen ? "translateY(0)" : "translateY(8px)",
                          transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s, transform 0.3s cubic-bezier(0.16,1,0.3,1)`,
                          boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
                        }}
                      >
                        <div style={{ position: "relative", aspectRatio: "16/9", background: "#0a0a0a", overflow: "hidden" }}>
                          <img src={`https://img.youtube.com/vi/${vr.video_id}/hqdefault.jpg`} alt="" loading="lazy" className="fg-vid-thumb" style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.5s cubic-bezier(0.16,1,0.3,1)" }} />
                          <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)" }} />
                          <div className="fg-vid-play" style={{
                            position: "absolute", top: "50%", left: "50%",
                            transform: "translate(-50%, -50%)",
                            width: 48, height: 48, borderRadius: "50%",
                            background: "linear-gradient(135deg, rgba(255,215,0,0.95), rgba(232,160,0,0.95))",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: "0 8px 28px rgba(0,0,0,0.6), 0 0 28px rgba(255,215,0,0.32)",
                            border: "2px solid rgba(255,255,255,0.2)",
                            transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s ease",
                          }}>
                            <Play size={18} fill="#050505" stroke="#050505" style={{ marginLeft: 3 }} />
                          </div>
                        </div>
                        <div style={{ padding: "13px 15px 15px" }}>
                          <p style={{
                            fontFamily: "'Syne',sans-serif",
                            fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.94)", lineHeight: 1.35,
                            margin: "0 0 5px",
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                          }}>{vr.title || vr.channel}</p>
                          {vr.title && vr.channel && (
                            <p style={{
                              fontFamily: "'JetBrains Mono',monospace",
                              fontSize: 11.5, color: "rgba(255,215,0,0.7)", fontWeight: 700,
                              letterSpacing: 0.6, textTransform: "uppercase",
                              margin: 0,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>{vr.channel}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </Accordion>
              )}

              {result.cast && result.cast.length > 0 && (
                <Accordion id="fg-cast" icon={<Users size={14} />} label="Cast" open={castOpen} toggle={() => setCastOpen(!castOpen)}>
                  {(() => {
                    const count = result.cast.length;
                    const canEvenRows = count % 4 === 0 || count % 3 === 0;
                    if (canEvenRows) {
                      return (
                        <div className="fg-accord-content" style={{ padding: "12px 26px 28px", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
                          {result.cast.map((m, i) => <CastMember key={`${m.name}-${i}`} name={m.name} character={m.character} img={m.img} idx={i} visible={castOpen} />)}
                        </div>
                      );
                    }
                    return (
                      <div className="fg-scroll fg-accord-content" style={{ padding: "12px 22px 26px", display: "flex", gap: 8, overflowX: "auto", overflowY: "hidden" }}>
                        {result.cast.map((m, i) => <CastMember key={`${m.name}-${i}`} name={m.name} character={m.character} img={m.img} idx={i} visible={castOpen} />)}
                      </div>
                    );
                  })()}
                </Accordion>
              )}

              {result.awards && result.awards.length > 0 && (
                <Accordion id="fg-awards" icon={<Trophy size={14} />} label="Awards & Accolades" open={awardsOpen} toggle={() => setAwardsOpen(!awardsOpen)}>
                  <div className="fg-accord-content" style={{ padding: "8px 26px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* Sort: Wins first, Nominations after — preserves original order within each group */}
                    {[...result.awards].sort((a, b) => {
                      const aw = a.result === "Won" ? 0 : 1;
                      const bw = b.result === "Won" ? 0 : 1;
                      return aw - bw;
                    }).map((a, idx) => {
                      const won = a.result === "Won";
                      return (
                        <div key={`${a.award}-${a.result}-${idx}`} className="fg-awards-row" style={{
                          padding: "14px 18px", borderRadius: 11,
                          background: won
                            ? "linear-gradient(135deg, rgba(255,215,0,0.04) 0%, rgba(255,215,0,0.012) 100%)"
                            : "rgba(255,255,255,0.022)",
                          border: `1px solid ${won ? "rgba(255,215,0,0.22)" : "rgba(255,255,255,0.05)"}`,
                          borderLeft: won ? "3px solid rgba(255,215,0,0.85)" : "1px solid rgba(255,255,255,0.05)",
                          boxShadow: won ? "0 0 28px rgba(255,215,0,0.05), inset 0 1px 0 rgba(255,215,0,0.06)" : "none",
                          opacity: awardsOpen ? 1 : 0,
                          transform: awardsOpen ? "translateY(0)" : "translateY(8px)",
                          transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${idx * 0.05}s`,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 8, flexWrap: "wrap" }}>
                            <span className="fg-awards-chip" style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              fontFamily: "'JetBrains Mono',monospace",
                              fontSize: 12, fontWeight: 700, letterSpacing: 1.4,
                              textTransform: "uppercase", padding: "4px 11px", borderRadius: 6,
                              background: won ? "linear-gradient(135deg, rgba(255,215,0,0.18), rgba(255,165,0,0.06))" : "rgba(255,255,255,0.05)",
                              color: won ? "#FFD700" : "rgba(255,255,255,0.6)",
                              border: won ? "1px solid rgba(255,215,0,0.34)" : "1px solid rgba(255,255,255,0.07)",
                              boxShadow: won ? "0 0 16px rgba(255,215,0,0.22)" : "none",
                            }}>
                              {won && <Trophy size={11} />}
                              {a.result}
                            </span>
                            <span className="fg-awards-name" style={{ fontFamily: "'Syne',sans-serif", fontSize: 15.5, fontWeight: 700, color: won ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.82)", letterSpacing: 0.1 }}>{a.award}</span>
                            {a.year && <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", fontFamily: "'JetBrains Mono',monospace", letterSpacing: 0.5 }}>{a.year}</span>}
                          </div>
                          <p className="fg-awards-detail" style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, margin: 0, letterSpacing: 0.1 }}>{a.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                </Accordion>
              )}

              {result.boxOffice && (
                <Accordion id="fg-boxoffice" icon={<DollarSign size={14} />} label="Production & Theatrical Run" open={boxOfficeOpen} toggle={() => setBoxOfficeOpen(!boxOfficeOpen)}>
                  <div className="fg-accord-content" style={{ padding: "10px 22px 22px" }}>
                    <BoxOfficeRow label="Production Budget" val={result.boxOffice.budget} rank={result.boxOffice.budgetRank} idx={0} visible={boxOfficeOpen} />
                    <BoxOfficeRow label="Opening Weekend Gross" val={result.boxOffice.openingWeekend} rank={result.boxOffice.openingRank} idx={1} visible={boxOfficeOpen} />
                    <BoxOfficeRow label="Per-Theater Average (PTA)" val={result.boxOffice.pta} rank={result.boxOffice.ptaRank} idx={2} visible={boxOfficeOpen} />
                    <BoxOfficeRow label="Domestic Gross" val={result.boxOffice.domestic} rank={result.boxOffice.domesticRank} idx={3} visible={boxOfficeOpen} />
                    <BoxOfficeRow label="International Gross" val={result.boxOffice.international} rank={result.boxOffice.internationalRank} idx={4} visible={boxOfficeOpen} />
                    <BoxOfficeRow label="Worldwide Gross" val={result.boxOffice.worldwide} rank={result.boxOffice.worldwideRank} idx={5} visible={boxOfficeOpen} />
                    <BoxOfficeRow label="Estimated ROI" val={result.boxOffice.roi} rank={result.boxOffice.roiRank} idx={6} visible={boxOfficeOpen} />
                    <BoxOfficeRow label="Theater Count (Widest)" val={result.boxOffice.theaterCount} rank={result.boxOffice.theaterCountRank} idx={7} visible={boxOfficeOpen} />
                    <BoxOfficeRow label="Days in Theater" val={result.boxOffice.daysInTheater || result.boxOffice.daysInRelease} rank={result.boxOffice.daysInTheaterRank} idx={8} visible={boxOfficeOpen} />
                    {!result.boxOffice.openingRank && !result.boxOffice.domesticRank && !result.boxOffice.worldwideRank && !result.boxOffice.budgetRank && (
                      <p style={{
                        fontSize: 10, color: "#555", fontStyle: "italic", marginTop: 12,
                        lineHeight: 1.45, textAlign: "center", padding: "0 4px",
                      }}>
                        All-time ranking data not available for this title.
                      </p>
                    )}
                  </div>
                </Accordion>
              )}

              {result.streaming && result.streaming.length > 0 && (
                <Accordion id="fg-watch" icon={<Tv size={14} />} label="Where to Watch" open={watchOpen} toggle={() => setWatchOpen(!watchOpen)}>
                  <div className="fg-watch-wrap" style={{ padding: "14px 26px 26px", display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {result.streaming.map((s, i) => <StreamingBadge key={`${s.platform}-${i}`} platform={s.platform} url={s.url} type={s.type} logo_path={s.logo_path} title={result.title} idx={i} visible={watchOpen} />)}
                  </div>
                </Accordion>
              )}

              {/* You Might Also Like — recommendations as proper portrait posters
                  (was 16/9 which cropped most of the image off). Spotlight hover
                  matching the Did-You-Mean card pattern. */}
              {result.recommendations && result.recommendations.length > 0 && (
                <Accordion id="fg-recs" icon={<Sparkles size={14} />} label="You Might Also Like" open={true} toggle={() => {}}>
                  <div className="fg-accord-content" style={{ padding: "10px 26px 26px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: 14 }}>
                    {result.recommendations.map((rec, i) => (
                      <button key={`${rec.title}-${i}`}
                        onClick={() => { setQuery(rec.title); doSearch(rec.title.toLowerCase()); }}
                        className="fg-rec-card"
                        style={{
                          background: "rgba(10,8,4,0.55)",
                          border: "1px solid rgba(255,215,0,0.08)",
                          borderRadius: 12, overflow: "hidden", cursor: "pointer", padding: 0, textAlign: "left",
                          transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
                          animation: `fadeIn 0.5s ${0.1 + i * 0.07}s both`,
                          boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
                          position: "relative",
                        }}
                      >
                        <div style={{ position: "relative", aspectRatio: "2/3", background: "#0a0a0a", overflow: "hidden" }}>
                          {rec.poster_path ? (
                            <img src={`https://image.tmdb.org/t/p/w342${rec.poster_path}`} alt={rec.title}
                              loading="lazy"
                              className="fg-rec-poster"
                              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.5s cubic-bezier(0.16,1,0.3,1)" }}
                              onError={e => { e.target.style.display = "none"; }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Film size={22} style={{ color: "rgba(255,215,0,0.28)" }} />
                            </div>
                          )}
                          {/* Bottom gradient + title overlay */}
                          <div aria-hidden="true" style={{
                            position: "absolute", bottom: 0, left: 0, right: 0, height: "55%",
                            background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 50%, transparent 100%)",
                            pointerEvents: "none",
                          }} />
                          <p style={{
                            position: "absolute", left: 11, right: 11, bottom: 11,
                            fontFamily: "'Syne',sans-serif",
                            fontSize: 14, fontWeight: 700,
                            color: "#fff",
                            lineHeight: 1.28,
                            letterSpacing: 0.1,
                            margin: 0,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textShadow: "0 2px 10px rgba(0,0,0,0.9)",
                          }}>{rec.title}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </Accordion>
              )}

            </div>
          )}

          {/* Did You Mean — search returned no results / system error.
              State-aware: rate-limit and timeout get their own headlines and
              suppress the suggestion section + retry button (where retrying
              isn't useful). Default no-match path shows close TMDB matches. */}
          {result && result.notFound && (() => {
            const lcErr = (errMsg || "").toLowerCase();
            const isRateLimited = lcErr.includes("too fast") || lcErr.includes("limit");
            const isTimeout = lcErr.includes("timed out") || lcErr.includes("timeout");
            const hasMatches = suggestions.length > 0;
            const headline = hasMatches
              ? "Did you mean…"
              : isRateLimited
              ? "Hold on a moment"
              : isTimeout
              ? "Connection slow"
              : "We couldn’t find that";
            const showSearchedFootnote = !isRateLimited && !isTimeout;
            const showSuggestionBlock = !isRateLimited && !isTimeout;
            const showRetry = !isRateLimited;

            return (
              <div style={{ padding: "32px 0 36px", animation: "fadeIn 0.5s ease-out" }}>
                <div className="dym-rail dym-rail-top" aria-hidden="true" />

                {/* Header — searched diagnostic on top, then italic gold headline.
                    No icon glyph (per design feedback). */}
                <div style={{ textAlign: "center", padding: "36px 18px 24px" }}>
                  {showSearchedFootnote && (
                    <p
                      style={{
                        margin: 0,
                        padding: "0 16px",
                        color: "rgba(255, 255, 255, 0.78)",
                        fontSize: 11.5,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        letterSpacing: 1.6,
                        textTransform: "uppercase",
                        wordBreak: "break-word",
                        animation: "softFade 0.5s ease-out 0.1s both",
                      }}
                    >
                      <span style={{ color: "rgba(255, 215, 0, 0.85)" }}>searched&nbsp;&middot;&nbsp;</span>
                      <span style={{ color: "#fff", textTransform: "none", letterSpacing: 0.2, fontSize: 12.5, fontWeight: 700 }}>&ldquo;{result.query}&rdquo;</span>
                    </p>
                  )}

                  <h2
                    className="dym-headline"
                    style={{
                      marginTop: showSearchedFootnote ? 14 : 0,
                      fontFamily: "'Playfair Display', serif",
                      fontStyle: "italic",
                      fontSize: "clamp(30px, 6vw, 44px)",
                      fontWeight: 600,
                      letterSpacing: -0.8,
                      lineHeight: 1.05,
                      margin: showSearchedFootnote ? "14px 0 0" : 0,
                      animation: "softFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.18s both",
                    }}
                  >
                    {headline}
                  </h2>

                  {errMsg && (isRateLimited || isTimeout) && (
                    <p style={{
                      marginTop: 14,
                      padding: "0 16px",
                      color: "rgba(255, 255, 255, 0.46)",
                      fontSize: 12.5,
                      fontStyle: "italic",
                      lineHeight: 1.45,
                      animation: "softFade 0.55s ease-out 0.32s both",
                    }}>
                      {errMsg}
                    </p>
                  )}
                </div>

                {/* Suggestion cards */}
                {showSuggestionBlock && hasMatches && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 4px", marginBottom: 28 }}>
                    {suggestions.map((s, i) => {
                      const num = String(i + 1).padStart(2, "0");
                      const ariaLabel = s.year
                        ? `Search ${s.title} from ${s.year}`
                        : `Search ${s.title}`;
                      // Unreleased detection — server already sorts unreleased to bottom,
                      // but we also adjust the year-pill treatment to show "TBA" or the
                      // expected release date instead of a year.
                      const todayStr = new Date().toISOString().substring(0, 10);
                      const currentYear = new Date().getFullYear();
                      const isUnreleased = s.release_date
                        ? s.release_date > todayStr
                        : (s.year == null || s.year > currentYear);
                      let releaseLabel = null;
                      if (isUnreleased) {
                        if (s.release_date) {
                          const d = new Date(s.release_date);
                          releaseLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                        } else {
                          releaseLabel = "Release Date TBD";
                        }
                      }
                      return (
                        <button
                          key={`${s.title}-${s.year}-${i}`}
                          onClick={() => { setQuery(s.title); doSearch(s.title); }}
                          onPointerMove={(e) => {
                            const r = e.currentTarget.getBoundingClientRect();
                            e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                            e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
                          }}
                          aria-label={ariaLabel}
                          className="dym-card"
                          style={{
                            display: "flex", alignItems: "center", gap: 22,
                            padding: "20px 22px 20px 22px",
                            background: "rgba(10, 8, 4, 0.62)",
                            border: "1px solid rgba(255, 215, 0, 0.10)",
                            borderRadius: 14,
                            cursor: "pointer",
                            width: "100%",
                            textAlign: "left",
                            position: "relative",
                            overflow: "hidden",
                            opacity: 0,
                            animation: `softFade 0.55s cubic-bezier(0.16, 1, 0.3, 1) ${0.42 + i * 0.08}s both`,
                            transition: "transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.4s ease, box-shadow 0.4s ease, background 0.4s ease, filter 0.2s ease",
                          }}
                        >
                          {/* Poster — bigger, premium treatment with neutral frame number */}
                          <div className="dym-poster-wrap" style={{
                            width: 130, height: 195,
                            borderRadius: 8,
                            background: "rgba(255, 255, 255, 0.03)",
                            flexShrink: 0,
                            overflow: "hidden",
                            position: "relative",
                            boxShadow: "0 10px 28px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05)",
                          }}>
                            {s.poster_path ? (
                              <img
                                className="dym-poster"
                                src={IMG + "w342" + s.poster_path}
                                alt=""
                                loading="lazy"
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                              />
                            ) : (
                              <div className="dym-poster" style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Film size={28} style={{ color: "rgba(255, 255, 255, 0.18)" }} aria-hidden="true" />
                              </div>
                            )}

                          </div>

                          {/* Title block — Syne (site body font) for cohesion */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="dym-title" style={{
                              fontFamily: "'Syne', sans-serif",
                              fontSize: 20, fontWeight: 700,
                              color: "#fff",
                              letterSpacing: -0.3,
                              lineHeight: 1.22,
                              marginBottom: 10,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {s.title}
                            </div>
                            <div style={{
                              display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
                              marginBottom: (s.overview || s.director) ? 12 : 0,
                            }}>
                              {!isUnreleased && s.year && (
                                <span style={{
                                  display: "inline-block",
                                  fontSize: 14, fontWeight: 700, letterSpacing: 1,
                                  color: "rgba(255, 215, 0, 0.88)",
                                  fontFamily: "'JetBrains Mono', monospace",
                                  background: "rgba(255, 215, 0, 0.08)",
                                  padding: "5px 13px", borderRadius: 6,
                                  border: "1px solid rgba(255, 215, 0, 0.18)",
                                }}>{s.year}</span>
                              )}
                              {isUnreleased && releaseLabel && (
                                <span style={{
                                  display: "inline-block",
                                  fontSize: 13, fontWeight: 700, letterSpacing: 0.9,
                                  color: "rgba(255, 215, 0, 0.95)",
                                  fontFamily: "'JetBrains Mono', monospace",
                                  background: "rgba(255, 215, 0, 0.11)",
                                  padding: "5px 13px", borderRadius: 6,
                                  border: "1px solid rgba(255, 215, 0, 0.26)",
                                  textTransform: "uppercase",
                                }}>{releaseLabel}</span>
                              )}
                              {s.runtime && (
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  fontSize: 14, fontWeight: 600, letterSpacing: 0.4,
                                  color: "rgba(255, 255, 255, 0.78)",
                                  fontFamily: "'JetBrains Mono', monospace",
                                  background: "rgba(255, 255, 255, 0.05)",
                                  padding: "5px 13px", borderRadius: 6,
                                  border: "1px solid rgba(255, 255, 255, 0.10)",
                                }}>{s.runtime}</span>
                              )}
                              {s.director && (
                                <span style={{
                                  fontSize: 15, fontWeight: 500,
                                  color: "rgba(255, 255, 255, 0.7)",
                                  fontFamily: "'Syne', sans-serif",
                                  letterSpacing: 0.15,
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                  maxWidth: 320,
                                }}>
                                  <span style={{ color: "rgba(255, 215, 0, 0.62)", fontWeight: 600 }}>Directed by</span>&nbsp;{s.director}
                                </span>
                              )}
                            </div>
                            {s.overview && (
                              <p style={{
                                margin: 0,
                                fontFamily: "'Syne', sans-serif",
                                fontSize: 15,
                                fontWeight: 400,
                                color: "rgba(255, 255, 255, 0.72)",
                                lineHeight: 1.55,
                                letterSpacing: 0.1,
                              }}>
                                {trimOverview(s.overview)}
                              </p>
                            )}
                          </div>

                          <ChevronRight
                            size={18}
                            aria-hidden="true"
                            className="dym-chevron"
                            style={{
                              color: "rgba(255, 215, 0, 0.55)",
                              flexShrink: 0,
                              transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), color 0.4s ease",
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Empty-state line — only when this is a normal "not found"
                    with no TMDB suggestions (rate-limit/timeout get their own
                    explanation via errMsg above and skip this). */}
                {showSuggestionBlock && !hasMatches && (
                  <p style={{
                    textAlign: "center",
                    color: "rgba(255, 255, 255, 0.42)",
                    fontSize: 13,
                    fontStyle: "italic",
                    margin: "16px 0 28px",
                    padding: "0 16px",
                    animation: "softFade 0.55s ease-out 0.4s both",
                  }}>
                    No close matches in our index. Try a different spelling or the full title.
                  </p>
                )}

                <div className="dym-rail dym-rail-bot" style={{ marginTop: 28 }} aria-hidden="true" />
              </div>
            );
          })()}

          {/* ───── New landing below-fold (ticker + how-it-works + film-strip) — idle only ───── */}
          {/* v5.12.8: also hide when the ambiguity picker is showing — same
              UX as the DYM page (no marketing chrome below an active result). */}
          {!result && !loading && !ambiguousMatches && (
            <>
              <Ornament marginTop={0} marginBottom={0} />

              {/* Sources ticker */}
              <section
                aria-label="Review sites included"
                style={{
                  position: "relative", padding: "20px 0 22px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.04)",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                  background: "rgba(10, 10, 10, 0.42)",
                  backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                  opacity: 1,
                }}
              >
                <div style={{ textAlign: "center", marginBottom: 18, fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, fontStyle: "italic", letterSpacing: -0.2, color: "rgba(255, 215, 0, 0.78)" }}>
                  Review Sites Included
                </div>
                <div className="ticker-viewport">
                  <div className="ticker-track">
                    {[...SOURCES, ...SOURCES].map((src, i) => {
                      const GlyphComp = Glyphs[src.key];
                      return (
                        <div key={`${src.key}-${i}`} className="ticker-item" aria-hidden={i >= SOURCES.length ? "true" : "false"}>
                          <GlyphComp />
                          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 600, letterSpacing: 0.2 }}>{src.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <Ornament marginTop={32} marginBottom={0} />

              {/* How It Works */}
              <section aria-label="How it works" style={{ maxWidth: 1060, margin: "0 auto", padding: "32px 24px 56px" }}>
                <div style={{ textAlign: "center", marginBottom: 38, fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 600, fontStyle: "italic", letterSpacing: -0.4, color: "rgba(255, 215, 0, 0.85)" }}>
                  How It Works
                </div>
                <div className="newl-how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                  {[
                    { Icon: Search, title: "Search", body: "Stop going to an endless amount of movie sites to find out if it's good.\nLook for a movie here and we do the leg-work by pulling those scores and averaging them out to create one TRUE rating score." },
                    { Icon: Star, title: "Glance", body: "Additionally, we also bring you every interesting movie fact you can think of." },
                    { Icon: MessageSquare, title: "Discuss", body: "Join our forum to connect, discuss and share insights on movies and the industry with fellow movie diehards." },
                  ].map((s) => {
                    const Icon = s.Icon;
                    return (
                      <article
                        key={s.title}
                        className="newl-how-card"
                        style={{ padding: "30px 28px", background: "rgba(10, 10, 10, 0.5)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: 16, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
                      >
                        <Icon size={26} strokeWidth={1.5} className="newl-how-icon" style={{ marginBottom: 18 }} />
                        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, letterSpacing: -0.4, marginBottom: 10 }}>{s.title}</h3>
                        <span aria-hidden="true" style={{ display: "block", width: 44, height: 1, background: "linear-gradient(to right, rgba(255, 215, 0, 0.05), rgba(255, 215, 0, 0.65), rgba(255, 215, 0, 0.05))", margin: "0 auto 18px", boxShadow: "0 0 8px rgba(255, 215, 0, 0.28)" }} />
                        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 400, color: "rgba(255, 242, 220, 0.88)", lineHeight: 1.7, letterSpacing: 0.1 }}>
                          {s.body.split("\n").map((line, i) => (
                            <span key={i} style={{ display: "block", marginTop: i === 0 ? 0 : 16 }}>{line}</span>
                          ))}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </section>

              <Ornament marginTop={0} marginBottom={0} />

              {/* What You'll Find — film strip */}
              <section aria-label="What you'll find in every film glance" style={{ padding: "40px 0 20px" }}>
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 600, fontStyle: "italic", letterSpacing: -0.4, color: "rgba(255, 215, 0, 0.85)" }}>
                    What You&apos;ll Find
                  </div>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255, 255, 255, 0.42)", marginTop: 8, letterSpacing: 0.2 }}>
                    Inside every Glance.
                  </p>
                </div>
                <div className="strip-outer">
                  <div className="sprocket-row" aria-hidden="true">
                    {Array.from({ length: 32 }).map((_, i) => (<span key={`st-${i}`} className="sprocket-hole" />))}
                  </div>
                  <div className="film-track-viewport">
                    <div className="film-track">
                      {[...FEATURES, ...FEATURES].map((f, i) => {
                        const Icon = f.Icon;
                        const isClone = i >= FEATURES.length;
                        return (
                          <article key={`frame-${i}`} className="film-frame" aria-hidden={isClone ? "true" : "false"}>
                            <Icon size={26} strokeWidth={1.6} className="film-icon" />
                            <h3 className="film-title">{f.title}</h3>
                            <p className="film-body">{f.body}</p>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                  <div className="sprocket-row" aria-hidden="true">
                    {Array.from({ length: 32 }).map((_, i) => (<span key={`sb-${i}`} className="sprocket-hole" />))}
                  </div>
                </div>
              </section>

              <Ornament marginTop={0} marginBottom={0} />
            </>
          )}

          <footer style={{ textAlign: "center", padding: "48px 16px 24px", color: "#181818", fontSize: 10.5 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Film size={11} style={{ color: "#1e1e1e" }} />
              <span style={{ letterSpacing: 2.5, fontWeight: 600 }}>FILM GLANCE 2026 v{FG_VERSION}</span>
            </div>
          </footer>
        </main>
      )}

      {/* Gold scroll indicator — landing, result page, and favourites view.
          Hidden only when actively loading (search in flight) or on the
          notFound state. The window-level scroll listener at the top of
          the component drives scrollPct off window.scrollY so the same
          indicator works for any scrolling view without per-view wiring. */}
      {((result && !result.notFound) || (!result && !loading && !ambiguousMatches)) && (
        <>
          <div ref={scrollTrackRef} onClick={(e) => {
            const track = scrollTrackRef.current;
            if (!track) return;
            const rect = track.getBoundingClientRect();
            const pct = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
            window.scrollTo(0, pct * (document.documentElement.scrollHeight - window.innerHeight));
          }}
            style={{ position: "fixed", right: 4, top: 120, bottom: 20, width: 18, borderRadius: 4, zIndex: 200, cursor: "default", display: "flex", justifyContent: "center" }}>
            <div style={{ width: 7, height: "100%", borderRadius: 4, background: "rgba(255,215,0,0.06)" }} />
            <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingScroll(true); }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 20px rgba(255,215,0,0.35), 0 0 40px rgba(255,215,0,0.12)"; e.currentTarget.style.width = "9px"; e.currentTarget.style.marginLeft = "-4.5px"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = `0 0 ${scrollPct > 0.85 ? "14px" : "6px"} ${scrollPct > 0.85 ? "rgba(255,107,0,0.5)" : "rgba(255,215,0,0.3)"}`; e.currentTarget.style.width = "7px"; e.currentTarget.style.marginLeft = "-3.5px"; }}
              style={{ position: "absolute", top: `${scrollPct * 100}%`, width: 7, left: "50%", marginLeft: -3.5, height: 80, borderRadius: 4, background: `linear-gradient(180deg, #FFD700, ${scrollPct > 0.85 ? "#ff6b00" : "#E8A000"})`, boxShadow: `0 0 ${scrollPct > 0.85 ? "14px" : "6px"} ${scrollPct > 0.85 ? "rgba(255,107,0,0.5)" : "rgba(255,215,0,0.3)"}`, transition: isDraggingScroll ? "none" : "all 0.3s", transform: "translateY(-50%)", cursor: "default" }} />
          </div>
          {scrollPct > 0.8 && (<div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 50, background: `linear-gradient(to top, rgba(255,215,0,${(scrollPct - 0.8) * 0.15}), transparent)`, pointerEvents: "none", zIndex: 150 }} />)}
        </>
      )}

      {/* Global loading overlay — renders whenever loading=true, regardless of
          view (main/favs), auth state, or any other conditional. zIndex 60
          places it ABOVE the sticky header (50). pointerEvents: none lets
          clicks pass through.

          Why no animation on the container: the previous slideUp keyframes
          went from opacity:0 + translateY(22px) → opacity:1 + translateY(0).
          During those 400ms the overlay was partially transparent (page
          content showed through) AND translated down (leaving the top 22px
          of the viewport uncovered, exposing the header's borderBottom).
          That transient state is what produced the visible white line.

          Solution: container has solid #000 background from frame 1 (no
          fade, no translate), so it's a complete black field instantly.
          The video element itself does the fade-in for visual softness. */}
      {loading && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 60,
          pointerEvents: "none",
          background: "#000000",
        }}>
          <video
            src="/loading-screen.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            style={{
              width: "min(440px, 80vw)",
              height: "auto",
              display: "block",
              border: 0,
              outline: 0,
              animation: "fadeIn 0.3s",
              // Defensive 2px clip from each edge in case the mp4 has a
              // 1-pixel light row at any frame boundary (which would
              // otherwise show as a thin line on the solid black backdrop).
              clipPath: "inset(2px)",
            }}
          />
        </div>
      )}
    </div>
  );
}
