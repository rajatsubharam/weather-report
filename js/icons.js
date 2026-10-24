/*
 * icons.js
 * A small hand-drawn set of flat SVG icons, bundled as strings so the popup
 * needs no image requests and no third-party icon font.
 *
 *  - weatherIcon(code, isDay) returns a coloured weather illustration (64x64 grid)
 *  - uiIcon(name) returns a monoline interface icon that inherits currentColor
 */

const SUN = "#fbbf24";
const MOON = "#e2e8f0";
const CLOUD = "#cbd5e1";
const CLOUD_DARK = "#94a3b8";
const STORM_CLOUD = "#64748b";
const RAIN = "#38bdf8";
const SNOW = "#e0f2fe";
const BOLT = "#facc15";

/* ---------- building blocks (all drawn on a 64 x 64 grid) ---------- */

function sun(cx, cy, r) {
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    const x1 = cx + Math.cos(a) * (r + 4);
    const y1 = cy + Math.sin(a) * (r + 4);
    const x2 = cx + Math.cos(a) * (r + 9);
    const y2 = cy + Math.sin(a) * (r + 9);
    rays.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`);
  }
  return `<g stroke="${SUN}" stroke-width="3.5" stroke-linecap="round">${rays.join("")}</g>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${SUN}"/>`;
}

// Crescent moon: a circle with a second circle cut out of it.
function moon(cx, cy, r) {
  const cut = r * 0.78;
  return `<path fill="${MOON}" d="M${cx + r * 0.25} ${cy - r}` +
    `A${r} ${r} 0 1 0 ${cx + r} ${cy + r * 0.35}` +
    `A${cut} ${cut} 0 0 1 ${cx + r * 0.25} ${cy - r}Z"/>`;
}

// Puffy cloud outline, positioned with a translate + scale.
function cloud(x, y, s, fill) {
  return `<path transform="translate(${x} ${y}) scale(${s})" fill="${fill}" ` +
    `d="M14 34h24a9 9 0 0 0 1.4-17.9A13 13 0 0 0 14.4 13 10.5 10.5 0 0 0 14 34Z"/>`;
}

function rainLines(count, color = RAIN) {
  const xs = { 2: [26, 38], 3: [22, 32, 42], 4: [19, 27, 35, 43] }[count];
  return `<g stroke="${color}" stroke-width="3.5" stroke-linecap="round">` +
    xs.map((x) => `<line x1="${x}" y1="47" x2="${x - 4}" y2="57"/>`).join("") + `</g>`;
}

function drizzleDots() {
  return `<g fill="${RAIN}">` +
    [[22, 50], [32, 54], [42, 50], [27, 58], [37, 58]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2"/>`).join("") + `</g>`;
}

function snowFlakes() {
  return `<g fill="${SNOW}">` +
    [[22, 50], [32, 55], [42, 50], [27, 59], [37, 59]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.8"/>`).join("") + `</g>`;
}

function sleet() {
  return `<g stroke="${RAIN}" stroke-width="3.5" stroke-linecap="round">` +
    `<line x1="24" y1="47" x2="20" y2="56"/><line x1="40" y1="47" x2="36" y2="56"/></g>` +
    `<g fill="${SNOW}"><circle cx="31" cy="53" r="2.8"/><circle cx="46" cy="56" r="2.6"/></g>`;
}

function fogLines() {
  return `<g stroke="${CLOUD_DARK}" stroke-width="3.5" stroke-linecap="round">` +
    `<line x1="12" y1="48" x2="52" y2="48"/><line x1="18" y1="55" x2="46" y2="55"/></g>`;
}

const bolt = `<path fill="${BOLT}" d="M34 40h-8l-4 11h6l-3 11 12-15h-7l4-7Z"/>`;

function svg(body, label) {
  return `<svg viewBox="0 0 64 64" role="img" aria-label="${label}" focusable="false">${body}</svg>`;
}

/* ---------- WMO weather codes ---------- */

// Open-Meteo reports conditions as WMO 4677 codes.
// Each entry: [plain description, icon kind]
const CODES = {
  0: ["Clear sky", "clear"],
  1: ["Mainly clear", "mostly-clear"],
  2: ["Partly cloudy", "partly"],
  3: ["Overcast", "overcast"],
  45: ["Fog", "fog"],
  48: ["Freezing fog", "fog"],
  51: ["Light drizzle", "drizzle"],
  53: ["Drizzle", "drizzle"],
  55: ["Heavy drizzle", "drizzle"],
  56: ["Freezing drizzle", "sleet"],
  57: ["Freezing drizzle", "sleet"],
  61: ["Light rain", "rain"],
  63: ["Rain", "rain"],
  65: ["Heavy rain", "heavy-rain"],
  66: ["Freezing rain", "sleet"],
  67: ["Heavy freezing rain", "sleet"],
  71: ["Light snow", "snow"],
  73: ["Snow", "snow"],
  75: ["Heavy snow", "snow"],
  77: ["Snow grains", "snow"],
  80: ["Light showers", "showers"],
  81: ["Showers", "showers"],
  82: ["Heavy showers", "heavy-rain"],
  85: ["Snow showers", "snow"],
  86: ["Heavy snow showers", "snow"],
  95: ["Thunderstorm", "thunder"],
  96: ["Thunderstorm with hail", "thunder"],
  99: ["Thunderstorm with hail", "thunder"]
};

export function describeCode(code) {
  return (CODES[code] || ["Unknown", "overcast"])[0];
}

export function iconKind(code) {
  return (CODES[code] || ["Unknown", "overcast"])[1];
}

export function weatherIcon(code, isDay = true) {
  const kind = iconKind(code);
  const label = describeCode(code);
  const sky = isDay ? sun(22, 22, 9) : moon(22, 22, 11);

  switch (kind) {
    case "clear":
      return svg(isDay ? sun(32, 32, 12) : moon(32, 32, 17), label);
    case "mostly-clear":
      return svg((isDay ? sun(28, 28, 11) : moon(28, 28, 15)) + cloud(22, 22, 0.85, CLOUD), label);
    case "partly":
      return svg(sky + cloud(10, 14, 1.05, CLOUD), label);
    case "overcast":
      return svg(cloud(14, 4, 0.9, CLOUD_DARK) + cloud(4, 14, 1.1, CLOUD), label);
    case "fog":
      return svg(cloud(6, 2, 1.05, CLOUD) + fogLines(), label);
    case "drizzle":
      return svg(cloud(6, 4, 1.05, CLOUD) + drizzleDots(), label);
    case "rain":
      return svg(cloud(6, 4, 1.05, CLOUD) + rainLines(3), label);
    case "heavy-rain":
      return svg(cloud(6, 4, 1.05, CLOUD_DARK) + rainLines(4), label);
    case "showers":
      return svg(sky + cloud(10, 10, 1.0, CLOUD) + rainLines(2), label);
    case "snow":
      return svg(cloud(6, 4, 1.05, CLOUD) + snowFlakes(), label);
    case "sleet":
      return svg(cloud(6, 4, 1.05, CLOUD) + sleet(), label);
    case "thunder":
      return svg(cloud(6, 2, 1.05, STORM_CLOUD) + bolt, label);
    default:
      return svg(cloud(6, 10, 1.05, CLOUD), label);
  }
}

/* ---------- small sun / moon badge for the day-night indicator ---------- */

export function dayNightIcon(isDay) {
  return isDay
    ? svg(sun(32, 32, 13), "Daytime")
    : svg(moon(32, 32, 19), "Night-time");
}

/* ---------- interface icons (24 x 24, stroke = currentColor) ---------- */

const UI = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  locate: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  droplet: '<path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z"/>',
  wind: '<path d="M3 9h11a3 3 0 1 0-3-3"/><path d="M3 15h15a3 3 0 1 1-3 3"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19c3-4 6-6 9-7.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  gauge: '<path d="M4.5 17a8.5 8.5 0 1 1 15 0"/><path d="m12 13 3.5-4"/><circle cx="12" cy="13" r="1.2" fill="currentColor"/>',
  umbrella: '<path d="M3 12a9 9 0 0 1 18 0Z"/><path d="M12 12v6.5a2 2 0 0 1-4 0"/>',
  sunrise: '<path d="M3.5 19h17M6.5 19a5.5 5.5 0 0 1 11 0"/><path d="M12 2.5v6M9.5 5 12 2.5 14.5 5"/>',
  sunset: '<path d="M3.5 19h17M6.5 19a5.5 5.5 0 0 1 11 0"/><path d="M12 2.5v6M9.5 6 12 8.5 14.5 6"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  offline: '<path d="M2.5 8.5a14 14 0 0 1 19 0M6 12a9 9 0 0 1 12 0M9.5 15.5a4 4 0 0 1 5 0"/><path d="m3 3 18 18"/>',
  pin: '<path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 0 0-13 0c0 5 6.5 11 6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'
};

export function uiIcon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${UI[name] || ""}</svg>`;
}

/* ---------- the app logo (same artwork as the toolbar icon) ---------- */

export const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">` +
  `<rect width="64" height="64" rx="14" fill="#1e293b"/>` +
  `<circle cx="25" cy="25" r="10" fill="#38bdf8"/>` +
  `<path fill="#e2e8f0" d="M22 48h22a8 8 0 0 0 1.2-15.9A11.5 11.5 0 0 0 23.3 30 9 9 0 0 0 22 48Z"/>` +
  `</svg>`;
