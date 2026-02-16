/**
 * data.js
 * =======
 * Inline data source — both XML files embedded as JavaScript string constants.
 *
 * These serve as a FALLBACK when the app is opened via file:// (where fetch()
 * is blocked by the browser). When hosted on localhost or a server, the app loads
 * the actual XML files from disk via fetch() instead.
 * Load order: data.js → state.js → engine.js → templates.js → app.js
 */


// ─────────────────────────────────────────────────────────────────────────────
//  AIRCRAFT DATA  (mirrors data/aircraft.xml exactly)
// ─────────────────────────────────────────────────────────────────────────────

const AIRCRAFT_XML = `<?xml version="1.0" encoding="UTF-8"?>

<!--
===============================================================================
 Lockheed Martin F-35A "Adir" (IAF) - Aircraft Load & Balance Configuration
===============================================================================
 This XML file defines the physical configuration of an F-35A operated by
 the Israeli Air Force (IAF).

 It is designed to support:
   - Weapon loadout validation
   - Weight and balance calculations
   - Center of Gravity (CG) envelope checking
   - Stealth vs non-stealth configuration logic

 All weights are in pounds (lbs)
 All arms (moment arms) are in inches from aircraft datum
===============================================================================
-->

<aircraft>

    <!-- Aircraft model and variant -->
    <model>Lockheed Martin F-35A - IAF Adir</model>

    <!-- ============================================================= -->
    <!--  Aircraft Weight & CG Specifications                          -->
    <!-- ============================================================= -->
    <specifications>

        <!-- Basic empty aircraft weight (no fuel, no weapons) -->
        <emptyWeight unit="lbs">29300</emptyWeight>

        <!-- Maximum allowed takeoff weight -->
        <maxWeight unit="lbs">70000</maxWeight>

        <!-- Maximum weight excluding fuel (structure + stores) -->
        <maxZeroFuelWeight unit="lbs">44500</maxZeroFuelWeight>

        <!-- Center of gravity of the empty aircraft -->
        <emptyCG unit="in">305.5</emptyCG>

        <!-- Allowable CG envelope for safe flight -->
        <cgLimits>
            <forward unit="in">298.0</forward>
            <aft unit="in">312.0</aft>
        </cgLimits>

    </specifications>

    <!-- ============================================================= -->
    <!--  Load Stations (Weapons, Fuel)                                -->
    <!-- ============================================================= -->
    <loadStations>

        <!-- Internal stealth air-to-air missile bay stations -->
        <station id="STA_5" name="Left Internal A/A"    arm="310" maxWeight="500"  capability="AA_Only"    type="Internal"/>
        <station id="STA_7" name="Right Internal A/A"   arm="310" maxWeight="500"  capability="AA_Only"    type="Internal"/>

        <!-- Internal stealth heavy weapon bay stations -->
        <station id="STA_4" name="Left Internal Heavy"  arm="320" maxWeight="2500" capability="Multi_Role" type="Internal"/>
        <station id="STA_8" name="Right Internal Heavy" arm="320" maxWeight="2500" capability="Multi_Role" type="Internal"/>

        <!-- External pylons for air-to-ground weapons (non-stealth) -->
        <station id="STA_2"  name="Outer Pylon Left"    arm="350" maxWeight="2500" capability="AG_Only"    type="External"/>
        <station id="STA_3"  name="Mid Pylon Left"      arm="340" maxWeight="2500" capability="AG_Only"    type="External"/>
        <station id="STA_9"  name="Mid Pylon Right"     arm="340" maxWeight="2500" capability="AG_Only"    type="External"/>
        <station id="STA_10" name="Outer Pylon Right"   arm="350" maxWeight="2500" capability="AG_Only"    type="External"/>

        <!-- Wingtip rails for short-range air-to-air missiles -->
        <station id="STA_1"  name="Wingtip Rail Left"   arm="360" maxWeight="300"  capability="AA_Only"    type="External"/>
        <station id="STA_11" name="Wingtip Rail Right"  arm="360" maxWeight="300"  capability="AA_Only"    type="External"/>

        <!-- Internal fuel tank (treated as a load station for CG math) -->
        <station id="FUEL"  name="Internal Fuel"           arm="315.0" maxWeight="18500"/>

       

    </loadStations>

    <!-- ============================================================= -->
    <!--  Stores (Weapons Library)                                     -->
    <!-- ============================================================= -->
    <storesLibrary>
        <store id="AMRAAM"    name="AIM-120C"       type="AA" weight="335"  stealth="true"/>
        <store id="Sidewinder"      name="AIM-9X"   type="AA" weight="190"  stealth="false"/>
        <store id="JDAM" name="GBU-31 JDAM (2000 lb)" type="AG" weight="2000" stealth="true"/>
    </storesLibrary>

</aircraft>`;


// ─────────────────────────────────────────────────────────────────────────────
//  PERFORMANCE DATA  (mirrors data/performance.xml exactly)
// ─────────────────────────────────────────────────────────────────────────────

const PERFORMANCE_XML = `<?xml version="1.0" encoding="UTF-8"?>

<!--
===============================================================================
 F-35A  - Performance Data File
===============================================================================
 This XML defines aircraft performance parameters used by the simulation
 and mission-planning system.

 It includes:
   - Takeoff rotation speeds (Vr) as a function of weight
   - Landing reference speeds (Vref) as a function of weight
   - Takeoff distance vs gross weight
   - Drag multipliers for external stores

 Units:
   - Weight is in pounds (lbs)
   - Speeds are in knots (KIAS)
   - Distances are in feet
   - Drag penalties are dimensionless multipliers
===============================================================================
-->

<performance>

    <!-- ============================================================= -->
    <!--  Takeoff Speeds (Vr)                                          -->
    <!-- ============================================================= -->
    <!--
         Vr = Rotation speed at which the pilot initiates takeoff.
         Values increase with aircraft gross weight.
    -->
    <takeoffSpeeds>
        <entry weight="35000" vr="135"/>
        <entry weight="45000" vr="148"/>
        <entry weight="55000" vr="162"/>
        <entry weight="65000" vr="174"/>
        <entry weight="70000" vr="180"/>
    </takeoffSpeeds>

    <!-- ============================================================= -->
    <!--  Landing Speeds (Vref)                                        -->
    <!-- ============================================================= -->
    <!--
         Vref = Final approach reference speed at 50 ft AGL.
         Used for landing distance calculations.
    -->
    <landingSpeeds>
        <entry weight="30000" vref="130"/>
        <entry weight="35000" vref="138"/>
        <entry weight="40000" vref="145"/>
        <entry weight="45000" vref="152"/>
        <entry weight="50000" vref="158"/>
    </landingSpeeds>

    <!-- ============================================================= -->
    <!--  Takeoff Ground Roll Distance                                 -->
    <!-- ============================================================= -->
    <!--
         Distance required to reach Vr and lift off under standard
         conditions (ISA, sea level, no wind).
    -->
    <takeoffDistance>
        <entry weight="35000" distance="1800"/>
        <entry weight="50000" distance="3200"/>
        <entry weight="70000" distance="7000"/>
    </takeoffDistance>

    <!-- ============================================================= -->
    <!--  External Store Drag Modeling                                 -->
    <!-- ============================================================= -->
    <dragLogic>
        <!-- Penalty applied when external pylons are loaded -->
        <pylonPenalty>1.12</pylonPenalty>

        <!-- Penalty applied when wingtip missiles are installed -->
        <wingtipPenalty>1.05</wingtipPenalty>
    </dragLogic>

</performance>`;