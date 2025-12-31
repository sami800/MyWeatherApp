````markdown
# Multi Timezone Digital Clock

What this is
- A small web app that displays digital clocks for multiple time zones.
- Add any IANA timezone (e.g. "Europe/London", "America/New_York", "UTC").
- Shows live time (hours:minutes:seconds) and the date for each zone.
- Toggle 24-hour format. Clocks and preference persist in localStorage.
- Remove clocks individually or Reset to the default set.

How to use
1. Open index.html in your browser (no server required).
2. Type a timezone into the input (you can choose from the dropdown list or type any valid IANA timezone).
   - Optionally provide a label using "Label|TimeZone" (e.g. "Tokyo|Asia/Tokyo").
3. Click Add or press Enter.
4. Use the "24-hour" checkbox to toggle 12/24 hour display.
5. Remove clocks with the Remove button on each card.
6. Press Reset to restore default clocks.

Notes
- The browser's Intl implementation determines which IANA time zones are supported. If the app reports "Timezone not recognized", try another identifier or update your browser.
- Default clocks include your local zone, UTC, New York, London, Tokyo, and Sydney.
- The app updates every second and uses no external libraries.