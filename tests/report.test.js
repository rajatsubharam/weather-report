// Tests for the rule-based "Tomorrow" report and the formatting helpers.
// Run with:  npm test   (or: node --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildTomorrowReport } from "../js/report.js";
import { feelLevel, aqiLevel, clock, compass, temp, wind } from "../js/format.js";

const metric = { tempUnit: "C", windUnit: "kmh", timeFormat: "12" };
const imperial = { tempUnit: "F", windUnit: "mph", timeFormat: "24" };

// Real Open-Meteo responses saved from a live request.
const load = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));
const copy = (obj) => JSON.parse(JSON.stringify(obj));

// Overwrite tomorrow's hourly values for the given hours.
function setTomorrowHours(weather, hours, values) {
  const { hourly, daily } = weather.forecast;
  const date = daily.time[1];
  hourly.time.forEach((t, i) => {
    if (t.startsWith(date) && hours.includes(Number(t.slice(11, 13)))) {
      Object.entries(values).forEach(([key, value]) => { hourly[key][i] = value; });
    }
  });
}

function makeDry(weather) {
  const { hourly } = weather.forecast;
  hourly.precipitation_probability = hourly.precipitation_probability.map(() => 0);
  hourly.weather_code = hourly.weather_code.map(() => 1);
  weather.forecast.daily.precipitation_sum[1] = 0;
}

const all = [...Array(24).keys()];
const text = (report) => report.sentences.join(" ");

test("real Kolkata data gives a readable bulletin", () => {
  const report = buildTomorrowReport(load("kolkata"), { name: "Kolkata" }, metric);
  const words = text(report);
  assert.match(report.sentences[0], /^Tomorrow in Kolkata: .+, high -?\d+°C, low -?\d+°C\.$/);
  assert.ok(report.sentences.length >= 2 && report.sentences.length <= 7);
  assert.doesNotMatch(words, /undefined|NaN|null|--/);
  assert.equal(report.periods.length, 4);
});

test("real Tokyo data mentions rain when it is likely", () => {
  const weather = load("tokyo");
  const report = buildTomorrowReport(weather, { name: "Tokyo" }, metric);
  const peak = Math.max(...weather.forecast.hourly.time
    .map((t, i) => (t.startsWith(weather.forecast.daily.time[1]) ? weather.forecast.hourly.precipitation_probability[i] : 0)));
  if (peak >= 40) assert.match(text(report), /rain|drizzle|showers|thunderstorms/i);
  assert.doesNotMatch(text(report), /undefined|NaN/);
});

test("dry day says no rain and suggests nothing about umbrellas", () => {
  const weather = copy(load("kolkata"));
  makeDry(weather);
  const words = text(buildTomorrowReport(weather, { name: "Kolkata" }, metric));
  assert.match(words, /No rain expected\./);
  assert.doesNotMatch(words, /umbrella/);
});

test("evening rain gives the period, chance and an umbrella tip", () => {
  const weather = copy(load("kolkata"));
  makeDry(weather);
  setTomorrowHours(weather, [18, 19, 20], { weather_code: 61, precipitation_probability: 40 });
  weather.forecast.daily.precipitation_sum[1] = 1.2;
  const words = text(buildTomorrowReport(weather, { name: "Kolkata" }, metric));
  assert.match(words, /Light rain possible in the evening \(40%\)/);
  assert.match(words, /umbrella/i);
});

test("afternoon thunderstorms are called out", () => {
  const weather = copy(load("kolkata"));
  makeDry(weather);
  setTomorrowHours(weather, [13, 14, 15, 16], { weather_code: 95, precipitation_probability: 75 });
  weather.forecast.daily.precipitation_sum[1] = 14;
  const words = text(buildTomorrowReport(weather, { name: "Kolkata" }, metric));
  assert.match(words, /Thunderstorms likely in the afternoon \(75%\)/);
  assert.match(words, /thunderstorms/i);
});

test("hot and humid day warns about the heat", () => {
  const weather = copy(load("kolkata"));
  weather.forecast.daily.temperature_2m_max[1] = 37;
  weather.forecast.daily.apparent_temperature_max[1] = 43;
  const words = text(buildTomorrowReport(weather, { name: "Kolkata" }, metric));
  assert.match(words, /feeling like 43°C/);
  assert.match(words, /water/);
});

test("snow and a freezing start in a cold place", () => {
  const weather = copy(load("tokyo"));
  makeDry(weather);
  setTomorrowHours(weather, all, { weather_code: 73, precipitation_probability: 85, temperature_2m: -2 });
  weather.forecast.daily.precipitation_sum[1] = 8;
  weather.forecast.daily.temperature_2m_max[1] = 0;
  weather.forecast.daily.temperature_2m_min[1] = -5;
  weather.forecast.daily.apparent_temperature_min[1] = -9;
  const words = text(buildTomorrowReport(weather, { name: "Sapporo" }, metric));
  assert.match(words, /Snow likely through the day/);
  assert.match(words, /freezing start, feeling like -9°C/);
});

test("units follow the settings", () => {
  const report = buildTomorrowReport(load("kolkata"), { name: "Kolkata" }, imperial);
  assert.match(report.sentences[0], /high \d+°F, low \d+°F/);
});

test("works without air quality data", () => {
  const weather = copy(load("kolkata"));
  weather.air = null;
  const words = text(buildTomorrowReport(weather, { name: "Kolkata" }, metric));
  assert.doesNotMatch(words, /Air quality/);
});

test("device location reads naturally", () => {
  const report = buildTomorrowReport(load("kolkata"), { name: "My location", isDevice: true }, metric);
  assert.match(report.sentences[0], /^Tomorrow at your location: /);
});

test("feels-like labels", () => {
  assert.equal(feelLevel(42).label, "Very hot");
  assert.equal(feelLevel(33).label, "Hot");
  assert.equal(feelLevel(28).label, "Warm");
  assert.equal(feelLevel(32.4).label, "Warm");
  assert.equal(feelLevel(32.6).label, "Hot");
  assert.equal(feelLevel(22).label, "Pleasant");
  assert.equal(feelLevel(12).label, "Cool");
  assert.equal(feelLevel(4).label, "Cold");
  assert.equal(feelLevel(-3).label, "Freezing");
});

test("AQI categories (US scale)", () => {
  assert.equal(aqiLevel(30).label, "Good");
  assert.equal(aqiLevel(75).label, "Moderate");
  assert.equal(aqiLevel(120).short, "Sensitive");
  assert.equal(aqiLevel(181).label, "Unhealthy");
  assert.equal(aqiLevel(250).label, "Very unhealthy");
  assert.equal(aqiLevel(400).label, "Hazardous");
  assert.equal(aqiLevel(null), null);
});

test("time, compass and unit formatting", () => {
  assert.equal(clock("2026-10-24T05:36", metric), "5:36 AM");
  assert.equal(clock("2026-10-24T17:04", metric), "5:04 PM");
  assert.equal(clock("2026-10-24T00:15", metric), "12:15 AM");
  assert.equal(clock("2026-10-24T17:04", imperial), "17:04");
  assert.equal(compass(0), "N");
  assert.equal(compass(334), "NNW");
  assert.equal(compass(359), "N");
  assert.equal(temp(30, imperial), "86°");
  assert.equal(wind(36, metric), "36 km/h");
  assert.equal(wind(36, imperial), "22 mph");
});
