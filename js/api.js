/*
 * api.js
 * Thin wrappers around the three free Open-Meteo services the extension uses.
 * None of them need an API key. Everything is requested in metric units;
 * conversion to °F / mph happens at display time (see format.js), so changing
 * units never needs a new request.
 */

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

const TIMEOUT_MS = 12000;

const CURRENT_FIELDS = [
  "temperature_2m", "relative_humidity_2m", "apparent_temperature", "is_day",
  "precipitation", "weather_code", "cloud_cover", "pressure_msl",
  "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m"
];

const HOURLY_FIELDS = [
  "temperature_2m", "apparent_temperature", "precipitation_probability",
  "precipitation", "weather_code", "wind_speed_10m", "wind_gusts_10m", "is_day"
];

const DAILY_FIELDS = [
  "weather_code", "temperature_2m_max", "temperature_2m_min",
  "apparent_temperature_max", "apparent_temperature_min", "sunrise", "sunset",
  "daylight_duration", "uv_index_max", "precipitation_sum",
  "precipitation_probability_max", "wind_speed_10m_max", "wind_gusts_10m_max",
  "wind_direction_10m_dominant"
];

/**
 * Error with a short, user-friendly message and a type the UI can react to:
 * "offline" | "timeout" | "server" | "notfound"
 */
export class WeatherError extends Error {
  constructor(type, message) {
    super(message);
    this.name = "WeatherError";
    this.type = type;
  }
}

async function getJSON(baseUrl, params, signal) {
  const url = `${baseUrl}?${new URLSearchParams(params)}`;

  if (!navigator.onLine) {
    throw new WeatherError("offline", "You're offline.");
  }

  // Abort slow requests ourselves, but still respect an outside signal
  // (used to cancel stale search-as-you-type requests).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });

  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (signal && signal.aborted) throw err; // caller cancelled, not an error to show
    if (controller.signal.aborted) {
      throw new WeatherError("timeout", "The weather service is taking too long to respond.");
    }
    throw new WeatherError(navigator.onLine ? "server" : "offline",
      navigator.onLine ? "Couldn't reach the weather service." : "You're offline.");
  } finally {
    clearTimeout(timer);
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // fall through with body = null
  }

  if (!response.ok || !body || body.error) {
    const reason = body && body.reason ? body.reason : `HTTP ${response.status}`;
    throw new WeatherError("server", `Weather service error: ${reason}`);
  }
  return body;
}

/**
 * Search for places by name. Returns a list of simple place objects.
 */
export async function searchPlaces(query, signal) {
  const name = query.trim();
  if (name.length < 2) return [];

  const data = await getJSON(GEOCODING_URL, {
    name,
    count: 6,
    language: "en",
    format: "json"
  }, signal);

  return (data.results || []).map((r) => ({
    name: r.name,
    region: r.admin1 || "",
    country: r.country || r.country_code || "",
    latitude: r.latitude,
    longitude: r.longitude
  }));
}

/**
 * Fetch forecast + air quality for a place.
 * Air quality is optional: if that request fails the forecast still shows.
 */
export async function fetchWeather(place) {
  const location = {
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: "auto"
  };

  const [forecastResult, airResult] = await Promise.allSettled([
    getJSON(FORECAST_URL, {
      ...location,
      current: CURRENT_FIELDS.join(","),
      hourly: HOURLY_FIELDS.join(","),
      daily: DAILY_FIELDS.join(","),
      forecast_days: 7
    }),
    getJSON(AIR_QUALITY_URL, {
      ...location,
      current: "us_aqi,pm2_5,pm10",
      hourly: "us_aqi",
      forecast_days: 3
    })
  ]);

  if (forecastResult.status === "rejected") throw forecastResult.reason;

  return {
    forecast: forecastResult.value,
    air: airResult.status === "fulfilled" ? airResult.value : null,
    fetchedAt: Date.now()
  };
}
