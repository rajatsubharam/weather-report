# Changelog

## 3.0.1 (2026-10-24)

- Firefox support: added the add-on ID and data-collection settings in
  `browser_specific_settings` (Firefox 140+). The same package still loads in
  Chrome, Brave and Edge.
- Ready-made zips for Chrome and Firefox on the Releases page.
- README: install steps for each browser and how to publish on Firefox Add-ons.

## 3.0.0 (2026-10-24)

Rebuilt as **Weather Report**.

- Moved to the free Open-Meteo APIs, so no API key is needed any more.
- Search any city or place, or use your location.
- Feels-like label (Cold to Very hot), air quality (US AQI), UV and pressure.
- Day/night icon using the place's local time, plus sunrise and sunset.
- Hourly strip for the next 24 hours and a 7-day forecast.
- "Tomorrow's report": a short written summary built from the forecast.
- The last forecast is cached so the popup opens instantly and works offline.
- Settings for °C/°F, km/h/mph/m/s and a 12/24-hour clock.
- New icons, and the code is split into modules.

## 2.1.0

- "Weather Pro Dashboard" on WeatherAPI.com: fixed the manifest, forecast,
  future date and alerts views, and added search results.

## 2.0

- First version: popup with current weather from WeatherAPI.com.
