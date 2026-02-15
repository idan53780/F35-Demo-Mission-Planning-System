/**
 * engine.js
 * =========
 * The calculation layer. Three responsibilities:
 *
 *   1. XmlParser      — fetches aircraft.xml + performance.xml,
 *                       parses them into the typed classes from state.js,
 *                       and assembles the initial AircraftState.
 *
 *   2. CgCalculator   — pure weight & balance math.
 *                       Takes state, returns CG in inches and as a % of envelope.
 *
 *   3. PerfLookup     — linear interpolation over the performance tables.
 *                       Returns Vr, Vref, takeoff distance, drag multiplier.
 *
 *   4. recalculate()  — the single function app.js calls after any state change.
 *                       Runs all three calculators and writes state.derived atomically.
 *
 * No DOM access happens here. This file is purely logic.
 * Load order: state.js → engine.js → app.js
 */


// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
//  Station IDs grouped by their drag penalty category.
//  Defined once here so the rules are not scattered across the codebase.
// ─────────────────────────────────────────────────────────────────────────────

const WINGTIP_STATION_IDS = ["STA_1", "STA_11"];

const PYLON_STATION_IDS = ["STA_2", "STA_3", "STA_9", "STA_10"];

// Stations whose presence (armed or not) breaks stealth when any external store
// is loaded on them. Internal stations are stealth-compatible by design.
const EXTERNAL_STATION_IDS = [...WINGTIP_STATION_IDS, ...PYLON_STATION_IDS];


// ─────────────────────────────────────────────────────────────────────────────
//  XML PARSER
//  Responsible for reading both XML data files and assembling AircraftState.
//
//  Why a class with static methods?
//  Parsing is a one-shot operation — it runs once at startup, produces objects,
//  and is never called again. Static methods on a class give us a clean
//  namespace without requiring an instance.
// ─────────────────────────────────────────────────────────────────────────────

class XmlParser {

    /**
     * Entry point. Parses both XML strings from the inline constants in data.js
     * and returns a fully constructed AircraftState ready to use.
     *
     * No network requests are made — the data is already in memory.
     * This allows index.html to open directly from the filesystem 
     * without requiring a local server.
     *
     * @returns {AircraftState}
     * @throws  {Error} if either XML string fails to parse
     */
    static loadData() {
        const aircraftDoc    = XmlParser._parseXmlString(AIRCRAFT_XML,    "aircraft.xml");
        const performanceDoc = XmlParser._parseXmlString(PERFORMANCE_XML, "performance.xml");

        const { config, stations, stores } = XmlParser._parseAircraftXml(aircraftDoc);
        const perfTables = XmlParser._parsePerformanceXml(performanceDoc);

        return new AircraftState(config, stations, stores, perfTables);
    }


    // ── Private: parse XML string ─────────────────────────────────────────────

    /**
     * Parses a raw XML string into an XMLDocument.
     * Throws a descriptive Error if the string is malformed.
     *
     * @param {string} xmlString  — the raw XML content
     * @param {string} sourceName — used only in error messages
     * @returns {XMLDocument}
     */
    static _parseXmlString(xmlString, sourceName) {
        const parser = new DOMParser();
        const doc    = parser.parseFromString(xmlString, "application/xml");

        // DOMParser does not throw on bad XML — it embeds a <parsererror> node instead
        const parseError = doc.querySelector("parsererror");
        if (parseError) {
            throw new Error(
                `XML syntax error in "${sourceName}": ${parseError.textContent.trim()}`
            );
        }

        return doc;
    }


    // ── Private: parse aircraft.xml ───────────────────────────────────────────

    /**
     * Parses aircraft.xml into { config, stations, stores }.
     *
     * @param {XMLDocument} doc
     * @returns {{ config: AircraftConfig, stations: Map<string, Station>, stores: Map<string, Store> }}
     */
    static _parseAircraftXml(doc) {
        const config   = XmlParser._parseConfig(doc);
        const stations = XmlParser._parseStations(doc);
        const stores   = XmlParser._parseStores(doc);
        return { config, stations, stores };
    }

    /**
     * Reads <specifications> and returns an AircraftConfig.
     * @param {XMLDocument} doc
     * @returns {AircraftConfig}
     */
    static _parseConfig(doc) {
        const model = doc.querySelector("model").textContent.trim();

        const specs = doc.querySelector("specifications");
        const emptyWeight       = XmlParser._numText(specs, "emptyWeight");
        const maxWeight         = XmlParser._numText(specs, "maxWeight");
        const maxZeroFuelWeight = XmlParser._numText(specs, "maxZeroFuelWeight");
        const emptyCG           = XmlParser._numText(specs, "emptyCG");

        const cgLimitsEl = specs.querySelector("cgLimits");
        const cgLimits = {
            forward: XmlParser._numText(cgLimitsEl, "forward"),
            aft:     XmlParser._numText(cgLimitsEl, "aft")
        };

        return new AircraftConfig(model, emptyWeight, maxWeight, maxZeroFuelWeight, emptyCG, cgLimits);
    }

    /**
     * Reads all <station> elements and returns a Map<stationId, Station>.
     * Map insertion order matches the XML order, which is the display order.
     *
     * @param {XMLDocument} doc
     * @returns {Map<string, Station>}
     */
    static _parseStations(doc) {
        const stations = new Map();

        doc.querySelectorAll("station").forEach(el => {
            const id         = el.getAttribute("id");
            const name       = el.getAttribute("name");
            const arm        = parseFloat(el.getAttribute("arm"));
            const maxWeight  = parseFloat(el.getAttribute("maxWeight"));
            // capability and type are null for FUEL 
            const capability = el.getAttribute("capability") || null;
            const type       = el.getAttribute("type")       || null;

            stations.set(id, new Station(id, name, arm, maxWeight, capability, type));
        });

        return stations;
    }

    /**
     * Reads all <store> elements and returns a Map<storeId, Store>.
     *
     * @param {XMLDocument} doc
     * @returns {Map<string, Store>}
     */
    static _parseStores(doc) {
        const stores = new Map();

        doc.querySelectorAll("store").forEach(el => {
            const id      = el.getAttribute("id");
            const name    = el.getAttribute("name");
            const type    = el.getAttribute("type");   // "AA" | "AG"
            const weight  = parseFloat(el.getAttribute("weight"));
            const stealth = el.getAttribute("stealth") === "true";

            stores.set(id, new Store(id, name, type, weight, stealth));
        });

        return stores;
    }


    // ── Private: parse performance.xml ───────────────────────────────────────

    /**
     * Parses performance.xml into a PerformanceTables instance.
     *
     * @param {XMLDocument} doc
     * @returns {PerformanceTables}
     */
    static _parsePerformanceXml(doc) {
        // Helper: reads all <entry> children of a selector into an array of plain objects
        const parseTable = (parentSelector, ...attrNames) =>
            Array.from(doc.querySelectorAll(`${parentSelector} entry`)).map(el =>
                Object.fromEntries(attrNames.map(attr => [attr, parseFloat(el.getAttribute(attr))]))
            );

        const takeoffSpeeds    = parseTable("takeoffSpeeds",    "weight", "vr");
        const landingSpeeds    = parseTable("landingSpeeds",    "weight", "vref");
        const takeoffDistances = parseTable("takeoffDistance",  "weight", "distance");

        const pylonPenalty   = parseFloat(doc.querySelector("pylonPenalty").textContent);
        const wingtipPenalty = parseFloat(doc.querySelector("wingtipPenalty").textContent);

        return new PerformanceTables(
            takeoffSpeeds,
            landingSpeeds,
            takeoffDistances,
            pylonPenalty,
            wingtipPenalty
        );
    }


    // ── Private: DOM helpers ──────────────────────────────────────────────────

    /**
     * Finds a child element by tag name within a parent and returns its
     * textContent parsed as a float.
     *
     * @param {Element} parent
     * @param {string}  tag
     * @returns {number}
     */
    static _numText(parent, tag) {
        return parseFloat(parent.querySelector(tag).textContent);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  CG CALCULATOR
//  Pure weight and balance mathematics.
//
//  The fundamental formula:
//
//    CG (inches) = Total Moment / Total Weight
//
//  where:
//    Total Moment = sum of (component weight × its moment arm from datum)
//    Total Weight = sum of all component weights
//
//  Components included:
//    - Empty aircraft   (emptyWeight × emptyCG — from AircraftConfig)
//    - Each armed weapon station (store.weight × station.arm)
//    - Fuel             (fuelWeight × FUEL station arm)
//    - No other components (e.g. crew, countermeasures) are modeled in this simplified tool.   
// ─────────────────────────────────────────────────────────────────────────────

class CgCalculator {

    /**
     * Calculates the full weight breakdown and CG for the current state.
     *
     * @param {AircraftState} state
     * @returns {{
     *   weaponWeight:   number,
     *   zeroFuelWeight: number,
     *   grossWeight:    number,
     *   cgInches:       number
     * }}
     */
    static calculate(state) {
        const cfg = state.config;

        // Start with the empty aircraft
        let totalWeight = cfg.emptyWeight;
        let totalMoment = cfg.emptyWeight * cfg.emptyCG;

        // ── Add each armed weapon station ────────────────────────────────────
        let weaponWeight = 0;

        for (const station of state.weaponStations) {
            if (!station.isArmed) continue;

            const store = state.getStore(station.loadedStoreId);
            if (!store) continue; // defensive — should never happen with valid data

            totalWeight  += store.weight;
            totalMoment  += store.weight * station.arm;
            weaponWeight += store.weight;
        }

        // Zero Fuel Weight = empty aircraft + all weapons (no fuel yet)
        const zeroFuelWeight = totalWeight;

        // ── Add fuel ─────────────────────────────────────────────────────────
        const fuelStation = state.stations.get("FUEL");
        if (fuelStation) {
            totalWeight += state.fuelWeight;
            totalMoment += state.fuelWeight * fuelStation.arm;
        }

       
        // ── CG ───────────────────────────────────────────────────────────────
        // Guard against divide-by-zero on an impossible empty aircraft edge case
        const cgInches = totalWeight > 0 ? totalMoment / totalWeight : cfg.emptyCG;

        return {
            weaponWeight,
            zeroFuelWeight,
            grossWeight: totalWeight,
            cgInches
        };
    }


    /**
     * Converts a CG position in inches to a percentage of the CG envelope.
     *
     *   0%   = exactly at the forward limit (most forward allowed)
     *   100% = exactly at the aft limit (most aft allowed)
     *   <0%  = forward of limit (LIMIT condition)
     *   >100%= aft of limit    (LIMIT condition)
     *
     * @param {number} cgInches
     * @param {AircraftConfig} config
     * @returns {number}  can be negative or >100 if outside envelope
     */
    static cgToPercent(cgInches, config) {
        return ((cgInches - config.cgLimits.forward) / config.cgEnvelopeRange) * 100;
    }


    /**
     * Maps a CG percent value to a status string.
     *
     * Thresholds (assumption — no specific threshold was given in the task):
     *   LIMIT   — outside the envelope (<0% or >100%)
     *   CAUTION — within 10% of either limit (0–10% or 90–100%)
     *   NORMAL  — comfortably within envelope (10–90%)
     *
     * @param {number} cgPercent
     * @returns {"NORMAL" | "CAUTION" | "LIMIT"}
     */
    static cgStatus(cgPercent) {
        if (cgPercent < 0 || cgPercent > 100) return "LIMIT";
        if (cgPercent < 10 || cgPercent > 90) return "CAUTION";
        return "NORMAL";
    }


    /**
     * Maps a gross weight to a status string relative to max takeoff weight.
     *
     * Thresholds:
     *   LIMIT   — over MTOW (>100%)
     *   CAUTION — within 5% of MTOW (95–100%)
     *   NORMAL  — below 95% of MTOW
     *
     * @param {number} grossWeight
     * @param {AircraftConfig} config
     * @returns {"NORMAL" | "CAUTION" | "LIMIT"}
     */
    static weightStatus(grossWeight, config) {
        const percent = (grossWeight / config.maxWeight) * 100;
        if (percent > 100) return "LIMIT";
        if (percent > 95)  return "CAUTION";
        return "NORMAL";
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  PERFORMANCE LOOKUP
//  Linear interpolation over the sorted data tables in PerformanceTables.
//
//  Why linear interpolation?
//    The performance tables give us discrete sample points (e.g. Vr at 35,000 lbs
//    and at 45,000 lbs). The actual aircraft weight will almost always fall between
//    two table entries. Linear interpolation gives a reasonable estimate without
//    requiring higher-order curve fitting, which would be over-engineering for
//    a simplified tool.
//
//  Clamping behaviour:
//    If the query weight is below the lowest table entry → return the lowest value.
//    If the query weight is above the highest table entry → return the highest value.
//    This avoids extrapolation, which would produce unreliable results.
// ─────────────────────────────────────────────────────────────────────────────

class PerfLookup {

    /**
     * Core interpolation method.
     * Finds the two table entries that bracket the input value and
     * linearly interpolates between them.
     *
     * @param {Array<Object>} table     — array of data points, e.g. [{weight:35000, vr:135}, …]
     * @param {string}        inputKey  — property to treat as the x-axis, e.g. "weight"
     * @param {string}        outputKey — property to return interpolated, e.g. "vr"
     * @param {number}        inputVal  — the x value to look up
     * @returns {number}
     */
    static _interpolate(table, inputKey, outputKey, inputVal) {
        if (!table || table.length === 0) return 0;

        // Sort ascending by input key (defensive — tables should already be sorted)
        const sorted = [...table].sort((a, b) => a[inputKey] - b[inputKey]);

        // Clamp: below minimum
        if (inputVal <= sorted[0][inputKey]) {
            return sorted[0][outputKey];
        }

        // Clamp: above maximum
        if (inputVal >= sorted[sorted.length - 1][inputKey]) {
            return sorted[sorted.length - 1][outputKey];
        }

        // Find the bracket [lo, hi] that contains inputVal
        for (let i = 0; i < sorted.length - 1; i++) {
            const lo = sorted[i];
            const hi = sorted[i + 1];

            if (inputVal >= lo[inputKey] && inputVal <= hi[inputKey]) {
                // Linear interpolation formula: y = y0 + (x - x0) * (y1 - y0) / (x1 - x0)
                const ratio  = (inputVal - lo[inputKey]) / (hi[inputKey] - lo[inputKey]);
                const result = lo[outputKey] + ratio * (hi[outputKey] - lo[outputKey]);
                return Math.round(result);
            }
        }

        // Should never reach here given the clamp logic above
        return 0;
    }


    /**
     * Returns the takeoff rotation speed (Vr) in KIAS for the given gross weight.
     * @param {PerformanceTables} tables
     * @param {number} grossWeight — lbs
     * @returns {number} knots
     */
    static getVr(tables, grossWeight) {
        return PerfLookup._interpolate(tables.takeoffSpeeds, "weight", "vr", grossWeight);
    }


    /**
     * Returns the landing reference speed (Vref) in KIAS for the given gross weight.
     * @param {PerformanceTables} tables
     * @param {number} grossWeight — lbs
     * @returns {number} knots
     */
    static getVref(tables, grossWeight) {
        return PerfLookup._interpolate(tables.landingSpeeds, "weight", "vref", grossWeight);
    }


    /**
     * Returns the takeoff ground roll distance in feet for the given gross weight,
     * BEFORE any drag penalty is applied.
     * @param {PerformanceTables} tables
     * @param {number} grossWeight — lbs
     * @returns {number} feet
     */
    static getTakeoffDistance(tables, grossWeight) {
        return PerfLookup._interpolate(tables.takeoffDistances, "weight", "distance", grossWeight);
    }


    /**
     * Calculates the combined drag multiplier based on which external stations are armed.
     *
     * Logic:
     *   - Any armed pylon station  → apply pylonPenalty
     *   - Any armed wingtip station → apply wingtipPenalty
     *   - Both types present        → multiply both penalties together
     *   - No external stores        → multiplier = 1.0 (clean config)
     *
     * @param {AircraftState} state
     * @returns {number}  e.g. 1.0, 1.05, 1.12, or 1.176 (both penalties)
     */
    static getDragMultiplier(state) {
        const tables = state.perfTables;
        let multiplier = 1.0;

        const hasPylon   = PYLON_STATION_IDS.some(
            id => state.stations.get(id)?.isArmed
        );
        const hasWingtip = WINGTIP_STATION_IDS.some(
            id => state.stations.get(id)?.isArmed
        );

        if (hasPylon)   multiplier *= tables.pylonPenalty;
        if (hasWingtip) multiplier *= tables.wingtipPenalty;

        // Round to 4 decimal places to avoid floating-point noise (e.g. 1.17600000001)
        return Math.round(multiplier * 10000) / 10000;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  STEALTH CHECKER
//  Determines whether the current loadout is stealth-compatible.
//
//  Two conditions break stealth:
//    1. Any weapon on an external station (wingtip rails or underwing pylons)
//    2. Any weapon flagged stealth=false in the stores library (e.g. AIM-9X)
//
//  Both are checked independently. Either one is enough to break stealth.
// ─────────────────────────────────────────────────────────────────────────────

class StealthChecker {

    /**
     * Returns true if the current loadout is stealth-compatible.
     * @param {AircraftState} state
     * @returns {boolean}
     */
    static isStealthConfig(state) {
        // Check 1: any external station armed?
        const hasExternalStore = EXTERNAL_STATION_IDS.some(
            id => state.stations.get(id)?.isArmed
        );
        if (hasExternalStore) return false;

        // Check 2: any non-stealth weapon loaded anywhere?
        for (const station of state.weaponStations) {
            if (!station.isArmed) continue;
            const store = state.getStore(station.loadedStoreId);
            if (store && !store.stealth) return false;
        }

        return true;
    }


    /**
     * Returns true if any external station has a weapon loaded.
     * Used by the UI to highlight external stations differently.
     * @param {AircraftState} state
     * @returns {boolean}
     */
    static hasExternalStores(state) {
        return EXTERNAL_STATION_IDS.some(id => state.stations.get(id)?.isArmed);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  RECALCULATE
//  The single function app.js calls after any user interaction.
//
//  It runs all calculators in the correct dependency order and writes
//  every result into state.derived in one atomic operation.
//
//  Dependency order:
//    1. CG + weights         (needed for everything below)
//    2. CG status + percent  (depends on cgInches)
//    3. Weight status        (depends on grossWeight)
//    4. Stealth flags        (depends on loadout)
//    5. Drag multiplier      (depends on loadout, needed for takeoffDistance)
//    6. Performance speeds   (depends on grossWeight)
//    7. Takeoff distance     (depends on grossWeight + dragMultiplier)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recalculates all derived values and writes them to state.derived.
 * This is the ONLY function that writes to state.derived.
 *
 * Call this after every user interaction, then call renderAll().
 *
 * @param {AircraftState} state
 */
function recalculate(state) {
    // 1. Weight & CG
    const { weaponWeight, zeroFuelWeight, grossWeight, cgInches } =
        CgCalculator.calculate(state);

    // 2. CG position as % of envelope and status
    const cgPercent = CgCalculator.cgToPercent(cgInches, state.config);
    const cgStatus  = CgCalculator.cgStatus(cgPercent);

    // 3. Weight status
    const weightStatus = CgCalculator.weightStatus(grossWeight, state.config);

    // 4. Stealth / external store flags
    const isStealthConfig   = StealthChecker.isStealthConfig(state);
    const hasExternalStores = StealthChecker.hasExternalStores(state);

    // 5. Drag multiplier (needed before takeoff distance)
    const dragMultiplier = PerfLookup.getDragMultiplier(state);

    // 6. V-speeds
    const vr   = PerfLookup.getVr(state.perfTables, grossWeight);
    const vref = PerfLookup.getVref(state.perfTables, grossWeight);

    // 7. Takeoff distance with drag penalty applied
    const baseTakeoffDistance = PerfLookup.getTakeoffDistance(state.perfTables, grossWeight);
    const takeoffDistance = Math.round(baseTakeoffDistance * dragMultiplier);

    // Write everything to state.derived atomically
    state.derived = {
        weaponWeight,
        zeroFuelWeight,
        grossWeight,
        cgInches:        Math.round(cgInches * 10) / 10,  // 1 decimal place
        cgPercent:       Math.round(cgPercent * 10) / 10,  // 1 decimal place
        cgStatus,
        weightStatus,
        isStealthConfig,
        hasExternalStores,
        vr,
        vref,
        takeoffDistance,
        dragMultiplier
    };
}