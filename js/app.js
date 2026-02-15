/**
 * app.js
 * ======
 * The UI layer. Three responsibilities:
 *
 *   1. Bootstrap  — on DOMContentLoaded, load XML data, build screens, first render.
 *
 *   2. Builders   — run ONCE at startup.
 *                   Call template functions from templates.js to get the HTML,
 *                   then inject it into the DOM.
 *
 *   3. Renderers  — run after EVERY state change.
 *                   Only patch text, attributes, and CSS classes on elements
 *                   that already exist. No innerHTML in hot paths.
 *
 * Pattern after any user interaction:
 *   mutate state  →  recalculate(state)  →  render()
 *
 * Load order: data.js → state.js → engine.js → templates.js → app.js
 */


// ─────────────────────────────────────────────────────────────────────────────
//  GLOBALS
// ─────────────────────────────────────────────────────────────────────────────

/** @type {AircraftState} — set once by init(), used everywhere after. */
let STATE = null;

/** Which screen is currently visible: "overview" | "fuel" | "ammo" */
let activeScreen = "overview";


// ─────────────────────────────────────────────────────────────────────────────
//  BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", init);

async function init() {
    try {
        // Parse both XML strings from the inline constants in data.js
        STATE = XmlParser.loadData();

        // First calculation — populates state.derived before any render
        recalculate(STATE);

        // Build every screen's HTML skeleton (runs once)
        buildTopBar();
        buildOverviewScreen();
        buildFuelScreen();
        buildAmmoScreen();

        // First render — fills all the values we just built
        render();

        // Show the app, hide the loading spinner
        document.getElementById("loading-overlay").classList.add("hidden");
        document.getElementById("app").classList.add("app--ready");

    } catch (err) {
        // Show the error message in the loading overlay instead of a blank screen
        const overlay = document.getElementById("loading-overlay");
        overlay.innerHTML = `
            <div class="error-box">
                <div class="error-title">⚠ SYSTEM FAULT</div>
                <div class="error-msg">${err.message}</div>
            </div>`;
        console.error("Init failed:", err);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  SCREEN ROUTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Switches the visible screen and updates the nav tab highlight.
 * @param {"overview"|"fuel"|"ammo"} screenId
 */
function showScreen(screenId) {
    activeScreen = screenId;

    // Swap screen visibility
    document.querySelectorAll(".screen").forEach(el => {
        el.classList.toggle("screen--active", el.dataset.screen === screenId);
    });

    // Swap nav tab active state
    document.querySelectorAll(".nav-tab").forEach(el => {
        el.classList.toggle("nav-tab--active", el.dataset.screen === screenId);
    });
}


// ─────────────────────────────────────────────────────────────────────────────
//  BUILDERS — call template functions, inject HTML, attach events
// ─────────────────────────────────────────────────────────────────────────────

function buildTopBar() {
    document.getElementById("top-bar").innerHTML = tplTopBar();
}

function buildOverviewScreen() {
    const screen      = document.querySelector('.screen[data-screen="overview"]');
    const aircraftSvg = tplAircraftSvg(STATE.weaponStations);
    screen.innerHTML   = tplOverviewScreen(STATE.config, aircraftSvg, fmt);
}

function buildFuelScreen() {
    const screen  = document.querySelector('.screen[data-screen="fuel"]');
    const tankSvg = tplTankSvg();
    screen.innerHTML = tplFuelScreen(STATE.maxFuel, STATE.fuelWeight, tankSvg, fmt);

    // Attach events after the HTML is in the DOM
    document.getElementById("fuel-slider").addEventListener("input", onFuelSlider);
    document.getElementById("fuel-input").addEventListener("change", onFuelInput);
}

function buildAmmoScreen() {
    const screen        = document.querySelector('.screen[data-screen="ammo"]');
    const stationMapSvg = tplStationMapSvg(STATE.weaponStations);
    screen.innerHTML     = tplAmmoScreen(stationMapSvg);

    buildStationRows();
}

/**
 * Builds one row per weapon station inside #station-rows.
 * Each row contains a <select> with the compatible stores for that station.
 * Called once — the dropdowns stay in the DOM and renderAmmo() syncs their values.
 */
function buildStationRows() {
    const container = document.getElementById("station-rows");

    STATE.weaponStations.forEach(station => {
        const compatible = STATE.compatibleStores(station);

        // Build the <option> list
        let optionsHtml = `<option value="">— EMPTY —</option>`;
        compatible.forEach(store => {
            const overweight = store.weight > station.maxWeight;
            const stealthTag = store.stealth ? "" : " [NS]";
            const warnTag    = overweight   ? " ⚠" : "";
            optionsHtml += `
                <option
                    value="${store.id}"
                    ${overweight ? "disabled" : ""}
                >
                    ${store.name}${stealthTag}  —  ${store.weight} lbs${warnTag}
                </option>`;
        });

        const row = document.createElement("div");
        row.className  = "station-row";
        row.id         = `station-row-${station.id}`;
        row.dataset.stationId = station.id;
        row.innerHTML  = tplStationRow(station, optionsHtml);

        container.appendChild(row);
    });
}


// ─────────────────────────────────────────────────────────────────────────────
//  MASTER RENDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders all three screens and the top bar.
 * Called after every state change (recalculate must have already run).
 */
function render() {
    renderTopBar();
    renderOverview();
    renderFuel();
    renderAmmo();
}


// ─────────────────────────────────────────────────────────────────────────────
//  RENDER — TOP BAR
// ─────────────────────────────────────────────────────────────────────────────

function renderTopBar() {
    const d   = STATE.derived;
    const cfg = STATE.config;

    setText("bind-topbar-gw",   fmt(d.grossWeight));
    setText("bind-topbar-fuel", STATE.fuelPercent);
    setText("bind-topbar-cg",   d.cgInches.toFixed(1));
    setText("bind-topbar-vr",   d.vr);
    setText("bind-topbar-vref", d.vref);

    // Weight status badge
    const gwPct = (d.grossWeight / cfg.maxWeight) * 100;
    setStatusBadge("bind-topbar-weight-status",
        d.weightStatus,
        gwPct > 100 ? "OVER MAX" : gwPct > 95 ? "NEAR MAX" : "NOMINAL"
    );

    // CG status badge
    setStatusBadge("bind-topbar-cg-status",
        d.cgStatus,
        d.cgStatus === "LIMIT" ? "CG LIMIT" : d.cgStatus === "CAUTION" ? "CG CAUTION" : "CG OK"
    );

    // Stealth badge
    const stealthEl = document.getElementById("bind-topbar-stealth");
    if (stealthEl) {
        stealthEl.textContent = d.isStealthConfig ? "◆ STEALTH" : "◇ NON-STEALTH";
        stealthEl.className   = d.isStealthConfig
            ? "badge badge--stealth-on"
            : "badge badge--stealth-off";
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  RENDER — OVERVIEW SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function renderOverview() {
    const d   = STATE.derived;
    const cfg = STATE.config;

    // Mass table
    setText("bind-ov-weapon-wt", fmt(d.weaponWeight));
    setText("bind-ov-zfw",       fmt(d.zeroFuelWeight));
    setText("bind-ov-fuel",      fmt(STATE.fuelWeight));
    setText("bind-ov-gw",        fmt(d.grossWeight));

    // Weight bar
    const wPct = Math.min((d.grossWeight / cfg.maxWeight) * 100, 100);
    setBar("bind-ov-weight-bar", wPct, d.weightStatus);

    // CG readout
    setText("bind-ov-cg-readout",
        `CG ${d.cgInches.toFixed(1)}"  (${d.cgPercent.toFixed(1)}%)`);

    // CG marker on ruler — clamp to [0,100] for visual even if outside limits
    const markerPct = Math.max(0, Math.min(d.cgPercent, 100));
    setStyle("bind-cg-marker", "left", `${markerPct}%`);
    setClass("bind-cg-marker", "cg-marker", statusClass(d.cgStatus));

    // CG status badge
    setStatusBadge("bind-ov-cg-status", d.cgStatus,
        d.cgStatus === "LIMIT" ? "CG OUTSIDE LIMITS" :
        d.cgStatus === "CAUTION" ? "CG CAUTION" : "CG NORMAL");

    // CG diamond on silhouette (top-down view)
    // Map cgInches → x position in the SVG (fwd limit = x~60, aft limit = x~440)
    const SVG_FWD_X = 60, SVG_AFT_X = 440;
    const cgRatio = (d.cgInches - cfg.cgLimits.forward) / cfg.cgEnvelopeRange;
    const diamondX = Math.round(SVG_FWD_X + cgRatio * (SVG_AFT_X - SVG_FWD_X));
    const dEl = document.getElementById("bind-cg-diamond");
    if (dEl) {
        dEl.setAttribute("points",
            `${diamondX},353 ${diamondX+7},360 ${diamondX},367 ${diamondX-7},360`);
    }

    // Performance table
    setText("bind-ov-vr",   d.vr);
    setText("bind-ov-vref", d.vref);
    setText("bind-ov-tod",  fmt(d.takeoffDistance));
    setText("bind-ov-drag", `${d.dragMultiplier.toFixed(3)}`);

    // Takeoff distance bar (reference: 8000 ft)
    const todPct = Math.min((d.takeoffDistance / 8000) * 100, 100);
    setBar("bind-ov-tod-bar", todPct, todPct > 100 ? "LIMIT" : todPct > 85 ? "CAUTION" : "NORMAL");

    // Station dots on silhouette
    STATE.weaponStations.forEach(station => {
        const dot = document.getElementById(`dot-${station.id}`);
        if (!dot) return;
        dot.className.baseVal = `station-dot ${stationDotClass(station)}`;
    });

    // Loadout chips
    renderLoadoutChips();
}

/** Renders the loadout chips in the overview panel. */
function renderLoadoutChips() {
    const container = document.getElementById("bind-ov-loadout-chips");
    if (!container) return;

    const armed = STATE.weaponStations.filter(s => s.isArmed);

    if (armed.length === 0) {
        container.innerHTML = `<span class="chips-empty">No weapons loaded</span>`;
        return;
    }

    container.innerHTML = armed.map(station => {
        const store = STATE.getStore(state_getLoadedStore(station.id));
        const cls   = station.isExternal ? "chip chip--ext" : "chip chip--int";
        return `<span class="${cls}">
                    <span class="chip-id">${station.id.replace("STA_", "")}</span>
                    <span class="chip-name">${store.name}</span>
                </span>`;
    }).join("");
}


// ─────────────────────────────────────────────────────────────────────────────
//  RENDER — FUEL SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function renderFuel() {
    const d   = STATE.derived;
    const pct = STATE.fuelPercent;

    // Data readouts
    setText("bind-fuel-lbs", fmt(STATE.fuelWeight));
    setText("bind-fuel-pct", pct);
    setText("bind-fuel-gw",  fmt(d.grossWeight));
    setText("bind-fuel-cg",  d.cgInches.toFixed(1));
    setText("bind-tank-pct", `${pct}%`);
    setText("bind-fuel-cg-readout",
        `${d.cgInches.toFixed(1)}"  (${d.cgPercent.toFixed(1)}%)`);

    // CG marker on fuel screen ruler
    const markerPct = Math.max(0, Math.min(d.cgPercent, 100));
    setStyle("bind-fuel-cg-marker", "left", `${markerPct}%`);

    // Fuel status badge
    const lowFuel = pct < 15;
    const fuBadge = document.getElementById("bind-fuel-status");
    if (fuBadge) {
        fuBadge.textContent = lowFuel ? "LOW FUEL" : "NOMINAL";
        fuBadge.className   = lowFuel ? "badge badge--limit" : "badge badge--normal";
    }

    // Tank SVG fill
    // The viewBox is 0→460 in height.
    // Tank occupies y=40 (top/100%) to y=400 (bottom/0%) → span = 360px
    const TANK_TOP    = 40;
    const TANK_BOTTOM = 400;
    const tankSpan    = TANK_BOTTOM - TANK_TOP;
    const fillHeight  = Math.round((pct / 100) * tankSpan);
    const fillY       = TANK_BOTTOM - fillHeight;

    const fillRect = document.getElementById("tank-fill");
    if (fillRect) {
        fillRect.setAttribute("y",      fillY);
        fillRect.setAttribute("height", fillHeight);
    }

    const surfaceLine = document.getElementById("tank-surface-line");
    if (surfaceLine) {
        surfaceLine.setAttribute("y1", fillY);
        surfaceLine.setAttribute("y2", fillY);
    }

    // Sync slider gradient (CSS can't read value, so we use inline background)
    const slider = document.getElementById("fuel-slider");
    if (slider) {
        slider.style.setProperty("--fill-pct", `${pct}%`);
        slider.style.background =
            `linear-gradient(to right, var(--col-green) ${pct}%, var(--track-bg) ${pct}%)`;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  RENDER — AMMO SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function renderAmmo() {
    const d = STATE.derived;

    // Summary
    setText("bind-ammo-weapon-wt", fmt(d.weaponWeight));
    setText("bind-ammo-gw",        fmt(d.grossWeight));
    setText("bind-ammo-cg",        d.cgInches.toFixed(1));

    // Stealth badge
    const stealthEl = document.getElementById("bind-ammo-stealth");
    if (stealthEl) {
        stealthEl.textContent = d.isStealthConfig ? "◆ STEALTH" : "◇ NON-STEALTH";
        stealthEl.className   = d.isStealthConfig
            ? "badge badge--stealth-on"
            : "badge badge--stealth-off";
    }

    // Per-station: sync dropdown value, update weight readout, update row highlight
    STATE.weaponStations.forEach(station => {
        // Sync dropdown to state (in case clearAll() was called)
        const select = document.getElementById(`select-${station.id}`);
        if (select) {
            const currentVal = station.loadedStoreId || "";
            if (select.value !== currentVal) select.value = currentVal;
        }

        // Weight readout next to the dropdown
        const wtEl = document.getElementById(`bind-station-wt-${station.id}`);
        if (wtEl) {
            const store = state_getLoadedStore(station.id);
            wtEl.textContent = store ? `${fmt(store.weight)} LBS` : "";
        }

        // Row armed/empty highlight
        const rowEl = document.getElementById(`station-row-${station.id}`);
        if (rowEl) {
            rowEl.classList.toggle("station-row--armed", station.isArmed);
        }

        // Station dot on the map
        const mapDot = document.getElementById(`map-dot-${station.id}`);
        if (mapDot) {
            mapDot.className.baseVal = `station-dot ${stationDotClass(station)}`;
        }
    });
}


// ─────────────────────────────────────────────────────────────────────────────
//  EVENT HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

/** Fuel slider moved. */
function onFuelSlider(e) {
    STATE.fuelWeight = parseInt(e.target.value, 10);
    // Keep the number input in sync
    const input = document.getElementById("fuel-input");
    if (input) input.value = STATE.fuelWeight;
    recalculate(STATE);
    render();
}

/** Fuel number input changed (fires on blur/Enter). */
function onFuelInput(e) {
    const val = parseInt(e.target.value, 10);
    STATE.fuelWeight = isNaN(val) ? 0 : val;   // setter clamps automatically
    // Keep the slider in sync
    const slider = document.getElementById("fuel-slider");
    if (slider) slider.value = STATE.fuelWeight;
    // Keep the input showing the clamped value
    e.target.value = STATE.fuelWeight;
    recalculate(STATE);
    render();
}

/** Preset button clicked. @param {number} fraction — 0 to 1 */
function setFuelPreset(fraction) {
    STATE.fuelWeight = Math.round(STATE.maxFuel * fraction);
    const slider = document.getElementById("fuel-slider");
    const input  = document.getElementById("fuel-input");
    if (slider) slider.value = STATE.fuelWeight;
    if (input)  input.value  = STATE.fuelWeight;
    recalculate(STATE);
    render();
}

/** Station dropdown changed. */
function onStationChange(stationId, value) {
    if (value === "") {
        STATE.clearStation(stationId);
    } else {
        STATE.loadStore(stationId, value);
    }
    recalculate(STATE);
    render();
}

/** Clear all stations button. */
function clearAll() {
    STATE.clearAllStations();
    recalculate(STATE);
    render();
}


// ─────────────────────────────────────────────────────────────────────────────
//  UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sets the textContent of an element by id.
 * Silent no-op if the element doesn't exist.
 */
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

/**
 * Sets an inline style property on an element by id.
 */
function setStyle(id, prop, value) {
    const el = document.getElementById(id);
    if (el) el.style[prop] = value;
}

/**
 * Sets the className of an element by id.
 */
function setClass(id, ...classes) {
    const el = document.getElementById(id);
    if (el) el.className = classes.filter(Boolean).join(" ");
}

/**
 * Sets a fill bar width and applies a status colour class.
 * @param {string} id       — element id
 * @param {number} pct      — 0–100
 * @param {string} status   — "NORMAL" | "CAUTION" | "LIMIT"
 */
function setBar(id, pct, status) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.width = `${Math.max(0, Math.min(pct, 100))}%`;
    el.className   = `bar-fill ${statusClass(status)}`;
}

/**
 * Sets a badge's text and applies the correct status colour class.
 * @param {string} id
 * @param {"NORMAL"|"CAUTION"|"LIMIT"} status
 * @param {string} label
 */
function setStatusBadge(id, status, label) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = label;
    el.className   = `badge ${statusClass(status)}`;
}

/**
 * Maps a status string to a CSS modifier class.
 * @param {"NORMAL"|"CAUTION"|"LIMIT"} status
 * @returns {string}
 */
function statusClass(status) {
    if (status === "LIMIT")   return "badge--limit";
    if (status === "CAUTION") return "badge--caution";
    return "badge--normal";
}

/**
 * Returns the CSS class for a station dot based on its armed state and type.
 * @param {Station} station
 * @returns {string}
 */
function stationDotClass(station) {
    if (!station.isArmed)    return "station-dot--empty";
    if (station.isExternal)  return "station-dot--external";
    return "station-dot--internal";
}

/**
 * Convenience wrapper: get the loaded Store for a station id directly from STATE.
 * @param {string} stationId
 * @returns {Store|null}
 */
function state_getLoadedStore(stationId) {
    return STATE.getLoadedStore(stationId);
}

/**
 * Formats a number as a thousands-separated integer string.
 * e.g. 29300 → "29,300"
 * @param {number} n
 * @returns {string}
 */
function fmt(n) {
    return Math.round(n).toLocaleString("en-US");
}