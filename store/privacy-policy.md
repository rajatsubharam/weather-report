# Privacy Policy: Weather Report

_Last updated: 24 October 2026_

Weather Report is a Chrome extension made by Rajat Subhara Mondal. This page
explains what happens to your information when you use it.

## The short version

Weather Report does not collect, store or sell any personal data. There are no
accounts, no analytics and no ads, and the developer runs no server.

## What is stored on your device

The extension uses Chrome's built-in extension storage to remember:

- the place you picked and a short list of recent places
- your settings (°C/°F, wind unit, 12/24-hour clock)
- the last forecast, so the popup opens instantly and works offline

This stays in your browser. Your settings may sync between your own Chrome
browsers if you have Chrome Sync turned on. You can delete everything under
**Settings → Clear saved place & history**, or by removing the extension.

## What is sent to the weather service

To show the weather, the extension sends requests straight from your browser to
[Open-Meteo](https://open-meteo.com/):

- **Place search:** the text you type in the search box goes to Open-Meteo's
  place search.
- **Forecast and air quality:** the coordinates of the place you chose.
- **Your location:** only if you click **Use my location**. The extension then
  asks the browser for your position, rounds it to about 1 km, and sends those
  coordinates to Open-Meteo to get the forecast. Your location isn't stored
  anywhere else, and the extension never reads it in the background.

Like any website, Open-Meteo receives your IP address with each request. See
[Open-Meteo's privacy information](https://open-meteo.com/en/terms#privacy).
Nothing is sent to the developer or to anyone else.

## Children

The extension doesn't knowingly collect any information from anyone, including
children.

## Changes

If this policy ever changes, the new version will be posted here with a new
date.

## Contact

Questions? Open an issue on the project's GitHub page:
https://github.com/rajatsubharam/weather-report
