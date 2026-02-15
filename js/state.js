/**
 * state.js
 * ========
 * Defines every data structure used by this application.
 *
 * Three kinds of data live here:
 *
 *   1. STATIC CONFIG  — read from the XML files once at startup, never changes.
 *                       (aircraft specs, station definitions, stores library,
 *                        performance tables)
 *
 *   2. DYNAMIC STATE  — owned by AircraftState, mutated by user interactions.
 *                       (fuel weight, which weapon is on each station)
 *
 *   3. DERIVED VALUES — written by the engine after every state change.
 *                       (gross weight, CG, Vr, Vref, …)
 *                       The UI only reads from here — it never computes.
 *
 * Load order: state.js → engine.js → app.js
 */


// ─────────────────────────────────────────────────────────────────────────────
//  STORE
//  Represents one entry from <storesLibrary> in aircraft.xml.
//  These are the weapons available to load onto stations.
// ─────────────────────────────────────────────────────────────────────────────

class Store {
    /**
     * @param {string} id       — e.g. "AIM-120C"
     * @param {string} name     — e.g. "AMRAAM"
     * @param {string} type     — "AA" | "AG"
     * @param {number} weight   — lbs
     * @param {boolean} stealth — true = compatible with stealth configuration
     */
    constructor(id, name, type, weight, stealth) {
        this.id      = id;
        this.name    = name;
        this.type    = type;     // "AA" or "AG"
        this.weight  = weight;   // lbs
        this.stealth = stealth;  // bool
    }

    /** True if this is an air-to-air weapon. */
    get isAA() { return this.type === "AA"; }

    /** True if this is an air-to-ground weapon. */
    get isAG() { return this.type === "AG"; }

    /**
     * Returns true if this store can be loaded onto the given station.
     * Rules:
     *   - AA_Only  stations accept AA weapons only
     *   - AG_Only  stations accept AG weapons only
     *   - Multi_Role stations accept everything
     *   - Store weight must not exceed station maxWeight
     *
     * @param {Station} station
     * @returns {boolean}
     */
    isCompatibleWith(station) {
        if (station.capability === "AA_Only"   && !this.isAA) return false;
        if (station.capability === "AG_Only"   && !this.isAG) return false;
        // Multi_Role: no capability restriction
        return true;
        // Note: weight overloading is allowed as a selection but flagged in the UI.
        // The engine does NOT enforce it — that's a UI responsibility.
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  STATION
//  Represents one physical mounting point on the aircraft.
//  Parsed from <loadStations> in aircraft.xml.
//
//  This is the central object — it owns both its static definition
//  AND its current dynamic state (what store, if any, is loaded on it).
// ─────────────────────────────────────────────────────────────────────────────

class Station {
    /**
     * @param {string}      id          — e.g. "STA_5"
     * @param {string}      name        — e.g. "Left Internal A/A"
     * @param {number}      arm         — moment arm in inches from datum
     * @param {number}      maxWeight   — max load in lbs
     * @param {string|null} capability  — "AA_Only" | "AG_Only" | "Multi_Role" | null
     * @param {string|null} type        — "Internal" | "External" | null
     */
    constructor(id, name, arm, maxWeight, capability = null, type = null) {
        // Static (from XML)
        this.id         = id;
        this.name       = name;
        this.arm        = arm;        // inches from datum
        this.maxWeight  = maxWeight;  // lbs
        this.capability = capability; // null for non-weapon stations (FUEL, FLARE, DECOY)
        this.type       = type;       // null for non-weapon stations

        // Dynamic — null means nothing loaded
        this.loadedStoreId = null;
    }

    // ── Static helpers ──────────────────────────────────────────────────────

    get isInternal() { return this.type === "Internal"; }
    get isExternal() { return this.type === "External"; }

    /** True if this is a weapon station (i.e. has a capability defined). */
    get isWeaponStation() { return this.capability !== null; }

    // ── Dynamic helpers ─────────────────────────────────────────────────────

    /** True if a weapon is currently loaded on this station. */
    get isArmed() { return this.loadedStoreId !== null; }

    /**
     * Loads a store onto this station.
     * Pass null to clear the station.
     * @param {string|null} storeId
     */
    load(storeId) {
        this.loadedStoreId = storeId;
    }

    /** Removes whatever is loaded on this station. */
    clear() {
        this.loadedStoreId = null;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  AIRCRAFT CONFIG
//  Static aircraft specifications parsed from <specifications> in aircraft.xml.
//  Created once at startup. Never mutated.
// ─────────────────────────────────────────────────────────────────────────────

class AircraftConfig {
    /**
     * @param {string} model
     * @param {number} emptyWeight      — lbs, no fuel, no weapons
     * @param {number} maxWeight        — lbs, maximum takeoff weight
     * @param {number} maxZeroFuelWeight — lbs, max weight without fuel
     * @param {number} emptyCG          — inches from datum
     * @param {{ forward: number, aft: number }} cgLimits — inches from datum
     */
    constructor(model, emptyWeight, maxWeight, maxZeroFuelWeight, emptyCG, cgLimits) {
        this.model              = model;
        this.emptyWeight        = emptyWeight;
        this.maxWeight          = maxWeight;
        this.maxZeroFuelWeight  = maxZeroFuelWeight;
        this.emptyCG            = emptyCG;
        this.cgLimits           = cgLimits; // { forward: 298.0, aft: 312.0 }
    }

    /** The total range of the CG envelope in inches. */
    get cgEnvelopeRange() {
        return this.cgLimits.aft - this.cgLimits.forward;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  PERFORMANCE TABLES
//  Static performance data parsed from performance.xml.
//  Created once at startup. Never mutated.
// ─────────────────────────────────────────────────────────────────────────────

class PerformanceTables {
    /**
     * @param {Array<{weight: number, vr: number}>}       takeoffSpeeds
     * @param {Array<{weight: number, vref: number}>}     landingSpeeds
     * @param {Array<{weight: number, distance: number}>} takeoffDistances
     * @param {number} pylonPenalty   — drag multiplier for external pylon stores
     * @param {number} wingtipPenalty — drag multiplier for wingtip stores
     */
    constructor(takeoffSpeeds, landingSpeeds, takeoffDistances, pylonPenalty, wingtipPenalty) {
        this.takeoffSpeeds    = takeoffSpeeds;    // sorted by weight ascending
        this.landingSpeeds    = landingSpeeds;    // sorted by weight ascending
        this.takeoffDistances = takeoffDistances; // sorted by weight ascending
        this.pylonPenalty     = pylonPenalty;     // e.g. 1.12
        this.wingtipPenalty   = wingtipPenalty;   // e.g. 1.05
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  AIRCRAFT STATE
//  The single source of truth for the entire application.
//
//  Holds:
//    - The static aircraft config
//    - A Map of all stations (keyed by station id)
//    - The stores library (Map keyed by store id)
//    - The performance tables
//    - The current fuel weight (user-controlled)
//    - The derived object (written by the engine, read by the UI)
// ─────────────────────────────────────────────────────────────────────────────

class AircraftState {
    /**
     * @param {AircraftConfig}   config
     * @param {Map<string, Station>} stations  — all stations including FUEL/FLARE/DECOY
     * @param {Map<string, Store>}   stores    — weapons library
     * @param {PerformanceTables}    perfTables
     */
    constructor(config, stations, stores, perfTables) {
        this.config     = config;
        this.stations   = stations;   // Map<stationId, Station>
        this.stores     = stores;     // Map<storeId,   Store>
        this.perfTables = perfTables;

        // ── Dynamic user-controlled values ──────────────────────────────────

        /**
         * Current fuel weight in lbs.
         * Starts at 50% of max capacity.
         * Clamped to [0, this.maxFuel] by any setter.
         */
        this._fuelWeight = Math.round(this.maxFuel * 0.5);

        // ── Derived values — written by engine.js, read by app.js ───────────
        // Initialized to safe defaults so the UI never reads undefined.

        this.derived = {
            // Weight breakdown
            weaponWeight:    0,   // lbs — total weight of all loaded weapons
            zeroFuelWeight:  0,   // lbs — emptyWeight + weaponWeight
            grossWeight:     0,   // lbs — zeroFuelWeight + fuelWeight

            // Centre of gravity
            cgInches:    0,       // inches from datum
            cgPercent:   0,       // 0 = at fwd limit, 100 = at aft limit
            cgStatus:    "NORMAL", // "NORMAL" | "CAUTION" | "LIMIT"

            // Weight status
            weightStatus: "NORMAL", // "NORMAL" | "CAUTION" | "LIMIT"

            // Configuration flags
            isStealthConfig:   true,  // false if any non-stealth element is present
            hasExternalStores: false, // true if any external station is armed

            // Performance outputs (interpolated from tables)
            vr:              0,   // knots — rotation speed
            vref:            0,   // knots — landing reference speed
            takeoffDistance: 0,   // feet  — ground roll to lift-off
            dragMultiplier:  1.0  // dimensionless — penalty for external stores
        };
    }


    // ── Fuel accessors ───────────────────────────────────────────────────────

    /**
     * Returns the maximum fuel capacity in lbs.
     * Read directly from the FUEL station's maxWeight in the XML.
     */
    get maxFuel() {
        const fuelStation = this.stations.get("FUEL");
        return fuelStation ? fuelStation.maxWeight : 18500;
    }

    /** Current fuel weight in lbs (0 → maxFuel). */
    get fuelWeight() {
        return this._fuelWeight;
    }

    /**
     * Set fuel weight. Automatically clamps to [0, maxFuel].
     * @param {number} lbs
     */
    set fuelWeight(lbs) {
        this._fuelWeight = Math.max(0, Math.min(Math.round(lbs), this.maxFuel));
    }

    /** Fuel as a percentage of max capacity (0–100). */
    get fuelPercent() {
        return Math.round((this._fuelWeight / this.maxFuel) * 100);
    }


    // ── Station helpers ──────────────────────────────────────────────────────

    /**
     * Returns all weapon stations (excludes FUEL, FLARE, DECOY pseudo-stations).
     * Returned in the order they appear in the Map (insertion order = XML order).
     * @returns {Station[]}
     */
    get weaponStations() {
        return Array.from(this.stations.values()).filter(s => s.isWeaponStation);
    }

    /**
     * Returns the station for a given id.
     * @param {string} id
     * @returns {Station|undefined}
     */
    getStation(id) {
        return this.stations.get(id);
    }


    // ── Store helpers ────────────────────────────────────────────────────────

    /**
     * Returns the store for a given id.
     * @param {string} id
     * @returns {Store|undefined}
     */
    getStore(id) {
        return this.stores.get(id);
    }

    /**
     * Returns the Store currently loaded on a station, or null if empty.
     * @param {string} stationId
     * @returns {Store|null}
     */
    getLoadedStore(stationId) {
        const station = this.stations.get(stationId);
        if (!station || !station.loadedStoreId) return null;
        return this.stores.get(station.loadedStoreId) ?? null;
    }

    /**
     * Returns all stores compatible with the given station.
     * Filters by capability. Does NOT filter out overweight stores —
     * those are shown in the UI as disabled options so the user can see why.
     * @param {Station} station
     * @returns {Store[]}
     */
    compatibleStores(station) {
        return Array.from(this.stores.values()).filter(
            store => store.isCompatibleWith(station)
        );
    }


    // ── Loadout mutators ─────────────────────────────────────────────────────

    /**
     * Loads a store onto a station.
     * @param {string} stationId
     * @param {string} storeId
     */
    loadStore(stationId, storeId) {
        const station = this.stations.get(stationId);
        if (station) station.load(storeId);
    }

    /**
     * Clears a specific station.
     * @param {string} stationId
     */
    clearStation(stationId) {
        const station = this.stations.get(stationId);
        if (station) station.clear();
    }

    /**
     * Clears all weapon stations in one go.
     */
    clearAllStations() {
        this.weaponStations.forEach(s => s.clear());
    }
}