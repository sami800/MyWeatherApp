// Robust Open‑Meteo dashboard (fixed daily parameter)
// - Uses Open‑Meteo geocoding + forecast (no API key required)
// - Validates coords, logs request URL, and displays numeric values (or friendly fallback)

const searchEl = document.getElementById('search');
const searchBtn = document.getElementById('searchBtn');
const geoBtn = document.getElementById('geoBtn');
const unitsEl = document.getElementById('units');
const placeEl = document.getElementById('place');
const dateTimeEl = document.getElementById('dateTime');
const tempEl = document.getElementById('temp');
const iconEl = document.getElementById('icon');
const descEl = document.getElementById('desc');
const feelsEl = document.getElementById('feels');
const humidityEl = document.getElementById('humidity');
const windEl = document.getElementById('wind');
const sunEl = document.getElementById('sun');
const hourlyList = document.getElementById('hourlyList');
const dailyList = document.getElementById('dailyList');

const miniNow = document.getElementById('miniNow');
const miniHigh = document.getElementById('miniHigh');
const miniLow = document.getElementById('miniLow');
const miniPop = document.getElementById('miniPop');

const notifToggle = document.getElementById('notifToggle');
const notifToday = document.getElementById('notifToday');
const notifUpcoming = document.getElementById('notifUpcoming');

const bgEl = document.getElementById('bg');

let currentCoords = null;
let units = 'metric';
let dateTimeIntervalId = null;
let notifIntervalId = null;
let currentTimezone = null;

// -------------------------------------------------

async function geocode(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`;
  console.log('Geocode URL ->', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status} ${res.statusText}`);
  const j = await res.json();
  return j.results || [];
}

async function fetchWeather(lat, lon, units = 'metric') {
  const nlat = Number(lat);
  const nlon = Number(lon);
  if (!isFinite(nlat) || !isFinite(nlon)) {
    throw new Error('Invalid coordinates: latitude and longitude must be numeric.');
  }

  const tempUnit = units === 'metric' ? 'celsius' : 'fahrenheit';
  const windUnit = units === 'metric' ? 'ms' : 'mph';

  // IMPORTANT: 'time' must NOT be included in daily variables (Open-Meteo expects variable names only)
  const params = new URLSearchParams({
    latitude: String(nlat),
    longitude: String(nlon),
    timezone: 'auto',
    current_weather: 'true',
    hourly: 'temperature_2m,relativehumidity_2m,precipitation_probability,weathercode,windspeed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_mean,weathercode,sunrise,sunset',
    temperature_unit: tempUnit,
    windspeed_unit: windUnit
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  console.log('fetchWeather URL ->', url);
  const res = await fetch(url);
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    console.error('Open‑Meteo error response:', res.status, res.statusText, text);
    throw new Error('Weather fetch failed: ' + res.status + ' ' + res.statusText + (text ? ' — ' + text : ''));
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('Failed to parse weather JSON: ' + e.message);
  }
}

function weatherCodeToCategory(code) {
  const c = Number(code);
  if (c === 0) return { cls: 'clear', desc: 'Clear' };
  if (c >= 1 && c <= 3) return { cls: 'clouds', desc: 'Partly cloudy' };
  if (c === 45 || c === 48) return { cls: 'mist', desc: 'Fog' };
  if ((c >= 51 && c <= 55) || (c >= 80 && c <= 82) || (c >= 61 && c <= 67)) return { cls: 'rain', desc: 'Rain' };
  if (c >= 71 && c <= 77) return { cls: 'snow', desc: 'Snow' };
  if (c >= 95 && c <= 99) return { cls: 'thunder', desc: 'Thunder' };
  return { cls: 'clouds', desc: 'Cloudy' };
}

function iconForCode(code, isDay) {
  const cat = weatherCodeToCategory(code);
  if (cat.cls === 'clear') return isDay ? '01d' : '01n';
  if (cat.cls === 'clouds') return '03d';
  if (cat.cls === 'mist') return '50d';
  if (cat.cls === 'rain') return '09d';
  if (cat.cls === 'snow') return '13d';
  if (cat.cls === 'thunder') return '11d';
  return '02d';
}
function iconURL(icon) { return `https://openweathermap.org/img/wn/${icon}@2x.png`; }

function findNearestHourlyIndex(hourlyTimes = [], currentISO) {
  if (!Array.isArray(hourlyTimes) || hourlyTimes.length === 0) return 0;
  const now = new Date(currentISO).getTime();
  for (let i = 0; i < hourlyTimes.length; i++) {
    if (new Date(hourlyTimes[i]).getTime() >= now) return i;
  }
  return Math.max(0, hourlyTimes.length - 1);
}

// ------------------------ UI & Rendering ------------------------

function startDateTimeUpdates(timezoneName) {
  currentTimezone = timezoneName || null;
  if (dateTimeIntervalId) clearInterval(dateTimeIntervalId);
  function update() {
    const now = new Date();
    if (currentTimezone) {
      try {
        dateTimeEl.textContent = new Intl.DateTimeFormat([], {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: currentTimezone
        }).format(now);
        return;
      } catch (e) {
        // fallback below
      }
    }
    dateTimeEl.textContent = now.toLocaleString();
  }
  update();
  dateTimeIntervalId = setInterval(update, 1000);
}

function applyBackgroundFor(data) {
  if (!data || !data.current_weather) return;
  const cur = data.current_weather;
  const daily = data.daily || {};
  const code = cur.weathercode;
  const cat = weatherCodeToCategory(code);
  const isDay = (() => {
    if (daily.sunrise && daily.sunset && daily.sunrise[0] && daily.sunset[0]) {
      const now = new Date(cur.time);
      return now >= new Date(daily.sunrise[0]) && now < new Date(daily.sunset[0]);
    }
    const h = new Date(cur.time).getHours();
    return h >= 6 && h < 19;
  })();

  let cls = 'clear-day';
  if (cat.cls === 'clear') cls = isDay ? 'clear-day' : 'clear-night';
  else if (cat.cls === 'clouds') cls = 'clouds';
  else if (cat.cls === 'rain') cls = 'rain';
  else if (cat.cls === 'snow') cls = 'snow';
  else if (cat.cls === 'thunder') cls = 'thunder';
  else if (cat.cls === 'mist') cls = 'mist';

  bgEl.className = 'weather-bg ' + cls;
  while (bgEl.firstChild) bgEl.removeChild(bgEl.firstChild);

  if (cls === 'clear-day' || cls === 'clear-night') {
    const sun = document.createElement('div'); sun.className = 'sun';
    if (cls === 'clear-night') {
      sun.style.background = 'radial-gradient(circle at 30% 30%, #fff, #f0f0f0 40%, rgba(240,240,240,0.12) 60%)';
      sun.style.boxShadow = '0 0 30px rgba(255,255,255,0.05)';
    }
    bgEl.appendChild(sun);
  } else if (cls === 'clouds') {
    const clouds = document.createElement('div'); clouds.className = 'clouds-layer'; bgEl.appendChild(clouds);
  } else if (cls === 'rain') {
    const clouds = document.createElement('div'); clouds.className = 'clouds-layer'; bgEl.appendChild(clouds);
    const rain = document.createElement('div'); rain.className = 'rain';
    for (let i = 0; i < 40; i++) {
      const drop = document.createElement('i');
      drop.style.left = (Math.random() * 100) + '%';
      drop.style.top = (Math.random() * 100) + '%';
      drop.style.animationDelay = (Math.random() * 1) + 's';
      drop.style.height = (10 + Math.random() * 20) + 'px';
      rain.appendChild(drop);
    }
    bgEl.appendChild(rain);
  } else if (cls === 'snow') {
    const clouds = document.createElement('div'); clouds.className = 'clouds-layer'; bgEl.appendChild(clouds);
    const snow = document.createElement('div'); snow.className = 'snow';
    for (let i = 0; i < 20; i++) {
      const s = document.createElement('i');
      s.style.left = (Math.random() * 100) + '%';
      s.style.top = (Math.random() * 100) + '%';
      s.style.animationDelay = (Math.random() * 5) + 's';
      s.style.width = s.style.height = (4 + Math.random() * 8) + 'px';
      snow.appendChild(s);
    }
    bgEl.appendChild(snow);
  } else if (cls === 'thunder') {
    const clouds = document.createElement('div'); clouds.className = 'clouds-layer'; bgEl.appendChild(clouds);
    const bolt = document.createElement('div'); bolt.className = 'bolt'; bgEl.appendChild(bolt);
    const rain = document.createElement('div'); rain.className = 'rain';
    for (let i = 0; i < 30; i++) {
      const drop = document.createElement('i');
      drop.style.left = (Math.random() * 100) + '%';
      drop.style.top = (Math.random() * 100) + '%';
      drop.style.animationDelay = (Math.random() * 1) + 's';
      drop.style.height = (10 + Math.random() * 20) + 'px';
      rain.appendChild(drop);
    }
    bgEl.appendChild(rain);
  } else if (cls === 'mist') {
    const clouds = document.createElement('div'); clouds.className = 'clouds-layer'; clouds.style.opacity = '0.6'; bgEl.appendChild(clouds);
  }
}

function renderCurrent(data) {
  if (!data || !data.current_weather) return;
  const cur = data.current_weather;
  startDateTimeUpdates(data.timezone);
  units = unitsEl.value;
  tempEl.textContent = `${Math.round(cur.temperature)}°${units === 'metric' ? 'C' : 'F'}`;

  const code = cur.weathercode;
  const cat = weatherCodeToCategory(code);
  const isDay = (() => {
    const d = data.daily || {};
    if (d.sunrise && d.sunset && d.sunrise[0] && d.sunset[0]) {
      const now = new Date(cur.time);
      return now >= new Date(d.sunrise[0]) && now < new Date(d.sunset[0]);
    }
    const h = new Date(cur.time).getHours();
    return h >= 6 && h < 19;
  })();

  iconEl.innerHTML = `<img src="${iconURL(iconForCode(code, isDay))}" alt="${cat.desc}" />`;
  descEl.textContent = cat.desc;

  feelsEl.textContent = `Feels: —`;
  humidityEl.textContent = `Humidity: —`;
  windEl.textContent = `Wind: ${Math.round(cur.windspeed || 0)} ${units === 'metric' ? 'm/s' : 'mph'}`;

  if (data.daily && data.daily.sunrise && data.daily.sunset && data.daily.sunrise[0]) {
    try {
      const sr = new Date(data.daily.sunrise[0]);
      const ss = new Date(data.daily.sunset[0]);
      sunEl.textContent = `Sun: ${new Intl.DateTimeFormat([], { hour: 'numeric', minute: 'numeric', timeZone: data.timezone }).format(sr)} - ${new Intl.DateTimeFormat([], { hour: 'numeric', minute: 'numeric', timeZone: data.timezone }).format(ss)}`;
    } catch {
      sunEl.textContent = 'Sun: —';
    }
  } else {
    sunEl.textContent = 'Sun: —';
  }
}

function renderMini(data) {
  if (!data || !data.current_weather) return;
  const cur = data.current_weather;
  miniNow.textContent = `${Math.round(cur.temperature)}°`;
  if (data.daily && data.daily.temperature_2m_max && data.daily.temperature_2m_min) {
    miniHigh.textContent = `${Math.round(data.daily.temperature_2m_max[0])}°`;
    miniLow.textContent = `${Math.round(data.daily.temperature_2m_min[0])}°`;
    miniPop.textContent = `${Math.round(data.daily.precipitation_probability_mean ? data.daily.precipitation_probability_mean[0] : 0)}%`;
  } else {
    miniHigh.textContent = '—';
    miniLow.textContent = '—';
    miniPop.textContent = '—';
  }
}

function renderHourly(data) {
  hourlyList.innerHTML = '';
  if (!data || !data.hourly || !data.hourly.time) return;
  const hourly = data.hourly;
  const tz = data.timezone;
  const start = findNearestHourlyIndex(hourly.time, data.current_weather.time);
  for (let i = start; i < Math.min(start + 12, hourly.time.length); i++) {
    const t = hourly.time[i];
    const temp = hourly.temperature_2m ? hourly.temperature_2m[i] : null;
    const code = hourly.weathercode ? hourly.weathercode[i] : 0;
    const pop = hourly.precipitation_probability ? hourly.precipitation_probability[i] : 0;
    const timeStr = (() => {
      try { return new Intl.DateTimeFormat([], { hour: 'numeric', minute: 'numeric', timeZone: tz }).format(new Date(t)); }
      catch { return new Date(t).toLocaleTimeString(); }
    })();
    const el = document.createElement('div');
    el.className = 'hourItem';
    el.innerHTML = `<div class="muted">${timeStr}</div>
      <div><img src="${iconURL(iconForCode(code, true))}" style="width:48px" alt=""></div>
      <div>${temp !== null ? Math.round(temp) + '°' : '—'}</div>
      <div class="muted">${Math.round(pop || 0)}% rain</div>`;
    hourlyList.appendChild(el);
  }
}

function renderDaily(data) {
  dailyList.innerHTML = '';
  if (!data || !data.daily || !data.daily.time) return;
  const d = data.daily;
  const tz = data.timezone;
  for (let i = 0; i < Math.min(7, d.time.length); i++) {
    const dayName = (() => {
      try { return new Intl.DateTimeFormat([], { weekday: 'short', timeZone: tz }).format(new Date(d.time[i])); }
      catch { return new Date(d.time[i]).toDateString(); }
    })();
    const icon = iconForCode(d.weathercode ? d.weathercode[i] : 0, true);
    const el = document.createElement('div');
    el.className = 'dayItem';
    el.innerHTML = `<div class="muted">${dayName}</div>
      <div><img src="${iconURL(icon)}" style="width:48px" alt=""></div>
      <div>${d.temperature_2m_max ? Math.round(d.temperature_2m_max[i]) + '°' : '—'} / ${d.temperature_2m_min ? Math.round(d.temperature_2m_min[i]) + '°' : '—'}</div>
      <div class="muted">${Math.round(d.precipitation_probability_mean ? d.precipitation_probability_mean[i] : 0)}% precip</div>`;
    dailyList.appendChild(el);
  }
}

// ------------------------ Notifications (simple while page is open) ------------------------

async function requestNotificationPermission() {
  if (!('Notification' in window)) { alert('Notifications not supported by this browser'); return false; }
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

notifToggle.addEventListener('change', async () => {
  if (notifToggle.checked) {
    const ok = await requestNotificationPermission();
    if (!ok) { notifToggle.checked = false; return; }
    startNotifications();
  } else {
    stopNotifications();
  }
});

function startNotifications() {
  if (notifIntervalId) clearInterval(notifIntervalId);
  notifIntervalId = setInterval(checkAndNotify, 1000 * 60 * 30); // 30 min
  checkAndNotify();
}
function stopNotifications() {
  if (notifIntervalId) clearInterval(notifIntervalId);
  notifIntervalId = null;
}
async function checkAndNotify() {
  if (!currentCoords) return;
  try {
    const data = await fetchWeather(currentCoords.lat, currentCoords.lon, units);
    scheduleImmediateNotificationIfEnabled(data);
  } catch (e) {
    console.warn('Notification check failed', e);
  }
}
function scheduleImmediateNotificationIfEnabled(data) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (notifToday.checked && notifToggle.checked) {
    const cur = data.current_weather;
    const cat = weatherCodeToCategory(cur.weathercode);
    const title = `Today: ${Math.round(cur.temperature)}°${units === 'metric' ? 'C' : 'F'} - ${cat.desc}`;
    new Notification(title);
  }
  if (notifUpcoming.checked && notifToggle.checked) {
    const hourly = data.hourly;
    if (!hourly) return;
    const start = findNearestHourlyIndex(hourly.time, data.current_weather.time);
    const upcomingPop = hourly.precipitation_probability ? hourly.precipitation_probability.slice(start, start + 12) : [];
    const willRain = upcomingPop.some(p => p > 50);
    if (willRain) new Notification('Upcoming: Rain expected', { body: 'Rain likely in the coming hours.' });
  }
}

// ------------------------ Main flow ------------------------

async function updateByCoords(lat, lon, label) {
  try {
    units = unitsEl.value;
    console.log('Updating weather for', lat, lon, 'units=', units);
    const data = await fetchWeather(lat, lon, units);
    currentCoords = { lat, lon };
    placeEl.textContent = label || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
    renderCurrent(data);
    renderMini(data);
    renderHourly(data);
    renderDaily(data);
    applyBackgroundFor(data);

    // try to set humidity from hourly (nearest)
    if (data.hourly && data.hourly.relativehumidity_2m && data.hourly.time) {
      const idx = findNearestHourlyIndex(data.hourly.time, data.current_weather.time);
      const hum = data.hourly.relativehumidity_2m[idx];
      if (typeof hum !== 'undefined') humidityEl.textContent = `Humidity: ${Math.round(hum)}%`;
    }
    scheduleImmediateNotificationIfEnabled(data);
  } catch (err) {
    console.error('updateByCoords error', err);
    alert('Unable to fetch weather: ' + (err.message || err));
    placeEl.textContent = 'Error';
    tempEl.textContent = '—';
    descEl.textContent = '—';
  }
}

// ------------------------ UI Handlers ------------------------

searchBtn.addEventListener('click', async () => {
  const q = searchEl.value.trim();
  if (!q) return alert('Please enter a city (e.g. "Paris" or "Paris,FR")');
  try {
    const results = await geocode(q);
    if (!results.length) return alert('No location found.');
    const first = results[0];
    const label = `${first.name}${first.admin1 ? ', ' + first.admin1 : ''}, ${first.country}`;
    await updateByCoords(first.latitude, first.longitude, label);
  } catch (e) {
    console.error(e);
    alert('Search failed: ' + (e.message || e));
  }
});

geoBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Geolocation not supported.');
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude, longitude } = pos.coords;
    try {
      const revRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(latitude + ',' + longitude)}&count=1`);
      const rev = await revRes.json();
      const label = (rev && rev.results && rev.results[0]) ? `${rev.results[0].name}, ${rev.results[0].country}` : 'My Location';
      await updateByCoords(latitude, longitude, label);
    } catch (err) {
      await updateByCoords(latitude, longitude, 'My Location');
    }
  }, err => {
    alert('Geolocation error: ' + err.message);
  });
});

unitsEl.addEventListener('change', () => {
  if (currentCoords) updateByCoords(currentCoords.lat, currentCoords.lon, placeEl.textContent);
});

// ------------------------ Init ------------------------

(function init() {
  unitsEl.value = units;
  console.log('Weather app initialized. Loading a default location (London) for quick test.');

  (async () => {
    try {
      const geo = await geocode('London');
      if (geo && geo[0]) {
        const f = geo[0];
        await updateByCoords(f.latitude, f.longitude, `${f.name}, ${f.country}`);
      } else {
        console.warn('Default geocode returned no result.');
      }
    } catch (e) {
      console.error('Default load failed', e);
    }
  })();
})();