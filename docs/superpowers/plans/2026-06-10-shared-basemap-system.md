# Shared Basemap System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract valoo's swisstopo basemap system into `@aireon/shared/basemap` (restyle engine + 6 basemaps + `resolveBasemapStyle` + live-preview `BasemapThumbMap` + gallery `BasemapPicker`), prove it by back-porting valoo, and ship `@aireon/shared@1.11.0`.

**Architecture:** New `src/basemap/` module in `aireon-shared`, exported via a dedicated `@aireon/shared/basemap` subpath (keeps it out of the `window`-touching auth barrel; `maplibre-gl` stays an external peer). Approach C (hybrid): the package owns the picker UI + restyle engine; each consuming app supplies an `onBasemapApplied(map)` callback that re-adds its own data layers after `setStyle` (which wipes them). Theme-pairing on by default; a manual gallery pick pins the choice.

**Tech Stack:** TypeScript, React 18, `maplibre-gl@^5.24.0` (peer), `tsup` (build), `vitest` (new — pure-logic tests), Tailwind (consumer-scanned).

**Source of truth for the extraction:** `/Users/joe/Documents/local_dev/swissnovo/valoo/src/components/ParcelMap.tsx` (the working implementation). Line ranges below refer to that file at the current `main`.

**Working dir for Tasks 0–8:** `/Users/joe/Documents/local_dev/swissnovo/aireon-shared`. **Task 9:** `/Users/joe/Documents/local_dev/swissnovo/valoo`. git identity + gh account are already `mbuchi`. Start each repo with `git fetch origin -q && git checkout main -q && git pull origin main -q`, then create a feature branch.

---

## File structure (locked-in decomposition)

| File | Responsibility |
|------|----------------|
| `src/basemap/restyle.ts` | Pure restyle engine: `RestyleSpec`, `applyRestyle`, `labelPaint`, `roadColorByClass`, `cloneStyle` |
| `src/basemap/specs.ts` | The palettes + `MINIMAL_HIDE` + `LIGHT_MINIMAL_SPEC`/`DARK_MINIMAL_SPEC`/`DARK_DETAILED_SPEC` + the three `to*Style` transforms |
| `src/basemap/options.ts` | `BasemapOption` type, `SWISSTOPO_VT`, basemap ids, `BASEMAP_OPTIONS`, `getBasemapOption`, `themeBasemapId`, `fetchStyleJson`, `resolveBasemapStyle` |
| `src/basemap/i18n.ts` | `BasemapLabels` type, `BASEMAP_STRINGS` (en/fr/de/it), `getBasemapStrings(locale)` |
| `src/basemap/BasemapThumbMap.tsx` | Tiny non-interactive live preview map |
| `src/basemap/BasemapPicker.tsx` | Gallery picker component (Approach C) + internal style-swap |
| `src/basemap/index.ts` | Subpath barrel — re-exports everything above |
| `src/basemap/*.test.ts` | vitest unit tests for the pure logic |
| `tsup.config.ts` | add `src/basemap/index.ts` entry |
| `package.json` | add `./basemap` export, `vitest` devDep + `test` script, version → 1.11.0 |
| `vitest.config.ts` | new — node environment, run `src/**/*.test.ts` |

---

## Task 0: vitest setup (pure-logic test infra)

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (devDep + `test` script)

- [ ] **Step 1: Add vitest + the test script**

Run:
```bash
cd /Users/joe/Documents/local_dev/swissnovo/aireon-shared
git checkout -b feat/shared-basemap
npm install -D vitest
```
Then edit `package.json` `scripts` to add (keep existing build/typecheck/generate:api):
```json
"test": "vitest run"
```

- [ ] **Step 2: Create the vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Verify the runner works (no tests yet → exits 0)**

Run: `npx vitest run`
Expected: "No test files found" but exit code 0 (or run after Task 1's test exists). Proceed.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore(basemap): add vitest for pure-logic tests"
```

---

## Task 1: Restyle engine (`restyle.ts`) — TDD

**Files:**
- Create: `src/basemap/restyle.ts`
- Test: `src/basemap/restyle.test.ts`

Port verbatim from valoo `ParcelMap.tsx`: `cloneStyle` (lines 25–27), `roadColorByClass` (57–61), `labelPaint` (the `labelPaint(...)` helper just below `roadColorByClass`), `RestyleSpec` (interface, lines 73–83), `applyRestyle` (85–113). Change only: make everything `export`, and import the `StyleSpecification` type from `maplibre-gl`.

- [ ] **Step 1: Write the failing test**

Create `src/basemap/restyle.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { applyRestyle, type RestyleSpec } from './restyle';

const baseStyle = () => ({
  version: 8 as const,
  sources: {},
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#fff' } },
    { id: 'water', type: 'fill', paint: { 'fill-color': '#abc' } },
    { id: 'contour_line', type: 'line', paint: { 'line-color': '#999' } },
    { id: 'place_city', type: 'symbol', paint: {} },
    { id: 'poi_other', type: 'symbol', paint: {} },
  ],
}) as any;

const spec: RestyleSpec = {
  recolor: { background: { 'background-color': '#000' }, water: { 'fill-color': '#012' } },
  hide: new Set(['contour_line']),
  labels: { place_city: { 'text-color': '#eee' } },
  symbolDefault: 'hide',
};

describe('applyRestyle', () => {
  it('recolors non-symbol layers, hides listed layers, tunes named labels, and hides other symbols', () => {
    const out = applyRestyle(baseStyle(), spec);
    const byId = Object.fromEntries(out.layers.map((l: any) => [l.id, l]));
    expect(byId.background.paint['background-color']).toBe('#000');
    expect(byId.water.paint['fill-color']).toBe('#012');
    expect(byId.contour_line.layout.visibility).toBe('none');
    expect(byId.place_city.paint['text-color']).toBe('#eee');
    expect(byId.poi_other.layout.visibility).toBe('none'); // symbolDefault 'hide'
  });

  it('relights unlisted symbols when symbolDefault is a paint object', () => {
    const out = applyRestyle(baseStyle(), { ...spec, symbolDefault: { 'text-color': '#aaa' } });
    const poi = out.layers.find((l: any) => l.id === 'poi_other') as any;
    expect(poi.paint['text-color']).toBe('#aaa');
    expect(poi.layout?.visibility).toBeUndefined();
  });

  it('does not mutate the input style (clones)', () => {
    const input = baseStyle();
    applyRestyle(input, spec);
    expect((input.layers[0] as any).paint['background-color']).toBe('#fff');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/basemap/restyle.test.ts`
Expected: FAIL — `Cannot find module './restyle'`.

- [ ] **Step 3: Create `restyle.ts`**

Create `src/basemap/restyle.ts` by copying the named blocks from valoo `ParcelMap.tsx` (cloneStyle 25–27, roadColorByClass 57–61, the `labelPaint` helper, RestyleSpec 73–83, applyRestyle 85–113), prefixing each with `export` and adding at the top:
```ts
import type { StyleSpecification } from 'maplibre-gl';
```
Do not change any logic. `applyRestyle` must keep handling both `symbolDefault === 'hide'` and a paint object (valoo lines 98–108).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/basemap/restyle.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/basemap/restyle.ts src/basemap/restyle.test.ts
git commit -m "feat(basemap): restyle engine (applyRestyle + RestyleSpec)"
```

---

## Task 2: Restyle specs (`specs.ts`)

**Files:**
- Create: `src/basemap/specs.ts`

This is a verbatim data move — no new logic, so verification is typecheck (Task 7 builds it; here we typecheck the file).

- [ ] **Step 1: Create `specs.ts`**

Copy these blocks **verbatim** from valoo `ParcelMap.tsx`, in this order, into `src/basemap/specs.ts`:
- `MINIMAL_HIDE` (the `new Set<string>([...])`)
- `LIGHT` palette + `LIGHT_MINIMAL_SPEC`
- `DARK` palette + `DARK_MINIMAL_SPEC`
- the `DARK_DETAILED_SPEC` block (incl. its `darkRoad`/`darkCasing`/`darkFaint`/`darkRail`/`darkDetailedBuildingLine` locals)
- `toLightMinimalStyle`, `toDarkMinimalStyle`, `toDarkDetailedStyle`

Add at the top:
```ts
import type { StyleSpecification } from 'maplibre-gl';
import { applyRestyle, labelPaint, roadColorByClass, type RestyleSpec } from './restyle';
```
`export` every top-level const (`MINIMAL_HIDE`, `LIGHT`, `DARK`, `LIGHT_MINIMAL_SPEC`, `DARK_MINIMAL_SPEC`, `DARK_DETAILED_SPEC`, `toLightMinimalStyle`, `toDarkMinimalStyle`, `toDarkDetailedStyle`). Remove the now-duplicated `labelPaint`/`roadColorByClass`/`RestyleSpec` definitions (they come from `./restyle`). Keep all hex values and layer ids byte-for-byte.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). If `labelPaint`/`roadColorByClass` are reported unused or missing, fix the import.

- [ ] **Step 3: Commit**

```bash
git add src/basemap/specs.ts
git commit -m "feat(basemap): light/dark minimal + detailed-dark restyle specs"
```

---

## Task 3: Options + style resolution (`options.ts`) — TDD

**Files:**
- Create: `src/basemap/options.ts`
- Test: `src/basemap/options.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/basemap/options.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BASEMAP_OPTIONS, getBasemapOption, themeBasemapId, resolveBasemapStyle,
} from './options';

describe('basemap options', () => {
  it('defines exactly the six unified basemaps in order', () => {
    expect(BASEMAP_OPTIONS.map((b) => b.id)).toEqual([
      'swisstopo-base', 'swisstopo-light', 'light-minimal',
      'swisstopo-dark', 'dark-minimal', 'swisstopo-imagery',
    ]);
  });

  it('themeBasemapId maps dark/light to the detailed dark/light basemaps', () => {
    expect(themeBasemapId(true)).toBe('swisstopo-dark');
    expect(themeBasemapId(false)).toBe('swisstopo-light');
  });

  it('getBasemapOption falls back to the first option for an unknown id', () => {
    expect(getBasemapOption('nope').id).toBe('swisstopo-base');
  });

  it('resolveBasemapStyle returns the bare URL when there is no transform', async () => {
    const base = getBasemapOption('swisstopo-base');
    expect(await resolveBasemapStyle(base)).toBe(base.styleUrl);
  });

  it('resolveBasemapStyle fetches + transforms when a transform is set', async () => {
    const fakeStyle = { version: 8, sources: {}, layers: [] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => fakeStyle });
    vi.stubGlobal('fetch', fetchMock);
    const dark = getBasemapOption('swisstopo-dark'); // has styleTransform
    const out = await resolveBasemapStyle(dark);
    expect(fetchMock).toHaveBeenCalledWith(dark.styleUrl);
    expect(typeof out).toBe('object'); // transformed style object, not a URL string
  });
});

beforeEach(() => vi.unstubAllGlobals());
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/basemap/options.test.ts`
Expected: FAIL — `Cannot find module './options'`.

- [ ] **Step 3: Create `options.ts`**

Create `src/basemap/options.ts`. Port from valoo `ParcelMap.tsx`: `SWISSTOPO_VT` (469), `BasemapOption` (471–483), `SWISSTOPO_LIGHT_BASEMAP_ID`/`SWISSTOPO_DARK_BASEMAP_ID` (485–486), `basemapOptions` (488–495 → export as `BASEMAP_OPTIONS`), `getBasemapOption` (501–503), `fetchStyleJson` + its `rawStyleCache` + `cloneStyle` usage (33–42 — import `cloneStyle` from `./restyle`), `resolveBasemapStyle` (505–509). Rename `getThemeBasemapId` → `themeBasemapId` and export it. Header:
```ts
import type { StyleSpecification } from 'maplibre-gl';
import { cloneStyle } from './restyle';
import { toLightMinimalStyle, toDarkMinimalStyle, toDarkDetailedStyle } from './specs';

export const SWISSTOPO_VT = 'https://vectortiles.geo.admin.ch/styles';
export const SWISSTOPO_BASE_ID = 'swisstopo-base';
export const SWISSTOPO_LIGHT_BASEMAP_ID = 'swisstopo-light';
export const SWISSTOPO_DARK_BASEMAP_ID = 'swisstopo-dark';
export const SWISSTOPO_IMAGERY_ID = 'swisstopo-imagery';
export const LIGHT_MINIMAL_ID = 'light-minimal';
export const DARK_MINIMAL_ID = 'dark-minimal';
```
`BasemapOption.labelKey` is valoo-specific (it keyed into valoo's i18n). In the shared type, **rename `labelKey` → `id`-keyed lookup is enough**: drop `labelKey` from `BasemapOption` entirely (the shared picker resolves the display name from `BasemapLabels.options[option.id]`, Task 4). So `BASEMAP_OPTIONS` entries keep only `{ id, styleUrl, styleTransform? }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/basemap/options.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/basemap/options.ts src/basemap/options.test.ts
git commit -m "feat(basemap): options + resolveBasemapStyle + style cache"
```

---

## Task 4: i18n labels (`i18n.ts`) — TDD

**Files:**
- Create: `src/basemap/i18n.ts`
- Test: `src/basemap/i18n.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/basemap/i18n.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getBasemapStrings, BASEMAP_STRINGS } from './i18n';
import { BASEMAP_OPTIONS } from './options';

const LOCALES = ['en', 'fr', 'de', 'it'] as const;

describe('basemap i18n', () => {
  it('has a label for every basemap id in every locale + a control label', () => {
    for (const loc of LOCALES) {
      const s = getBasemapStrings(loc);
      expect(s.control.length).toBeGreaterThan(0);
      for (const opt of BASEMAP_OPTIONS) {
        expect(s.options[opt.id], `${loc}/${opt.id}`).toBeTruthy();
      }
    }
  });

  it('carries no "Swisstopo" prefix in the english labels', () => {
    const s = getBasemapStrings('en');
    for (const v of Object.values(s.options)) expect(v).not.toMatch(/swisstopo/i);
  });

  it('falls back to english for an unknown locale', () => {
    expect(getBasemapStrings('xx' as any)).toEqual(BASEMAP_STRINGS.en);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/basemap/i18n.test.ts`
Expected: FAIL — `Cannot find module './i18n'`.

- [ ] **Step 3: Create `i18n.ts`**

Create `src/basemap/i18n.ts` with the de-"Swisstopo"'d names (matching valoo `I18nContext.tsx` after PR #173):
```ts
export type BasemapLocale = 'en' | 'fr' | 'de' | 'it';

export interface BasemapLabels {
  /** aria-label for the picker trigger / control. */
  control: string;
  /** basemap id → display name. */
  options: Record<string, string>;
}

export const BASEMAP_STRINGS: Record<BasemapLocale, BasemapLabels> = {
  en: { control: 'Basemap', options: {
    'swisstopo-base': 'Standard', 'swisstopo-light': 'Light', 'light-minimal': 'Light Minimal',
    'swisstopo-dark': 'Dark', 'dark-minimal': 'Dark Minimal', 'swisstopo-imagery': 'Aerial',
  } },
  fr: { control: 'Fond de carte', options: {
    'swisstopo-base': 'Standard', 'swisstopo-light': 'Clair', 'light-minimal': 'Clair épuré',
    'swisstopo-dark': 'Sombre', 'dark-minimal': 'Sombre épuré', 'swisstopo-imagery': 'Aérien',
  } },
  de: { control: 'Grundkarte', options: {
    'swisstopo-base': 'Standard', 'swisstopo-light': 'Hell', 'light-minimal': 'Hell minimal',
    'swisstopo-dark': 'Dunkel', 'dark-minimal': 'Dunkel minimal', 'swisstopo-imagery': 'Luftbild',
  } },
  it: { control: 'Mappa di base', options: {
    'swisstopo-base': 'Standard', 'swisstopo-light': 'Chiaro', 'light-minimal': 'Chiaro minimale',
    'swisstopo-dark': 'Scuro', 'dark-minimal': 'Scuro minimale', 'swisstopo-imagery': 'Aerea',
  } },
};

export function getBasemapStrings(locale: string): BasemapLabels {
  return BASEMAP_STRINGS[(locale as BasemapLocale)] ?? BASEMAP_STRINGS.en;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/basemap/i18n.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/basemap/i18n.ts src/basemap/i18n.test.ts
git commit -m "feat(basemap): 4-locale basemap labels (de-Swisstopo'd)"
```

---

## Task 5: Live preview map (`BasemapThumbMap.tsx`)

**Files:**
- Create: `src/basemap/BasemapThumbMap.tsx`

- [ ] **Step 1: Create the component**

Port valoo `ParcelMap.tsx` lines 511–558 (`BASEMAP_THUMB_CENTER`, `BASEMAP_THUMB_ZOOM`, `BasemapThumbMap`). Change the `maplibregl.Map` construction to use a passed-in `maplibregl` namespace OR import it. Since `maplibre-gl` is an external peer that apps already bundle, import it directly:
```tsx
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { BasemapOption } from './options';
import { resolveBasemapStyle } from './options';

const BASEMAP_THUMB_CENTER: [number, number] = [8.5417, 47.3769];
const BASEMAP_THUMB_ZOOM = 12.2;

export const BasemapThumbMap = ({ basemap }: { basemap: BasemapOption }) => {
  /* body verbatim from valoo 521–558, replacing the bare `maplibregl.Map`
     with `new maplibregl.Map({...})` (same call) */
};
```
Keep the cleanup (`map?.remove()`), the `cancelled` guard, and the pulse skeleton exactly as valoo has them.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/basemap/BasemapThumbMap.tsx
git commit -m "feat(basemap): BasemapThumbMap live preview"
```

---

## Task 6: Gallery picker (`BasemapPicker.tsx`) — Approach C

**Files:**
- Create: `src/basemap/BasemapPicker.tsx`
- Test: `src/basemap/themePairing.test.ts` (pure helper)

The picker owns: gallery UI (grid of `BasemapThumbMap`), selected state, the style swap (`resolveBasemapStyle` → `map.setStyle` → `style.load` → `onBasemapApplied`), theme pairing (default on) with manual-pick pinning. Extract the pure "which basemap should theme show" decision into a tiny testable helper.

- [ ] **Step 1: Write the failing test for the pinning helper**

Create `src/basemap/themePairing.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { nextThemeBasemap } from './BasemapPicker';

describe('nextThemeBasemap', () => {
  it('returns the theme basemap when not pinned', () => {
    expect(nextThemeBasemap({ dark: true, pinned: false, current: 'swisstopo-light' })).toBe('swisstopo-dark');
    expect(nextThemeBasemap({ dark: false, pinned: false, current: 'swisstopo-dark' })).toBe('swisstopo-light');
  });
  it('returns null (no change) when pinned', () => {
    expect(nextThemeBasemap({ dark: true, pinned: true, current: 'swisstopo-imagery' })).toBeNull();
  });
  it('returns null when already on the matching theme basemap', () => {
    expect(nextThemeBasemap({ dark: true, pinned: false, current: 'swisstopo-dark' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/basemap/themePairing.test.ts`
Expected: FAIL — `nextThemeBasemap` not exported.

- [ ] **Step 3: Create `BasemapPicker.tsx`**

Create `src/basemap/BasemapPicker.tsx`:
```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { BasemapThumbMap } from './BasemapThumbMap';
import {
  BASEMAP_OPTIONS, getBasemapOption, resolveBasemapStyle, themeBasemapId,
  type BasemapOption,
} from './options';
import type { BasemapLabels } from './i18n';

/** Pure decision for theme auto-pairing. Exported for unit testing. */
export function nextThemeBasemap(
  { dark, pinned, current }: { dark: boolean; pinned: boolean; current: string },
): string | null {
  if (pinned) return null;
  const target = themeBasemapId(dark);
  return target === current ? null : target;
}

export interface BasemapPickerProps {
  map: MaplibreMap | null;
  labels: BasemapLabels;
  /** Required: re-add the app's own data layers after the style swap + load. */
  onBasemapApplied: (map: MaplibreMap, basemap: BasemapOption) => void;
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  dark?: boolean;
  /** Suite standard: ON. Manual pick pins and suppresses further auto-pairing. */
  pairWithTheme?: boolean;
  options?: BasemapOption[];
  className?: string;
}

export const BasemapPicker = ({
  map, labels, onBasemapApplied, value, defaultValue,
  onChange, dark = false, pairWithTheme = true, options = BASEMAP_OPTIONS, className,
}: BasemapPickerProps) => {
  const controlled = value != null;
  const [internal, setInternal] = useState(
    () => value ?? defaultValue ?? themeBasemapId(dark),
  );
  const selectedId = controlled ? (value as string) : internal;
  const [open, setOpen] = useState(false);

  // An explicit initial value (controlled or defaultValue) counts as pinned.
  const pinnedRef = useRef<boolean>(value != null || defaultValue != null);
  const styleReqRef = useRef(0);
  const onAppliedRef = useRef(onBasemapApplied);
  onAppliedRef.current = onBasemapApplied;

  const applyBasemap = useCallback((id: string) => {
    if (!map) return;
    const basemap = getBasemapOption(id);
    const reqId = ++styleReqRef.current;
    void resolveBasemapStyle(basemap).then((style) => {
      if (!map || styleReqRef.current !== reqId) return;
      map.once('style.load', () => {
        if (styleReqRef.current !== reqId) return;
        onAppliedRef.current(map, basemap);
      });
      map.setStyle(style as any);
    }).catch((e) => console.error(`basemap "${id}" failed`, e));
  }, [map]);

  const select = (id: string) => {
    pinnedRef.current = true;            // manual pick pins
    setOpen(false);
    if (!controlled) setInternal(id);
    onChange?.(id);
    applyBasemap(id);
  };

  // Theme pairing: when dark flips, auto-swap unless pinned / already matching.
  useEffect(() => {
    if (!pairWithTheme || !map) return;
    const next = nextThemeBasemap({ dark, pinned: pinnedRef.current, current: selectedId });
    if (!next) return;
    if (!controlled) setInternal(next);
    onChange?.(next);
    applyBasemap(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  return (
    <div className={className}>
      <button
        type="button"
        aria-label={labels.control}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow ring-1 transition-colors ${
          dark ? 'bg-gray-900/90 text-gray-100 ring-white/10 hover:bg-gray-800'
               : 'bg-white/95 text-gray-800 ring-black/10 hover:bg-gray-50'
        }`}
      >
        {labels.options[selectedId] ?? labels.control}
      </button>
      {open && (
        <div
          className={`mt-2 grid grid-cols-2 gap-2 rounded-xl p-2 shadow-xl ring-1 ${
            dark ? 'bg-gray-900/95 ring-white/10' : 'bg-white/95 ring-black/10'
          }`}
        >
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => select(opt.id)}
              className={`group relative h-20 w-28 overflow-hidden rounded-lg ring-2 transition ${
                opt.id === selectedId ? 'ring-emerald-500' : 'ring-transparent hover:ring-emerald-300'
              }`}
            >
              <BasemapThumbMap basemap={opt} />
              <span className="absolute bottom-0 inset-x-0 bg-black/45 px-1 py-0.5 text-[10px] font-medium text-white text-center">
                {labels.options[opt.id] ?? opt.id}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default BasemapPicker;
```

Note: this is the suite-standard picker UI. It intentionally does NOT call `onBasemapApplied` on first mount — the consuming app loads its initial style + data layers itself (valoo's existing init at lines 1283–1309 keeps doing that); the picker only handles subsequent swaps and theme pairing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/basemap/themePairing.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/basemap/BasemapPicker.tsx src/basemap/themePairing.test.ts
git commit -m "feat(basemap): BasemapPicker gallery + theme pairing (Approach C)"
```

---

## Task 7: Subpath barrel + build wiring + version

**Files:**
- Create: `src/basemap/index.ts`
- Modify: `tsup.config.ts`, `package.json`

- [ ] **Step 1: Create the barrel**

Create `src/basemap/index.ts`:
```ts
export * from './restyle';
export * from './specs';
export * from './options';
export * from './i18n';
export { BasemapThumbMap } from './BasemapThumbMap';
export { BasemapPicker, default as BasemapPickerDefault, nextThemeBasemap, type BasemapPickerProps } from './BasemapPicker';
```

- [ ] **Step 2: Add the tsup entry**

In `tsup.config.ts`, add `'src/basemap/index.ts'` to the `entry` array (alongside the existing `src/map/parcelInteraction.ts` / `src/map/maplibreStyle.ts` entries). `maplibre-gl` is already in `external`.

- [ ] **Step 3: Add the package export + bump version**

In `package.json`: set `"version": "1.11.0"`, and add to `exports`:
```json
"./basemap": {
  "types": "./dist/basemap/index.d.ts",
  "default": "./dist/basemap/index.js"
}
```

- [ ] **Step 4: Build + verify the subpath emits**

Run:
```bash
npm run typecheck && npm run build
ls dist/basemap/index.js dist/basemap/index.d.ts
grep -c "BasemapPicker\|resolveBasemapStyle\|getBasemapStrings" dist/basemap/index.js
```
Expected: typecheck + build pass; both files exist; grep ≥ 3.

- [ ] **Step 5: Run the full unit suite**

Run: `npm test`
Expected: all tests pass (restyle 3, options 5, i18n 3, themePairing 3).

- [ ] **Step 6: Commit**

```bash
git add src/basemap/index.ts tsup.config.ts package.json dist/
git commit -m "feat(basemap): /basemap subpath export + build wiring (v1.11.0)"
```

---

## Task 8: Ship `@aireon/shared@1.11.0`

- [ ] **Step 1: Push + PR**

```bash
git push -u origin feat/shared-basemap
gh pr create --title "feat(basemap): shared swisstopo basemap system (v1.11.0)" --body "Extracts valoo's basemap engine + 6 swisstopo basemaps + gallery picker into @aireon/shared/basemap (Approach C). Pure-logic vitest tests added. See docs/superpowers/specs/2026-06-10-shared-basemap-system-design.md."
```

- [ ] **Step 2: Merge + tag**

```bash
gh pr merge feat/shared-basemap --squash --delete-branch
git checkout main && git pull origin main
git tag v1.11.0 && git push origin v1.11.0
```
Expected: PR merged; `v1.11.0` tag pushed. Confirm `node -e "console.log(require('./package.json').version)"` → `1.11.0` and `grep -c BasemapPicker dist/basemap/index.js` ≥ 1 on main.

---

## Task 9: Back-port valoo onto the shared module (proof)

**Files (valoo):**
- Modify: `src/components/ParcelMap.tsx`, `package.json`

Goal: valoo deletes its inline basemap code and consumes `@aireon/shared/basemap`, with no behavior change except the new manual-pick pinning.

- [ ] **Step 1: Bump the dep**

```bash
cd /Users/joe/Documents/local_dev/swissnovo/valoo
git fetch origin -q && git checkout main -q && git pull origin main -q
git checkout -b refactor/shared-basemap
npm install "github:mbuchi/aireon-shared#v1.11.0"
grep -c "BasemapPicker\|resolveBasemapStyle" node_modules/@aireon/shared/dist/basemap/index.js
```
Expected: dep resolves to `#v1.11.0`; grep ≥ 1.

- [ ] **Step 2: Replace the inline definitions with imports**

In `src/components/ParcelMap.tsx`:
- Delete the inline blocks now living in shared: `cloneStyle` (25–27), `fetchStyleJson` + `rawStyleCache` (29–42), `roadColorByClass`/`labelPaint`/`RestyleSpec`/`applyRestyle` (44–113), all the restyle palettes + specs + `MINIMAL_HIDE` + `to*Style` transforms (the §"Custom swisstopo restyle" through the `toDarkMinimalStyle` line), `SWISSTOPO_VT`/`BasemapOption`/`basemapOptions`/`getThemeBasemapId`/`getBasemapOption`/`resolveBasemapStyle` (469–509), `BASEMAP_THUMB_CENTER`/`BASEMAP_THUMB_ZOOM`/`BasemapThumbMap` (511–558).
- Keep `SWISSTOPO_LIGHT_BASEMAP_ID`/`SWISSTOPO_DARK_BASEMAP_ID` usages by importing them.
- Add import:
```ts
import {
  BASEMAP_OPTIONS, getBasemapOption, resolveBasemapStyle, themeBasemapId,
  SWISSTOPO_LIGHT_BASEMAP_ID, SWISSTOPO_DARK_BASEMAP_ID,
  BasemapPicker,
  type BasemapOption,
} from '@aireon/shared/basemap';
```
- Replace `getThemeBasemapId(` call sites with `themeBasemapId(`.
- Keep valoo's `applyBasemapStyle` (756–775) and its init effect (1283–1309) — they call the imported `resolveBasemapStyle`/`getBasemapOption` and still own `addParcelLayers` (the re-add). These continue to work unchanged.

- [ ] **Step 3: Swap the inline gallery JSX for `<BasemapPicker>`**

Find valoo's basemap gallery markup (the block rendering `<BasemapThumbMap basemap={basemap} />` around line 1549, plus its open/close button and `basemapOptions.map(...)`). Replace that whole control with:
```tsx
<BasemapPicker
  map={mapRef.current}
  dark={darkMode}
  labels={{
    control: t('panel.basemap.control') /* or a sensible existing label */,
    options: Object.fromEntries(BASEMAP_OPTIONS.map((b) => [b.id, t(basemapLabelKey(b.id))])),
  }}
  value={selectedBasemap}
  onChange={setSelectedBasemap}
  onBasemapApplied={(m) => {
    addParcelLayers(m);
    applyParcelVisibility(m, parcelsVisibleRef.current);
    /* mirror the post-swap restore valoo does at 1373–1382 */
  }}
/>
```
where `basemapLabelKey(id)` maps each id to valoo's existing `panel.basemap.swisstopo_*` key (keep a small local map so valoo's translations are reused). Remove valoo's now-dead `selectedBasemap` gallery open/close state if `<BasemapPicker>` owns it — but since valoo still drives `selectedBasemap` for the theme effect at 1350–1384, pass it as `value` and keep `setSelectedBasemap` via `onChange` (controlled), and let valoo's existing theme effect continue OR delegate theme pairing to the picker (`pairWithTheme` default on) and delete valoo's 1350–1384 effect. **Choose delegation:** delete valoo's theme-pairing effect (1350–1384) and let `<BasemapPicker pairWithTheme>` handle it; keep only the parcel-opacity dark/light adjustment in a slimmed effect (opacity is valoo-specific, not basemap logic).

- [ ] **Step 4: Typecheck + build**

Run: `npm run build`
Expected: PASS (tsc + vite). Fix any unused-import errors from the deletions (valoo has `noUnusedLocals`).

- [ ] **Step 5: Manual verification checklist**

Run `npm run dev`, open a parcel, and confirm:
- All 6 basemaps switch and the parcel choropleth re-appears each time (the `onBasemapApplied` re-add works).
- Toggling dark/light swaps Light↔Dark basemap (theme pairing) — until you manually pick one, after which a theme toggle no longer overrides it (pinning).
- Street/place labels render above the parcels.

- [ ] **Step 6: Release notes + version + ship**

Prepend a `v0.10.61` entry to `src/data/releaseNotes.ts` (kind `'improved'`, icon `Layers`, codename e.g. "Shared Basemaps", text: "valoo's basemap picker now runs on the shared @aireon/shared basemap component — same maps, plus a manual pick now sticks when you toggle theme."). Set `package.json` version to match (account for any newer top entry — use `max(pkg, notesTop)+1 patch`).
```bash
git add src/components/ParcelMap.tsx package.json package-lock.json src/data/releaseNotes.ts
git commit -m "refactor: consume shared @aireon/shared/basemap (vX.Y.Z)"
git push -u origin refactor/shared-basemap
gh pr create --title "refactor: use shared basemap system" --body "valoo now consumes @aireon/shared/basemap v1.11.0 (Approach C). No basemap behaviour change except manual-pick pinning. -~300 lines."
gh pr merge refactor/shared-basemap --squash --delete-branch
```

---

## Self-review notes (author)

- **Spec coverage:** engine (T1), specs (T2), options/resolve (T3), i18n (T4), thumb (T5), picker + theme-pairing + pinning + onBasemapApplied (T6), subpath/build/version (T7), ship v1.11.0 (T8), valoo back-port + proof (T9). All §3–§10 spec items covered.
- **Type consistency:** `themeBasemapId` (renamed from valoo's `getThemeBasemapId`) used consistently in T3/T6/T9. `BasemapOption` loses `labelKey` (T3) — names come from `BasemapLabels.options` (T4) keyed by `id`; T6 picker and T9 valoo both resolve names that way. `onBasemapApplied(map, basemap)` signature identical in T6 def and T9 usage.
- **Placeholder check:** large verbatim color-spec block (T2) and `BasemapThumbMap` body (T5) are exact moves from cited valoo line ranges (not vague) — re-pasting ~200 lines of hex here would risk transcription drift; the source is the canonical copy.
