import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Search, Star, ExternalLink, X, ChevronDown, Zap, Crown,
  Eye, EyeOff, Mail, Lock, User, Film, TrendingUp, Loader2, Check,
  Users, AlertCircle, RefreshCw, Play, Tv, DollarSign, Award, Heart, Trash2,
  MessageSquare, ArrowRight, LogIn, BarChart3, Flame, Youtube, Sparkles
} from "lucide-react";
import { supabase } from "@/lib/supabase-browser";
import { FloatingParticles } from "@/components/ui/floating-particles";
import { StarfieldFlythrough } from "@/components/ui/starfield-flythrough";
const FG_VERSION = "5.10";

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
  { Icon: Youtube,    title: "Video Reviews",        body: "The most-watched YouTube reviews, ready to play." },
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
          style={{ display: "inline-block", opacity: 0, animation: `letterIn 0.85s cubic-bezier(0.16, 1, 0.3, 1) ${offset + i * 0.028}s forwards` }}
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
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.95)",
        transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${idx * 0.04 + 0.05}s`,
        minWidth: 78, maxWidth: 90, flexShrink: 0, width: "calc(25% - 6px)"
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{
        width: 54, height: 54, borderRadius: "50%", overflow: "hidden",
        background: `linear-gradient(135deg, hsl(${hue},22%,13%), hsl(${hue},28%,22%))`,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: `2px solid ${hov ? "rgba(255,215,0,0.4)" : `hsla(${hue},20%,30%,0.3)`}`,
        transition: "all 0.3s",
        transform: hov ? "scale(1.1)" : "scale(1)",
        boxShadow: hov ? "0 4px 20px rgba(255,215,0,0.1)" : "none",
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
            fontSize: 16, fontWeight: 700,
            color: hov ? "#FFD700" : `hsl(${hue},18%,52%)`,
            fontFamily: "'Playfair Display',serif",
            transition: "color 0.2s", letterSpacing: 1, zIndex: 1
          }}>{initials}</span>
        )}
      </div>
      <div style={{ textAlign: "center", lineHeight: 1.2, width: "100%" }}>
        <div style={{
          fontSize: 10, fontWeight: 600,
          color: hov ? "#FFD700" : "#bbb",
          transition: "color 0.2s",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
        }}>{name}</div>
        <div style={{
          fontSize: 9, color: "#4a4a4a", marginTop: 1, fontStyle: "italic",
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
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "9px 16px", borderRadius: 10,
        background: hov ? "rgba(255,215,0,0.1)" : "rgba(255,215,0,0.04)",
        border: `1px solid ${hov ? "rgba(255,215,0,0.3)" : "rgba(255,215,0,0.12)"}`,
        textDecoration: "none", cursor: "pointer",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${idx * 0.05}s`,
      }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt="" style={{ width: 18, height: 18, borderRadius: 4, objectFit: "cover" }} onError={e => e.target.style.display = "none"} />
      ) : (
        <Play size={11} fill="#FFD700" stroke="#FFD700" style={{ opacity: hov ? 1 : 0.7, transition: "opacity 0.2s" }} />
      )}
      <span style={{
        fontSize: 11.5, fontWeight: 600, color: "#FFD700",
        opacity: hov ? 1 : 0.8, transition: "opacity 0.2s",
        whiteSpace: "nowrap",
      }}>{platform}</span>
      {typeLabel && <span style={{ fontSize: 9, color: "#FFD700", opacity: 0.5, fontWeight: 500 }}>{typeLabel}</span>}
      <ExternalLink size={9} style={{ color: "#FFD700", opacity: hov ? 0.6 : 0.25, transition: "opacity 0.2s" }} />
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

function BoxOfficeRow({ label, val, rank, idx, visible }) {
  const showRank = rank && rank !== "#N/A" && rank !== "N/A";
  const formatted = formatBoxOfficeVal(val, label);
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "9px 13px", borderRadius: 9,
      background: idx % 2 === 0 ? "rgba(255,255,255,0.018)" : "transparent",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(8px)",
      transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${idx * 0.04}s`,
    }}>
      <span style={{ fontSize: 11.5, color: "#888", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#fff", fontWeight: 700, fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: 0.3 }}>
        {formatted}{showRank && <span style={{ color: "#777", fontWeight: 500, fontSize: 11 }}> / {rank}</span>}
      </span>
    </div>
  );
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
    }
    if (!r.ok) return null;

    const mv = await r.json();
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
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) out.push(<Star key={i} size={sz} fill="#FFD700" stroke="#FFD700" />);
    else if (i - 0.5 <= rating) out.push(
      <span key={i} style={{ position: "relative", display: "inline-block", width: sz, height: sz }}>
        <Star size={sz} fill="none" stroke="rgba(255,215,0,0.25)" style={{ position: "absolute" }} />
        <span style={{ position: "absolute", overflow: "hidden", width: "50%" }}>
          <Star size={sz} fill="#FFD700" stroke="#FFD700" />
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

function SourceRow({ source, idx, visible }) {
  const score = typeof source.score === 'string' ? parseFloat(source.score) : source.score;
  const max = typeof source.max === 'string' ? parseFloat(source.max) : source.max;
  const norm = (!isNaN(score) && !isNaN(max) && max > 0) ? (max === 100 ? score : max === 10 ? score * 10 : max === 5 ? score * 20 : (score / max) * 100) : 0;
  const clr = norm >= 80 ? "#22c55e" : norm >= 60 ? "#eab308" : norm >= 40 ? "#f97316" : "#ef4444";
  const [h, setH] = useState(false);
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer"
      style={{
        display: "grid", gridTemplateColumns: "1fr 68px 1fr 24px", alignItems: "center", gap: 10,
        padding: "10px 13px", borderRadius: 9,
        background: h ? "rgba(255,215,0,0.045)" : "rgba(255,255,255,0.018)",
        border: `1px solid ${h ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.035)"}`,
        textDecoration: "none", color: "#fff", cursor: "pointer",
        opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${idx * 0.05}s`,
      }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
    >
      <div style={{ minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 12.5 }}>{source.name}</span>
        <span style={{ fontSize: 10.5, color: "#888", marginLeft: 7 }}>{source.type}</span>
      </div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 13, color: clr, textAlign: "right" }}>
        {source.score}/{source.max}
      </div>
      <div style={{ position: "relative", height: 4, borderRadius: 2, background: "#161616", overflow: "hidden" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 2,
          background: `linear-gradient(90deg,${clr}55,${clr})`,
          width: visible ? `${Math.min(norm, 100)}%` : "0%",
          transition: `width 0.85s cubic-bezier(0.16,1,0.3,1) ${idx * 0.05 + 0.25}s`,
        }} />
      </div>
      <ExternalLink size={12} style={{ color: h ? "#FFD700" : "rgba(255,255,255,0.4)", transition: "color 0.2s" }} />
    </a>
  );
}

function Accordion({ icon, label, count, open, toggle, children }) {
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.035)" }}>
      <button onClick={toggle} style={{
        width: "100%", padding: "13px 24px", background: "none", border: "none",
        color: open ? "#FFD700" : "#777", fontFamily: "'Syne',sans-serif",
        fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.color = "#aaa"; }}
        onMouseLeave={e => { e.currentTarget.style.color = open ? "#FFD700" : "#777"; }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {icon} {label}
        </span>
        <ChevronDown size={14} style={{ transition: "transform 0.35s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      <div style={{ maxHeight: open ? 1200 : 0, overflow: "hidden", transition: "max-height 0.55s cubic-bezier(0.16,1,0.3,1)" }}>
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
  const [plan, setPlan] = useState("free");
  const [searches, setSearches] = useState(0);
  const [showSug, setShowSug] = useState(false);
  const [errMsg, setErrMsg] = useState(null);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
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
      const { data: favs, error: favErr } = await supabase
        .from("favorites")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (favErr) console.error("Load favorites error:", favErr);
      if (favs) {
        setFavorites(favs.map(f => ({
          title: f.title, year: f.year, genre: f.genre,
          poster: f.poster_url, score: { ten: f.score_ten, stars: f.score_stars },
          searchKey: f.search_key
        })));
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
        setUser(null); setPlan("free"); setSearches(0); setFavorites([]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

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

  // Scroll tracking for gold scrollbar (window scroll)
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollPct(max > 0 ? Math.min(window.scrollY / max, 1) : 0);
      setHeaderScrolled(window.scrollY > 8);
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
    setLoading(true); setResult(null); setVideoModal(null); setShowSug(false); setErrMsg(null); setSuggestions([]); setDailyLimitReached(false);

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
        DB[q] = mv; // Client-side session cache
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

  const resetHome = () => { setResult(null); setShowPrice(false); setShowFavs(false); setQuery(""); setLoading(false); setErrMsg(null); setSuggestions([]); setDailyLimitReached(false); };

  const toggleFav = async (movieResult) => {
    if (!user) { setShowAuth(true); return; }
    // Normalize values for DB
    const title = String(movieResult.title || "");
    const year = typeof movieResult.year === 'string' ? parseInt(movieResult.year) || 0 : (movieResult.year || 0);
    const genre = Array.isArray(movieResult.genre) ? movieResult.genre.join(" · ") : String(movieResult.genre || "");
    
    const exists = favorites.find(f => f.title === title && f.year === year);
    if (exists) {
      // Remove favorite
      const prevFavs = [...favorites];
      setFavorites(prev => prev.filter(f => !(f.title === title && f.year === year)));
      try {
        const { error } = await supabase.from("favorites").delete().eq("user_id", user.id).eq("title", title).eq("year", year);
        if (error) { console.error("Remove fav error:", error); setFavorites(prevFavs); }
      } catch (e) { console.error("Remove fav exception:", e); setFavorites(prevFavs); }
    } else {
      // Add favorite
      const newFav = { title, year, genre, poster: movieResult.poster || "", score: movieResult.score || { ten: 0, stars: 0 }, searchKey: title.toLowerCase() };
      const prevFavs = [...favorites];
      setFavorites(prev => [...prev, newFav]);
      try {
        const { error } = await supabase.from("favorites").insert({
          user_id: user.id, title, year,
          genre, poster_url: movieResult.poster || "",
          score_ten: movieResult.score?.ten || 0, score_stars: movieResult.score?.stars || 0,
          search_key: title.toLowerCase(),
        });
        if (error) { console.error("Add fav error:", error, "Data:", { title, year, genre }); setFavorites(prevFavs); }
      } catch (e) { console.error("Add fav exception:", e); setFavorites(prevFavs); }
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

  return (
    <div onClick={() => showAccountMenu && setShowAccountMenu(false)} style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "'Syne',sans-serif" }}>
      <style>{`
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

        /* ═══ NEW LANDING: atmosphere, hero accent, ticker, how-it-works, film-strip ═══ */
        .bg-spotlight {
          position: fixed; top: -30vh; left: 50%;
          width: 150vw; height: 130vh;
          transform: translateX(-50%);
          background: radial-gradient(ellipse 55% 48% at 50% 0%, rgba(255, 220, 120, 0.13) 0%, rgba(232, 160, 0, 0.06) 22%, rgba(232, 160, 0, 0.02) 42%, transparent 65%);
          pointer-events: none; z-index: 1;
          animation: spotlightWarm 2.8s ease-out both;
        }
        @keyframes spotlightWarm {
          from { opacity: 0; transform: translateX(-50%) scale(1.04); filter: blur(12px); }
          to   { opacity: 1; transform: translateX(-50%) scale(1); filter: blur(0); }
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

        .hero-accent {
          background: linear-gradient(135deg, #FFE27A 0%, #FFD700 32%, #E8A000 62%, #FFD700 100%);
          background-size: 220% auto;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent; color: transparent;
          animation: goldShimmer 6s ease-in-out infinite, haloBreathe 5s ease-in-out infinite;
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
      `}</style>

      {/* Header — matches /preview-landing for cross-page consistency */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: headerScrolled ? "13px 32px" : "18px 32px",
          borderBottom: headerScrolled
            ? "1px solid rgba(255, 215, 0, 0.14)"
            : "1px solid rgba(255, 255, 255, 0.04)",
          background: headerScrolled ? "rgba(5, 5, 5, 0.78)" : "rgba(5, 5, 5, 0.55)",
          backdropFilter: "blur(24px) saturate(1.4)",
          WebkitBackdropFilter: "blur(24px) saturate(1.4)",
          boxShadow: headerScrolled
            ? "0 1px 0 rgba(255, 215, 0, 0.06), 0 8px 32px rgba(0, 0, 0, 0.35)"
            : "none",
          transition: "padding 0.35s ease, border-color 0.4s ease, background 0.4s ease, box-shadow 0.4s ease",
        }}
      >
        <Link href="/preview-landing" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "#fff" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, rgba(255,215,0,0.20), rgba(255,165,0,0.06))", border: "1px solid rgba(255, 215, 0, 0.18)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(255, 215, 0, 0.10)" }}>
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
                <User size={12} /> My Account
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
              Sign In
            </button>
          )}
        </nav>
      </header>

      {/* ───── Atmosphere layers — only on the idle landing ───── */}
      {!result && !loading && !showFavs && (
        <>
          <div className="bg-spotlight" aria-hidden="true" />
          {isPortrait ? (
            <div key="portrait-flythrough" className="fg-particles-wrap" aria-hidden="true">
              <StarfieldFlythrough
                particleCount={3500}
                particleColor1="#FFD700"
                particleColor2="#FFE4A0"
                particleSize={14}
                flythroughSpeed={1.4}
              />
            </div>
          ) : (
            <div key="landscape-orbital" className="fg-particles-wrap" aria-hidden="true">
              <FloatingParticles
                particleCount={3500}
                particleColor1="#FFD700"
                particleColor2="#FFE4A0"
                cameraDistance={1000}
                cameraFov={35}
                rotationSpeed={0.06}
                particleSize={14}
                antigravityForce={30}
                activationRate={30}
              />
            </div>
          )}
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
              <iframe
                src={`https://www.youtube.com/embed/${videoModal.id}?autoplay=1&rel=0&modestbranding=1`}
                title={videoModal.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            </div>
            <p style={{ textAlign: "center", color: "#666", fontSize: 11, marginTop: 10, fontWeight: 500 }}>{videoModal.title}</p>
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

      {showFavs ? (
        <div style={{ padding: "48px 18px 56px", maxWidth: 680, margin: "0 auto", animation: "fadeIn 0.5s" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(24px,4vw,36px)", fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.5 }}>
              Your <span style={{ color: "#FFD700" }}>Favourites</span>
            </h2>
          </div>
          {favorites.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", animation: "fadeIn 0.5s" }}>
              <Film size={36} stroke="#333" strokeWidth={1} style={{ marginBottom: 16 }} />
              <p style={{ color: "#888", fontSize: 14, marginBottom: 6 }}>No favourites yet</p>
              <p style={{ color: "#333", fontSize: 12 }}>Search for a movie and tap the heart to save it here.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {favorites.map((fav, idx) => (
                <div key={`${fav.title}-${fav.year}`} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 18px 24px 18px",
                  background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)",
                  borderRadius: 13, cursor: "pointer", position: "relative",
                  animation: `slideUp 0.4s cubic-bezier(0.16,1,0.3,1) ${idx * 0.05}s both`,
                  transition: "border-color 0.2s, background 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,215,0,0.15)"; e.currentTarget.style.background = "rgba(255,215,0,0.02)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)"; e.currentTarget.style.background = "rgba(255,255,255,0.015)"; }}
                onClick={() => loadFav(fav)}
                >
                  <div style={{ width: 44, height: 66, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "#111" }}>
                    {fav.poster ? (
                      <img src={fav.poster} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Film size={16} style={{ color: "#333" }} />
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fav.title}</p>
                    <p style={{ color: "#888", fontSize: 11 }}>{fav.year}{fav.genre ? ` · ${fav.genre}` : ""}</p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, background: "linear-gradient(135deg,#FFD700,#E8A000)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" }}>{fav.score.ten}</span>
                    <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>/10</span>
                  </div>
                  <button
                    onClick={(e) => removeFav(fav, e)}
                    title="Remove from favourites"
                    style={{
                      position: "absolute", bottom: 8, right: 10,
                      background: "transparent", border: "none", cursor: "pointer",
                      padding: 4, borderRadius: 6,
                      color: "rgba(255,255,255,0.15)", transition: "color 0.2s",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#e53e3e"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.15)"; }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <main style={{ maxWidth: (result || loading) ? 720 : 1200, margin: "0 auto", padding: "0 16px", position: "relative", zIndex: 10, transition: "max-width 0.3s ease" }}>
          {/* Search area */}
          <div style={{ textAlign: "center", paddingTop: result || loading ? 12 : 90, transition: "padding-top 0.5s cubic-bezier(0.16,1,0.3,1)", marginBottom: result || loading ? 10 : 32, ...(result || loading ? { position: "sticky", top: 61, zIndex: 40, background: "rgba(5,5,5,0.7)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", paddingBottom: 12, marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16, borderBottom: "1px solid rgba(255,215,0,0.04)" } : {}) }}>
            {!result && !loading && (
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(52px, 8.6vw, 104px)", fontWeight: 700, lineHeight: 1.02, letterSpacing: -1.8, marginBottom: 44, animation: "fadeIn 0.7s" }}>
                <LetterLine text="Every Film." offset={0.15} />
                <span
                  className="hero-accent"
                  style={{ fontStyle: "italic", display: "block", opacity: 0, animation: "softFade 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.9s forwards" }}
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

          {/* Loading */}
          {loading && (
            <div style={{ animation: "slideUp 0.4s" }}>
              <div style={{ background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 17, overflow: "hidden" }}>
                <Skeleton />
              </div>
              <div style={{ textAlign: "center", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Loader2 size={13} style={{ color: "#FFD700", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 11.5, color: "#888" }}>{loadMsg}</span>
              </div>
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
                <Accordion icon={<Tv size={13} />} label="Where to Watch" open={watchOpen} toggle={() => setWatchOpen(!watchOpen)}>
                  <div style={{ padding: "8px 18px 20px", display: "flex", flexWrap: "wrap", gap: 8 }}>
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
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 17, overflow: "hidden", animation: "slideUp 0.5s cubic-bezier(0.16,1,0.3,1)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "0 8px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
              <div style={{ padding: "24px 26px 22px" }}>
                <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
                  <div style={{ width: 130, height: 195, borderRadius: 12, overflow: "hidden", flexShrink: 0, boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)", animation: "fadeIn 0.5s both" }}>
                    <PosterCard title={result.title} year={result.year} genre={result.genre} posterUrl={result.poster} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                    {result.tagline && (
                      <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 11, fontStyle: "italic", color: "rgba(255,255,255,0.45)", marginBottom: 7, animation: "fadeIn 0.6s 0.1s both", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        "{result.tagline}"
                      </p>
                    )}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 3, animation: "fadeIn 0.5s 0.15s both" }}>
                      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(20px,3.2vw,28px)", fontWeight: 700, lineHeight: 1.12, flex: 1 }}>{result.title}</h2>
                      {user && (
                        <button onClick={() => toggleFav(result)} style={{
                          background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0, marginTop: 2,
                          transition: "transform 0.2s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.2)"}
                        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                        >
                          <Heart size={18} fill={isFav(result) ? "#FFD700" : "none"} stroke="#FFD700" strokeWidth={isFav(result) ? 0 : 1.5} style={{ transition: "all 0.3s" }} />
                        </button>
                      )}
                    </div>
                    <p style={{ color: "#aaa", fontSize: 12, marginBottom: 2, animation: "fadeIn 0.5s 0.2s both" }}>
                      {result.year}{result.director ? ` · ${result.director}` : ""}{result.runtime ? ` · ${result.runtime}` : ""}
                    </p>
                    {result.genre && <p style={{ color: "#666", fontSize: 11, marginBottom: 8, letterSpacing: 0.7, animation: "fadeIn 0.5s 0.25s both" }}>{result.genre}</p>}
                    {result.description && <p style={{ color: "rgba(255,255,255,0.92)", fontSize: 12.5, lineHeight: 1.55, marginBottom: 14, animation: "fadeIn 0.5s 0.3s both" }}>{result.description}</p>}
                    <p style={{ fontSize: 10, letterSpacing: 1.8, color: "#FFD700", textTransform: "uppercase", fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6, animation: "fadeIn 0.5s 0.3s both" }}>Averaged Movie Score Across Major Review Sites</p>
                    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 5, animation: "countUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.35s both" }}>
                      <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 56, fontWeight: 700, background: "linear-gradient(135deg,#FFD700,#E8A000)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent", lineHeight: 1 }}>{result.score.ten}</span>
                      <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 20, fontWeight: 600 }}>/10</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, animation: "countUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.4s both" }}>
                      <StarDisplay rating={result.score.stars} sz={20} />
                      <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{result.score.stars}/5</span>
                      {result.trailer_key && (
                        <button
                          onClick={() => setVideoModal({ id: result.trailer_key, title: `${result.title} — Official Trailer` })}
                          style={{
                            marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "6px 14px", borderRadius: 8,
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
                      )}
                    </div>
                  </div>
                </div>
              </div>


              {result.sources && Array.isArray(result.sources) && result.sources.length > 0 && (
              <Accordion icon={<TrendingUp size={13} />} label="Source Breakdown" open={srcOpen} toggle={() => setSrcOpen(!srcOpen)}>
                <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
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
                <Accordion icon={<TrendingUp size={13} />} label="Movie Hot Take — The Good and The Bad" open={hotTakeOpen} toggle={() => setHotTakeOpen(!hotTakeOpen)}>
                  <div style={{ padding: "4px 18px 22px" }}>
                    {result.hot_take.good?.length > 0 && (
                      <div style={{ marginBottom: result.hot_take.bad?.length > 0 ? 16 : 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "0 4px" }}>
                          <div style={{ width: 26, height: 26, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>👍</div>
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace", color: "#22c55e" }}>The Good</span>
                        </div>
                        {result.hot_take.good.map((point, i) => (
                          <div key={`good-${i}`} style={{
                            display: "flex", alignItems: "baseline", gap: 10,
                            padding: "9px 13px", borderRadius: 9, marginBottom: 4,
                            fontSize: 12, lineHeight: 1.5, color: "rgba(255,255,255,0.75)",
                            background: "rgba(34,197,94,0.025)", border: "1px solid rgba(34,197,94,0.06)",
                            opacity: hotTakeOpen ? 1 : 0, transform: hotTakeOpen ? "translateY(0)" : "translateY(8px)",
                            transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s`,
                          }}>
                            <span style={{ flexShrink: 0, width: 5, height: 5, borderRadius: "50%", background: "#22c55e", marginTop: 5 }} />
                            {point}
                          </div>
                        ))}
                      </div>
                    )}
                    {result.hot_take.good?.length > 0 && result.hot_take.bad?.length > 0 && (
                      <div style={{ height: 1, background: "rgba(255,255,255,0.03)", margin: "14px 4px" }} />
                    )}
                    {result.hot_take.bad?.length > 0 && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "0 4px" }}>
                          <div style={{ width: 26, height: 26, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>👎</div>
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace", color: "#ef4444" }}>The Bad</span>
                        </div>
                        {result.hot_take.bad.map((point, i) => (
                          <div key={`bad-${i}`} style={{
                            display: "flex", alignItems: "baseline", gap: 10,
                            padding: "9px 13px", borderRadius: 9, marginBottom: 4,
                            fontSize: 12, lineHeight: 1.5, color: "rgba(255,255,255,0.75)",
                            background: "rgba(239,68,68,0.025)", border: "1px solid rgba(239,68,68,0.06)",
                            opacity: hotTakeOpen ? 1 : 0, transform: hotTakeOpen ? "translateY(0)" : "translateY(8px)",
                            transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${(result.hot_take.good?.length || 0) * 0.05 + i * 0.05}s`,
                          }}>
                            <span style={{ flexShrink: 0, width: 5, height: 5, borderRadius: "50%", background: "#ef4444", marginTop: 5 }} />
                            {point}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Accordion>
              )}

              {/* Video Reviews */}
              {result.video_reviews && result.video_reviews.length > 0 && (
                <Accordion icon={<Play size={13} />} label="Video Reviews" open={reviewsOpen} toggle={() => setReviewsOpen(!reviewsOpen)}>
                  <div style={{ padding: "8px 18px 22px", display: "flex", gap: 10 }}>
                    {result.video_reviews.map((vr, i) => (
                      <button key={vr.video_id}
                        onClick={() => setVideoModal({ id: vr.video_id, title: vr.title })}
                        style={{
                          flex: 1, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)",
                          borderRadius: 10, overflow: "hidden", cursor: "pointer", padding: 0, textAlign: "left",
                          opacity: reviewsOpen ? 1 : 0,
                          transform: reviewsOpen ? "translateY(0)" : "translateY(8px)",
                          transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s`,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,215,0,0.15)"; e.currentTarget.style.background = "rgba(255,215,0,0.03)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)"; e.currentTarget.style.background = "rgba(255,255,255,0.015)"; }}
                      >
                        <div style={{ position: "relative", aspectRatio: "16/9", background: "#111" }}>
                          <img src={`https://img.youtube.com/vi/${vr.video_id}/hqdefault.jpg`} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,215,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Play size={14} fill="#050505" stroke="#050505" style={{ marginLeft: 2 }} />
                            </div>
                          </div>
                        </div>
                        <div style={{ padding: "6px 8px 8px" }}>
                          <p style={{ fontSize: 10, fontWeight: 600, color: "#aaa", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vr.channel}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </Accordion>
              )}

              {result.cast && result.cast.length > 0 && (
                <Accordion icon={<Users size={13} />} label="Cast" open={castOpen} toggle={() => setCastOpen(!castOpen)}>
                  {(() => {
                    const count = result.cast.length;
                    const canEvenRows = count % 4 === 0 || count % 3 === 0;
                    if (canEvenRows) {
                      return (
                        <div style={{ padding: "6px 18px 22px", display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                          {result.cast.map((m, i) => <CastMember key={`${m.name}-${i}`} name={m.name} character={m.character} img={m.img} idx={i} visible={castOpen} />)}
                        </div>
                      );
                    }
                    return (
                      <div className="fg-scroll" style={{ padding: "6px 18px 22px", display: "flex", gap: 6, overflowX: "auto", overflowY: "hidden" }}>
                        {result.cast.map((m, i) => <CastMember key={`${m.name}-${i}`} name={m.name} character={m.character} img={m.img} idx={i} visible={castOpen} />)}
                      </div>
                    );
                  })()}
                </Accordion>
              )}

              {result.awards && result.awards.length > 0 && (
                <Accordion icon={<Award size={13} />} label="Awards & Accolades" open={awardsOpen} toggle={() => setAwardsOpen(!awardsOpen)}>
                  <div style={{ padding: "4px 18px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {result.awards.map((a, idx) => (
                      <div key={`${a.award}-${a.result}-${idx}`} style={{
                        padding: "10px 13px", borderRadius: 9,
                        background: "rgba(255,255,255,0.018)",
                        border: `1px solid ${a.result === "Won" ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.035)"}`,
                        opacity: awardsOpen ? 1 : 0,
                        transform: awardsOpen ? "translateY(0)" : "translateY(8px)",
                        transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${idx * 0.05}s`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: 1,
                            textTransform: "uppercase", padding: "2px 7px", borderRadius: 5,
                            background: a.result === "Won" ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.04)",
                            color: a.result === "Won" ? "#FFD700" : "#666",
                            fontFamily: "'JetBrains Mono',monospace",
                          }}>{a.result}</span>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: "#ccc" }}>{a.award}</span>
                          {a.year && <span style={{ fontSize: 10, color: "#777", fontFamily: "'JetBrains Mono',monospace" }}>{a.year}</span>}
                        </div>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.4, margin: 0 }}>{a.detail}</p>
                      </div>
                    ))}
                  </div>
                </Accordion>
              )}

              {result.boxOffice && (
                <Accordion icon={<DollarSign size={13} />} label="Production & Theatrical Run" open={boxOfficeOpen} toggle={() => setBoxOfficeOpen(!boxOfficeOpen)}>
                  <div style={{ padding: "4px 18px 18px" }}>
                    <BoxOfficeRow label="Production Budget" val={result.boxOffice.budget} rank={result.boxOffice.budgetRank} idx={0} visible={boxOfficeOpen} />
                    <BoxOfficeRow label="Opening Weekend Gross" val={result.boxOffice.openingWeekend} rank={result.boxOffice.openingRank} idx={1} visible={boxOfficeOpen} />
                    <BoxOfficeRow label="Per-Theater Average (PTA)" val={result.boxOffice.pta} rank={null} idx={2} visible={boxOfficeOpen} />
                    <BoxOfficeRow label="Domestic Gross" val={result.boxOffice.domestic} rank={result.boxOffice.domesticRank} idx={3} visible={boxOfficeOpen} />
                    <BoxOfficeRow label="International Gross" val={result.boxOffice.international} rank={null} idx={4} visible={boxOfficeOpen} />
                    <BoxOfficeRow label="Worldwide Gross" val={result.boxOffice.worldwide} rank={result.boxOffice.worldwideRank} idx={5} visible={boxOfficeOpen} />
                    <BoxOfficeRow label="Estimated ROI" val={result.boxOffice.roi} rank={null} idx={6} visible={boxOfficeOpen} />
                    <BoxOfficeRow label="Theater Count (Widest)" val={result.boxOffice.theaterCount} rank={null} idx={7} visible={boxOfficeOpen} />
                    <BoxOfficeRow label="Days in Theater" val={result.boxOffice.daysInTheater || result.boxOffice.daysInRelease} rank={null} idx={8} visible={boxOfficeOpen} />
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
                <Accordion icon={<Tv size={13} />} label="Where to Watch" open={watchOpen} toggle={() => setWatchOpen(!watchOpen)}>
                  <div style={{ padding: "8px 18px 20px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {result.streaming.map((s, i) => <StreamingBadge key={`${s.platform}-${i}`} platform={s.platform} url={s.url} type={s.type} logo_path={s.logo_path} title={result.title} idx={i} visible={watchOpen} />)}
                  </div>
                </Accordion>
              )}

              {/* Similar Movies */}
              {result.recommendations && result.recommendations.length > 0 && (
                <Accordion icon={<Film size={13} />} label="You Might Also Like" open={true} toggle={() => {}}>
                  <div style={{ padding: "8px 18px 22px", display: "flex", gap: 10 }}>
                    {result.recommendations.map((rec, i) => (
                      <button key={`${rec.title}-${i}`}
                        onClick={() => { setQuery(rec.title); doSearch(rec.title.toLowerCase()); }}
                        style={{
                          flex: 1, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)",
                          borderRadius: 10, overflow: "hidden", cursor: "pointer", padding: 0, textAlign: "left",
                          transition: "all 0.3s", animation: `fadeIn 0.5s ${0.1 + i * 0.1}s both`,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,215,0,0.15)"; e.currentTarget.style.background = "rgba(255,215,0,0.03)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)"; e.currentTarget.style.background = "rgba(255,255,255,0.015)"; }}
                      >
                        <div style={{ position: "relative", aspectRatio: "16/9", background: "#111" }}>
                          {rec.poster_path ? (
                            <img src={`https://image.tmdb.org/t/p/w300${rec.poster_path}`} alt={rec.title}
                              loading="lazy"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              onError={e => { e.target.style.display = "none"; }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Film size={18} style={{ color: "#222" }} />
                            </div>
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

          {/* Not found */}
          {result && result.notFound && (
            <div style={{ textAlign: "center", padding: "40px 24px", background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 17, animation: "slideUp 0.4s" }}>
              <AlertCircle size={34} style={{ color: "#f97316", marginBottom: 12 }} />
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: "#4a4a4a", marginBottom: 6 }}>No results for &ldquo;{result.query}&rdquo;</h3>
              <p style={{ color: "#2a2a2a", fontSize: 11.5, marginBottom: 16 }}>{errMsg || "Try a different title."}</p>

              {suggestions.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ color: "#888", fontSize: 12, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Did you mean?</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                    {suggestions.map((s, i) => (
                      <button key={`${s.title}-${s.year}-${i}`}
                        onClick={() => { setQuery(s.title); doSearch(s.title); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 18px", borderRadius: 12, cursor: "pointer",
                          background: "rgba(255,215,0,0.03)", border: "1px solid rgba(255,215,0,0.12)",
                          transition: "all 0.2s", width: "100%", maxWidth: 340,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,215,0,0.08)"; e.currentTarget.style.borderColor = "rgba(255,215,0,0.3)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,215,0,0.03)"; e.currentTarget.style.borderColor = "rgba(255,215,0,0.12)"; }}
                      >
                        {s.poster_path ? (
                          <img src={IMG + "w92" + s.poster_path} alt="" loading="lazy" style={{ width: 32, height: 48, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 32, height: 48, borderRadius: 5, background: "rgba(255,255,255,0.04)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Film size={14} style={{ color: "#888" }} />
                          </div>
                        )}
                        <div style={{ textAlign: "left" }}>
                          <span style={{ color: "#FFD700", fontSize: 13, fontWeight: 600 }}>{s.title}</span>
                          {s.year && <span style={{ color: "#666", fontSize: 11, marginLeft: 6 }}>({s.year})</span>}
                        </div>
                        <Search size={13} style={{ color: "#888", marginLeft: "auto", flexShrink: 0 }} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => { setResult(null); setErrMsg(null); setSuggestions([]); inputRef.current?.focus(); }}
                style={{ padding: "8px 20px", borderRadius: 10, border: "1px solid rgba(255,215,0,0.15)", background: "rgba(255,215,0,0.04)", color: "#FFD700", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={13} /> Try Again
              </button>
            </div>
          )}

          {/* ───── New landing below-fold (ticker + how-it-works + film-strip) — idle only ───── */}
          {!result && !loading && (
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
                  opacity: 0, animation: "softFade 1.2s ease-out 2.2s forwards",
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

      {/* Gold scroll indicator — on the landing and on result pages (hidden on favourites) */}
      {!showFavs && ((result && !result.notFound) || (!result && !loading)) && (
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
    </div>
  );
}
