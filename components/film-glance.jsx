import { useState, useRef, useCallback, useEffect } from "react";
import {
  Search, Star, ExternalLink, X, ChevronDown, Zap, Crown,
  Eye, EyeOff, Mail, Lock, User, Film, TrendingUp, Loader2, Check,
  Users, AlertCircle, RefreshCw, Play, Tv, DollarSign, Award, Heart, Trash2
} from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

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
        minWidth: 78, maxWidth: 90, flexShrink: 0
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

const W = (platform, url) => ({ platform, url });

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
  // Already formatted (has $ or % or #)
  if (s.startsWith("$") || s.endsWith("%") || s.endsWith("days") || s.endsWith("days+")) return s;
  // Raw number — format it
  const num = parseFloat(s.replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return s;
  const lbl = label.toLowerCase();
  const isDollar = lbl.includes("budget") || lbl.includes("gross") || lbl.includes("opening") || lbl.includes("domestic") || lbl.includes("international") || lbl.includes("worldwide") || lbl.includes("pta");
  const isROI = lbl.includes("roi");
  if (isROI) return num >= 1 ? `${Math.round(num)}%` : `${Math.round(num * 100)}%`;
  if (isDollar) {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(0)}K`;
    return `$${Math.round(num).toLocaleString()}`;
  }
  return Number.isInteger(num) ? num.toLocaleString() : s;
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
        {formatted}{showRank && <span style={{ color: "#777", fontWeight: 500, fontSize: 11 }}> / {rank} all-time</span>}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOVIE DATABASE
   ═══════════════════════════════════════════════════════════════════════════ */
function mkS(rtc, rta, mc, mcu, imdb, lb, tmdb, trakt, crit, mubi, sl) {
  const [r, m, i, l, t, tr, cr, mu] = sl;
  const o = [];
  if (rtc != null) o.push({ name: "Rotten Tomatoes", score: rtc, max: 100, type: "Critics", url: `https://www.rottentomatoes.com/m/${r}` });
  if (rta != null) o.push({ name: "Rotten Tomatoes", score: rta, max: 100, type: "Audience", url: `https://www.rottentomatoes.com/m/${r}` });
  if (mc != null) o.push({ name: "Metacritic", score: mc, max: 100, type: "Metascore", url: `https://www.metacritic.com/movie/${m}` });
  if (mcu != null) o.push({ name: "Metacritic", score: mcu, max: 10, type: "User Score", url: `https://www.metacritic.com/movie/${m}` });
  if (imdb != null) o.push({ name: "IMDb", score: imdb, max: 10, type: "Rating", url: `https://www.imdb.com/title/${i}/` });
  if (lb != null) o.push({ name: "Letterboxd", score: lb, max: 5, type: "Average", url: `https://letterboxd.com/film/${l}/` });
  if (tmdb != null) o.push({ name: "TMDB", score: tmdb, max: 10, type: "Rating", url: `https://www.themoviedb.org/movie/${t}` });
  if (trakt != null) o.push({ name: "Trakt", score: trakt, max: 10, type: "Rating", url: `https://trakt.tv/movies/${tr}` });
  if (crit != null) o.push({ name: "Criticker", score: crit, max: 100, type: "TCI", url: `https://www.criticker.com/film/${cr}/` });
  if (mubi != null) o.push({ name: "MUBI", score: mubi, max: 5, type: "Rating", url: `https://mubi.com/films/${mu}` });
  return o;
}

const P = (path) => IMG + "w500" + path;
const H = (path) => IMG + "w185" + path;

const DB = {
  "inception": {
    title: "Inception", year: 2010, genre: "Sci-Fi · Action · Thriller", director: "Christopher Nolan", runtime: "148 min", tagline: "Your mind is the scene of the crime.",
    description: "A skilled thief who steals secrets from within the subconscious is offered a chance to have his criminal record erased if he can successfully plant an idea into a target's mind.",
    poster: P("/ljsZTbVsrQSqZgWeep2B1QiDKuh.jpg"),
    cast: [
      { name: "Leonardo DiCaprio", character: "Dom Cobb", img: H("/wo2hJpn04vbtmh0B9utCFdsQhxM.jpg") },
      { name: "Joseph Gordon-Levitt", character: "Arthur", img: H("/zSuXCR6xCKIgo9GAbUJLfzSW4NV.jpg") },
      { name: "Elliot Page", character: "Ariadne", img: H("/jqBIJGA8XB6MZo0VNrHwMUBc0pZ.jpg") },
      { name: "Tom Hardy", character: "Eames", img: H("/d81K0RH8UX7tZj49tZaQhZ9ewH.jpg") },
      { name: "Ken Watanabe", character: "Saito", img: H("/psAXOYp9SBOXvg7WXNnmPKMI0yR.jpg") },
      { name: "Cillian Murphy", character: "Robert Fischer", img: H("/dm6V24JJJVG2AXCVnMQ2VGPEDLb.jpg") },
    ],
    sources: mkS(87, 91, 74, 8.8, 8.8, 4.2, 8.4, 8.6, 82, 3.9, ["inception", "inception", "tt1375666", "inception", "27205", "inception-2010", "Inception", "inception"]),
    streaming: [W("Netflix","https://www.netflix.com/title/70131314"),W("Prime Video","https://www.amazon.com/dp/B0047WJ11G"),W("Peacock","https://www.peacocktv.com/watch/asset/movies/inception/")],
    boxOffice: {"budgetRank":"#67","budget":"$160M","openingRank":"#54","openingWeekend":"$62.8M","pta":"$14,129","domesticRank":"#89","domestic":"$292.6M","international":"$543.7M","worldwideRank":"#68","worldwide":"$836.8M","roi":"423%","theaterCount":"3,792","daysInTheater":"168"},
    awards: [{"award":"Academy Awards","result":"Won","detail":"4 Wins (Cinematography, Sound Editing, Sound Mixing, Visual Effects)"},{"award":"Academy Awards","result":"Nominated","detail":"4 Additional Nominations (Best Picture, Original Screenplay, Art Direction, Original Score)"},{"award":"BAFTA Awards","result":"Won","detail":"Best Special Visual Effects, Best Sound"},{"award":"Golden Globe Awards","result":"Nominated","detail":"Best Original Score"}],
  },
  "the dark knight": {
    title: "The Dark Knight", year: 2008, genre: "Action · Crime · Drama", director: "Christopher Nolan", runtime: "152 min", tagline: "Why so serious?",
    description: "Batman faces his greatest psychological and physical challenge when the menacing Joker wreaks havoc on Gotham, forcing the Dark Knight to confront chaos itself.",
    poster: P("/qJ2tW6WMUDux911BTUgMe1nPCT.jpg"),
    cast: [
      { name: "Christian Bale", character: "Bruce Wayne", img: H("/qCpZn2e3dimwbryLnqxZuI88PTi.jpg") },
      { name: "Heath Ledger", character: "The Joker", img: H("/5Y9HnYYa1jB4Ia1iIOCVMYndyYT.jpg") },
      { name: "Aaron Eckhart", character: "Harvey Dent", img: H("/bZ1gMnIZqRhMNws28JIlgqDIIat.jpg") },
      { name: "Gary Oldman", character: "Jim Gordon", img: H("/2v9FVVBUrrkW2m3QOcYkuhq9A6o.jpg") },
      { name: "Morgan Freeman", character: "Lucius Fox", img: H("/oIciQWr8VGbnBGixHniVqNp7l2x.jpg") },
    ],
    sources: mkS(94, 94, 84, 9.0, 9.0, 4.4, 8.5, 9.0, 88, 3.8, ["the_dark_knight", "the-dark-knight", "tt0468569", "the-dark-knight", "155", "the-dark-knight-2008", "The-Dark-Knight", "the-dark-knight"]),
    streaming: [W("Max","https://play.max.com/movie/the-dark-knight"),W("Prime Video","https://www.amazon.com/dp/B001I189MK"),W("Apple TV+","https://tv.apple.com/movie/the-dark-knight/umc.cmc.37ybx7kle")],
    boxOffice: {"budgetRank":"#52","budget":"$185M","openingRank":"#12","openingWeekend":"$158.4M","pta":"$36,283","domesticRank":"#25","domestic":"$533.3M","international":"$468.6M","worldwideRank":"#48","worldwide":"$1.005B","roi":"443%","theaterCount":"4,366","daysInTheater":"231"},
    awards: [{"award":"Academy Awards","result":"Won","detail":"2 Wins (Supporting Actor - Heath Ledger, Sound Editing)"},{"award":"Academy Awards","result":"Nominated","detail":"6 Additional Nominations"},{"award":"SAG Awards","result":"Won","detail":"Best Supporting Actor - Heath Ledger"},{"award":"BAFTA Awards","result":"Won","detail":"Best Supporting Actor - Heath Ledger"},{"award":"Golden Globe Awards","result":"Won","detail":"Best Supporting Actor - Heath Ledger"}],
  },
  "die hard": {
    title: "Die Hard", year: 1988, genre: "Action · Thriller", director: "John McTiernan", runtime: "132 min", tagline: "40 stories of sheer adventure!",
    description: "An NYPD officer finds himself trapped in a Los Angeles skyscraper on Christmas Eve, battling a group of terrorists who have taken hostages during an office party.",
    poster: P("/yFihWxQcmqcaBR31QM6Y8gT6aYV.jpg"),
    cast: [
      { name: "Bruce Willis", character: "John McClane", img: H("/A1YFIBcUo865wkGEzqAVU2FZJCE.jpg") },
      { name: "Alan Rickman", character: "Hans Gruber", img: H("/hS1sW58ZHiMj1eFjLsNPD1VRcCp.jpg") },
      { name: "Bonnie Bedelia", character: "Holly", img: H("/lMjWENje5TkCp3XuoEqaI4bxlnf.jpg") },
      { name: "Reginald VelJohnson", character: "Sgt. Powell", img: H("/4QG7VzcLHx0GyS7dh5dQ4W7AtBl.jpg") },
    ],
    sources: mkS(94, 94, 72, 7.6, 8.2, 4.1, 7.8, 8.4, 78, 3.5, ["die_hard", "die-hard", "tt0095016", "die-hard", "562", "die-hard-1988", "Die-Hard", "die-hard"]),
    streaming: [W("Hulu","https://www.hulu.com/movie/die-hard"),W("Disney+","https://www.disneyplus.com/movies/die-hard/"),W("Prime Video","https://www.amazon.com/dp/B000SP16FY"),W("Tubi","https://tubitv.com/movies/die-hard")],
    boxOffice: {"budgetRank":"#420","budget":"$28M","openingRank":"#950","openingWeekend":"$7.1M","pta":"$4,611","domesticRank":"#482","domestic":"$83.0M","international":"$57.0M","worldwideRank":"#588","worldwide":"$140.8M","roi":"403%","theaterCount":"1,538","daysInTheater":"154"},
    awards: [{"award":"Academy Awards","result":"Nominated","detail":"4 Nominations (Editing, Sound, Sound Effects Editing, Visual Effects)"},{"award":"BAFTA Awards","result":"Nominated","detail":"Best Special Effects"}],
  },
  "rounders": {
    title: "Rounders", year: 1998, genre: "Crime · Drama", director: "John Dahl", runtime: "121 min", tagline: "In the poker game of life, women are the rake.",
    description: "A reformed gambler is drawn back into the world of high-stakes poker to help a friend pay off a dangerous debt, risking everything he's rebuilt.",
    poster: P("/gMJngTNfaqCSCqpMtNRFHwpe3uy.jpg"),
    cast: [
      { name: "Matt Damon", character: "Mike McDermott", img: H("/elSlNgV8xVifsbHpFsqrPGxJToZ.jpg") },
      { name: "Edward Norton", character: "Worm", img: H("/8nytsqL59SFJTVYVrN72k6qkGgJ.jpg") },
      { name: "John Malkovich", character: "Teddy KGB", img: H("/dQfT22Jkqdc3JJYtIVbAiSGylO8.jpg") },
      { name: "Gretchen Mol", character: "Jo", img: H("/3fATiEkDGSYnKE1sDlBSa0MF4qy.jpg") },
      { name: "John Turturro", character: "Joey Knish", img: H("/8Ihu4MNEugq3eTTFgWCshCeiHg9.jpg") },
      { name: "Famke Janssen", character: "Petra", img: H("/tHlgJQBSLq8aDplafJjmGBxrxuv.jpg") },
    ],
    sources: mkS(65, 81, 54, 7.4, 7.3, 3.5, 7.0, 7.5, 68, 3.1, ["rounders", "rounders", "tt0128442", "rounders", "14536", "rounders-1998", "Rounders", "rounders"]),
    streaming: [W("Paramount+","https://www.paramountplus.com/movies/rounders/"),W("Prime Video","https://www.amazon.com/dp/B000IBMYF0"),W("Pluto TV","https://pluto.tv/on-demand/movies/rounders")],
    boxOffice: {"budgetRank":"#1200","budget":"$12M","openingRank":"#780","openingWeekend":"$8.4M","pta":"$3,558","domesticRank":"#1450","domestic":"$22.9M","international":"$10.1M","worldwideRank":"#2100","worldwide":"$33.0M","roi":"175%","theaterCount":"2,372","daysInTheater":"77"},
    awards: [],
  },
  "avatar": {
    title: "Avatar", year: 2009, genre: "Action · Adventure · Sci-Fi", director: "James Cameron", runtime: "162 min", tagline: "Enter the world.",
    description: "A paralyzed Marine is sent to the alien world of Pandora, where he falls in love with the land and its people, and must choose between following orders and protecting his new home.",
    poster: P("/kyeqWdyUXW608qlYkRqosgbbJyK.jpg"),
    cast: [
      { name: "Sam Worthington", character: "Jake Sully", img: H("/blKKsHlJIL9PZqcDQGiOXHBP98g.jpg") },
      { name: "Zoe Saldana", character: "Neytiri", img: H("/iOVbUH20il632nj2v01NCtYYeSg.jpg") },
      { name: "Sigourney Weaver", character: "Dr. Augustine", img: H("/flfhep27iBxseZIlxOMHpODFHjq.jpg") },
      { name: "Stephen Lang", character: "Col. Quaritch", img: H("/7fNX2vM5ByaROJlGTCc0e6WNcJp.jpg") },
    ],
    sources: mkS(82, 82, 83, 7.8, 7.9, 3.3, 7.6, 7.8, 66, 2.9, ["avatar", "avatar", "tt0499549", "avatar", "19995", "avatar-2009", "Avatar", "avatar"]),
    streaming: [W("Disney+","https://www.disneyplus.com/movies/avatar/pfxDzMKN2jax"),W("Prime Video","https://www.amazon.com/dp/B0CG1DRHBF"),W("Apple TV+","https://tv.apple.com/movie/avatar/umc.cmc.4yqfwqr3")],
    boxOffice: {"budgetRank":"#14","budget":"$237M","openingRank":"#38","openingWeekend":"$77.0M","pta":"$22,829","domesticRank":"#2","domestic":"$760.5M","international":"$2.13B","worldwideRank":"#1","worldwide":"$2.92B","roi":"1,132%","theaterCount":"3,452","daysInTheater":"238"},
    awards: [{"award":"Academy Awards","result":"Won","detail":"3 Wins (Cinematography, Visual Effects, Art Direction)"},{"award":"Academy Awards","result":"Nominated","detail":"6 Additional Nominations (Best Picture, Best Director)"},{"award":"Golden Globe Awards","result":"Won","detail":"Best Motion Picture - Drama, Best Director"},{"award":"BAFTA Awards","result":"Won","detail":"Best Production Design, Best Special Visual Effects"}],
  },
  "ransom": {
    title: "Ransom", year: 1996, genre: "Action · Crime · Thriller", director: "Ron Howard", runtime: "121 min", tagline: "Someone is going to pay.",
    description: "A wealthy airline owner defies FBI advice and turns the tables on his son's kidnappers by offering the ransom money as a bounty on their heads.",
    poster: P("/sPAHiG7FMz7gGKT8iPCKHCh3r1d.jpg"),
    cast: [
      { name: "Mel Gibson", character: "Tom Mullen", img: "" },
      { name: "Rene Russo", character: "Kate Mullen", img: "" },
      { name: "Gary Sinise", character: "Jimmy Shaker", img: "" },
      { name: "Delroy Lindo", character: "Lonnie Hawkins", img: "" },
      { name: "Liev Schreiber", character: "Clark Barnes", img: "" },
    ],
    sources: mkS(74, 68, 59, 6.2, 6.7, 3.1, 6.5, 6.8, 60, 2.8, ["ransom", "ransom", "tt0117438", "ransom", "11450", "ransom-1996", "Ransom_1996", "ransom"]),
    streaming: [W("Prime Video","https://www.amazon.com/dp/B001AGXEAG"),W("Paramount+","https://www.paramountplus.com/movies/ransom/"),W("Tubi","https://tubitv.com/movies/ransom")],
    boxOffice: {"budgetRank":"#185","budget":"$80M","openingRank":"#140","openingWeekend":"$34.2M","pta":"$13,095","domesticRank":"#246","domestic":"$136.5M","international":"$173.5M","worldwideRank":"#320","worldwide":"$309.5M","roi":"287%","theaterCount":"2,612","daysInTheater":"119"},
    awards: [],
  },
  "the godfather": {
    title: "The Godfather", year: 1972, genre: "Crime · Drama", director: "Francis Ford Coppola", runtime: "175 min", tagline: "An offer you can't refuse.",
    description: "The aging patriarch of an organized crime dynasty transfers control of his empire to his reluctant youngest son, who transforms into a ruthless mafia boss.",
    poster: P("/3bhkrj58Vtu7enYsRolD1fZdja1.jpg"),
    cast: [
      { name: "Marlon Brando", character: "Don Corleone", img: H("/fuTMKmGOSNY9a93VastVMOcpCq3.jpg") },
      { name: "Al Pacino", character: "Michael", img: H("/2dGBb1fOAwaGOHc0Y5tifX7OPKV.jpg") },
      { name: "James Caan", character: "Sonny", img: H("/v3flJtQEyczxENfnBr3eJGiRv1g.jpg") },
      { name: "Robert Duvall", character: "Tom Hagen", img: H("/ybMmK25h4IVtPoON4vL3BFMZDIE.jpg") },
    ],
    sources: mkS(97, 98, 100, 9.2, 9.2, 4.6, 8.7, 9.1, 96, 4.3, ["the_godfather", "the-godfather", "tt0068646", "the-godfather", "238", "the-godfather-1972", "The-Godfather", "the-godfather"]),
    streaming: [W("Paramount+","https://www.paramountplus.com/movies/the-godfather/"),W("Prime Video","https://www.amazon.com/dp/B001AQR3JE"),W("Apple TV+","https://tv.apple.com/movie/the-godfather/umc.cmc.5tm73zh")],
    boxOffice: {"budgetRank":"#2500","budget":"$6M","openingRank":"#200","openingWeekend":"$26.1M","pta":"$82,595","domesticRank":"#127","domestic":"$134.9M","international":"$111.1M","worldwideRank":"#340","worldwide":"$246.1M","roi":"4,002%","theaterCount":"316","daysInTheater":"350+"},
    awards: [{"award":"Academy Awards","result":"Won","detail":"3 Wins (Best Picture, Best Actor - Marlon Brando, Best Adapted Screenplay)"},{"award":"Academy Awards","result":"Nominated","detail":"8 Additional Nominations (Best Director, Supporting Actor x3)"},{"award":"Golden Globe Awards","result":"Won","detail":"5 Wins including Best Picture - Drama, Best Director, Best Actor, Best Score"}],
  },
  "pulp fiction": {
    title: "Pulp Fiction", year: 1994, genre: "Crime · Drama", director: "Quentin Tarantino", runtime: "154 min", tagline: "You won't know the facts until you've seen the fiction.",
    description: "The lives of two hitmen, a boxer, a gangster, and his wife interweave in a series of darkly comic episodes of violence, redemption, and chance in Los Angeles.",
    poster: P("/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg"),
    cast: [
      { name: "John Travolta", character: "Vincent Vega", img: H("/ns8uZHEHzV7S8K3HISAS2QSMFGO.jpg") },
      { name: "Uma Thurman", character: "Mia Wallace", img: H("/rfX3oOyvguxfI0GnEXzXOljKEWG.jpg") },
      { name: "Samuel L. Jackson", character: "Jules", img: H("/mXNiAKjR2EplRvq5kg8kTCdG1Yq.jpg") },
      { name: "Bruce Willis", character: "Butch", img: H("/A1YFIBcUo865wkGEzqAVU2FZJCE.jpg") },
    ],
    sources: mkS(92, 96, 95, 9.0, 8.9, 4.4, 8.5, 9.0, 90, 4.1, ["pulp_fiction", "pulp-fiction", "tt0110912", "pulp-fiction", "680", "pulp-fiction-1994", "Pulp-Fiction", "pulp-fiction"]),
    streaming: [W("Prime Video","https://www.amazon.com/dp/B000I9YTX0"),W("Paramount+","https://www.paramountplus.com/movies/pulp-fiction/"),W("Apple TV+","https://tv.apple.com/movie/pulp-fiction/umc.cmc.1h0k8dz")],
    boxOffice: {"budgetRank":"#1800","budget":"$8M","openingRank":"#680","openingWeekend":"$9.3M","pta":"$12,075","domesticRank":"#174","domestic":"$107.9M","international":"$105.6M","worldwideRank":"#376","worldwide":"$213.9M","roi":"2,574%","theaterCount":"1,338","daysInTheater":"252"},
    awards: [{"award":"Academy Awards","result":"Won","detail":"Best Original Screenplay"},{"award":"Academy Awards","result":"Nominated","detail":"6 Additional Nominations (Best Picture, Best Director, Best Actor)"},{"award":"Cannes Film Festival","result":"Won","detail":"Palme d'Or"},{"award":"BAFTA Awards","result":"Won","detail":"Best Supporting Actor - Samuel L. Jackson"},{"award":"Golden Globe Awards","result":"Won","detail":"Best Screenplay"}],
  },
  "the matrix": {
    title: "The Matrix", year: 1999, genre: "Action · Sci-Fi", director: "Lana and Lilly Wachowski", runtime: "136 min", tagline: "Welcome to the Real World.",
    description: "A computer hacker discovers that reality as he knows it is a simulation created by machines, and joins a rebellion to free humanity from its digital prison.",
    poster: P("/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg"),
    cast: [
      { name: "Keanu Reeves", character: "Neo", img: H("/4D0PpNI0cyR2oZMzUevYR5t3AI.jpg") },
      { name: "Laurence Fishburne", character: "Morpheus", img: H("/8suOhUmPbfKqDQ17jQ1Gy0mI3P3.jpg") },
      { name: "Carrie-Anne Moss", character: "Trinity", img: H("/xD4jTA3KmVp5Rq3aHcymfp1Lbmx.jpg") },
      { name: "Hugo Weaving", character: "Agent Smith", img: H("/n1HdPBRFVhYRWzHq0EG8DVNA1Am.jpg") },
    ],
    sources: mkS(88, 85, 73, 8.7, 8.7, 4.3, 8.2, 8.9, 85, 3.8, ["the_matrix", "the-matrix", "tt0133093", "the-matrix", "603", "the-matrix-1999", "The-Matrix", "the-matrix"]),
    streaming: [W("Max","https://play.max.com/movie/the-matrix"),W("Prime Video","https://www.amazon.com/dp/B000GJPL9K"),W("Apple TV+","https://tv.apple.com/movie/the-matrix/umc.cmc.1eijolhg")],
    boxOffice: {"budgetRank":"#250","budget":"$63M","openingRank":"#180","openingWeekend":"$27.8M","pta":"$10,203","domesticRank":"#138","domestic":"$171.5M","international":"$295.1M","worldwideRank":"#169","worldwide":"$466.6M","roi":"641%","theaterCount":"2,849","daysInTheater":"196"},
    awards: [{"award":"Academy Awards","result":"Won","detail":"4 Wins (Film Editing, Sound, Sound Effects Editing, Visual Effects)"},{"award":"BAFTA Awards","result":"Won","detail":"Best Sound, Best Achievement in Special Visual Effects"}],
  },
  "interstellar": {
    title: "Interstellar", year: 2014, genre: "Sci-Fi · Adventure · Drama", director: "Christopher Nolan", runtime: "169 min", tagline: "Mankind was born on Earth. It was never meant to die here.",
    description: "A team of astronauts travels through a wormhole near Saturn in search of a new habitable planet as Earth faces an extinction-level agricultural crisis.",
    poster: P("/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg"),
    cast: [
      { name: "Matthew McConaughey", character: "Cooper", img: H("/sY2mwpafMA0VrhyAOaJg7jvGkLy.jpg") },
      { name: "Anne Hathaway", character: "Dr. Brand", img: H("/s6tflSD53eDLzGLl7OhSCRrKNiS.jpg") },
      { name: "Jessica Chastain", character: "Murph", img: H("/lodMzLKSdrPcBry6TdoDsMN3Vge.jpg") },
      { name: "Michael Caine", character: "Prof. Brand", img: H("/bGZn5RBzLEKHFnHJyRTUr9yYIbd.jpg") },
    ],
    sources: mkS(73, 85, 74, 8.8, 8.7, 4.3, 8.4, 8.8, 80, 3.7, ["interstellar_2014", "interstellar", "tt0816692", "interstellar", "157336", "interstellar-2014", "Interstellar", "interstellar"]),
    streaming: [W("Paramount+","https://www.paramountplus.com/movies/interstellar/"),W("Prime Video","https://www.amazon.com/dp/B00TU9UFTS"),W("Apple TV+","https://tv.apple.com/movie/interstellar/umc.cmc.1q0mz9xs")],
    boxOffice: {"budgetRank":"#59","budget":"$165M","openingRank":"#82","openingWeekend":"$47.5M","pta":"$13,851","domesticRank":"#162","domestic":"$188.0M","international":"$489.4M","worldwideRank":"#80","worldwide":"$677.5M","roi":"311%","theaterCount":"3,561","daysInTheater":"168"},
    awards: [{"award":"Academy Awards","result":"Won","detail":"Best Visual Effects"},{"award":"Academy Awards","result":"Nominated","detail":"4 Additional Nominations (Best Original Score, Sound Mixing, Sound Editing, Production Design)"},{"award":"BAFTA Awards","result":"Nominated","detail":"Best Special Visual Effects"}],
  },
  "oppenheimer": {
    title: "Oppenheimer", year: 2023, genre: "Biography · Drama · History", director: "Christopher Nolan", runtime: "180 min", tagline: "The world forever changes.",
    description: "The story of J. Robert Oppenheimer and his role in developing the atomic bomb during World War II, and the moral consequences that followed.",
    poster: P("/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg"),
    cast: [
      { name: "Cillian Murphy", character: "Oppenheimer", img: H("/dm6V24JJJVG2AXCVnMQ2VGPEDLb.jpg") },
      { name: "Emily Blunt", character: "Kitty", img: H("/nPJXaFWOf8Yj2iE37WKSG4MbNjR.jpg") },
      { name: "Robert Downey Jr.", character: "Strauss", img: H("/im9SAqJPWKEbcuKNCm2mLRIhOXB.jpg") },
      { name: "Matt Damon", character: "Groves", img: H("/elSlNgV8xVifsbHpFsqrPGxJToZ.jpg") },
      { name: "Florence Pugh", character: "Jean Tatlock", img: H("/6fXFj5sFomYRnGcb6YCb5UhMkEN.jpg") },
    ],
    sources: mkS(93, 91, 88, 8.6, 8.3, 4.3, 8.1, 8.5, 84, 3.9, ["oppenheimer_2023", "oppenheimer", "tt15398776", "oppenheimer-2023", "872585", "oppenheimer-2023", "Oppenheimer", "oppenheimer"]),
    streaming: [W("Peacock","https://www.peacocktv.com/watch/asset/movies/oppenheimer/"),W("Prime Video","https://www.amazon.com/dp/B0CG14LKBC"),W("Apple TV+","https://tv.apple.com/movie/oppenheimer/umc.cmc.27mbpkha")],
    boxOffice: {"budgetRank":"#120","budget":"$100M","openingRank":"#30","openingWeekend":"$82.5M","pta":"$22,419","domesticRank":"#41","domestic":"$326.7M","international":"$625.4M","worldwideRank":"#54","worldwide":"$952.1M","roi":"852%","theaterCount":"3,890","daysInTheater":"175"},
    awards: [{"award":"Academy Awards","result":"Won","detail":"7 Wins (Best Picture, Best Director, Best Actor, Best Supporting Actor, Film Editing, Cinematography, Original Score)"},{"award":"Golden Globe Awards","result":"Won","detail":"5 Wins including Best Picture - Drama, Best Director, Best Actor"},{"award":"BAFTA Awards","result":"Won","detail":"7 Wins including Best Film, Best Director, Best Actor"},{"award":"SAG Awards","result":"Won","detail":"3 Wins including Outstanding Cast"}],
  },
  "the shawshank redemption": {
    title: "The Shawshank Redemption", year: 1994, genre: "Drama", director: "Frank Darabont", runtime: "142 min", tagline: "Fear can hold you prisoner. Hope can set you free.",
    description: "A banker sentenced to life in Shawshank prison befriends a fellow inmate over decades, finding solace and eventual redemption through acts of common decency.",
    poster: P("/9cjIJTKGmGKhlkMEsIHQlifpNhA.jpg"),
    cast: [
      { name: "Tim Robbins", character: "Andy Dufresne", img: H("/hsCu1JUzQQ4pl7uFxAVFLOs9yHh.jpg") },
      { name: "Morgan Freeman", character: "Red", img: H("/oIciQWr8VGbnBGixHniVqNp7l2x.jpg") },
      { name: "Bob Gunton", character: "Warden Norton", img: "" },
      { name: "Clancy Brown", character: "Capt. Hadley", img: "" },
    ],
    sources: mkS(91, 98, 82, 9.1, 9.3, 4.6, 8.7, 9.2, 95, 4.2, ["shawshank_redemption", "the-shawshank-redemption", "tt0111161", "the-shawshank-redemption", "278", "the-shawshank-redemption-1994", "The-Shawshank-Redemption", "the-shawshank-redemption"]),
    streaming: [W("Max","https://play.max.com/movie/the-shawshank-redemption"),W("Prime Video","https://www.amazon.com/dp/B000I9X1JE"),W("Apple TV+","https://tv.apple.com/movie/the-shawshank-redemption/umc.cmc.2hz9bm0q")],
    boxOffice: {"budgetRank":"#480","budget":"$25M","openingRank":"#3800","openingWeekend":"$727K","pta":"$2,244","domesticRank":"#2200","domestic":"$16.0M","international":"$42.3M","worldwideRank":"#1400","worldwide":"$58.3M","roi":"133%","theaterCount":"944","daysInTheater":"126"},
    awards: [{"award":"Academy Awards","result":"Nominated","detail":"7 Nominations (Best Picture, Best Actor, Cinematography, Film Editing, Original Score, Sound Mixing, Adapted Screenplay)"},{"award":"Golden Globe Awards","result":"Nominated","detail":"Best Actor - Morgan Freeman"}],
  },
  "the departed": {
    title: "The Departed", year: 2006, genre: "Crime · Drama · Thriller", director: "Martin Scorsese", runtime: "151 min", tagline: "Lies. Betrayal. Sacrifice.",
    description: "An undercover cop and a mole in the police force attempt to identify each other while infiltrating an Irish gang in South Boston.",
    poster: P("/nT97ifVT2J1yMQmeq21Gelm58UB.jpg"),
    cast: [
      { name: "Leonardo DiCaprio", character: "Billy Costigan", img: H("/wo2hJpn04vbtmh0B9utCFdsQhxM.jpg") },
      { name: "Matt Damon", character: "Colin Sullivan", img: H("/elSlNgV8xVifsbHpFsqrPGxJToZ.jpg") },
      { name: "Jack Nicholson", character: "Costello", img: H("/hCqFSeid3xDAzYMAKiXcGBiSM6s.jpg") },
      { name: "Mark Wahlberg", character: "Dignam", img: H("/bTEFpaWd7A6AZVWOqKKBWzKEQB.jpg") },
      { name: "Martin Sheen", character: "Queenan", img: "" },
      { name: "Vera Farmiga", character: "Madolyn", img: H("/7TyTsFMNE3GxyDmqUOMBemJctn1.jpg") },
    ],
    sources: mkS(91, 94, 85, 8.5, 8.5, 4.3, 8.2, 8.6, 82, 3.7, ["departed", "the-departed", "tt0407887", "the-departed", "1422", "the-departed-2006", "The-Departed", "the-departed"]),
    streaming: [W("Max","https://play.max.com/movie/the-departed"),W("Prime Video","https://www.amazon.com/dp/B000O1BOJ6"),W("Apple TV+","https://tv.apple.com/movie/the-departed/umc.cmc.3h4vc1ax")],
    boxOffice: {"budgetRank":"#500","budget":"$90M","openingRank":"#500","openingWeekend":"$26.9M","pta":"$8,015","domesticRank":"#500","domestic":"$132.4M","international":"$157.0M","worldwideRank":"#500","worldwide":"$289.8M","roi":"222%","theaterCount":"3,356","daysInTheater":"140"},
    awards: [{"award":"Academy Awards","result":"Won","detail":"4 Wins (Best Picture, Best Director, Best Adapted Screenplay, Best Film Editing)"},{"award":"Academy Awards","result":"Nominated","detail":"1 Additional Nomination (Best Supporting Actor - Mark Wahlberg)"},{"award":"Golden Globe Awards","result":"Nominated","detail":"6 Nominations including Best Picture - Drama, Best Director"},{"award":"BAFTA Awards","result":"Nominated","detail":"Best Director, Best Adapted Screenplay"},{"award":"SAG Awards","result":"Nominated","detail":"Outstanding Cast"}],
  },
  "goodfellas": {
    title: "Goodfellas", year: 1990, genre: "Crime · Drama", director: "Martin Scorsese", runtime: "146 min", tagline: "As far back as I can remember, I always wanted to be a gangster.",
    description: "The story of Henry Hill and his life in the mob, from his teenage years through his eventual decision to become a government witness.",
    poster: P("/aKuFiU82s5ISJpGZp7YkIr3kCUd.jpg"),
    cast: [
      { name: "Robert De Niro", character: "James Conway", img: H("/cT8htcckIuyI1Lqwt1CqYKOlKs.jpg") },
      { name: "Ray Liotta", character: "Henry Hill", img: H("/pYGScvMc1jUZbfC6KpOMrtbLfHr.jpg") },
      { name: "Joe Pesci", character: "Tommy DeVito", img: H("/5JKNO4t0isRMiACmKFnAbHq7JOj.jpg") },
      { name: "Lorraine Bracco", character: "Karen Hill", img: H("/p5m0pLD6KS9a2VXQX0r6rFr09WP.jpg") },
    ],
    sources: mkS(96, 97, 90, 9.0, 8.7, 4.5, 8.5, 8.9, 91, 4.0, ["goodfellas", "goodfellas", "tt0099685", "goodfellas", "769", "goodfellas-1990", "GoodFellas", "goodfellas"]),
    streaming: [W("Max","https://play.max.com/movie/goodfellas"),W("Prime Video","https://www.amazon.com/dp/B001AQO4CM"),W("Apple TV+","https://tv.apple.com/movie/goodfellas/umc.cmc.2u0ew62c")],
    boxOffice: {"budgetRank":"#500","budget":"$25M","openingRank":"#500","openingWeekend":"$6.3M","pta":"$4,753","domesticRank":"#500","domestic":"$46.8M","international":"$N/A","worldwideRank":"#500","worldwide":"$46.8M","roi":"87%","theaterCount":"1,326","daysInTheater":"140"},
    awards: [{"award":"Academy Awards","result":"Won","detail":"Best Supporting Actor - Joe Pesci"},{"award":"Academy Awards","result":"Nominated","detail":"5 Additional Nominations (Best Picture, Best Director, Best Supporting Actress, Best Adapted Screenplay, Best Film Editing)"},{"award":"BAFTA Awards","result":"Won","detail":"Best Film, Best Director"},{"award":"Venice Film Festival","result":"Won","detail":"Silver Lion - Best Director"}],
  },
  "fight club": {
    title: "Fight Club", year: 1999, genre: "Drama · Thriller", director: "David Fincher", runtime: "139 min", tagline: "Mischief. Mayhem. Soap.",
    description: "An insomniac office worker and a devil-may-care soap maker form an underground fight club that evolves into an anarchist movement.",
    poster: P("/pB8BM7pdSp6B6Ih7QI4S2t0POD.jpg"),
    cast: [
      { name: "Brad Pitt", character: "Tyler Durden", img: H("/cckcYc2v0yh1tc9QjRelptcOBko.jpg") },
      { name: "Edward Norton", character: "The Narrator", img: H("/8nytsqL59SFJTVYVrN72k6qkGgJ.jpg") },
      { name: "Helena Bonham Carter", character: "Marla", img: H("/DPnessSsaJOGIOnVzclVdHrGbP.jpg") },
    ],
    sources: mkS(79, 96, 66, 8.8, 8.8, 4.3, 8.4, 8.9, 84, 3.8, ["fight_club", "fight-club", "tt0137523", "fight-club", "550", "fight-club-1999", "Fight-Club", "fight-club"]),
    streaming: [W("Hulu","https://www.hulu.com/movie/fight-club"),W("Prime Video","https://www.amazon.com/dp/B000SP15RE"),W("Apple TV+","https://tv.apple.com/movie/fight-club/umc.cmc.72c2pj2q")],
    boxOffice: {"budgetRank":"#500","budget":"$63M","openingRank":"#500","openingWeekend":"$11.0M","pta":"$4,228","domesticRank":"#500","domestic":"$37.0M","international":"$63.8M","worldwideRank":"#500","worldwide":"$101.2M","roi":"61%","theaterCount":"2,603","daysInTheater":"112"},
    awards: [{"award":"Academy Awards","result":"Nominated","detail":"1 Nomination (Best Sound Effects Editing)"},{"award":"BAFTA Awards","result":"Nominated","detail":"Best Sound"}],
  },
  "forrest gump": {
    title: "Forrest Gump", year: 1994, genre: "Drama · Romance · Comedy", director: "Robert Zemeckis", runtime: "142 min", tagline: "Life is like a box of chocolates.",
    description: "The story of a man with a low IQ who inadvertently influences several major historical events in America while pursuing his one true love.",
    poster: P("/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg"),
    cast: [
      { name: "Tom Hanks", character: "Forrest Gump", img: H("/xndWFsBlClOJFRdhSt4NBwiPq2o.jpg") },
      { name: "Robin Wright", character: "Jenny", img: H("/cODq3oumOaILlhpGSnAaW6oSCGb.jpg") },
      { name: "Gary Sinise", character: "Lt. Dan", img: H("/hCjNRGKanBuMf0mxoQPkrkYk3HG.jpg") },
      { name: "Sally Field", character: "Mrs. Gump", img: H("/z7bcSXCRPYpVbmPWapqPbddNWMa.jpg") },
    ],
    sources: mkS(71, 95, 82, 8.7, 8.8, 4.0, 8.5, 8.6, 80, 3.4, ["forrest_gump", "forrest-gump", "tt0109830", "forrest-gump", "13", "forrest-gump-1994", "Forrest-Gump", "forrest-gump"]),
    streaming: [W("Paramount+","https://www.paramountplus.com/movies/forrest-gump/"),W("Prime Video","https://www.amazon.com/dp/B000I9X54K"),W("Apple TV+","https://tv.apple.com/movie/forrest-gump/umc.cmc.4t02t5hk")],
    boxOffice: {"budgetRank":"#500","budget":"$55M","openingRank":"#500","openingWeekend":"$24.5M","pta":"$10,048","domesticRank":"#42","domestic":"$330.5M","international":"$347.7M","worldwideRank":"#74","worldwide":"$678.2M","roi":"1,133%","theaterCount":"2,441","daysInTheater":"252"},
    awards: [{"award":"Academy Awards","result":"Won","detail":"6 Wins (Best Picture, Best Director, Best Actor - Tom Hanks, Best Adapted Screenplay, Best Film Editing, Best Visual Effects)"},{"award":"Academy Awards","result":"Nominated","detail":"7 Additional Nominations"},{"award":"Golden Globe Awards","result":"Won","detail":"3 Wins (Best Picture - Drama, Best Director, Best Actor)"}],
  },
  "gladiator": {
    title: "Gladiator", year: 2000, genre: "Action · Adventure · Drama", director: "Ridley Scott", runtime: "155 min", tagline: "What we do in life echoes in eternity.",
    description: "A former Roman general sets out to exact vengeance against the corrupt emperor who murdered his family and sent him into slavery.",
    poster: P("/ty8TGRuvJLPUmAR1H1nRIsgCLkN.jpg"),
    cast: [
      { name: "Russell Crowe", character: "Maximus", img: H("/uxjQGhMsNCoLvJbcEYBOyGMNGcj.jpg") },
      { name: "Joaquin Phoenix", character: "Commodus", img: H("/nXMzvVF6xR3OXOedozfOcoA20xh.jpg") },
      { name: "Connie Nielsen", character: "Lucilla", img: H("/b2JWnTMNyK0KK4FRsMIKEgYBPB4.jpg") },
      { name: "Oliver Reed", character: "Proximo", img: "" },
      { name: "Richard Harris", character: "Marcus Aurelius", img: "" },
    ],
    sources: mkS(80, 87, 67, 8.5, 8.5, 4.0, 8.2, 8.4, 78, 3.4, ["gladiator", "gladiator", "tt0172495", "gladiator", "98", "gladiator-2000", "Gladiator", "gladiator"]),
    streaming: [W("Paramount+","https://www.paramountplus.com/movies/gladiator/"),W("Prime Video","https://www.amazon.com/dp/B00AYB0JZ8"),W("Peacock","https://www.peacocktv.com/watch/asset/movies/gladiator/")],
    boxOffice: {"budgetRank":"#500","budget":"$103M","openingRank":"#500","openingWeekend":"$34.8M","pta":"$12,434","domesticRank":"#117","domestic":"$187.7M","international":"$269.8M","worldwideRank":"#120","worldwide":"$457.6M","roi":"344%","theaterCount":"2,938","daysInTheater":"196"},
    awards: [{"award":"Academy Awards","result":"Won","detail":"5 Wins (Best Picture, Best Actor - Russell Crowe, Best Costume Design, Best Sound, Best Visual Effects)"},{"award":"Academy Awards","result":"Nominated","detail":"7 Additional Nominations"},{"award":"Golden Globe Awards","result":"Won","detail":"Best Picture - Drama"},{"award":"BAFTA Awards","result":"Won","detail":"4 Wins including Best Film, Best Cinematography"}],
  },
};

const SUGGESTIONS = Object.keys(DB).map(k => DB[k].title);
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
    if (!r.ok) return null;

    const mv = await r.json();
    if (!mv.title || !mv.sources || mv.sources.length === 0) return null;

    // Construct image URLs from TMDB paths
    // Always prefer TMDB poster_path over any Claude-guessed poster URL
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
  return r;
}

function calcScore(sources) {
  if (!sources || !Array.isArray(sources) || sources.length === 0) return { ten: 0, stars: 0, count: 0 };
  const valid = sources.filter(s => s && typeof s.score !== 'undefined' && s.score !== null && s.max > 0);
  if (valid.length === 0) return { ten: 0, stars: 0, count: 0 };
  const n = valid.map(s => {
    const score = typeof s.score === 'string' ? parseFloat(s.score) : s.score;
    const max = typeof s.max === 'string' ? parseFloat(s.max) : s.max;
    if (isNaN(score) || isNaN(max) || max === 0) return null;
    return max === 100 ? score : max === 10 ? score * 10 : max === 5 ? score * 20 : (score / max) * 100;
  }).filter(v => v !== null && !isNaN(v));
  if (n.length === 0) return { ten: 0, stars: 0, count: sources.length };
  const m = n.reduce((a, b) => a + b, 0) / n.length;
  return {
    ten: Math.round((m / 10) * 10) / 10,
    stars: Math.round((m / 20) * 2) / 2,
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
        <span style={{ fontSize: 10.5, color: "#555", marginLeft: 7 }}>{source.type}</span>
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
          {count != null && (
            <span style={{
              fontSize: 9.5, padding: "2px 7px", borderRadius: 8, fontWeight: 700,
              fontFamily: "'JetBrains Mono',monospace",
              background: open ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.04)",
              color: open ? "#FFD700" : "#555",
            }}>{count}</span>
          )}
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
  const [srcOpen, setSrcOpen] = useState(false);
  const [castOpen, setCastOpen] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const [boxOfficeOpen, setBoxOfficeOpen] = useState(false);
  const [awardsOpen, setAwardsOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
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
  const inputRef = useRef(null);
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
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser({ email: session.user.email, id: session.user.id, _session: session });
        await loadUserData(session);
        setShowAuth(false);
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

    // Auth gate — require sign-in for ALL searches
    if (!user) {
      setPendingSearch(q);
      setShowAuth(true);
      return;
    }

    // [ARCHIVED — PRICING DORMANT] if (atLimit) { setShowPrice(true); return; }
    setLoading(true); setResult(null); setSrcOpen(false); setCastOpen(false); setWatchOpen(false); setBoxOfficeOpen(false); setAwardsOpen(false); setReviewsOpen(false); setVideoModal(null); setShowSug(false); setErrMsg(null);

    // Check client-side cache — exact match only (prevents sequel mismatches)
    let cached = DB[q];
    if (!cached) {
      const k = Object.keys(DB).find(k => {
        const title = DB[k].title.toLowerCase();
        if (title === q) return true;
        if (q === "the " + k || k === "the " + q) return true;
        if (q === "the " + title || title === "the " + q) return true;
        return false;
      });
      if (k) cached = DB[k];
    }

    if (cached) {
      setLoadMsg("Scanning Movie Studio Vault...");
      await new Promise(r => setTimeout(r, 500 + Math.random() * 400));
      const cachedResult = normalizeResult({ ...cached, score: calcScore(cached.sources) });
      setResult(cachedResult);
      // [ARCHIVED — PRICING DORMANT] if (plan === "free") setSearches(c => c + 1);
      setLoading(false);
      setTimeout(() => setSrcOpen(true), 300);
      // Enrich cached movie with real TMDB images + streaming in background
      const castNames = cached.cast?.map(c => ({ name: c.name, character: c.character }));
      enrichCachedMovie(cached.title, cached.year, castNames).then(tmdb => {
        if (!tmdb) return;
        setResult(prev => {
          if (!prev || prev.title !== cached.title) return prev;
          const updated = { ...prev };
          if (tmdb.poster_path) updated.poster = IMG + "w500" + tmdb.poster_path;
          if (tmdb.cast && tmdb.cast.length > 0) {
            updated.cast = tmdb.cast.map((tc, i) => ({
              name: tc.name,
              character: tc.character || prev.cast?.[i]?.character || "",
              img: tc.profile_path ? IMG + "w185" + tc.profile_path : ""
            }));
          }
          if (tmdb.streaming && tmdb.streaming.length > 0) updated.streaming = tmdb.streaming;
          // Always overwrite these — never serve stale cached data
          updated.trailer_key = tmdb.trailer_key || null;
          updated.recommendations = tmdb.recommendations || [];
          updated.video_reviews = tmdb.video_reviews || [];
          return updated;
        });
      });
      return;
    }

    // Backend API lookup (handles: server cache → Anthropic → TMDB image enrichment)
    setLoadMsg("Scanning Movie Studio Vault...");
    try {
      const token = user?._session?.access_token || null;
      const mv = await fetchMovieAPI(q, token);

      // [ARCHIVED — PRICING DORMANT] Uncomment to re-enable limit enforcement:
      // if (mv && mv.limitReached) { setShowPrice(true); setLoading(false); return; }

      if (mv && mv.sources && mv.sources.length > 0) {
        try {
          const res = normalizeResult({ ...mv, score: mv.score || calcScore(mv.sources) });
          setResult(res);
          // Always enrich from TMDB (server cache may have old data)
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
              // Always overwrite — never serve stale cached data
              updated.trailer_key = tmdb.trailer_key || null;
              updated.recommendations = tmdb.recommendations || [];
              updated.video_reviews = tmdb.video_reviews || [];
              return updated;
            });
          });
        } catch (parseErr) {
          console.error("Result parse error:", parseErr);
          setErrMsg("Could not display this movie. Try a different title.");
          setResult({ notFound: true, query: q });
        }
        // [ARCHIVED — PRICING DORMANT] if (plan === "free") setSearches(c => c + 1);
        DB[q] = mv; // Client-side session cache
        setTimeout(() => setSrcOpen(true), 300);
      } else {
        setErrMsg("Could not find this movie. Check spelling or try the full title.");
        setResult({ notFound: true, query: q });
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

  const resetHome = () => { setResult(null); setShowPrice(false); setShowFavs(false); setQuery(""); setLoading(false); setErrMsg(null); };

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
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e1e1e; border-radius: 2px; }
        .castscroll::-webkit-scrollbar { height: 3px; }
      `}</style>

      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.03)", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }} onClick={resetHome}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,rgba(255,215,0,0.12),rgba(255,165,0,0.05))", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,215,0,0.08)" }}>
            <Film size={14} style={{ color: "#FFD700" }} />
          </div>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>
            Film <span style={{ color: "#FFD700" }}>Glance</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* [ARCHIVED — PRICING DORMANT] Pricing nav button:
          <button onClick={() => { setShowPrice(!showPrice); setShowFavs(false); setResult(null); setLoading(false); }}
            style={{ background: "none", border: "none", color: showPrice ? "#FFD700" : "#fff", cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>
            Pricing
          </button>
          */}
          {user && (
            <button onClick={() => { setShowFavs(!showFavs); setShowPrice(false); setResult(null); setLoading(false); }}
              style={{ background: "none", border: "none", color: showFavs ? "#FFD700" : "#fff", cursor: "pointer", fontSize: 11.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              Favourites
              {favorites.length > 0 && <span style={{ fontSize: 9, background: "rgba(255,215,0,0.12)", color: "#FFD700", padding: "1px 5px", borderRadius: 6, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{favorites.length}</span>}
            </button>
          )}
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 7, position: "relative" }}>
              <button onClick={(e) => { e.stopPropagation(); setShowAccountMenu(!showAccountMenu); }}
                style={{ padding: "6px 14px", borderRadius: 9, border: "1px solid rgba(255,215,0,0.18)", background: "rgba(255,215,0,0.03)", color: "#FFD700", fontSize: 11.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <User size={12} /> My Account
              </button>
              {showAccountMenu && (
                <div style={{ position: "absolute", top: 38, right: 0, background: "#0a0a0a", border: "1px solid rgba(255,215,0,0.1)", borderRadius: 12, padding: "12px 0", minWidth: 220, zIndex: 100, animation: "fadeIn 0.2s" }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ padding: "6px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <p style={{ fontSize: 10.5, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</p>
                  </div>
                  <button onClick={() => { setShowAccountMenu(false); logout(); }}
                    style={{ width: "100%", padding: "10px 16px", background: "none", border: "none", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
                    <X size={12} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)} style={{ padding: "6px 16px", borderRadius: 9, border: "1px solid rgba(255,215,0,0.18)", background: "rgba(255,215,0,0.03)", color: "#FFD700", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>Sign In</button>
          )}
        </div>
      </header>

      {/* Video Modal */}
      {videoModal && (
        <div onClick={() => setVideoModal(null)} style={{
          position: "fixed", inset: 0, zIndex: 1200,
          background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)",
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

      {/* Auth Modal */}
      {showAuth && (
        <div onClick={() => setShowAuth(false)} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.88)", backdropFilter: "blur(22px)", animation: "fadeIn 0.25s" }}>
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

      {/* ═══════════════════════════════════════════════════════════════════
          [ARCHIVED — PRICING PAGE — DORMANT]
          The full pricing page component was here. To restore:
          1. Uncomment the Pricing nav button in the header above
          2. Restore the pricing ternary: showPrice ? (PricingPage) : showFavs ? ...
          3. Re-enable atLimit gating in doSearch
          Full pricing code preserved in: film-glance-checkpoint-v2.jsx (lines 856-878)
          ═══════════════════════════════════════════════════════════════════ */}

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
              <p style={{ color: "#555", fontSize: 14, marginBottom: 6 }}>No favourites yet</p>
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
                      <img src={fav.poster} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Film size={16} style={{ color: "#333" }} />
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fav.title}</p>
                    <p style={{ color: "#555", fontSize: 11 }}>{fav.year}{fav.genre ? ` · ${fav.genre}` : ""}</p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, background: "linear-gradient(135deg,#FFD700,#E8A000)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{fav.score.ten}</span>
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
        <main style={{ maxWidth: 680, margin: "0 auto", padding: "0 16px", position: "relative", zIndex: 5 }}>
          {/* Search area */}
          <div style={{ textAlign: "center", paddingTop: result || loading ? 16 : 90, transition: "padding-top 0.5s cubic-bezier(0.16,1,0.3,1)", marginBottom: result || loading ? 10 : 32 }}>
            {!result && !loading && (
              <div style={{ animation: "fadeIn 0.7s", marginBottom: 32 }}>
                <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(28px,5.5vw,48px)", fontWeight: 700, lineHeight: 1.1, letterSpacing: -1, marginBottom: 12 }}>
                  Every Film.<br />
                  <span style={{ background: "linear-gradient(135deg,#FFD700,#E8A000,#FFD700)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "shimmer 3s linear infinite" }}>One Rating at a Glance.</span>
                </h1>
                <p style={{ color: "#4a4a4a", fontSize: 13.5, maxWidth: 380, margin: "0 auto", lineHeight: 1.55 }}>
                  Search any movie ever made and we'll show you the averaged rated score across the major movie review sites.
                </p>
              </div>
            )}
            <div style={{ position: "relative", maxWidth: 560, margin: "0 auto" }}>
              <div style={{ position: "relative", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, animation: !result && !loading ? "glow 4s ease-in-out infinite" : "none" }}>
                <Search size={16} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#3a3a3a", pointerEvents: "none", zIndex: 1 }} />
                <input ref={inputRef} type="text" value={query}
                  onChange={e => { setQuery(e.target.value); setShowSug(true); }}
                  onFocus={() => setShowSug(true)}
                  onBlur={() => setTimeout(() => setShowSug(false), 180)}
                  onKeyDown={e => { if (e.key === "Enter") doSearch(); }}
                  placeholder="Search any movie..."
                  style={{ width: "100%", padding: "15px 110px 15px 44px", background: "transparent", border: "none", color: "#fff", fontSize: 14.5, fontFamily: "'Syne',sans-serif" }}
                />
                <button onClick={() => doSearch()} disabled={loading}
                  style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", padding: "8px 20px", borderRadius: 10, border: "none", background: loading ? "#222" : "linear-gradient(135deg,#FFD700,#E8A000)", color: loading ? "#555" : "#050505", fontSize: 12.5, fontWeight: 700, cursor: loading ? "default" : "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : "Glance"}
                </button>
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
                <span style={{ fontSize: 11.5, color: "#555" }}>{loadMsg}</span>
              </div>
            </div>
          )}

          {/* Result */}
          {result && !result.notFound && (
            <div style={{ background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 17, overflow: "hidden", animation: "slideUp 0.5s cubic-bezier(0.16,1,0.3,1)" }}>
              <div style={{ padding: "24px 26px 22px" }}>
                <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
                  <div style={{ width: 130, height: 195, borderRadius: 12, overflow: "hidden", flexShrink: 0, boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)", animation: "fadeIn 0.5s both" }}>
                    <PosterCard title={result.title} year={result.year} genre={result.genre} posterUrl={result.poster} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                    {result.tagline && (
                      <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 11, fontStyle: "italic", color: "rgba(255,255,255,0.22)", marginBottom: 7, animation: "fadeIn 0.6s 0.1s both", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
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
                    <p style={{ color: "#555", fontSize: 11.5, marginBottom: 2, animation: "fadeIn 0.5s 0.2s both" }}>
                      {result.year}{result.director ? ` · ${result.director}` : ""}{result.runtime ? ` · ${result.runtime}` : ""}
                    </p>
                    {result.genre && <p style={{ color: "#3a3a3a", fontSize: 10.5, marginBottom: 8, letterSpacing: 0.7, animation: "fadeIn 0.5s 0.25s both" }}>{result.genre}</p>}
                    {result.description && <p style={{ color: "rgba(255,255,255,0.82)", fontSize: 11.5, lineHeight: 1.55, marginBottom: 14, animation: "fadeIn 0.5s 0.3s both" }}>{result.description}</p>}
                    <p style={{ fontSize: 10, letterSpacing: 1.8, color: "#FFD700", textTransform: "uppercase", fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6, animation: "fadeIn 0.5s 0.3s both", opacity: 0.85 }}>Averaged Movie Score Across Major Review Sites</p>
                    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 5, animation: "countUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.35s both" }}>
                      <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 56, fontWeight: 700, background: "linear-gradient(135deg,#FFD700,#E8A000)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>{result.score.ten}</span>
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
                          onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg,rgba(255,215,0,0.18),rgba(255,165,0,0.1))"; e.currentTarget.style.borderColor = "rgba(255,215,0,0.4)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg,rgba(255,215,0,0.1),rgba(255,165,0,0.05))"; e.currentTarget.style.borderColor = "rgba(255,215,0,0.2)"; }}
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
              <Accordion icon={<TrendingUp size={13} />} label="Source Breakdown" count={result.sources.length} open={srcOpen} toggle={() => setSrcOpen(!srcOpen)}>
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
                </div>
              </Accordion>
              )}

              {/* Video Reviews */}
              {result.video_reviews && result.video_reviews.length > 0 && (
                <Accordion icon={<Play size={13} />} label="Video Reviews" count={result.video_reviews.length} open={reviewsOpen} toggle={() => setReviewsOpen(!reviewsOpen)}>
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
                          <img src={`https://img.youtube.com/vi/${vr.video_id}/hqdefault.jpg`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                <Accordion icon={<Users size={13} />} label="Cast" count={result.cast.length} open={castOpen} toggle={() => setCastOpen(!castOpen)}>
                  <div className="castscroll" style={{ padding: "6px 18px 22px", display: "flex", gap: 6, overflowX: "auto", overflowY: "hidden" }}>
                    {result.cast.map((m, i) => <CastMember key={`${m.name}-${i}`} name={m.name} character={m.character} img={m.img} idx={i} visible={castOpen} />)}
                  </div>
                </Accordion>
              )}

              {result.boxOffice && (
                <Accordion icon={<DollarSign size={13} />} label="Production & Theatrical Run" count={null} open={boxOfficeOpen} toggle={() => setBoxOfficeOpen(!boxOfficeOpen)}>
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
                  </div>
                </Accordion>
              )}

              {result.awards && result.awards.length > 0 && (
                <Accordion icon={<Award size={13} />} label="Awards & Accolades" count={result.awards.length} open={awardsOpen} toggle={() => setAwardsOpen(!awardsOpen)}>
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
                        </div>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.4, margin: 0 }}>{a.detail}</p>
                      </div>
                    ))}
                  </div>
                </Accordion>
              )}

              {result.streaming && result.streaming.length > 0 && (
                <Accordion icon={<Tv size={13} />} label="Where to Watch" count={result.streaming.length} open={watchOpen} toggle={() => setWatchOpen(!watchOpen)}>
                  <div style={{ padding: "8px 18px 20px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {result.streaming.map((s, i) => <StreamingBadge key={`${s.platform}-${i}`} platform={s.platform} url={s.url} type={s.type} logo_path={s.logo_path} title={result.title} idx={i} visible={watchOpen} />)}
                  </div>
                </Accordion>
              )}

              {/* Similar Movies */}
              {result.recommendations && result.recommendations.length > 0 && (
                <Accordion icon={<Film size={13} />} label="You Might Also Like" count={result.recommendations.length} open={true} toggle={() => {}}>
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
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: "#4a4a4a", marginBottom: 6 }}>No results for "{result.query}"</h3>
              <p style={{ color: "#2a2a2a", fontSize: 11.5, marginBottom: 16 }}>{errMsg || "Try a different title."}</p>
              <button onClick={() => { setResult(null); setErrMsg(null); inputRef.current?.focus(); }}
                style={{ padding: "8px 20px", borderRadius: 10, border: "1px solid rgba(255,215,0,0.15)", background: "rgba(255,215,0,0.04)", color: "#FFD700", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={13} /> Try Again
              </button>
            </div>
          )}

          <footer style={{ textAlign: "center", padding: "48px 16px 24px", color: "#181818", fontSize: 10.5 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Film size={11} style={{ color: "#1e1e1e" }} />
              <span style={{ letterSpacing: 2.5, fontWeight: 600 }}>FILM GLANCE 2026</span>
            </div>
          </footer>
        </main>
      )}

      {/* Test Mode Panel */}
    </div>
  );
}
