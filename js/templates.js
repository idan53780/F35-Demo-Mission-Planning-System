/**
 * templates.js
 * ============
 * All HTML templates used by app.js, extracted into pure functions.
 *
 * Each function returns a string of HTML. The builder functions in app.js
 * call these, inject the returned HTML into the DOM, then attach event
 * listeners.
 *
 * Load order: data.js → state.js → engine.js → templates.js → app.js
 */


// ─────────────────────────────────────────────────────────────────────────────
//  TOP BAR
// ─────────────────────────────────────────────────────────────────────────────

function tplTopBar() {
    return `
        <div class="topbar-brand">
            <span class="brand-name">F-35A ADIR</span>
            <span class="brand-sub">IAF LOAD &amp; PERF TOOL</span>
        </div>

        <div class="topbar-stats">
            <div class="topbar-stat">
                <span class="stat-label">GROSS WT</span>
                <span class="stat-value" id="bind-topbar-gw">—</span>
                <span class="stat-unit">LBS</span>
            </div>
            <div class="topbar-stat">
                <span class="stat-label">FUEL</span>
                <span class="stat-value" id="bind-topbar-fuel">—</span>
                <span class="stat-unit">%</span>
            </div>
            <div class="topbar-stat">
                <span class="stat-label">CG</span>
                <span class="stat-value" id="bind-topbar-cg">—</span>
                <span class="stat-unit">"</span>
            </div>
            <div class="topbar-stat">
                <span class="stat-label">Vr</span>
                <span class="stat-value" id="bind-topbar-vr">—</span>
                <span class="stat-unit">KT</span>
            </div>
            <div class="topbar-stat">
                <span class="stat-label">Vref</span>
                <span class="stat-value" id="bind-topbar-vref">—</span>
                <span class="stat-unit">KT</span>
            </div>
        </div>

        <div class="topbar-badges">
            <span class="badge" id="bind-topbar-weight-status">NOMINAL</span>
            <span class="badge" id="bind-topbar-cg-status">CG OK</span>
            <span class="badge" id="bind-topbar-stealth">◆ STEALTH</span>
        </div>
    `;
}


// ─────────────────────────────────────────────────────────────────────────────
//  OVERVIEW SCREEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {AircraftConfig} cfg
 * @param {string} aircraftSvg — SVG markup from tplAircraftSvg()
 * @param {Function} fmt — number formatter
 */
function tplOverviewScreen(cfg, aircraftSvg, fmt) {
    return `
        <div class="overview-layout">

            <!-- Column 1: Mass breakdown -->
            <div class="panel">
                <h2 class="panel-title">MASS BREAKDOWN</h2>

                <table class="data-table">
                    <tr>
                        <td class="dt-label">Empty weight</td>
                        <td class="dt-value">${fmt(cfg.emptyWeight)}</td>
                        <td class="dt-unit">LBS</td>
                    </tr>
                    <tr>
                        <td class="dt-label">Weapon weight</td>
                        <td class="dt-value" id="bind-ov-weapon-wt">—</td>
                        <td class="dt-unit">LBS</td>
                    </tr>
                    <tr class="dt-row-sub">
                        <td class="dt-label">Zero fuel weight</td>
                        <td class="dt-value" id="bind-ov-zfw">—</td>
                        <td class="dt-unit">LBS</td>
                    </tr>
                    <tr>
                        <td class="dt-label">Fuel</td>
                        <td class="dt-value" id="bind-ov-fuel">—</td>
                        <td class="dt-unit">LBS</td>
                    </tr>
                    <tr class="dt-row-total">
                        <td class="dt-label">GROSS WEIGHT</td>
                        <td class="dt-value" id="bind-ov-gw">—</td>
                        <td class="dt-unit">LBS</td>
                    </tr>
                    <tr class="dt-row-limit">
                        <td class="dt-label">Max allowed</td>
                        <td class="dt-value">${fmt(cfg.maxWeight)}</td>
                        <td class="dt-unit">LBS</td>
                    </tr>
                </table>

                <!-- Weight loading bar -->
                <div class="gauge-label">WEIGHT LOADING</div>
                <div class="bar-track">
                    <div class="bar-fill" id="bind-ov-weight-bar"></div>
                    <!-- 95% caution marker -->
                    <div class="bar-marker" style="left: 95%"></div>
                </div>
                <div class="bar-legend">
                    <span>0</span>
                    <span>${fmt(cfg.maxWeight)} LBS MAX</span>
                </div>
            </div>

            <!-- Column 2: CG diagram -->
            <div class="panel panel--center">
                <h2 class="panel-title">CENTRE OF GRAVITY</h2>

                <!-- Aircraft silhouette with station dots -->
                <div class="silhouette-wrap">
                    <svg class="silhouette-svg" viewBox="0 0 500 580" xmlns="http://www.w3.org/2000/svg">
                        ${aircraftSvg}
                    </svg>
                </div>

                <!-- CG ruler -->
                <div class="cg-ruler-labels">
                    <span>FWD ${cfg.cgLimits.forward}"</span>
                    <span id="bind-ov-cg-readout">CG —"  (—%)</span>
                    <span>AFT ${cfg.cgLimits.aft}"</span>
                </div>
                <div class="cg-track">
                    <div class="cg-zone cg-zone--normal"></div>
                    <div class="cg-marker" id="bind-cg-marker"></div>
                </div>
                <div class="cg-status-row">
                    <span class="badge" id="bind-ov-cg-status">CG OK</span>
                </div>
            </div>

            <!-- Column 3: Performance -->
            <div class="panel">
                <h2 class="panel-title">PERFORMANCE</h2>

                <table class="data-table">
                    <tr>
                        <td class="dt-label">Rotation speed (Vr)</td>
                        <td class="dt-value dt-value--large" id="bind-ov-vr">—</td>
                        <td class="dt-unit">KIAS</td>
                    </tr>
                    <tr>
                        <td class="dt-label">Landing ref (Vref)</td>
                        <td class="dt-value dt-value--large" id="bind-ov-vref">—</td>
                        <td class="dt-unit">KIAS</td>
                    </tr>
                    <tr>
                        <td class="dt-label">T/O ground roll</td>
                        <td class="dt-value" id="bind-ov-tod">—</td>
                        <td class="dt-unit">FT</td>
                    </tr>
                    <tr>
                        <td class="dt-label">Drag multiplier</td>
                        <td class="dt-value" id="bind-ov-drag">—</td>
                        <td class="dt-unit">×</td>
                    </tr>
                </table>

                <!-- Takeoff distance bar (reference: 8000 ft runway) -->
                <div class="gauge-label">T/O ROLL vs 8,000 FT RUNWAY</div>
                <div class="bar-track">
                    <div class="bar-fill" id="bind-ov-tod-bar"></div>
                    <div class="bar-marker" style="left: 100%"></div>
                </div>
                <div class="bar-legend">
                    <span>0</span>
                    <span>8,000 FT</span>
                </div>

                <!-- Active loadout chips -->
                <div class="gauge-label" style="margin-top: 20px">WEAPON CONFIGURATION</div>
                <div class="loadout-chips" id="bind-ov-loadout-chips"></div>
            </div>

        </div>
    `;
}


// ─────────────────────────────────────────────────────────────────────────────
//  FUEL SCREEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {number} maxFuel
 * @param {number} currentFuel
 * @param {string} tankSvg — SVG markup from tplTankSvg()
 * @param {Function} fmt
 */
function tplFuelScreen(maxFuel, currentFuel, tankSvg, fmt) {
    return `
        <div class="fuel-layout">

            <!-- Left: controls -->
            <div class="panel">
                <h2 class="panel-title">FUEL CONFIGURATION</h2>

                <label class="field-label" for="fuel-input">FUEL QUANTITY (LBS)</label>
                <div class="fuel-input-row">
                    <input
                        type="number"
                        id="fuel-input"
                        class="hud-input"
                        min="0"
                        max="${maxFuel}"
                        step="100"
                        value="${currentFuel}"
                    />
                    <span class="input-unit">LBS</span>
                </div>

                <input
                    type="range"
                    id="fuel-slider"
                    class="hud-slider"
                    min="0"
                    max="${maxFuel}"
                    step="100"
                    value="${currentFuel}"
                />
                <div class="slider-legend">
                    <span>0</span>
                    <span>50%</span>
                    <span>${fmt(maxFuel)} LBS</span>
                </div>

                <!-- Quick preset buttons -->
                <div class="preset-row">
                    <button class="preset-btn" onclick="setFuelPreset(0)">EMPTY</button>
                    <button class="preset-btn" onclick="setFuelPreset(0.25)">25%</button>
                    <button class="preset-btn" onclick="setFuelPreset(0.50)">50%</button>
                    <button class="preset-btn" onclick="setFuelPreset(0.75)">75%</button>
                    <button class="preset-btn" onclick="setFuelPreset(1.0)">FULL</button>
                </div>

                <!-- Live readout table -->
                <table class="data-table" style="margin-top: 20px">
                    <tr>
                        <td class="dt-label">Fuel weight</td>
                        <td class="dt-value" id="bind-fuel-lbs">—</td>
                        <td class="dt-unit">LBS</td>
                    </tr>
                    <tr>
                        <td class="dt-label">Fuel level</td>
                        <td class="dt-value" id="bind-fuel-pct">—</td>
                        <td class="dt-unit">%</td>
                    </tr>
                    <tr>
                        <td class="dt-label">Gross weight</td>
                        <td class="dt-value" id="bind-fuel-gw">—</td>
                        <td class="dt-unit">LBS</td>
                    </tr>
                    <tr>
                        <td class="dt-label">CG (with fuel)</td>
                        <td class="dt-value" id="bind-fuel-cg">—</td>
                        <td class="dt-unit">"</td>
                    </tr>
                </table>

                <!-- CG track -->
                <div class="gauge-label" style="margin-top: 16px">CG POSITION</div>
                <div class="cg-ruler-labels">
                    <span>FWD</span>
                    <span id="bind-fuel-cg-readout">—</span>
                    <span>AFT</span>
                </div>
                <div class="cg-track">
                    <div class="cg-zone cg-zone--normal"></div>
                    <div class="cg-marker" id="bind-fuel-cg-marker"></div>
                </div>
            </div>

            <!-- Right: tank visualisation -->
            <div class="panel panel--center">
                <h2 class="panel-title">INTERNAL FUEL TANK</h2>
                <div class="tank-wrap">
                    <svg
                        id="fuel-tank-svg"
                        class="tank-svg"
                        viewBox="0 0 200 460"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        ${tankSvg}
                    </svg>
                </div>
                <div class="tank-readout">
                    <span class="tank-pct" id="bind-tank-pct">—%</span>
                    <span class="tank-label">FUEL LEVEL</span>
                </div>
                <div class="badge-row">
                    <span class="badge" id="bind-fuel-status">NOMINAL</span>
                </div>
            </div>

        </div>
    `;
}


// ─────────────────────────────────────────────────────────────────────────────
//  AMMO SCREEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} stationMapSvg — SVG markup from tplStationMapSvg()
 */
function tplAmmoScreen(stationMapSvg) {
    return `
        <div class="ammo-layout">

            <!-- Left: station map -->
            <div class="panel">
                <h2 class="panel-title">WEAPON STATIONS</h2>
                <div class="station-map-wrap">
                    <svg
                        id="station-map-svg"
                        class="station-map-svg"
                        viewBox="0 0 500 280"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        ${stationMapSvg}
                    </svg>
                </div>
                <div class="map-legend">
                    <span class="legend-dot legend-dot--internal"></span>Internal armed
                    <span class="legend-dot legend-dot--external"></span>External armed
                    <span class="legend-dot legend-dot--empty"></span>Empty
                </div>
            </div>

            <!-- Right: loadout configuration -->
            <div class="panel">
                <div class="panel-title-row">
                    <h2 class="panel-title">WEAPON CONFIGURATION</h2>
                    <button class="clear-btn" onclick="clearAll()">CLEAR ALL</button>
                </div>

                <!-- One row per weapon station, built dynamically -->
                <div class="station-rows" id="station-rows"></div>

                <!-- Summary -->
                <div class="ammo-summary">
                    <table class="data-table">
                        <tr>
                            <td class="dt-label">Total weapon weight</td>
                            <td class="dt-value" id="bind-ammo-weapon-wt">—</td>
                            <td class="dt-unit">LBS</td>
                        </tr>
                        <tr>
                            <td class="dt-label">Gross weight</td>
                            <td class="dt-value" id="bind-ammo-gw">—</td>
                            <td class="dt-unit">LBS</td>
                        </tr>
                        <tr>
                            <td class="dt-label">CG after loadout</td>
                            <td class="dt-value" id="bind-ammo-cg">—</td>
                            <td class="dt-unit">"</td>
                        </tr>
                    </table>
                    <div class="badge-row" style="margin-top: 8px">
                        <span class="badge" id="bind-ammo-stealth">◆ STEALTH</span>
                    </div>
                </div>
            </div>

        </div>
    `;
}


/**
 * Returns HTML for a single station row (used in the ammo screen).
 * @param {Station} station
 * @param {string} optionsHtml — pre-built <option> tags
 */
function tplStationRow(station, optionsHtml) {
    const typeLabel = station.isInternal ? "INT" : "EXT";
    const capLabel  = station.capability === "AA_Only" ? "A/A"
                    : station.capability === "AG_Only" ? "A/G"
                    : "MR";

    return `
        <div class="station-row-info">
            <span class="station-id">${station.id.replace("STA_", "STA ")}</span>
            <span class="station-name">${station.name}</span>
            <div class="station-tags">
                <span class="tag tag--${station.isExternal ? "ext" : "int"}">${typeLabel}</span>
                <span class="tag tag--cap">${capLabel}</span>
            </div>
        </div>
        <div class="station-row-select">
            <select
                class="hud-select"
                id="select-${station.id}"
                onchange="onStationChange('${station.id}', this.value)"
            >
                ${optionsHtml}
            </select>
            <span class="station-weight-readout" id="bind-station-wt-${station.id}"></span>
        </div>
    `;
}


// ─────────────────────────────────────────────────────────────────────────────
//  SVG TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Station positions for the TOP-DOWN view (overview screen).
 * Mapped to the F35_top_view_hud.png image within a 500×640 viewBox.
 * The image is nose-up, so Y increases downward (nose=top, tail=bottom).
 * Stations are left-to-right across the wings.
 */
const STATION_POSITIONS_TOP = {
    STA_1:  { x: 68,  y: 378 },   // Wingtip left
    STA_2:  { x: 110, y: 365 },   // Outer pylon left
    STA_3:  { x: 160, y: 348 },   // Mid pylon left
    STA_4:  { x: 218, y: 356 },   // Internal heavy left
    STA_5:  { x: 232, y: 325 },   // Internal A/A left
    STA_7:  { x: 268, y: 325 },   // Internal A/A right
    STA_8:  { x: 282, y: 356 },   // Internal heavy right
    STA_9:  { x: 340, y: 348 },   // Mid pylon right
    STA_10: { x: 390, y: 365 },   // Outer pylon right
    STA_11: { x: 432, y: 378 },   // Wingtip right
};

/**
 * Station positions for the FRONT view (ammunition screen).
 * Mapped to the F35_front_hud.png image within a 500×340 viewBox.
 * Looking head-on: left wing is screen-left, right wing is screen-right.
 * Stations spread horizontally across the wingspan.
 */
const STATION_POSITIONS_FRONT = {
    STA_1:  { x: 45,  y: 215 },   // Wingtip left
    STA_2:  { x: 75,  y: 225 },   // Outer pylon left
    STA_3:  { x: 125, y: 230 },   // Mid pylon left
    STA_4:  { x: 215, y: 245 },   // Internal heavy left
    STA_5:  { x: 237, y: 270 },   // Internal A/A left
    STA_7:  { x: 290, y: 270 },   // Internal A/A right
    STA_8:  { x: 310, y: 245 },   // Internal heavy right
    STA_9:  { x: 400, y: 230 },   // Mid pylon right
    STA_10: { x: 450, y: 225 },   // Outer pylon right
    STA_11: { x: 480, y: 215 },   // Wingtip right
};


/**
 * Aircraft top-down  for the overview screen (includes CG line + diamond).
 * Uses F35_top_view_hud.png as the background image.
 * @param {Station[]} weaponStations
 */
function tplAircraftSvg(weaponStations) {
    let stationDots = "";
    weaponStations.forEach(station => {
        const pos = STATION_POSITIONS_TOP[station.id];
        if (!pos) return;
        stationDots += `
            <circle
                id="dot-${station.id}"
                cx="${pos.x}" cy="${pos.y}" r="7"
                class="station-dot station-dot--empty"
            />`;
    });

    return `
        <!-- F-35 top-down photograph (HUD-processed) -->
        <image
            href="assets/F35_top_view_hud.png"
            x="30" y="10"
            width="440" height="565"
            opacity="0.85"
        />

       

        <!-- Station dots -->
        ${stationDots}
    `;
}


/**
 * Fuel tank cross-section SVG.
 */
function tplTankSvg() {
    return `
        <defs>
            <linearGradient id="fuel-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stop-color="var(--col-green)"     stop-opacity="0.9"/>
                <stop offset="100%" stop-color="var(--col-green-dark)" stop-opacity="0.5"/>
            </linearGradient>
            <clipPath id="tank-clip">
                <path d="M40 40 Q100 10 160 40 L168 400 Q100 430 32 400 Z"/>
            </clipPath>
        </defs>

        <!-- Tank shell -->
        <path d="M40 40 Q100 10 160 40 L168 400 Q100 430 32 400 Z"
            fill="rgba(0,255,136,0.04)" stroke="var(--col-green)"
            stroke-width="1.3" opacity="0.6"/>

        <!-- Fuel fill (clip-pathed, height driven by renderFuel) -->
        <rect
            id="tank-fill"
            x="28" y="400" width="144" height="0"
            fill="url(#fuel-grad)"
            clip-path="url(#tank-clip)"/>

        <!-- Fuel surface line -->
        <line id="tank-surface-line"
            x1="35" y1="400" x2="165" y2="400"
            stroke="var(--col-green)" stroke-width="1.8" opacity="0.9"/>

        <!-- Horizontal grid lines (static) -->
        <line x1="38" y1="118" x2="162" y2="118"
            stroke="var(--col-green)" stroke-width="0.4" opacity="0.2"/>
        <line x1="36" y1="207" x2="164" y2="207"
            stroke="var(--col-green)" stroke-width="0.4" opacity="0.2"/>
        <line x1="34" y1="296" x2="166" y2="296"
            stroke="var(--col-green)" stroke-width="0.4" opacity="0.2"/>

        <!-- Scale labels -->
        <text x="10" y="44"  fill="var(--col-green)" font-size="10"
            font-family="var(--font-mono)" opacity="0.55">100%</text>
        <text x="10" y="120" fill="var(--col-green)" font-size="10"
            font-family="var(--font-mono)" opacity="0.55">75%</text>
        <text x="10" y="210" fill="var(--col-green)" font-size="10"
            font-family="var(--font-mono)" opacity="0.55">50%</text>
        <text x="10" y="299" fill="var(--col-green)" font-size="10"
            font-family="var(--font-mono)" opacity="0.55">25%</text>
        <text x="10" y="405" fill="var(--col-green)" font-size="10"
            font-family="var(--font-mono)" opacity="0.55">0%</text>
    `;
}


/**
 * Station map SVG for the ammunition screen (front view).
 * Uses F35_front.png as the background image.
 * @param {Station[]} weaponStations
 */
function tplStationMapSvg(weaponStations) {
    let stationDots = "";
    weaponStations.forEach(station => {
        const pos = STATION_POSITIONS_FRONT[station.id];
        if (!pos) return;
        stationDots += `
            <circle
                id="map-dot-${station.id}"
                cx="${pos.x}" cy="${pos.y}" r="9"
                class="station-dot station-dot--empty"
            />
            <text
                x="${pos.x}" y="${pos.y - 14}"
                text-anchor="middle"
                fill="var(--col-muted)" font-size="16"
                font-family="var(--font-mono)"
            >${station.id.replace("STA_", "")}</text>`;
    });

    return `
        <!-- F-35 front view (HUD-processed, transparent bg) -->
        <image
            href="assets/F35_front_view_hud.png"
            x="0" y="15"
            width="500" height="300"
            opacity="0.85"
        />
        ${stationDots}
    `;
}