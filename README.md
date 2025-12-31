# MyWeatherApp
Global Weather App
A responsive web weather dashboard that shows the current weather, hourly and 7‑day forecasts, dynamic backgrounds that mimic the weather and day/night, timezone‑aware date/time, and optional browser notifications. Uses Open‑Meteo (no API key required) for geocoding and forecasts.

This repository contains a single‑page client app (HTML/CSS/JS) you can run locally or host on any static web host.

---

## Features

- Worldwide geocoding (search by city) and device geolocation lookup.
- Current weather, hourly (next 12) and 7‑day forecast (Open‑Meteo).
- Timezone‑aware current date & time (updates every second).
- Dynamic background and simple animations that reflect current weather + day/night.
- Units toggle (metric °C / m/s and imperial °F / mph).
- Browser notifications for "today" and "upcoming" weather (while page is open).
- Service Worker for simple asset caching and receiving push messages (requires server to send pushes).
- Defensive fetch logic and friendly fallbacks when some fields are unavailable.

---

## Files (MyWeatherApp)

- `index.html` — main page.
- `styles.css` — visual styles and animated backgrounds.
- `app.js` — main JavaScript: geocoding, fetching Open‑Meteo, rendering UI, notifications, background logic.
- `sw.js` — service worker for caching and push notification handling.
- `README.md` — this file.

---

## No API key required

This project uses Open‑Meteo and its geocoding endpoints which do not require an API key. The code calls:

- Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name=...`
- Forecast: `https://api.open-meteo.com/v1/forecast?...`

---

## Quick start (local)

1. Clone or copy these files into a folder on your machine.

2. Serve the files with a local HTTP server (recommended). In the project folder run one of:

- Python 3:
  - macOS / Linux:
    ```
    python3 -m http.server 8000
    ```
  - Windows (PowerShell):
    ```
    py -3 -m http.server 8000
    ```
  Then open: `http://localhost:8000/index.html`

- Node (npx http-server):
  ```
  npx http-server -p 8000
  ```
  Then open: `http://localhost:8000/index.html`

> Why serve via HTTP? Some browser features (service workers, notifications, and some fetch behaviors) require a secure origin (`https`) or `http://localhost`. Opening files with `file://` may block network fetches in some browsers.

---

## How it works (high level)

1. User searches a city (or clicks "Use my location").
2. App calls Open‑Meteo geocoding to obtain latitude/longitude and timezone.
3. App calls the Open‑Meteo forecast endpoint with `timezone=auto`, `current_weather=true`, `hourly=...`, `daily=...` and requested units.
4. App renders:
   - prominent current temperature and condition,
   - hourly strip (12 items),
   - 7‑day cards,
   - timezone-aware date/time.
5. App chooses a background class (clear/rain/clouds/snow/thunder/mist) based on Open‑Meteo weather codes and sunrise/sunset to determine day/night.
6. App sets CSS variables so text and cards remain readable against the background.
7. Optional: notifications are shown while the page is open (Notification API). For background push while the page is closed, you must implement a push server (Web Push or FCM).

---

## Important implementation notes

- The Open‑Meteo daily parameter list must include **variable names only** — do **not** include `time` in the daily variable list. Using `time` in the daily list causes a 400 response (error: "Cannot initialize ForecastVariableDaily from invalid String value time,...").
  - Correct example:
    ```
    daily=temperature_2m_max,temperature_2m_min,precipitation_probability_mean,weathercode,sunrise,sunset
    ```

- The app includes defensive validation for coordinates and logs the exact forecast URL to console. If you see an error, open DevTools → Console and copy the `fetchWeather URL ->` log and any response text for diagnosis.

- Humidity / feels_like: Open‑Meteo's `current_weather` may not include `humidity` or `feels_like`. The app attempts to infer humidity/other values from the hourly arrays when possible.

---

## Notifications & Service Worker

- Notifications while the page is open use the browser Notification API (user must grant permission).
- Service Worker (`sw.js`) is registered to enable:
  - basic caching of assets,
  - handling push events (if you send push messages to the SW).
- To receive notifications when the site is closed, you must implement a push server (Web Push with VAPID or Firebase Cloud Messaging) and subscribe the client. The SW includes a basic `push` event handler, but server‑side push logic is outside the scope of this client.

---

## Debugging tips

- If numbers don’t show:
  1. Open DevTools (F12) → Console and Network.
  2. Look for logs printed by `app.js`, particularly lines like:
     - `Geocode URL -> https://geocoding-api...`
     - `fetchWeather URL -> https://api.open-meteo.com/v1/forecast?...`
  3. Inspect the forecast request response in Network (status should be 200). If 400, paste the response body here.
- If you get CORS or network errors:
  - Try serving via `http://localhost` (see Quick start).
  - Disable ad-blockers/privacy extensions temporarily.
  - Try a different network (mobile hotspot) to rule out corporate firewall.

---

## Optional enhancements (suggestions you can add)

- Persist last selected city and units to `localStorage` so the app re-opens with previous location.
  - Example (save): `localStorage.setItem('weather.last', JSON.stringify({ lat, lon, label, units }))`
  - Example (load on init): read and call `updateByCoords(...)`.
- Scheduling UI to request notifications at a user‑chosen local time.
- Add server example (Node/Express) to proxy requests (if you later use an API with a secret key) or to send Web Push notifications.
- Replace static icon images with animated Lottie icons for richer visuals.

---

## Accessibility & UX

- The app uses `aria-live` attributes for dynamic content where appropriate.
- Text contrast is adjusted automatically depending on the background to maintain readability.
- For keyboard accessibility, search input supports Enter key to submit.

---

## Deployment

- Any static host works (GitHub Pages, Netlify, Vercel, Surge, etc.).
- Service workers and push require serving from the site root and over HTTPS.
- When hosting on a subpath, ensure the service worker scope is correct (place `sw.js` at site root for full coverage) or adjust registration scope accordingly.

---

## Security & Privacy

- No API keys are embedded or required for Open‑Meteo.
- If you add a third‑party API that requires a key, do not put server secrets into client JavaScript. Use a server proxy or server‑side calls.
- Be transparent to users about notifications and location usage (the app requests geolocation only when the user clicks "Use my location").

---



