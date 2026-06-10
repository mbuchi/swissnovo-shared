# Shared Basemap System — Design Spec

**Date:** 2026-06-10
**Status:** Approved design — ready for implementation planning
**Sub-project:** #1 of the "unify map-first apps on MapLibre + one basemap selector" initiative
**Home repo:** `aireon-shared` (package `@aireon/shared`)

---

## 1. Context & overall goal

Every map-first Aireon app should run on **MapLibre GL** and present the **same
basemap-selection UI** with the **same 6 swisstopo basemaps**, so the suite feels
consistent. Anything shareable lives in `@aireon/shared`.

The full initiative decomposes into sub-projects, each with its own spec → plan →
build cycle:

1. **Shared basemap system in `@aireon/shared`** ← *this spec*
2. Adopt it in the apps that are already MapLibre (~13: choose, footprint, geopool,
   groove, proom, roofs, room, roots, scoore, snoop, valoo, …)
3. Mapbox → MapLibre migrations: `woom`, `contoor`, `doorway` → then adopt
4. Leaflet → MapLibre rewrites: `boom`, `soolar`, `taxoo`, `vacoo`, `watchoo`,
   `boost`, one at a time → then adopt

3D/Cesium apps (`hood`, `similoo`, `voogle`) and the blockchain repos
(`realioo`, `brokereum`) are out of scope for the whole initiative.

## 2. Scope of this sub-project

**In scope**

- Extract valoo's basemap system into `@aireon/shared` as a reusable module:
  the restyle engine, the 6 swisstopo basemap definitions + their restyle specs,
  `resolveBasemapStyle` + the style-JSON cache, the live-preview `BasemapThumbMap`,
  and the gallery `BasemapPicker`.
- Ship `getBasemapStrings(locale)` for the 6 (de-"Swisstopo"'d) labels in en/fr/de/it.
- **Back-port valoo** onto the shared module to prove it (the reference consumer).

**Out of scope (later sub-projects)**

- Any engine migration.
- Adopting the picker in other apps (#2+). One non-valoo pilot is optional but not
  required to close this sub-project.

## 3. Architecture — Approach C (Hybrid)

A new `src/basemap/` module in `aireon-shared`, exported under a dedicated subpath
**`@aireon/shared/basemap`** (keeps it out of the main barrel, which touches
`window` via `oidc-client-ts`, mirroring the existing `/map-interaction` and
`/map-style` subpaths). `maplibre-gl` stays an **external peer** (already the case
since the ScooreMiniMap port; all map apps are on `maplibre-gl@^5.24.0`).

### Exports

- **Engine:** `applyRestyle(style, spec)`, `RestyleSpec`, `labelPaint`,
  `roadColorByClass`.
- **Specs + transforms:** `LIGHT_MINIMAL_SPEC`, `DARK_MINIMAL_SPEC`,
  `DARK_DETAILED_SPEC`, `toLightMinimalStyle`, `toDarkMinimalStyle`,
  `toDarkDetailedStyle`, `MINIMAL_HIDE`.
- **Options:** `BasemapOption` type, `BASEMAP_OPTIONS` (the 6), the `SWISSTOPO_VT`
  base + the canonical basemap ids.
- **Style resolution:** `resolveBasemapStyle(option)` + `fetchStyleJson` cache.
- **React:** `BasemapThumbMap`, `BasemapPicker`.
- **i18n:** `BasemapLabels` type, `BASEMAP_STRINGS`, `getBasemapStrings(locale)`.

## 4. The 6 basemaps (unified everywhere)

| id | label (en) | source | transform |
|----|-----------|--------|-----------|
| `swisstopo-base` | Standard | `ch.swisstopo.basemap.vt` | — |
| `swisstopo-light` | Light | `ch.swisstopo.lightbasemap.vt` | — |
| `light-minimal` | Light Minimal | `…lightbasemap.vt` | `toLightMinimalStyle` |
| `swisstopo-dark` | Dark | `…lightbasemap.vt` | `toDarkDetailedStyle` |
| `dark-minimal` | Dark Minimal | `…lightbasemap.vt` | `toDarkMinimalStyle` |
| `swisstopo-imagery` | Aerial | `ch.swisstopo.imagerybasemap.vt` | — |

Labels carry **no "Swisstopo" prefix** (Standard / Light / Light Minimal / Dark /
Dark Minimal / Aerial), matching the recent valoo change.

## 5. `BasemapPicker` component API

```ts
interface BasemapLabels {
  control: string;                    // aria-label for the trigger
  options: Record<string, string>;    // basemap id → display name
}

interface BasemapPickerProps {
  map: MaplibreMap | null;            // the app's MapLibre map instance
  labels: BasemapLabels;              // from getBasemapStrings(locale) or the app's i18n
  value?: string;                     // controlled selected basemap id
  defaultValue?: string;              // uncontrolled initial (default 'swisstopo-light')
  onChange?: (id: string) => void;
  /** Fired AFTER the new style is applied + loaded. The app re-adds its own
   *  data layers here (parcels / extrusions / score points). REQUIRED. */
  onBasemapApplied: (map: MaplibreMap, basemap: BasemapOption) => void;
  dark?: boolean;                     // chrome theming + the theme-pairing signal
  /** Suite standard: ON. When the app's `dark` flips, auto-swap to the matching
   *  detailed Dark/Light basemap — UNLESS the user has manually picked a basemap
   *  this session (a manual pick pins the choice). */
  pairWithTheme?: boolean;            // default true
  options?: BasemapOption[];          // default BASEMAP_OPTIONS (the 6)
  className?: string;                 // app positions/places the control
}
```

### Behavior

- Renders a trigger that opens the **live-thumbnail gallery** (grid of tiny
  non-interactive `BasemapThumbMap` previews rendered via `resolveBasemapStyle`, so
  restyled options preview accurately). Selected option shows a ring + check.
  Previews mount only while open; `map.remove()` on close/select to cap WebGL
  contexts (valoo keeps ≤4 extra contexts).
- On select: `resolveBasemapStyle(option)` → `map.setStyle(styleOrUrl)` → wait for
  the map's `style.load` → `onBasemapApplied(map, option)`.
- **Theme pairing (default on):** when `dark` toggles, swap to `swisstopo-dark` /
  `swisstopo-light` accordingly, *unless* the user has made a manual selection this
  session. A manual selection sets a "pinned" flag that suppresses further
  auto-pairing. This gives a consistent map-matches-theme feel by default while
  respecting an explicit choice (the existing valoo/geopool refinement).

## 6. The layer re-add contract (the crux)

MapLibre's `setStyle` removes **every** source/layer the app added. The picker owns
the style swap; the app owns its data layers. After the new style loads, the picker
calls `onBasemapApplied(map, option)`, where the app re-adds its layers — inserting
them **beneath the first symbol layer** so basemap labels (streets/places) render on
top of the data, exactly as valoo does today via `addParcelLayers`. This callback is
the single, well-defined per-app integration point.

## 7. i18n

`getBasemapStrings(locale: 'en'|'fr'|'de'|'it'): BasemapLabels` returns the control
aria + the 6 de-"Swisstopo"'d names, mirroring the existing `getReleaseNotesStrings`
pattern. Apps either pass it straight through or supply their own `labels` object.

## 8. Styling / Tailwind

Picker chrome uses Tailwind utility classes with `dark:` variants; consumers already
scan `./node_modules/@aireon/shared/dist/**/*.js`, so no extra config. Reuse
`mapUi.css` only if a shared `.map-shell-*` pattern is warranted.

## 9. valoo back-port (proof of the module)

valoo deletes its inline `BasemapOption` / restyle specs / `resolveBasemapStyle` /
`BasemapThumbMap` / gallery and imports them from `@aireon/shared/basemap`, passing
`onBasemapApplied = addParcelLayers` and `pairWithTheme` to preserve current
behavior. Expected net change ≈ −300 lines in valoo. valoo's i18n keys
(`panel.basemap.swisstopo_*`) keep mapping to the shared option ids.

## 10. Versioning & rollout

Ship as an `@aireon/shared` **minor** (next after current: `v1.11.0`). valoo pins
`github:mbuchi/aireon-shared#v1.11.0`. Other apps adopt in sub-project #2.

## 11. Risks & mitigations

- **`setStyle` / `style.load` timing** — fire `onBasemapApplied` only after the
  style is actually loaded; guard against overlapping in-flight swaps.
- **WebGL context count** from gallery previews — mount previews only while the
  gallery is open; `map.remove()` on close/select.
- **Per-app data-layer differences** — handled entirely by `onBasemapApplied`.
- **Theme-pairing vs initial/deep-link basemap** — pinning must not override an
  explicit initial/deep-linked basemap; treat an explicit initial value as pinned.
- **maplibre-gl peer skew** — all map apps are on `^5.24.0` today; keep it a peer.

## 12. Testing

- **Unit:** `applyRestyle` handles `recolor` / `hide` / `labels` / both
  `symbolDefault` forms (`'hide'` and a paint object); `resolveBasemapStyle` returns
  a bare URL for untransformed options and a transformed style object otherwise;
  `getBasemapStrings` completeness (4 locales × 6 names + control).
- **Build:** `npm run typecheck` + `npm run build` green in `aireon-shared`; valoo
  build green after back-port.
- **Manual (valoo):** switch through all 6 basemaps and confirm the parcel
  choropleth re-appears each time; toggle dark/light and confirm theme pairing +
  that a manual pick pins; confirm labels render above parcels.

## 13. Open items

None blocking.
