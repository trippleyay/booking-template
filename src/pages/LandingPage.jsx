import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useConfig } from "../hooks/useConfig.jsx";
import { formatMoney, formatTime } from "../lib/format.js";

const DAY_LABELS = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

// Social icons as inline SVG to avoid icon library dep
function InstagramIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/></svg>;
}
function FacebookIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>;
}
function WhatsAppIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>;
}
function GoogleMapsIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
}
function PhoneIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.18 6.18l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
}
function MapPinIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
}
function StarIcon({ filled }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}
function ChevronRightIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
}

function relativeDate(dateStr) {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

function initials(name) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// Deterministic avatar color from name
const AVATAR_COLORS = ["#C084FC","#F59E0B","#10B981","#3B82F6","#EC4899","#8B5CF6"];
function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Hero background ───────────────────────────────────────────────────────────
// Priority: video → image → gradient. Falls through on any load failure, so a
// missing or unplayable file degrades instead of leaving the hero blank.

const FALLBACK_GRADIENT = "linear-gradient(135deg, #1C1917 0%, #44403C 100%)";

// Sits over the media so the white hero copy stays legible on any footage.
const SCRIM = "linear-gradient(105deg, rgba(15,10,5,0.72) 0%, rgba(15,10,5,0.35) 55%, rgba(15,10,5,0.1) 100%)";

const MIME_BY_EXTENSION = {
  webm: "video/webm",
  mp4: "video/mp4",
  ogv: "video/ogg",
  ogg: "video/ogg",
  mov: "video/quicktime",
};

/** Accepts a string or an array; returns [{ src, type }] for <source> elements. */
function toVideoSources(heroVideo) {
  const paths = (Array.isArray(heroVideo) ? heroVideo : [heroVideo]).filter(
    (p) => typeof p === "string" && p.trim()
  );

  return paths.map((src) => {
    const extension = src.split("?")[0].split(".").pop()?.toLowerCase();
    return { src, type: MIME_BY_EXTENSION[extension] };
  });
}

function usePrefersReducedMotion() {
  const [prefers, setPrefers] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;

    const onChange = (e) => setPrefers(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return prefers;
}

function HeroBackground({ config }) {
  const sources = useMemo(() => toVideoSources(config.heroVideo), [config.heroVideo]);
  const prefersReducedMotion = usePrefersReducedMotion();

  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const videoRef = useRef(null);

  // A new config (or a Settings edit) deserves a fresh attempt.
  useEffect(() => {
    setVideoFailed(false);
  }, [config.heroVideo]);

  useEffect(() => {
    setImageFailed(false);
  }, [config.heroImage]);

  // iOS refuses to autoplay even muted inline video while Low Power Mode is on,
  // and then draws its own play button over the element. A tap on it would be
  // swallowed by the scrim above anyway, so a refusal is treated exactly like a
  // load failure: drop the video and show the still image instead.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const attemptPlay = () => {
      video.play()?.catch?.((error) => {
        // AbortError only means a pending load interrupted this attempt, which
        // the next canplay retries. NotAllowedError is a policy refusal and
        // will not recover on its own.
        if (!cancelled && error?.name === "NotAllowedError") setVideoFailed(true);
      });
    };

    attemptPlay();
    video.addEventListener("canplay", attemptPlay);
    return () => {
      cancelled = true;
      video.removeEventListener("canplay", attemptPlay);
    };
  }, [sources]);

  const poster = config.heroPoster || config.heroImage || undefined;

  // Motion-sensitive visitors get the still image rather than autoplaying video.
  const showVideo = sources.length > 0 && !videoFailed && !prefersReducedMotion;
  const showImage = !showVideo && Boolean(config.heroImage) && !imageFailed;

  return (
    <div className="absolute inset-0" style={{ background: FALLBACK_GRADIENT }}>
      {showVideo && (
        <video
          // Remount on source change so the browser re-runs resource selection
          // instead of holding on to the previously failed list.
          key={sources.map((s) => s.src).join("|")}
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          controls={false}
          // "metadata" can leave too little buffered for autoplay to start on a
          // cold connection; the hero clip is small enough to fetch outright.
          preload="auto"
          poster={poster}
          aria-hidden="true"
          tabIndex={-1}
          className="w-full h-full object-cover pointer-events-none"
          // Fires once every candidate source has failed.
          onError={() => setVideoFailed(true)}
        >
          {sources.map(({ src, type }) => (
            <source key={src} src={src} type={type} />
          ))}
        </video>
      )}

      {showImage && (
        <img
          src={config.heroImage}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImageFailed(true)}
        />
      )}

      <div className="absolute inset-0" style={{ background: SCRIM }} />
    </div>
  );
}

export default function LandingPage() {
  const { config } = useConfig();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [navVisible, setNavVisible] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const heroRef = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      // Wait until scrolled past 70% of the viewport height before showing nav
      setNavVisible(window.scrollY > window.innerHeight * 0.7);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hide navbar CTA while hero CTA is visible
  useEffect(() => {
    if (!heroRef.current) return;
    const obs = new IntersectionObserver(([e]) => setHeroVisible(e.isIntersecting), { threshold: 0.2 });
    obs.observe(heroRef.current);
    return () => obs.disconnect();
  }, []);

  if (!config) return null;

  return (
    <div style={{ background: "var(--background)", color: "var(--text)" }}>

      {/* ── Scroll-reveal fixed nav ── */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-3 transition-all duration-500"
        style={{ transform: navVisible ? 'translateY(0)' : 'translateY(-150%)', pointerEvents: navVisible ? 'auto' : 'none' }}
      >
        <nav
          className="w-full max-w-5xl flex items-center justify-between px-5 py-3 transition-all duration-300"
          style={{
            background: scrolled ? "var(--nav-bg)" : "var(--nav-bg-idle)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            boxShadow: scrolled ? "var(--shadow-md)" : "var(--shadow-sm)",
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            {config.logo && (
              <img src={config.logo} alt={config.name} className="h-7 w-auto" onError={e => e.target.style.display="none"} />
            )}
            {config.name && (
              <span className="font-semibold text-base tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
                {config.name}
              </span>
            )}
          </div>

          {/* Right: links + CTA */}
          <div className="flex items-center gap-5">
            <div className="hidden md:flex items-center gap-5">
              {[["#services","Services"],["#gallery","Gallery"],["#reviews","Reviews"]].map(([href, label]) => (
                <a key={href} href={href} className="text-sm transition-colors hover:text-[var(--primary)]" style={{ color: "var(--text-muted)" }}>
                  {label}
                </a>
              ))}
            </div>
            <button
              onClick={() => navigate("/booking")}
              className="text-sm font-semibold text-white px-4 py-2 transition-all hover:opacity-90"
              style={{ background: "var(--primary)", borderRadius: "var(--radius)" }}
            >
              Book now
            </button>
          </div>
        </nav>
      </div>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <HeroBackground config={config} />

        <div ref={heroRef} className="relative max-w-5xl mx-auto px-6 py-28 w-full">
          <div className="max-w-xl">
            {config.address && (
              <div className="inline-flex items-center gap-1.5 mb-5 text-xs font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)" }}>
                <MapPinIcon />{config.address}
              </div>
            )}
            
            <div className="flex flex-row items-center gap-4 mb-5">
              {config.logo && (
                <img src={config.logoOnDark || config.logo} alt={config.name} className="h-12 sm:h-16 w-auto" onError={e => e.target.style.display="none"} />
              )}
              {config.name && (
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.05]" style={{ fontFamily: "var(--font-heading)" }}>
                  {config.name}
                </h1>
              )}
            </div>

            <p className="text-lg sm:text-xl mb-10 leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>
              {config.tagline}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/booking")}
                className="inline-flex items-center gap-2 px-7 py-3.5 text-white text-sm font-semibold transition-all hover:opacity-90 hover:scale-[1.02] shadow-lg"
                style={{ background: "var(--primary)", borderRadius: "var(--radius)" }}
              >
                Book an appointment <ChevronRightIcon />
              </button>
              <a
                href="#services"
                className="inline-flex items-center px-7 py-3.5 text-white text-sm font-medium border border-white/25 hover:bg-white/10 transition-colors"
                style={{ borderRadius: "var(--radius)" }}
              >
                See services
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section id="services" className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--primary)" }}>What we offer</p>
              <h2 className="text-4xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Our services</h2>
            </div>
            <button
              onClick={() => navigate("/booking")}
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70"
              style={{ color: "var(--primary)" }}
            >
              Book now <ChevronRightIcon />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {config.services.map((service, i) => {
              const deposit = Math.round(service.price * (config.depositPercent / 100));
              const isFeatured = i === 0; // first service gets elevated treatment
              return (
                <button
                  key={service.id}
                  onClick={() => navigate(`/booking?service=${service.id}`)}
                  className="group text-left p-6 border transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    borderColor: isFeatured ? "var(--primary)" : "var(--border)",
                    borderRadius: "var(--radius)",
                    background: isFeatured ? "var(--secondary)" : "var(--surface)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = "var(--shadow-md)"}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = "var(--shadow-sm)"}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-base font-semibold leading-snug pr-2" style={{ fontFamily: "var(--font-heading)" }}>{service.name}</h3>
                    <span className="text-lg font-bold flex-shrink-0" style={{ color: "var(--primary)" }}>
                      {formatMoney(service.price, config.currency)}
                    </span>
                  </div>
                  <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                    {service.duration} min &nbsp;·&nbsp; {formatMoney(deposit, config.currency)} deposit
                  </p>
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium transition-all opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0"
                    style={{ color: "var(--primary)" }}
                  >
                    Book this <ChevronRightIcon />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── About + Hours ── */}
      <section className="py-24 border-y" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="max-w-5xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--primary)" }}>About us</p>
            <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: "var(--font-heading)" }}>
              We care about every detail
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: "var(--text-muted)" }}>
              {config.description}
            </p>
            <div className="space-y-2.5">
              {config.phone && (
                <a href={`tel:${config.phone}`} className="flex items-center gap-2.5 text-sm hover:text-[var(--primary)] transition-colors" style={{ color: "var(--text-muted)" }}>
                  <PhoneIcon />{config.phone}
                </a>
              )}
              {config.address && (
                <div className="flex items-center gap-2.5 text-sm" style={{ color: "var(--text-muted)" }}>
                  <MapPinIcon />{config.address}
                </div>
              )}
            </div>
          </div>

          <div
            className="p-7 border"
            style={{ borderColor: "var(--border)", borderRadius: "var(--radius)", background: "var(--background)", boxShadow: "var(--shadow-sm)" }}
          >
            <h3 className="text-xl font-bold mb-6" style={{ fontFamily: "var(--font-heading)" }}>Opening hours</h3>
            <div className="space-y-2">
              {Object.entries(config.hours).map(([day, hours]) => {
                const isToday = ["sun","mon","tue","wed","thu","fri","sat"][new Date().getDay()] === day;
                return (
                  <div
                    key={day}
                    className="flex justify-between items-center py-2 px-3 rounded-lg text-sm"
                    style={{
                      background: isToday ? "var(--secondary)" : "transparent",
                      borderRadius: "8px",
                    }}
                  >
                    <span className="font-medium" style={{ color: isToday ? "var(--primary)" : "var(--text)" }}>
                      {DAY_LABELS[day]}{isToday && <span className="ml-1.5 text-xs font-normal opacity-70">Today</span>}
                    </span>
                    {hours ? (
                      <span style={{ color: "var(--text-muted)" }}>
                        {formatTime(hours.open)} – {formatTime(hours.close)}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Gallery ── */}
      {config.gallery?.length > 0 && (
        <section id="gallery" className="py-24">
          <div className="max-w-5xl mx-auto px-6">
            <div className="mb-12">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--primary)" }}>Our work</p>
              <h2 className="text-4xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Gallery</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {config.gallery.map((src, i) => (
                <div
                  key={i}
                  className="overflow-hidden"
                  style={{
                    borderRadius: "var(--radius)",
                    aspectRatio: i === 0 ? "1/1" : i === 3 ? "2/1" : "1/1",
                    gridColumn: i === 3 ? "span 2" : undefined,
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <img
                    src={src}
                    alt={`Gallery ${i + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    onError={e => {
                      e.target.parentElement.style.background = "var(--surface)";
                      e.target.style.display = "none";
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Reviews ── */}
      {config.reviews?.length > 0 && (
        <section id="reviews" className="py-24 border-t" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex items-end justify-between mb-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--primary)" }}>What clients say</p>
                <h2 className="text-4xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Reviews</h2>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
                <StarIcon filled />
                <span className="font-semibold" style={{ color: "var(--text)" }}>
                  {(config.reviews.reduce((s,r) => s + r.rating, 0) / config.reviews.length).toFixed(1)}
                </span>
                <span>({config.reviews.length} reviews)</span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {config.reviews.map((review, i) => (
                <div
                  key={i}
                  className="p-6 border flex flex-col"
                  style={{
                    borderColor: "var(--border)",
                    borderRadius: "var(--radius)",
                    background: "var(--background)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div className="flex gap-0.5 mb-4" style={{ color: "var(--primary)" }}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <StarIcon key={j} filled={j < review.rating} />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed flex-1 mb-5" style={{ color: "var(--text-muted)" }}>
                    "{review.text}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: avatarColor(review.name) }}
                    >
                      {initials(review.name)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{review.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{relativeDate(review.date)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA banner ── */}
      <section className="py-24" style={{ background: "var(--primary)" }}>
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>
              Ready to book your appointment?
            </h2>
            <p className="text-white/70 mt-2 text-sm">A small deposit holds your slot. Pay the rest on the day.</p>
          </div>
          <button
            onClick={() => navigate("/booking")}
            className="flex-shrink-0 px-8 py-3.5 text-sm font-semibold bg-white hover:bg-white/90 transition-colors whitespace-nowrap"
            style={{ color: "var(--primary)", borderRadius: "var(--radius)" }}
          >
            Book an appointment
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-14 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid sm:grid-cols-3 gap-10 mb-10">
            {/* Brand */}
            <div>
              <p className="font-bold text-lg mb-2" style={{ fontFamily: "var(--font-heading)" }}>{config.name}</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{config.tagline}</p>
              {/* Social icons */}
              <div className="flex gap-3 mt-4">
                {config.socials?.instagram && (
                  <a href={config.socials.instagram} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                    <InstagramIcon />
                  </a>
                )}
                {config.socials?.facebook && (
                  <a href={config.socials.facebook} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                    <FacebookIcon />
                  </a>
                )}
                {config.socials?.whatsapp && (
                  <a href={`https://wa.me/${config.socials.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                    <WhatsAppIcon />
                  </a>
                )}
                {config.socials?.googleMaps && (
                  <a href={config.socials.googleMaps} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                    <GoogleMapsIcon />
                  </a>
                )}
              </div>
            </div>

            {/* Quick links */}
            <div>
              <p className="text-base font-semibold mb-4" style={{ fontFamily: "var(--font-heading)" }}>Explore</p>
              <div className="space-y-2">
                {[["#services","Services"],["#gallery","Gallery"],["#reviews","Reviews"]].map(([href, label]) => (
                  <a key={href} href={href} className="block text-sm hover:text-[var(--primary)] transition-colors" style={{ color: "var(--text-muted)" }}>{label}</a>
                ))}
                <button onClick={() => navigate("/booking")} className="block text-sm hover:text-[var(--primary)] transition-colors" style={{ color: "var(--text-muted)" }}>
                  Book appointment
                </button>
              </div>
            </div>

            {/* Contact + Hours */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>Contact</p>
              <div className="space-y-2.5 text-sm" style={{ color: "var(--text-muted)" }}>
                {config.address && (
                  <div className="flex items-start gap-2"><MapPinIcon /><span>{config.address}</span></div>
                )}
                {config.phone && (
                  <a href={`tel:${config.phone}`} className="flex items-center gap-2 hover:text-[var(--primary)] transition-colors"><PhoneIcon />{config.phone}</a>
                )}
                {config.email && (
                  <a href={`mailto:${config.email}`} className="block hover:text-[var(--primary)] transition-colors">{config.email}</a>
                )}
              </div>
            </div>
          </div>

          <div className="pt-8 border-t text-center text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            <span>© {new Date().getFullYear()} {config.name}. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}