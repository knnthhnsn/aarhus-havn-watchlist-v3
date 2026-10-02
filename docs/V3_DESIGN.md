# V3 design decisions

This document describes the current V3 design and its intended behaviour. It is not a test report or a claim that every device has been verified. Dated browser, accessibility and release evidence belongs in `V3_QA.md`.

## Direction

V3 treats Vessel Schedule as an operational workspace: a user should identify a vessel, its placement, the next task and any problem without first navigating a promotional dashboard. The list occupies the available width. The desktop sidebar can collapse to return that width to the work area.

The visual language uses Space Grotesk, clear typographic hierarchy, flat surfaces, operational density and restrained rounded corners. Official Aarhus Havn marks remain intact. The main work surface contains no gradients, decorative edge stripes, status-coloured berth labels or oversized illustrative hero. Normal and compact are distinct information hierarchies, not cosmetic spacing options.

The workspace-selection page uses a larger editorial type treatment because it is an entry point rather than a data-dense operating surface. It uses the same theme tokens and controls as the application.

## Recognizable states and mobile actions

Status belongs to its complete relevant area, rather than an isolated coloured dot: an operation card, time card, map vessel choice or non-interactive legend label. Expected is yellow, ordered/en-route is blue and actual is coral; lifecycle “in port” uses green. Written state names remain visible, so colour is never the only explanation. Colour does not replace zebra row scanning or turn neutral quay identifiers into operation statuses.

Normal mobile takes its task/action hierarchy from the supplied V2 reference: vessel identity and pin state first, separately labelled quay/arrival/departure facts, then a filled next-task panel containing status, task, date/time and placement. A distinct navy Register area opens confirmation. Optional tasks expand explicitly. Compact keeps its short summary, OPS count, More control, notes indicator and visible pinned indicator instead of rendering the large panel.

Shared pin controls use outlined inactive and solid active surfaces, a filled pin plus check, `aria-pressed`, vessel-specific action labels and visible keyboard focus. The normal phone action also says “Fastgjort”. Selection on the map includes a check and “Valgt”. Short hover/press feedback supports interaction and honours reduced motion; no gradients or decorative edge rails are introduced.

The sidebar and browser favicon use the exact 32×32 PNG favicon selected by the user from the official Aarhus Havn website, verified on 2026-09-05: https://cdn.prod.website-files.com/65e8645ed4e5ccf7a0756056/6614f09bc9afc476caee4999_aah-favicon-32x32.png. The user's “monogram” refers here to the white line on navy; the supplied design manual calls the independent line “Linjen” (page 21). Its original bytes and colours are preserved. The sidebar displays it at 32 CSS pixels inside a 58px navy tile in both themes. This asset choice does not claim whole-interface compliance with the manual; the official wordmarks remain available for other placements.

## Colour and typography

The brand anchors are navy `#0a3055`, warm sand `#dcdccc` and Brand Black `#0a0a0a`. V3 uses supporting flat surface and text colours to create readable light and dark interfaces. These authored UI tokens should be distinguished from a formal claim that every tone is a primary colour in the original design manual.

| Role | Dark theme | Light theme |
| --- | --- | --- |
| Page canvas | `#0a0a0a` | `#eeeee7` |
| Main surface | `#111e2b` | `#ffffff` |
| Raised/grouped surface | `#1a2b3c` | `#e7e8df` |
| Primary text | `#eeeee7` | `#0a3055` |
| Secondary text | `#adbac6` | `#526374` |
| Alternating list row | `#1a2b3c` | `#e7e8df` |
| Row hover / keyboard focus | `#24384a` | `#dde1dd` |
| Notes with content / text | `#a1d5c6` / `#0a3055` | `#005758` / `#ffffff` |
| Primary action fill | `#dcdccc` | `#0a3055` |
| Primary action text | `#0a3055` | `#ffffff` |

`src/app/globals.css` is authoritative for these tokens. Components inherit them, including native dialogs in the browser's top layer. The desktop rail, its collapse control, menu states and profile controls all respond to the selected theme.

Yellow is reserved for expected operational state; ordered times use pale blue. Live ETA is explicitly labelled as an estimate and remains separate from the ordered time. Recorded actual events have their own labelled treatment. Warning colour is paired with explanatory text and an icon. Neutral berth labels do not reuse expected-state yellow.

Space Grotesk is loaded by `next/font`. Interface sizes favour legible metadata, stronger vessel names and tabular time values. Input sizes avoid mobile Safari's small-input zoom behaviour. Focus and selected states are visible rather than conveyed solely by animation.

## Information hierarchy

The page starts with a compact identity/refresh row and a clear operational heading. Three summary controls expose active work, attention and the next task. Selecting a summary changes the working scope.

The toolbar groups search, filters, information presets, sorting, density and column settings. Fuld, Kontor and Havn change the information shown; they do not represent access privileges. The separate workspace selection determines the fictional server-side record view.

The list uses vessel identity as the stable anchor. Full exposes all 21 V2 domain fields as independently sortable columns, including separate customer, agent, LOA, beam, IMO, call sign, quay, bollards and side. All presets retain independent OPS and next-task columns. Every field is also available in the sort selector; header sorting cycles natural direction, reverse, then default next-task order. Placement and time sorting use the displayed primary value, not an invisible legacy placement or supplementary live ETA. Pinned calls retain priority.

Normal table rows show optional operations with type, state, time, placement and services directly. Compact rows use an OPS disclosure and substantially lower row height. Completed optional operations remain discoverable and use their recorded timestamp. A task appearing as next is not removed from OPS. The visible range and page controls keep the result set understandable.

Rows alternate between the main and raised surface colours in all presets and both densities, including mobile swipe rows. Alternation follows the displayed call order after filtering/sorting, not the physical DOM row count: an inline OPS expansion retains its parent call's stripe. The sticky vessel cell matches the rest of its row. Hover and keyboard focus highlight the entire table row without replacing operational time or note colours.

Notes with written content use a green fill and contrasting text; empty notes retain a neutral, outlined zero. The count and note icon remain visible, so colour is not the only signal. Empty/whitespace-only records do not count as written notes. Table, normal mobile summary and More tray share the same note control. Compact mobile keeps a small non-interactive count in the existing next-task line; its labelled notes action remains in More. Counts and colour update from the effective call data after a local note is saved. Warning explanations preserve the underlying scheduling or data-quality reason; a coloured dot alone is insufficient.

## Responsive behaviour

The responsive system is width-based rather than a hard-coded device catalogue. The acceptance target includes iPhone 17 and 17e, other phones, tablets and desktops. Phone testing must include portrait and landscape, safe-area insets, on-screen keyboard use and longer English labels; viewport emulation is not proof of physical-device testing.

At 760 CSS pixels and below, users choose between dense swipe rows and the full sortable table. This choice is saved per public profile. Normal swipe rows show additional metadata, pin and notes controls directly; compact rows move secondary data into the explicit More tray, retaining quay, both times, next task, signals and a separate OPS disclosure. Compact phone mode also removes summary tiles to free working space. The desktop rail is hidden and bottom navigation exposes list, map, pinned calls and profile. The same Fuld/Kontor/Havn segmented control stays available.

A rightward touch/pen swipe opens the inline action tray; left closes it. Vertical intent locks out swiping and gestures starting on controls are ignored. A visible 44px More button is the keyboard/tap alternative. Swiping never writes a registration; a separate confirmation is required. Escape closes the tray or OPS and restores focus.

Above that breakpoint, the table uses available width. A dedicated table scroll region accommodates genuinely wide column selections; it must not create page-level horizontal overflow. Tablet and smaller desktop layouts wrap toolbar controls and reduce incidental spacing. Wide layouts expand the work area rather than constraining it to a narrow card.

Call details use a desktop modal with a constrained, independently scrollable content area. At 600 CSS pixels and below it becomes a full-height sheet. The header, tabs and action footer remain accessible; safe-area padding protects the bottom action. The workspace-selection page becomes a single-column layout below 760 pixels.

## Call detail and task completion

The detail workspace has four integrated tabs:

- **Anløb:** separately labelled times, current/upcoming placement, warnings, partners and crane/data status.
- **Tidslinje:** a numbered sequence of operations with time, state, placement and service information. No decorative timeline rail or accent border is required to understand the sequence.
- **Skib:** vessel identity, IMO, call sign, dimensions, category, flag and previous/current/next port.
- **Noter:** note history, a labelled composer and document availability.

The component uses native `dialog`, background scroll locking, Escape/backdrop dismissal and focus restoration. Tabs support arrow keys, Home and End. Registration requires a small explicit confirmation. After completion the detail closes so the undo feedback outside the modal remains reachable. Cancelling confirmation returns focus to the registration control.

Protected records are read-only for notes and operation registrations. Document text describes the real availability of the link/integration; the interface does not offer fake downloads.

## Harbour map

The map is loaded on demand. Traffic, quay and route layers expose operational context. Quay geometry has enlarged interaction corridors and keyboard labels. Choosing a quay highlights/zooms it and filters in place; switching to another quay does not force list navigation. A searchable quay directory and numerically sorted native selector provide alternatives to map geometry. Current and upcoming calls are shown separately, including useful empty-quay states and clear-filter controls. Counts use the authorized effective snapshot, and historical placements are excluded. Future shifts use their own assignment time/state; arrival rows distinguish ordered time from live ETA.

A vessel list provides an alternative to selecting map markers. Only the explicit View quay in list action leaves the map. Overlapping vessel positions can be represented as grouped markers.

The map uses an OpenStreetMap basemap and inherited Aarhus planning geometry. Missing tracking data does not justify inventing an offshore ship position. Tile-loading failure receives a visible retry path. Source and geometry limitations are placed where they help interpret the map.

## Workspace selection and state

`/login` is a workspace selector, not a verified credential flow. Native radio choices submit the existing profile-selection server action. The design removed password and one-time-code fields because the application has no identity provider that can validate them.

Public and Havnevagt preferences are stored by profile. Theme and language follow the selected appearance into the workspace without overwriting unrelated settings. The secure profile neither reads nor saves that local preference record. The main application additionally disables persistence whenever the active context is restricted or a snapshot contains protected calls.

Local notes and registrations are local application state, with explicit feedback. They are not represented as delivered FlexPort or D365 commands. Fetch freshness refers to when the snapshot was retrieved; operational timestamps belong to the deterministic scenario clock.

## Acceptance and evidence

Design acceptance requires rendered checks of phone, tablet and desktop layouts in both themes, representative long content, search/filter/sort flows, map selection, notes and registration/undo, and keyboard navigation. Contrast must be measured on the actual foreground/background pair; a token's nominal colour alone is insufficient. Empty, offline and error states need review as well as the populated view.

Repository lint, type, domain tests and build checks complement those checks. They do not replace them. Record actual commands, outcomes, browser widths, screenshots, remaining limitations and deployed revision in `V3_QA.md`.

The other copied documents in this folder—including `QA_REPORT.md`, `FINAL_REPORT.md`, `UX_DECISION_LOG.md`, `SOURCE_REVIEW.md`, `ORIGINAL_BASELINE.md`, `MOCK_DATA_AND_INTEGRATIONS.md` and everything under `qa/`—are inherited V2/earlier context. Their claims, colours, screenshots, scores and release identifiers are not V3 verification evidence.
