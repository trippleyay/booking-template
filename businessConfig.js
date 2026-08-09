// ============================================================
// BUSINESS CONFIG — the only file you need to edit to rebrand
// ============================================================
// After forking: fill in your details, drop your images and video
// into /public/assets/, and set your environment variables in .env
//
// Values here are defaults. Anything the owner later changes in the
// admin Settings screen is stored in the database and wins over this
// file at runtime — see server/services/config.js.
// ============================================================

export const businessConfig = {
  // --- Identity ---
  name: "Lumé Studio",
  tagline: "Look good. Feel great.",
  description:
    "A boutique hair and beauty studio in the heart of the city. We believe great hair is the ultimate accessory.",
  // --- Logos ---
  // Two files, because a single colour can't sit on both the dark hero and
  // the light nav bar. `logo` is the default, used on light surfaces such as
  // the nav; `logoOnDark` is used over the hero media. Either may be left
  // empty — each falls back to the other, and both falling back leaves just
  // the business name as text.
  logo: "/assets/logo.svg",
  logoOnDark: "/assets/logo-on-dark.svg",

  // --- Hero background ---
  // heroVideo takes priority over heroImage. If the video fails to load or
  // the browser can't play the format, it falls back to heroImage; if that
  // is missing too, a gradient is used. Any of these may be left empty.
  //
  // Accepts one path or several for format fallback:
  //   heroVideo: "/assets/hero.webm"
  //   heroVideo: ["/assets/hero.webm", "/assets/hero.mp4"]
  //
  // Keep it short, silent and heavily compressed — it autoplays muted, and
  // mobile browsers refuse to autoplay anything else. Under ~3MB is sensible.
  heroVideo: ["/assets/hero.webm", "/assets/hero.mp4"],
  heroImage: "/assets/hero.webp",
  // Shown while the video buffers, and to anyone who prefers reduced motion.
  heroPoster: "/assets/hero.webp",

  phone: "+1 (555) 012-3456",
  email: "hello@lumestudio.com",
  address: "123 Main Street, Suite 4, New York, NY 10001",

  // --- Timezone ---
  // IANA name. Decides what "today" means and which slots have already
  // passed — without it the server would use the host clock, which on a
  // deployed container is UTC.
  timezone: "America/New_York",

  // --- Theme (applied as CSS variables at runtime) ---
  // For a dark site, set dark background/surface/text values here — the whole
  // UI is driven from these variables, so no other change is needed.
  theme: {
    primary: "#C084FC",       // buttons, accents
    secondary: "#F3E8FF",     // backgrounds, chips
    accent: "#7C3AED",        // hover states, highlights
    background: "#FFFFFF",
    surface: "#FAFAFA",       // card backgrounds
    text: "#1A1A1A",
    textMuted: "#6B7280",
    border: "#E5E7EB",
    font: {
      heading: "Playfair Display",
      body: "Inter",
    },
    borderRadius: "12px",     // applied globally as --radius
  },

  // --- Services ---
  // duration in minutes, price in cents (avoids float issues)
  services: [
    { id: "haircut",     name: "Haircut & Style",    duration: 45,  price: 3500 },
    { id: "color",       name: "Color Treatment",    duration: 90,  price: 8500 },
    { id: "highlights",  name: "Highlights",         duration: 120, price: 12000 },
    { id: "blowout",     name: "Blowout",            duration: 30,  price: 2500 },
    { id: "treatment",   name: "Deep Treatment",     duration: 60,  price: 5500 },
  ],

  // --- Weekly hours ---
  // Set a day to null to mark it as closed
  hours: {
    mon: { open: "09:00", close: "18:00" },
    tue: { open: "09:00", close: "18:00" },
    wed: { open: "09:00", close: "18:00" },
    thu: { open: "09:00", close: "20:00" },
    fri: { open: "09:00", close: "18:00" },
    sat: { open: "10:00", close: "16:00" },
    sun: null,
  },

  // Slot interval in minutes — how often time slots are offered
  slotInterval: 15,

  // --- Booking settings ---
  currency: "USD",
  depositPercent: 30,           // % of service price charged at booking
  cancellationHours: 24,        // min hours notice required to cancel
  minimumNoticeHours: 1,        // how far ahead the next bookable slot is; 0 disables

  // --- Social links (leave empty string to hide) ---
  socials: {
    instagram: "https://instagram.com/lumestudio",
    facebook: "https://facebook.com/lumestudio",
    whatsapp: "+15550123456",
    googleMaps: "https://maps.google.com/?q=123+Main+Street+New+York+NY",
  },

  // --- Gallery images (paths relative to /public) ---
  gallery: [
    "/assets/gallery1.webp",
    "/assets/gallery2.webp",
    "/assets/gallery3.webp",
    "/assets/gallery4.webp",
    "/assets/gallery5.webp",
    "/assets/gallery6.webp",
  ],

  // --- Reviews (static — replace with your real ones) ---
  reviews: [
    {
      name: "Sarah M.",
      rating: 5,
      text: "Best highlights I've ever had. The color is exactly what I asked for and the team made me feel so comfortable.",
      date: "2026-05-12",
    },
    {
      name: "James O.",
      rating: 5,
      text: "Came in for a cut and left looking like a completely different person. Highly recommend.",
      date: "2026-05-03",
    },
    {
      name: "Priya K.",
      rating: 5,
      text: "The deep treatment saved my hair. It was so damaged and now it's incredibly soft. Worth every penny.",
      date: "2026-04-28",
    },
  ],
};
