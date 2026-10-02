# Vessel Schedule · V3

An independent V3 website for Aarhus Havn's port-call workflow. V3 provides a full-width, 21-field sortable table, compact mobile swipe rows with a saved table alternative, interactive/filterable harbour quays and an accessible call-detail workspace.

Live: [Vessel Schedule V3](https://aarhus-havn-watchlist-v3.vercel.app/watchlist).

The running application uses fictional operational fixtures. Its interface is designed as a finished product; the technical boundaries below describe what the implementation actually does.

## Run locally

Requirements: Node.js 20.9 or later and npm.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open [the local watchlist](http://localhost:3000/watchlist) or [workspace selection](http://localhost:3000/login). To use a separate port alongside V2:

```powershell
npm.cmd run dev -- --hostname 127.0.0.1 --port 4326
```

For a local production build:

```powershell
npm.cmd run build
npm.cmd run start
```

The `next/font` build fetches Space Grotesk and serves the resulting font files from the application. Building therefore requires access to the font provider unless those resources are already cached.

## What V3 contains

- Desktop and mobile sortable table, or dense mobile swipe rows, with Fuld / Kontor / Havn information presets.
- Independent OPS in every preset: shifting, assistance and anchorage, including next-task and completed entries; normal inline details and compact disclosure.
- Structural normal/compact density: lower table/phone row heights, secondary details in an action tray, and fewer phone summary elements.
- Search, status and berth filters; shift, all-call, pinned and attention scopes; sortable columns; configurable column visibility/order; pagination.
- Consistent expected, ordered, live-estimate and actual time labels. Berth labels remain separate from operational status colours.
- Pinning, warning explanations, current/upcoming placements and next actionable operations.
- A four-tab call dialog: Anløb, Tidslinje, Skib and Noter. On phones it becomes a full-height sheet.
- A code-split Leaflet harbour map with traffic, quay and route views, selected-vessel details, a keyboard-accessible vessel list and basemap failure feedback.
- Danish and English interface text, light/dark themes, normal/compact density, and a collapsible desktop sidebar.
- Manual refresh and a ten-minute automatic refresh, with visible age, offline and refresh-error states.
- Workspace selection through the existing server action, without requesting passwords or claiming a verified identity.

The initial working view is Danish, dark, Kontor, normal density and 20 calls per page. Saved preferences can change that initial view.

## Source map

| Area | Responsibility |
| --- | --- |
| `src/app/watchlist/page.tsx` | Server-rendered initial snapshot and selected workspace |
| `src/components/v3/VesselSchedule.tsx` | V3 application state, list, navigation and controls |
| `src/components/v3/CallDetail.tsx` | Call details, timeline, notes and registration confirmation |
| `src/components/v3/PortMap.tsx` | Leaflet map, layers and vessel selection |
| `src/components/v3/display.ts` | Shared interface labels and time presentation |
| `src/app/login/` | Workspace-selection UI and profile cookie action |
| `src/app/globals.css` | Shared light/dark theme tokens |
| `src/lib/watchlist.ts` | Typed entities, operations, warnings, filtering, sorting and placement rules |
| `src/lib/mobileTask.ts` | Registration overrides and derived operational state |
| `src/lib/harbor.ts` | Harbour geometry and route helpers |
| `src/services/watchlistServer.ts` | Server-side fixture composition and record visibility |
| `src/services/watchlistService.ts` | Browser adapter for `/api/watchlist` |
| `src/data/` | Public and protected fictional fixtures |
| `public/brand/` | Preserved brand marks and inherited brand assets |

The copied `src/components/watchlist/` implementation remains available as inherited code. The V3 route renders `VesselSchedule`; V3 detail reuses selected domain/presentation helpers from the inherited lifecycle module.

## Operational boundaries

**Workspace selection is not authentication.** The `chooseDemoProfile` server action accepts an allowlisted profile id, sets an HttpOnly, SameSite=Lax cookie for eight hours and redirects to `/watchlist`. It does not validate an employee account, password, Microsoft Entra identity or MFA code.

Public and Havnevagt workspaces receive 76 public fictional port calls. Sikret drift includes four additional protected fictional calls. Server composition filters associated vessels, tracking and service orders together with the permitted calls. Unknown profile values fall back to the public view. The API uses private, no-store responses. These mechanics demonstrate fixture visibility; they are not a real-data authorisation system.

For non-restricted contexts, preferences, pins, added notes and operation registrations are saved to the browser's profile-specific `aarhus-havn-v3.<profile>` key. Notes and registrations do not sync to another user, browser or backend. Registration has an explicit confirmation and an undo action. The operational fixtures and registrations use the shared scenario clock in `src/lib/watchlist.ts`; this is distinct from the real time at which the API snapshot was fetched.

Restricted contexts do not persist application state in browser storage. Protected records cannot be edited through local notes or registration controls.

FlexPort documents are descriptive records. There is no real document download, DataPort, FlexPort, D365 or live ship-tracking connection. The map uses OpenStreetMap tiles and inherited planning geometry; it is not a navigation or surveyed mooring system. Replacing fixture composition requires real integration, identity, authorisation and persistence work.

## Design and verification

[V3 design notes](docs/V3_DESIGN.md) describe the visual system and interaction decisions.

Run the repository checks:

```powershell
npm.cmd run verify
```

This runs ESLint, TypeScript, Vitest and a Next.js production build. Passing these checks does not establish visual quality, physical-device compatibility or a completed deployment. V3 browser and release evidence is maintained separately in `docs/V3_QA.md`; consult the actual dated results there.

### Documentation scope

This repository includes current V3 design, verification and performance notes. V2-era reports, handoff-generation materials and local-only QA artifacts are intentionally not included. Historical results should not be treated as acceptance evidence for a current deployment.

## Deployment

The existing V3 prototype is linked above and hosted separately from this source repository. Pushing to GitHub does not update the Vercel deployment automatically. Keep any deployment separate from the portfolio and V2 projects, and record the verified V3 URL and deployed revision in release evidence.

The application is intentionally excluded from search indexing.
