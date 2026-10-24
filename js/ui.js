/*
 * ui.js
 * Rendering only: takes the stored weather data + settings and fills the popup.
 * No network or storage calls in here.
 */

import { weatherIcon, dayNightIcon, uiIcon, describeCode } from "./icons.js";
import {
  temp, wind, windNumber, compass, feelLevel, aqiLevel, uvLabel,
  clock, hourLabel, weekday, shortDate, duration, localNow, escapeHTML
} from "./format.js";
import { buildTomorrowReport } from "./report.js";

const $ = (id) => document.getElementById(id);

/* ---------- working out "now" at the place ---------- */

/**
 * Everything the views need to know about the current moment at the place.
 * Uses the place's own clock (not the computer's), so New York shows night
 * while it's afternoon in Kolkata.
 */
export function getMoment(forecast) {
  const now = localNow(forecast.timezone, forecast.utc_offset_seconds);
  const today = now.slice(0, 10);
  const { daily, hourly } = forecast;

  let dayIndex = daily.time.indexOf(today);
  if (dayIndex === -1) dayIndex = today < daily.time[0] ? 0 : daily.time.length - 1;

  // Day or night from today's sunrise/sunset; fall back to the API's is_day flag.
  const sunrise = daily.sunrise[dayIndex];
  const sunset = daily.sunset[dayIndex];
  let isDay = forecast.current.is_day === 1;
  if (sunrise && sunset && sunrise.startsWith(today)) {
    isDay = now >= sunrise && now < sunset;
  }

  // First hourly slot at or after the current hour.
  const currentHour = now.slice(0, 13);
  let hourIndex = hourly.time.findIndex((t) => t.slice(0, 13) >= currentHour);
  if (hourIndex === -1) hourIndex = hourly.time.length - 1;

  return { now, today, dayIndex, isDay, hourIndex, sunrise, sunset };
}

/* ---------- current conditions ---------- */

export function renderCurrent(weather, place, settings, moment) {
  const { current, daily } = weather.forecast;
  const level = feelLevel(current.apparent_temperature);
  const subtitle = [place.region, place.country].filter(Boolean)
    .filter((v, i, list) => list.indexOf(v) === i && v !== place.name).join(", ");
  const coords = `${Math.abs(place.latitude).toFixed(2)}°${place.latitude >= 0 ? "N" : "S"}, ` +
    `${Math.abs(place.longitude).toFixed(2)}°${place.longitude >= 0 ? "E" : "W"}`;

  $("current").innerHTML = `
    <div class="current-top">
      <div class="place">
        <h2 class="place-name" title="${escapeHTML(place.name)}">${escapeHTML(place.name)}</h2>
        <p class="place-sub">${escapeHTML(subtitle || coords)}</p>
      </div>
      <div class="local-time" title="${moment.isDay ? "Daytime" : "Night-time"} at this place">
        <span class="daynight ${moment.isDay ? "is-day" : "is-night"}">${dayNightIcon(moment.isDay)}</span>
        <span>
          <b>${clock(moment.now, settings)}</b>
          <small>${shortDate(moment.today)}</small>
        </span>
      </div>
    </div>

    <div class="current-main">
      <div class="current-icon">${weatherIcon(current.weather_code, moment.isDay)}</div>
      <div class="current-temp">${temp(current.temperature_2m, settings)}<span>${settings.tempUnit}</span></div>
      <div class="current-text">
        <p class="condition">${describeCode(current.weather_code)}</p>
        <p class="feels">Feels like ${temp(current.apparent_temperature, settings)}
          <span class="chip feel-${level.tone}">${level.label}</span></p>
        <p class="hilo">H ${temp(daily.temperature_2m_max[moment.dayIndex], settings)} · L ${temp(daily.temperature_2m_min[moment.dayIndex], settings)}</p>
      </div>
    </div>`;
}

/* ---------- Today tab: details, sun times, hourly strip ---------- */

function stat(icon, label, value, extra = "", extraClass = "") {
  return `
    <div class="stat">
      <span class="stat-label">${uiIcon(icon)}${label}</span>
      <b>${value}</b>
      <small class="${extraClass}">${extra}</small>
    </div>`;
}

function sunProgress(moment) {
  if (!moment.sunrise || !moment.sunset) return 0;
  const toMin = (iso) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
  const rise = toMin(moment.sunrise);
  const set = toMin(moment.sunset);
  const now = toMin(moment.now);
  if (set <= rise) return 0;
  return Math.min(1, Math.max(0, (now - rise) / (set - rise)));
}

export function renderToday(weather, settings, moment) {
  const { current, daily, hourly } = weather.forecast;
  const air = weather.air && weather.air.current;
  const d = moment.dayIndex;

  const aqi = air && air.us_aqi != null ? Math.round(air.us_aqi) : null;
  const aqiInfo = aqiLevel(aqi);
  const uv = daily.uv_index_max[d];
  const rainChance = daily.precipitation_probability_max[d];

  const stats = [
    stat("droplet", "Humidity", `${current.relative_humidity_2m}%`,
      `Clouds ${current.cloud_cover}%`),
    stat("wind", "Wind", wind(current.wind_speed_10m, settings),
      `${compass(current.wind_direction_10m)} · gusts ${windNumber(current.wind_gusts_10m, settings)}`),
    stat("leaf", "Air quality", aqi == null ? "--" : `${aqi}`,
      aqiInfo ? (aqiInfo.short || aqiInfo.label) : "Not available", aqiInfo ? `aqi-${aqiInfo.tone}` : ""),
    stat("sun", "UV index", uv == null ? "--" : uv.toFixed(1).replace(/\.0$/, ""), uvLabel(uv)),
    stat("gauge", "Pressure", `${Math.round(current.pressure_msl)}`, "hPa"),
    stat("umbrella", "Rain today", rainChance == null ? "--" : `${rainChance}%`,
      `${(daily.precipitation_sum[d] ?? 0).toFixed(1)} mm`)
  ].join("");

  // 24 hours starting from now (runs into tomorrow).
  const hours = [];
  for (let i = moment.hourIndex; i < Math.min(hourly.time.length, moment.hourIndex + 24); i++) {
    const t = hourly.time[i];
    const isNow = i === moment.hourIndex;
    const label = isNow ? "Now" : t.slice(11, 13) === "00" ? weekday(t) : hourLabel(t, settings);
    const rain = hourly.precipitation_probability[i];
    hours.push(`
      <li class="hour${isNow ? " now" : ""}${t.slice(11, 13) === "00" ? " midnight" : ""}">
        <span class="hour-time">${label}</span>
        <span class="hour-icon">${weatherIcon(hourly.weather_code[i], hourly.is_day[i] === 1)}</span>
        <b>${temp(hourly.temperature_2m[i], settings)}</b>
        <small class="hour-rain">${rain != null && rain >= 20 ? `${rain}%` : ""}</small>
      </li>`);
  }

  const progress = sunProgress(moment);

  $("panel-today").innerHTML = `
    <div class="stats">${stats}</div>

    <div class="sun-row" title="Daylight ${duration(daily.daylight_duration[d])}">
      <span class="sun-time">${uiIcon("sunrise")}<span><small>Sunrise</small><b>${clock(daily.sunrise[d], settings)}</b></span></span>
      <span class="sun-track" aria-hidden="true">
        <span class="sun-fill" style="width:${(progress * 100).toFixed(1)}%"></span>
        <span class="sun-dot${moment.isDay ? "" : " set"}" style="left:${(progress * 100).toFixed(1)}%"></span>
      </span>
      <span class="sun-time">${uiIcon("sunset")}<span><small>Sunset</small><b>${clock(daily.sunset[d], settings)}</b></span></span>
    </div>

    <h3 class="section-title">Next 24 hours</h3>
    <ul class="hours" aria-label="Hourly forecast">${hours.join("")}</ul>`;
}

/* ---------- 7 days tab ---------- */

export function renderWeek(weather, settings, moment) {
  const { daily } = weather.forecast;
  const days = daily.time.slice(moment.dayIndex);
  const offset = moment.dayIndex;

  // Shared scale for the little temperature range bars.
  const lows = days.map((_, i) => daily.temperature_2m_min[i + offset]);
  const highs = days.map((_, i) => daily.temperature_2m_max[i + offset]);
  const weekMin = Math.min(...lows);
  const weekMax = Math.max(...highs);
  const span = Math.max(1, weekMax - weekMin);

  const rows = days.map((date, n) => {
    const i = n + offset;
    const name = n === 0 ? "Today" : n === 1 ? "Tomorrow" : weekday(date, true);
    const lo = daily.temperature_2m_min[i];
    const hi = daily.temperature_2m_max[i];
    const rain = daily.precipitation_probability_max[i];
    const left = ((lo - weekMin) / span) * 100;
    const width = Math.max(6, ((hi - lo) / span) * 100);
    return `
      <li class="day">
        <span class="day-name">${name}<small>${shortDate(date).split(", ")[1]}</small></span>
        <span class="day-icon" title="${describeCode(daily.weather_code[i])}">${weatherIcon(daily.weather_code[i], true)}</span>
        <span class="day-rain">${rain != null && rain >= 20 ? `${uiIcon("droplet")}${rain}%` : ""}</span>
        <span class="day-lo">${temp(lo, settings)}</span>
        <span class="range" aria-hidden="true"><span style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%"></span></span>
        <span class="day-hi">${temp(hi, settings)}</span>
      </li>`;
  });

  $("panel-week").innerHTML = `<ul class="days" aria-label="7-day forecast">${rows.join("")}</ul>`;
}

/* ---------- Tomorrow tab ---------- */

export function renderReport(weather, place, settings, moment) {
  const report = buildTomorrowReport(weather, place, settings, moment.dayIndex);
  const panel = $("panel-report");

  if (!report) {
    panel.innerHTML = `<p class="muted">Tomorrow's forecast isn't available yet.</p>`;
    return;
  }

  const periods = report.periods.filter((p) => p.available).map((p) => `
    <div class="period">
      <span class="period-name">${p.label}</span>
      <span class="period-icon">${p.code == null ? "" : weatherIcon(p.code, p.isDay)}</span>
      <b>${temp(p.temp, settings)}</b>
      <small>${p.rain != null && p.rain >= 20 ? `${uiIcon("droplet")}${p.rain}%` : "&nbsp;"}</small>
    </div>`).join("");

  const f = report.facts;
  const aqiInfo = aqiLevel(f.aqi);
  const facts = [
    stat("umbrella", "Rain", f.rainChance == null ? "--" : `${f.rainChance}%`, `${(f.rainSum ?? 0).toFixed(1)} mm`),
    stat("wind", "Wind", wind(f.windMax, settings), `${compass(f.windDirection)} · gusts ${windNumber(f.gusts, settings)}`),
    f.aqi != null
      ? stat("leaf", "Air quality", `${f.aqi}`, aqiInfo.short || aqiInfo.label, `aqi-${aqiInfo.tone}`)
      : stat("sun", "UV index", f.uv == null ? "--" : f.uv.toFixed(1).replace(/\.0$/, ""), uvLabel(f.uv))
  ].join("");

  panel.innerHTML = `
    <article class="report">
      <header class="report-head">
        <h3>Tomorrow's report</h3>
        <span>${weekday(report.date, true)}, ${shortDate(report.date).split(", ")[1]}</span>
      </header>
      ${report.sentences.map((s) => `<p>${escapeHTML(s)}</p>`).join("")}
    </article>
    <div class="periods">${periods}</div>
    <div class="stats report-facts">${facts}</div>`;
}

/* ---------- footer note ---------- */

export function renderUpdated(text) {
  $("updated").textContent = text;
}
