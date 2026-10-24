/*
 * format.js
 * Unit conversion and text formatting shared by the UI and the report.
 * All raw values are metric (°C, km/h, mm, hPa) straight from Open-Meteo.
 */

export const DEFAULT_SETTINGS = {
  tempUnit: "C",      // "C" | "F"
  windUnit: "kmh",    // "kmh" | "mph" | "ms"
  timeFormat: "12"    // "12" | "24"
};

/* ---------- numbers & units ---------- */

export function toTemp(celsius, settings) {
  if (celsius == null || Number.isNaN(celsius)) return null;
  return settings.tempUnit === "F" ? celsius * 9 / 5 + 32 : celsius;
}

// "29°"  (short, for big numbers and lists)
export function temp(celsius, settings) {
  const t = toTemp(celsius, settings);
  return t == null ? "--" : `${Math.round(t)}°`;
}

// "29°C" (with unit, for sentences)
export function tempWithUnit(celsius, settings) {
  const t = toTemp(celsius, settings);
  return t == null ? "--" : `${Math.round(t)}°${settings.tempUnit}`;
}

export function wind(kmh, settings) {
  if (kmh == null) return "--";
  if (settings.windUnit === "mph") return `${Math.round(kmh * 0.621371)} mph`;
  if (settings.windUnit === "ms") return `${Math.round(kmh / 3.6)} m/s`;
  return `${Math.round(kmh)} km/h`;
}

// Number only, in the chosen unit (for compact labels like "gusts 26").
export function windNumber(kmh, settings) {
  if (kmh == null) return "--";
  if (settings.windUnit === "mph") return String(Math.round(kmh * 0.621371));
  if (settings.windUnit === "ms") return String(Math.round(kmh / 3.6));
  return String(Math.round(kmh));
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

export function compass(degrees) {
  if (degrees == null) return "";
  return COMPASS[Math.round(((degrees % 360) / 22.5)) % 16];
}

/* ---------- how it feels ---------- */

// Based on the "feels like" temperature in °C.
const FEEL_LEVELS = [
  { min: 40, label: "Very hot", tone: "very-hot" },
  { min: 33, label: "Hot", tone: "hot" },
  { min: 26, label: "Warm", tone: "warm" },
  { min: 18, label: "Pleasant", tone: "pleasant" },
  { min: 10, label: "Cool", tone: "cool" },
  { min: 0, label: "Cold", tone: "cold" },
  { min: -Infinity, label: "Freezing", tone: "freezing" }
];

export function feelLevel(feelsLikeC) {
  // Round first so the label always agrees with the number shown on screen.
  const value = Math.round(feelsLikeC);
  return FEEL_LEVELS.find((level) => value >= level.min);
}

/* ---------- air quality (US AQI scale) ---------- */

const AQI_LEVELS = [
  { max: 50, label: "Good", tone: "good" },
  { max: 100, label: "Moderate", tone: "moderate" },
  { max: 150, label: "Unhealthy for sensitive groups", short: "Sensitive", tone: "sensitive" },
  { max: 200, label: "Unhealthy", tone: "unhealthy" },
  { max: 300, label: "Very unhealthy", tone: "very-unhealthy" },
  { max: Infinity, label: "Hazardous", tone: "hazardous" }
];

export function aqiLevel(aqi) {
  if (aqi == null) return null;
  return AQI_LEVELS.find((level) => aqi <= level.max);
}

export function uvLabel(uv) {
  if (uv == null) return "";
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

/* ---------- dates & times ----------
 * Open-Meteo returns local times for the place as plain strings
 * ("2026-10-24T15:45"), so we read the digits directly instead of
 * converting through the browser's own time zone.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dateParts(isoDate) {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return { y, m, d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

export function clock(isoDateTime, settings) {
  if (!isoDateTime) return "--";
  const [h, min] = isoDateTime.slice(11, 16).split(":").map(Number);
  const mm = String(min).padStart(2, "0");
  if (settings.timeFormat === "24") return `${String(h).padStart(2, "0")}:${mm}`;
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}:${mm} ${suffix}`;
}

// Compact hour label for the hourly strip: "4 PM" / "16:00"
export function hourLabel(isoDateTime, settings) {
  const h = Number(isoDateTime.slice(11, 13));
  if (settings.timeFormat === "24") return `${String(h).padStart(2, "0")}:00`;
  return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
}

export function weekday(isoDate, long = false) {
  const { weekday: wd } = dateParts(isoDate);
  return long ? WEEKDAYS_LONG[wd] : WEEKDAYS[wd];
}

// "Sat, 24 Oct"
export function shortDate(isoDate) {
  const { d, m, weekday: wd } = dateParts(isoDate);
  return `${WEEKDAYS[wd]}, ${d} ${MONTHS[m - 1]}`;
}

export function duration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/**
 * The current wall-clock time at the place, as "YYYY-MM-DDTHH:MM"
 * (same shape as Open-Meteo's own timestamps, so they compare as strings).
 */
export function localNow(timezone, utcOffsetSeconds = 0) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type).value;
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  } catch {
    // Unknown zone name: fall back to the numeric offset from the API.
    return new Date(Date.now() + utcOffsetSeconds * 1000).toISOString().slice(0, 16);
  }
}

// "just now", "5 min ago", "2 h ago" — used for the "updated" note.
export function timeAgo(timestamp) {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

// Stops place names (which come from the network) being read as HTML.
export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}
