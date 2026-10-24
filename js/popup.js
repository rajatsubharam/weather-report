/*
 * popup.js
 * Entry point for the popup: wires up search, location, settings and tabs,
 * and keeps the last forecast in chrome.storage so the popup opens instantly.
 */

import { searchPlaces, fetchWeather, WeatherError } from "./api.js";
import { uiIcon, weatherIcon, LOGO } from "./icons.js";
import { DEFAULT_SETTINGS, timeAgo, escapeHTML } from "./format.js";
import { getMoment, renderCurrent, renderToday, renderWeek, renderReport, renderUpdated } from "./ui.js";

const $ = (id) => document.getElementById(id);

// Re-fetch when the saved forecast is older than this.
const REFRESH_AFTER_MS = 10 * 60 * 1000;
const MAX_RECENT = 5;

const state = {
  settings: { ...DEFAULT_SETTINGS },
  place: null,       // { name, region, country, latitude, longitude, isDevice? }
  weather: null,     // { forecast, air, fetchedAt }
  recent: [],        // recently viewed places
  activeTab: "today",
  loading: false
};

/* =========================================================
   Storage
   Settings sync across the user's browsers; the place and the
   cached forecast stay on this device only.
   ========================================================= */

function loadStored() {
  return Promise.all([
    chrome.storage.sync.get({ settings: DEFAULT_SETTINGS }),
    chrome.storage.local.get({ place: null, weather: null, recent: [] })
  ]).then(([sync, local]) => {
    state.settings = { ...DEFAULT_SETTINGS, ...sync.settings };
    state.place = local.place;
    state.weather = local.weather;
    state.recent = local.recent;
  });
}

const saveSettings = () => chrome.storage.sync.set({ settings: state.settings });
const saveLocal = () => chrome.storage.local.set({
  place: state.place,
  weather: state.weather,
  recent: state.recent
});

const samePlace = (a, b) => a && b &&
  Math.abs(a.latitude - b.latitude) < 0.01 && Math.abs(a.longitude - b.longitude) < 0.01;

/* =========================================================
   View states
   ========================================================= */

function showOnly(id) {
  ["emptyState", "loadingState", "errorState", "weatherView"].forEach((section) => {
    $(section).hidden = section !== id;
  });
}

function showBanner(message, icon = "alert") {
  const banner = $("banner");
  if (!message) {
    banner.hidden = true;
    return;
  }
  banner.innerHTML = `${uiIcon(icon)}<span>${escapeHTML(message)}</span>`;
  banner.hidden = false;
}

function showError(err) {
  const offline = err && err.type === "offline";
  $("errorIcon").innerHTML = uiIcon(offline ? "offline" : "alert");
  $("errorTitle").textContent = offline ? "You're offline" : "Couldn't load the weather";
  $("errorText").textContent = offline
    ? "Connect to the internet and try again."
    : (err && err.message) || "Something went wrong. Please try again.";
  showOnly("errorState");
}

function render() {
  if (!state.place || !state.weather) return;
  const moment = getMoment(state.weather.forecast);

  renderCurrent(state.weather, state.place, state.settings, moment);
  renderToday(state.weather, state.settings, moment);
  renderWeek(state.weather, state.settings, moment);
  renderReport(state.weather, state.place, state.settings, moment);
  renderUpdated(`Updated ${timeAgo(state.weather.fetchedAt)}`);
  showOnly("weatherView");
}

/* =========================================================
   Fetching
   ========================================================= */

async function refresh({ force = false } = {}) {
  if (!state.place || state.loading) return;

  const fresh = state.weather && Date.now() - state.weather.fetchedAt < REFRESH_AFTER_MS;
  if (fresh && !force) return;

  state.loading = true;
  $("refreshBtn").classList.add("spinning");
  if (!state.weather) {
    $("loadingText").textContent = `Loading weather for ${state.place.name}…`;
    showOnly("loadingState");
  }

  try {
    state.weather = await fetchWeather(state.place);
    await saveLocal();
    showBanner(null);
    render();
  } catch (err) {
    if (state.weather) {
      // Keep showing the saved forecast and say how old it is.
      const age = timeAgo(state.weather.fetchedAt);
      showBanner(err.type === "offline"
        ? `You're offline. Showing the forecast from ${age}.`
        : `Couldn't refresh (${err.message}). Showing data from ${age}.`,
      err.type === "offline" ? "offline" : "alert");
      render();
    } else {
      showError(err);
    }
  } finally {
    state.loading = false;
    $("refreshBtn").classList.remove("spinning");
  }
}

function selectPlace(place) {
  closeSuggestions();
  $("searchInput").value = "";
  $("searchInput").blur();

  const changed = !samePlace(place, state.place);
  state.place = place;
  state.recent = [place, ...state.recent.filter((p) => !samePlace(p, place))].slice(0, MAX_RECENT);

  if (changed) {
    state.weather = null;
    showBanner(null);
  }
  saveLocal();
  setTab("today");
  refresh({ force: changed });
}

/* =========================================================
   Search box with suggestions
   ========================================================= */

let searchTimer = null;
let searchController = null;
let suggestionItems = [];
let highlighted = -1;

function placeSubtitle(p) {
  return [p.region, p.country].filter(Boolean).join(", ");
}

function openSuggestions(items, heading) {
  suggestionItems = items;
  highlighted = -1;
  const list = $("suggestions");

  if (!items.length) {
    list.innerHTML = heading ? `<li class="suggestion-empty">${escapeHTML(heading)}</li>` : "";
  } else {
    list.innerHTML = (heading ? `<li class="suggestion-note">${escapeHTML(heading)}</li>` : "") +
      items.map((p, i) => `
        <li class="suggestion" role="option" id="opt-${i}" data-index="${i}" aria-selected="false">
          ${uiIcon(p.isDevice ? "locate" : "pin")}
          <span><b>${escapeHTML(p.name)}</b><small>${escapeHTML(placeSubtitle(p))}</small></span>
        </li>`).join("");
  }

  list.hidden = !list.innerHTML;
  $("searchInput").setAttribute("aria-expanded", String(!list.hidden));
}

function closeSuggestions() {
  $("suggestions").hidden = true;
  $("searchInput").setAttribute("aria-expanded", "false");
  $("searchInput").removeAttribute("aria-activedescendant");
  highlighted = -1;
}

function moveHighlight(step) {
  if (!suggestionItems.length) return;
  highlighted = (highlighted + step + suggestionItems.length) % suggestionItems.length;
  document.querySelectorAll(".suggestion").forEach((el, i) => {
    el.classList.toggle("active", i === highlighted);
    el.setAttribute("aria-selected", String(i === highlighted));
  });
  $("searchInput").setAttribute("aria-activedescendant", `opt-${highlighted}`);
}

function showRecent() {
  if (state.recent.length) openSuggestions(state.recent, "Recent");
}

async function runSearch(query) {
  if (searchController) searchController.abort();
  searchController = new AbortController();

  try {
    const results = await searchPlaces(query, searchController.signal);
    if ($("searchInput").value.trim() !== query) return; // user kept typing
    openSuggestions(results, results.length ? "" : `No places found for "${query}"`);
    return results;
  } catch (err) {
    if (err.name === "AbortError" || searchController.signal.aborted) return;
    openSuggestions([], err instanceof WeatherError ? err.message : "Search failed. Try again.");
  }
  return [];
}

function onSearchInput() {
  const query = $("searchInput").value.trim();
  clearTimeout(searchTimer);
  if (query.length < 2) {
    if (!query) showRecent(); else closeSuggestions();
    return;
  }
  searchTimer = setTimeout(() => runSearch(query), 250);
}

async function onSearchSubmit(event) {
  event.preventDefault();
  const query = $("searchInput").value.trim();

  if (highlighted >= 0 && suggestionItems[highlighted]) {
    selectPlace(suggestionItems[highlighted]);
    return;
  }
  if (query.length < 2) return;

  clearTimeout(searchTimer);
  const results = await runSearch(query);
  if (results && results.length) selectPlace(results[0]);
}

function onSearchKey(event) {
  if (event.key === "ArrowDown") { event.preventDefault(); moveHighlight(1); }
  else if (event.key === "ArrowUp") { event.preventDefault(); moveHighlight(-1); }
  else if (event.key === "Escape") { closeSuggestions(); }
}

/* =========================================================
   Use my location
   Only runs when the user clicks the button. Coordinates are rounded
   to 2 decimals (about 1 km) before being sent to Open-Meteo.
   ========================================================= */

function useMyLocation() {
  if (!navigator.geolocation) return;
  $("locateBtn").classList.add("spinning");
  showBanner("Finding your location…", "locate");

  navigator.geolocation.getCurrentPosition((pos) => {
    $("locateBtn").classList.remove("spinning");
    showBanner(null);
    const round = (n) => Math.round(n * 100) / 100;
    selectPlace({
      name: "My location",
      region: "",
      country: "",
      latitude: round(pos.coords.latitude),
      longitude: round(pos.coords.longitude),
      isDevice: true
    });
  }, (err) => {
    $("locateBtn").classList.remove("spinning");
    const messages = {
      1: "Location access is turned off. Search for your city instead.",
      2: "Your location isn't available right now. Try searching instead.",
      3: "Finding your location took too long. Try again or search instead."
    };
    showBanner(messages[err.code] || messages[2]);
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 15 * 60 * 1000 });
}

/* =========================================================
   Tabs
   ========================================================= */

function setTab(name) {
  state.activeTab = name;
  ["today", "week", "report"].forEach((key) => {
    const selected = key === name;
    $(`tab-${key}`).setAttribute("aria-selected", String(selected));
    $(`tab-${key}`).tabIndex = selected ? 0 : -1;
    $(`panel-${key}`).hidden = !selected;
  });
}

function onTabKey(event) {
  const order = ["today", "week", "report"];
  const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
  if (!step) return;
  const next = order[(order.indexOf(state.activeTab) + step + order.length) % order.length];
  setTab(next);
  $(`tab-${next}`).focus();
}

/* =========================================================
   Settings
   ========================================================= */

function syncSettingsUI() {
  document.querySelectorAll(".segmented").forEach((group) => {
    const current = state.settings[group.dataset.setting];
    group.querySelectorAll("button").forEach((btn) => {
      btn.setAttribute("aria-checked", String(btn.dataset.value === current));
    });
  });
}

function toggleSettings(open) {
  $("settings").hidden = !open;
  $("settingsBtn").setAttribute("aria-expanded", String(open));
  if (open) $("closeSettingsBtn").focus();
}

async function clearData() {
  await chrome.storage.local.clear();
  state.place = null;
  state.weather = null;
  state.recent = [];
  toggleSettings(false);
  showBanner(null);
  renderUpdated("");
  showOnly("emptyState");
}

/* =========================================================
   Start-up
   ========================================================= */

async function setupLocationButtons() {
  // The button only appears if the extension has the geolocation permission,
  // so removing it from the manifest cleanly removes the feature.
  let allowed = false;
  try {
    allowed = !!navigator.geolocation &&
      await chrome.permissions.contains({ permissions: ["geolocation"] });
  } catch {
    allowed = false;
  }
  $("locateBtn").hidden = !allowed;
  $("emptyLocateBtn").hidden = !allowed;
}

function bindEvents() {
  $("searchForm").addEventListener("submit", onSearchSubmit);
  $("searchInput").addEventListener("input", onSearchInput);
  $("searchInput").addEventListener("keydown", onSearchKey);
  $("searchInput").addEventListener("focus", () => {
    if (!$("searchInput").value.trim()) showRecent();
  });

  // mousedown (not click) so the choice lands before the input loses focus
  $("suggestions").addEventListener("mousedown", (event) => {
    const item = event.target.closest(".suggestion");
    if (!item) return;
    event.preventDefault();
    selectPlace(suggestionItems[Number(item.dataset.index)]);
  });

  document.addEventListener("click", (event) => {
    if (!$("searchForm").contains(event.target)) closeSuggestions();
  });

  $("locateBtn").addEventListener("click", useMyLocation);
  $("emptyLocateBtn").addEventListener("click", useMyLocation);
  $("refreshBtn").addEventListener("click", () => refresh({ force: true }));
  $("retryBtn").addEventListener("click", () => refresh({ force: true }));

  ["today", "week", "report"].forEach((key) => {
    $(`tab-${key}`).addEventListener("click", () => setTab(key));
    $(`tab-${key}`).addEventListener("keydown", onTabKey);
  });

  $("settingsBtn").addEventListener("click", () => toggleSettings($("settings").hidden));
  $("closeSettingsBtn").addEventListener("click", () => toggleSettings(false));
  $("clearDataBtn").addEventListener("click", clearData);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("settings").hidden) toggleSettings(false);
  });

  document.querySelectorAll(".segmented").forEach((group) => {
    group.addEventListener("click", (event) => {
      const btn = event.target.closest("button");
      if (!btn) return;
      state.settings[group.dataset.setting] = btn.dataset.value;
      saveSettings();
      syncSettingsUI();
      render();
    });
  });

  // Came back online: refresh straight away.
  window.addEventListener("online", () => refresh({ force: true }));
}

function drawStaticIcons() {
  $("brandLogo").innerHTML = LOGO;
  $("refreshBtn").innerHTML = uiIcon("refresh");
  $("settingsBtn").innerHTML = uiIcon("sliders");
  $("closeSettingsBtn").innerHTML = uiIcon("close");
  $("searchIcon").innerHTML = uiIcon("search");
  $("locateBtn").innerHTML = uiIcon("locate");
  $("emptyArt").innerHTML = weatherIcon(2, true);
  $("versionText").textContent = `v${chrome.runtime.getManifest().version}`;
}

async function init() {
  drawStaticIcons();
  bindEvents();
  await Promise.all([loadStored(), setupLocationButtons()]);
  syncSettingsUI();
  setTab("today");

  if (!state.place) {
    showOnly("emptyState");
    $("searchInput").focus();
    return;
  }

  if (state.weather) render();   // show the saved forecast immediately
  refresh();                     // then update it if it's getting old
}

init();
