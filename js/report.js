/*
 * report.js
 * Builds the short "Tomorrow" bulletin from the forecast numbers.
 * It's a plain set of rules - the same input always gives the same text.
 *
 * Periods used throughout:
 *   morning 06-12, afternoon 12-17, evening 17-21, night 21-06
 */

import { describeCode, iconKind } from "./icons.js";
import { tempWithUnit, wind, aqiLevel, uvLabel } from "./format.js";

const PERIODS = [
  { key: "morning", label: "Morning", from: 6, to: 12 },
  { key: "afternoon", label: "Afternoon", from: 12, to: 17 },
  { key: "evening", label: "Evening", from: 17, to: 21 },
  { key: "night", label: "Night", from: 21, to: 30 } // 21:00 to 06:00 next day
];

const PRECIP_KINDS = ["drizzle", "rain", "heavy-rain", "showers", "snow", "sleet", "thunder"];

/* ---------- small helpers ---------- */

const hourOf = (iso) => Number(iso.slice(11, 13));
const max = (list) => (list.length ? Math.max(...list) : null);
const min = (list) => (list.length ? Math.min(...list) : null);
const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const clean = (list) => list.filter((v) => v != null && !Number.isNaN(v));

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "a", "a and b", "a, b and c"
function joinWords(words) {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/**
 * Index of the hourly entries that belong to one date,
 * optionally stretched past midnight (for "night").
 */
function hourIndexes(hourly, date, nextDate) {
  const out = [];
  hourly.time.forEach((t, i) => {
    if (t.startsWith(date)) out.push({ i, h: hourOf(t) });
    else if (nextDate && t.startsWith(nextDate) && hourOf(t) < 6) out.push({ i, h: hourOf(t) + 24 });
  });
  return out;
}

/* ---------- describing the sky ---------- */

// Turn daytime weather codes into "sunny" / "partly cloudy" / ...
function skyPhrase(codes) {
  if (!codes.length) return "mixed skies";
  const cloudiness = codes.map((c) => (c <= 3 ? c : 3)); // precipitation counts as cloudy
  const avg = mean(cloudiness);
  const foggy = codes.filter((c) => c === 45 || c === 48).length >= 3;

  let sky;
  if (avg < 0.5) sky = "sunny";
  else if (avg < 1.3) sky = "mostly sunny";
  else if (avg < 2.2) sky = "partly cloudy";
  else if (avg < 2.7) sky = "mostly cloudy";
  else sky = "cloudy";

  return foggy ? `a foggy start, then ${sky}` : sky;
}

/* ---------- rain / snow / storms ---------- */

function precipitationSentence(periodStats, dailySum) {
  // Strongest chance of precipitation in each period.
  const wet = periodStats.filter((p) => p.rain != null && p.rain >= 30);
  const peak = max(clean(periodStats.map((p) => p.rain))) ?? 0;

  if (!wet.length) {
    if (peak >= 15) return { text: `Mostly dry, with only a small chance of a shower (${peak}%).`, umbrella: false };
    return { text: "No rain expected.", umbrella: false };
  }

  const kinds = wet.map((p) => p.precipKind).filter(Boolean);
  let noun;
  if (kinds.includes("thunder")) noun = "thunderstorms";
  else if (kinds.includes("snow")) noun = dailySum >= 5 ? "snow" : "light snow";
  else if (kinds.includes("sleet")) noun = "sleet";
  else if (kinds.every((k) => k === "drizzle")) noun = "drizzle";
  else if (dailySum >= 15 || kinds.includes("heavy-rain")) noun = "heavy rain";
  else if (dailySum < 2) noun = "light rain";
  else noun = "rain";

  const likelihood = peak >= 70 ? "likely" : peak >= 40 ? "possible" : "a slight chance";
  // Describe when: "in the evening", "in the afternoon and evening",
  // "from the afternoon into the night", "through the day".
  const keys = wet.map((p) => p.key);
  let when;
  if (keys.length >= 3 && keys[0] === "morning") when = "through the day";
  else if (keys.length >= 3) when = `from the ${keys[0]} into the ${keys[keys.length - 1]}`;
  else when = `in the ${joinWords(keys)}`;

  let text;
  if (likelihood === "a slight chance") {
    text = `There's a slight chance of ${noun} ${when} (${peak}%).`;
  } else {
    text = `${capitalise(noun)} ${likelihood} ${when} (${peak}%)`;
    text += dailySum >= 1 && noun !== "thunderstorms" ? `, around ${Math.round(dailySum)} mm in total.` : ".";
  }
  return { text, umbrella: peak >= 40, storm: noun === "thunderstorms", snow: noun.includes("snow") };
}

/* ---------- the four periods (for the small grid) ---------- */

function summarisePeriods(hourly, date, nextDate) {
  const hours = hourIndexes(hourly, date, nextDate);

  return PERIODS.map((period) => {
    const slice = hours.filter(({ h }) => h >= period.from && h < period.to).map(({ i }) => i);
    const temps = clean(slice.map((i) => hourly.temperature_2m[i]));
    const probs = clean(slice.map((i) => hourly.precipitation_probability[i]));
    const codes = slice.map((i) => hourly.weather_code[i]).filter((c) => c != null);
    const rain = max(probs);

    // Pick the code to show: the wettest hour if rain is likely, otherwise the most common sky.
    let code = null;
    let precipKind = null;
    const wetIndex = slice.filter((i) => PRECIP_KINDS.includes(iconKind(hourly.weather_code[i])));
    if (wetIndex.length) {
      const worst = wetIndex.reduce((a, b) => (hourly.weather_code[b] > hourly.weather_code[a] ? b : a));
      precipKind = iconKind(hourly.weather_code[worst]);
      if (rain != null && rain >= 40) code = hourly.weather_code[worst];
    }
    if (code == null && codes.length) {
      const counts = {};
      codes.filter((c) => c <= 48).forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
      const common = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      code = common != null ? Number(common) : codes[0];
    }

    return {
      key: period.key,
      label: period.label,
      temp: period.key === "afternoon" ? max(temps) : period.key === "night" ? min(temps) : mean(temps),
      rain,
      code,
      precipKind,
      isDay: period.key !== "night" && period.key !== "evening",
      available: slice.length > 0
    };
  });
}

/* ---------- public ---------- */

/**
 * @param {object} weather   { forecast, air } as stored by popup.js
 * @param {object} place     { name, ... }
 * @param {object} settings  unit settings
 * @param {number} dayIndex  index of "today" in daily arrays (normally 0)
 * @returns {{ date, sentences: string[], periods: object[] } | null}
 */
export function buildTomorrowReport(weather, place, settings, dayIndex = 0) {
  const { daily, hourly } = weather.forecast;
  const t = dayIndex + 1;
  if (!daily || !daily.time[t]) return null;

  const date = daily.time[t];
  const nextDate = daily.time[t + 1];
  const high = daily.temperature_2m_max[t];
  const low = daily.temperature_2m_min[t];
  const feelsHigh = daily.apparent_temperature_max[t];
  const feelsLow = daily.apparent_temperature_min[t];
  const todayHigh = daily.temperature_2m_max[dayIndex];
  const gusts = daily.wind_gusts_10m_max[t];
  const windMax = daily.wind_speed_10m_max[t];
  const uv = daily.uv_index_max[t];
  const rainSum = daily.precipitation_sum[t] ?? 0;

  const periods = summarisePeriods(hourly, date, nextDate);
  const daytimeCodes = hourIndexes(hourly, date)
    .filter(({ h }) => h >= 7 && h <= 18)
    .map(({ i }) => hourly.weather_code[i])
    .filter((c) => c != null);

  const sentences = [];
  const tips = [];
  const where = place.isDevice || !place.name ? "at your location" : `in ${place.name}`;

  // 1. Headline: sky + temperatures.
  sentences.push(
    `Tomorrow ${where}: ${skyPhrase(daytimeCodes)}, high ${tempWithUnit(high, settings)}, low ${tempWithUnit(low, settings)}.`
  );

  // 2. Rain, snow or storms.
  const precip = precipitationSentence(periods, rainSum);
  sentences.push(precip.text);
  if (precip.storm) tips.push("avoid open ground during thunderstorms");
  if (precip.snow) tips.push("allow extra time on the roads");
  else if (precip.umbrella) tips.push("carry an umbrella");

  // 3. How it will feel compared with today.
  if (feelsHigh != null && feelsHigh >= 38 && feelsHigh - high >= 2) {
    sentences.push(`Hot and humid, feeling like ${tempWithUnit(feelsHigh, settings)} in the afternoon.`);
    tips.push("drink plenty of water");
  } else if (feelsLow != null && feelsLow <= 0) {
    sentences.push(`A freezing start, feeling like ${tempWithUnit(feelsLow, settings)} early on.`);
    tips.push("wrap up warm");
  } else if (todayHigh != null && high != null) {
    const change = high - todayHigh;
    if (change >= 3) sentences.push("Noticeably warmer than today.");
    else if (change >= 1.5) sentences.push("A little warmer than today.");
    else if (change <= -3) sentences.push("Noticeably cooler than today.");
    else if (change <= -1.5) sentences.push("A little cooler than today.");
  }

  // 4. Wind.
  if (gusts != null && gusts >= 60) {
    sentences.push(`Strong winds, with gusts up to ${wind(gusts, settings)}.`);
    tips.push("secure loose items outdoors");
  } else if ((gusts != null && gusts >= 40) || (windMax != null && windMax >= 25)) {
    sentences.push(`Breezy at times, gusts up to ${wind(gusts ?? windMax, settings)}.`);
  }

  // 5. Air quality (average of tomorrow's hourly US AQI).
  let aqiAverage = null;
  if (weather.air && weather.air.hourly) {
    const aqiValues = clean(weather.air.hourly.time
      .map((time, i) => (time.startsWith(date) ? weather.air.hourly.us_aqi[i] : null)));
    const avg = mean(aqiValues);
    aqiAverage = avg == null ? null : Math.round(avg);
    const level = aqiLevel(avg == null ? null : Math.round(avg));
    if (level) {
      const value = Math.round(avg);
      sentences.push(value > 100
        ? `Air quality ${level.label.toLowerCase()} (AQI ${value}).`
        : `Air quality ${level.label.toLowerCase()}.`);
      if (value > 150) tips.push("consider a mask outdoors");
      else if (value > 100) tips.push("limit long workouts outdoors if you're sensitive to pollution");
    }
  }

  // 6. Strong sun.
  if (uv != null && uv >= 8) {
    sentences.push(`UV ${uvLabel(uv).toLowerCase()} around midday.`);
    tips.push("use sunscreen");
  }

  // 7. One or two practical tips to finish.
  if (!tips.length && high != null) {
    if (high >= 18 && high <= 30 && !precip.umbrella) tips.push("a good day to be outdoors");
  }
  if (tips.length) {
    sentences.push(`${capitalise(joinWords(tips.slice(0, 2)))}.`);
  }

  return {
    date,
    sentences,
    periods,
    summary: describeCode(daily.weather_code[t]),
    facts: {
      rainChance: daily.precipitation_probability_max[t],
      rainSum,
      windMax,
      gusts,
      windDirection: daily.wind_direction_10m_dominant[t],
      uv,
      aqi: aqiAverage
    }
  };
}
