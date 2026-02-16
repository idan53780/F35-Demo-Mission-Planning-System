# F-35A - Mission Planing tool

A military-themed front-end application for configuring the F-35A aircraft load , fuel and ammunition , and instantly viewing how those choices affect weight, balance, center of gravity, and flight performance.

---

## Quick Start
- Place all the files in the same dirctory
### Option A — Open directly (no server needed)

1. Double-click **`index.html`** in your file browser.
2. The app will load using embedded XML data and work fully offline.

### Option B — Serve locally 

If you have **Node.js**, **Python**, or any static file server:

```bash
# Python
python -m http.server 8000

# Node.js (npx, no install)
npx serve .
```

Then open **http://localhost:8000** in your browser.

> **NOTE:** A local server ensures assets (images, XML files) load via `fetch()` as intended. The app still works via `file://` thanks to built-in inline data fallbacks.

---

## Folder Structure

```
├── index.html              ← Entry point
├── css/
│   └── style.css           ← Military HUD-style theme
├── js/
│   ├── data.js             ← Inline XML data (fallback for file:// mode)
│   ├── state.js            ← Data classes & state model
│   ├── engine.js           ← Calculation engine (CG, performance, weight)
│   ├── templates.js        ← HTML template builders for each screen
│   └── app.js              ← UI layer — bootstrap, build, render
├── data/
│   ├── aircraft.xml        ← Aircraft specs, stations & weapons library
│   └── performance.xml     ← V-speeds, takeoff distances, drag tables
└── assets/
    ├── logo.png            ← App logo (loading screen)
    ├── F35_front_view_hud.png
    └── F35_top_view_hud.png
```

---

## App Screens

### 1. Overview

A dashboard showing the full picture at a glance:

- **Mass Breakdown** - Empty weight, weapons weight, zero-fuel weight, fuel, and gross weight.
- **Center of Gravity Diagram** - Visual CG position with forward/aft limits and a NORMAL / CAUTION / LIMIT status indicator.
- **Performance Table** - Rotation speed (Vr), landing reference speed (Vref), takeoff ground roll distance, and drag multiplier - all derived from the current gross weight.
- **Aircraft Top-Down View** - Shows all 10 weapon stations with loaded/empty status.

### 2. Fuel

- Adjust fuel quantity using a slider or numeric input (0 - 18,500 lbs).
- A cross-section fuel tank visualization fills in real time.
- Changes instantly recalculate gross weight, CG, and performance.

### 3. Ammunition

- Configure each of the **10 weapon stations** individually.
- Stations are role-restricted: Air-to-Air only, Air-to-Ground only, or Multi-Role.
- Internal stations preserve stealth, external pylons add a drag penalty.
- Available munitions: AIM-120C AMRAAM, AIM-9X Sidewinder, GBU-31 JDAM.
- Selecting or clearing a weapon instantly updates all calculations.

---

## Status System

The app uses a three-tier alert system across all screens:

| Status      | Meaning                                        |
|-------------|------------------------------------------------|
| **NORMAL**  | All values within safe operating limits         |
| **CAUTION** | Approaching a limit - review configuration      |
| **LIMIT**   | Weight exceeds MTOW or CG is outside envelope   |

---

## How It Works

1. **XML Data** - Aircraft specifications and performance tables are loaded from XML files (or inline fallback strings).
2. **State Model** - All user inputs (fuel level, station loadouts) are stored in a central state object.
3. **Calculation Engine** - Every change triggers `recalculate()`, which computes gross weight, CG position (in inches and as % of envelope), and interpolates performance values from lookup tables.
4. **Render** - The UI patches only the values that changed - no full page reloads.

---

## Browser Support

Any modern browser (Chrome, Firefox, Edge, Safari). No build step, no dependencies, no network access required.

---

## Key Specifications (from XML data)

| Parameter              | Value         |
|------------------------|---------------|
| Empty Weight           | 29,300 lbs    |
| Max Takeoff Weight     | 70,000 lbs    |
| Max Zero-Fuel Weight   | 44,500 lbs    |
| Max Internal Fuel      | 18,500 lbs    |
| Weapon Stations        | 10            |
| CG Envelope            | 290 – 320 in  |

---

## Notes

- All weights are in **pounds (lbs)**, moment arms in **inches**, speeds in **knots (KIAS)**, and distances in **feet**.
- This is a front-end simulation/planning tool and does not connect to any live aircraft systems.
- No personal data is collected or stored.
