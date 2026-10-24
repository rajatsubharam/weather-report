# Chrome Web Store listing: Weather Report

Copy these into the Developer Dashboard. Character limits are noted where the
dashboard has them.

## Name

Weather Report

## Short description (manifest `description`, 132 characters max)

Weather for any place: current conditions, air quality, hourly and 7-day forecast, plus a plain-language report for tomorrow.

## Detailed description

Weather Report shows the weather for any city or place in the world, right from
your toolbar.

Search for a place or use your location, and you'll see:

• Current temperature and conditions, with a clear "feels like" label: Cold,
  Cool, Pleasant, Warm, Hot and so on
• Wind speed, direction and gusts, humidity, pressure and UV index
• Air quality (AQI) with an easy colour-coded category
• A sun or moon icon based on the place's own local time, plus sunrise and
  sunset
• The next 24 hours, hour by hour
• A 7-day forecast with highs, lows and chance of rain
• Tomorrow's report: a short summary in plain words, like a weather bulletin.
  "Tomorrow in Kolkata: mostly sunny, high 32°C, low 25°C. Light rain possible
  in the evening (40%). Air quality moderate. Carry an umbrella."

Small details:
• Opens instantly with your last forecast, then refreshes in the background
• Keeps showing the last forecast when you're offline
• °C or °F, km/h, mph or m/s, and a 12- or 24-hour clock
• Remembers your recent places
• No account, no API key, no ads, no tracking

Weather data by Open-Meteo.com (CC BY 4.0). Air quality from the Copernicus
Atmosphere Monitoring Service (CAMS).

## Category

Productivity. Lifestyle would also fit.

## Language

English

## Graphics (in this folder)

| File | Use |
| --- | --- |
| `../icons/icon128.png` | Store icon (128x128) |
| `screenshot-1-kolkata-today.png` | Screenshot 1 (1280x800) |
| `screenshot-2-tokyo-report.png` | Screenshot 2 (1280x800) |
| `screenshot-3-kolkata-week.png` | Screenshot 3 (1280x800) |
| `screenshot-4-newyork-night.png` | Screenshot 4 (1280x800) |
| `screenshot-5-search.png` | Screenshot 5 (1280x800) |
| `promo-tile-440x280.png` | Small promo tile (440x280) |

---

## Privacy practices tab

### Single purpose

Weather Report shows the weather forecast, air quality and a short written
forecast summary for a place the user chooses.

### Permission justification

**storage**
Saves the place the user picked, their unit settings (°C/°F, wind unit, clock
format), a short list of recent places and the last forecast. This lets the
popup open instantly and keep working offline. All of it stays in the browser.

**geolocation**
Used only when the user clicks "Use my location". The coordinates are rounded
to about 1 km and sent to the Open-Meteo weather API to get the forecast for
that spot. Location is never collected in the background, and it isn't sent
anywhere else.

**Host permissions**
None requested. The extension calls the public Open-Meteo APIs, which allow
cross-origin requests.

**Remote code**
No, I am not using remote code. All JavaScript is included in the package.

### Data usage

What the extension does with data:

- The developer runs no server and receives no data at all.
- To show the forecast, the place's coordinates are sent to Open-Meteo. That
  means the searched city, or the user's approximate location if they click
  "Use my location". Search text is sent to Open-Meteo's place search.
- Settings, recent places and the cached forecast stay in the browser's
  extension storage.

How to fill in the form:

- **What user data do you plan to collect?** If you go with "collects no
  personal data", leave every box unticked. The safer choice is to tick only
  **Location**: the store treats data sent to a third-party API (here,
  Open-Meteo) as handled, and reviewers check the geolocation permission. Leave
  the rest unticked, including personal info, health, financial, auth, personal
  communications, web history, user activity and website content.
- Tick all three certifications:
  - I do not sell or transfer user data to third parties, outside of the
    approved use cases
  - I do not use or transfer user data for purposes that are unrelated to my
    item's single purpose
  - I do not use or transfer user data to determine creditworthiness or for
    lending purposes
- **Privacy policy URL:** the link to `store/privacy-policy.md` on GitHub, for
  example
  `https://github.com/rajatsubharam/weather-report/blob/main/store/privacy-policy.md`

---

## Distribution

Visibility: Public · Regions: All regions · Price: Free (no ads, no in-app
purchases; this also keeps it within Open-Meteo's free non-commercial terms).
