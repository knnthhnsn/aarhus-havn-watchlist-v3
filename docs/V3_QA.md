# V3 acceptance evidence

Date: 5 September 2026. This report covers the independent V3 implementation, not the inherited V2 reports.

## Status surfaces and V2-inspired mobile actions — local revision, 5 September 2026

This is a local revision only. The preview on `http://localhost:4327/watchlist` was rebuilt and restarted; no deployment or commit was made.

- `npm.cmd run verify`: PASS, zero lint warnings, TypeScript, **181 tests / 16 files**, production build. Test discovery now includes `.test.tsx`. Fourteen added tests cover readable status labels, active/inactive pins, a compact pinned indicator, normal/compact mobile task presentation, protected-call restrictions and filled desktop OPS surfaces.
- Status is applied to the relevant complete surface: desktop OPS, normal mobile next-task cards and expanded OPS, detail time cards/timeline events, map vessel choices and the status legend. Each retains a written status label. Quays remain neutral; alternating row backgrounds and green written-note controls are preserved.
- Browser checks: dark/light mobile normal and compact at 320 and 390 CSS pixels; dark/light desktop table at 1440px; map selection on 320px mobile and 1440px desktop. No page-level horizontal overflow in those inspected layouts. Wide desktop tables continue to scroll internally.
- Normal mobile includes the operation, status, date/time, placement and a direct registration action. At 320px, the sampled normal cards measured approximately **300px**, compact cards **120px**. At 1440px the desktop samples measured **88–92px normal / 53px compact**. The new normal task card supersedes the smaller normal-card measurements in the historical sections below.
- Pinning was exercised with pointer and Enter. Active controls use a solid fill, pin/check icons, `aria-pressed` and, where space permits, “Fastgjort”. The compact mobile indicator is visible outside the closed action tray. Keyboard focus was visibly outlined. Test pins were removed afterwards.
- Direct mobile registration opened the existing confirmation, focused “Annullér”, and did not immediately register anything. Cancellation restored focus to the registration control. No new operation registration or note was saved in this revision.
- A rendered-DOM text contrast scan used computed foreground/background colours and alpha compositing, with 4.5:1 normal-text and 3:1 large-text thresholds. No failing text pairs remained in the inspected settled light/dark list, mobile task/OPS and detail views. Map scans found no new failing text pair; the shared low-contrast breadcrumb separator discovered on desktop was corrected and rechecked in both themes. This is not a certification of all content, network states, physical devices, image/map tiles or assistive technology.
- Sidebar active navigation is mutually exclusive between List, Map and Pinned. The Pinned entry is now “Fastgjorte”, matching mobile and the scope filter. Refresh presents a written loading/error/offline/freshness state with an icon, not an isolated green dot.
- **Resolved brand input — 2026-09-05:** the user supplied the design manual and selected the official site's favicon: https://cdn.prod.website-files.com/65e8645ed4e5ccf7a0756056/6614f09bc9afc476caee4999_aah-favicon-32x32.png. The exact 32×32 PNG now supplies the sidebar and browser icon; the manual calls its independent line “Linjen”, while the user called this placement a “monogram”. Source and copied asset SHA256 match (`9D05225CF39F0012D34493A1DE1ABA610F4FDE77E93747F089EE901072280766`). After this change, `npm.cmd run verify` passed lint, TypeScript, **181 tests / 16 files**, and the production build. The local production-mode preview was restarted on `127.0.0.1:4327`. Controller visual review at 1440×1000 confirmed the mark in dark and light screenshots. In both modes, the loaded sidebar image had natural/display width 32px inside a 58px navy `rgb(10,48,85)` tile; the light rail retained `rgb(220,220,204)`. The sole `rel=icon` referenced the same `/brand/aarhus-havn-monogram.png` path with PNG/32×32 metadata. A local HTTP GET returned 200, `image/png`, 516 bytes, with the same SHA256 as the official source. This verifies the selected asset and placements, not whole-interface design-manual compliance; earlier visual evidence below predates this replacement. No deployment was made.
- Final rebuilt-preview checks repeated light/dark list contrast and 390px mobile normal/compact; no failing rendered text pairs or production-runtime errors were observed. The browser log retained one development-only CSS hot-reload error from editing PortMap on 4326; navigation/reload recovered it, and it did not recur on the rebuilt 4327 preview. Temporary viewport overrides and test pins were cleared.
- Visual evidence consists of local screenshots that are intentionally not included in this source package. They show actual local UI states, not design-manual approval or hosted acceptance.

## Row scanning and note signals — local revision, 5 September 2026

This revision is implemented and checked in the local production-mode preview at `http://localhost:4327/watchlist`. It has **not been deployed**. The hosted operational-parity release below remains unchanged.

- Restored alternating backgrounds across table and mobile swipe rows, in both themes and densities. The visible call index drives the stripe; hidden/expanded OPS rows do not break the sequence. Sticky vessel cells share the row background.
- Filled note controls are green; empty controls show a neutral zero. Icon, count and accessible vessel-specific labels accompany the colour. Compact mobile includes a 22px-high note indicator in its existing next-task line, with the 44px note action in More.
- `npm.cmd run verify` passed: zero lint warnings, TypeScript, **167 tests / 15 files**, production build. Seven new tests cover empty/whitespace/content counts, shared note controls/indicators, table stripes after reversed/filtered call order and inserted OPS rows, and mobile summary/tray coverage. A subsequent icon-specificity adjustment was production-built successfully.
- Browser checks on the production-mode local preview: 320/390px mobile and 1920px desktop; 1440px desktop was also inspected on the development server. Light/dark, Normal/Compact, Fuld/Kontor/Havn, notes sorting, text filtering and Nordic's two inline OPS were exercised. No page-level horizontal overflow at the inspected widths.
- Actual computed row backgrounds: dark `#111e2b` / `#1a2b3c`; light `#ffffff` / `#e7e8df`. Each table cell, including the sticky vessel anchor, matched its row. Keyboard focus used the distinct row highlight.
- Filled-note text contrast measured **8.20:1 dark** (`#0a3055` on `#a1d5c6`) and **8.39:1 light** (`#ffffff` on `#005758`). Dark keyboard focus used a contrasting navy inset outline; mouse hover retained a green fill (`#b5e2d4`) and navy text. These are checks of the changed signals, not an exhaustive whole-application accessibility certification.
- On 320px mobile, compact rows measured approximately **120px** and the note indicator **22px**; the indicator fits within the existing 24px next-task line. Normal 390px rows measured approximately **164px**. Table density remained approximately **51–53px compact** versus **88–92px normal** in the inspected desktop presets.
- Saved one explicitly labelled local UI-test note under the separate `127.0.0.1:4327` origin. Whitespace-only save stayed disabled; saving content changed Meridian from neutral 0 to green 1, immediately reflected in the list and retained after reload. The localhost preview was not populated with that test note; there was no external notes write.
- No new browser error logs during these checks. Viewport emulation is not physical phone/Safari/assistive-technology verification. The broader map, registration and access-control evidence below belongs to the prior revision unless explicitly repeated here.

## Operational parity revision — 5 September 2026

The first V3 release below is historical evidence, not acceptance of the revised workflow. User feedback required restoring independent fields/OPS, a genuinely denser layout, mobile table choice/swipe and interactive quays.

### Current implementation and local evidence

- `npm.cmd run verify`: ESLint, TypeScript, **160 tests / 14 files**, and production build passed after the functional changes.
- All **21 column headers** were activated in the browser and produced the corresponding sort key/direction. IMO keyboard sorting was separately checked as ascending → descending → default next-task order. The sort selector exposes the same 21 fields.
- New tests cover complete field/preset parity, storage migration, displayed primary arrival times rather than live ETA, projected quay sorting without mutating records, mobile swipe direction/axis locking, complete optional OPS, and current/upcoming quay assignments with correct time precedence.
- At **1920 × 1080**, Havn compact showed **13 complete rows** at approximately **51px**; Normal showed **6** at approximately **92px**. Its table filled the available **1754px** region.
- At **390px**, mobile rows measured **118px compact / 162px normal**. Compact phone mode also removes summary tiles. At **320px**, compact rows remained 118px with bounded quay/time tracks and no outer overflow.
- Mobile table selection survives reload. Fuld contains 21 independent columns on mobile, with **52px compact rows**, a sticky vessel anchor and internal horizontal scrolling.
- Full, Kontor and Havn all retain independent OPS. Nordic Kestrel's two shifts were opened in both compact table and phone OPS: **10:06 / ordered / quay306 / 20–28 / SB**, **11:56 / expected / quay304 / 28–36 / BB**.
- Actual browser pointer gestures (CDP pen pointer, not synthetic DOM event dispatch): rightward opens the inline tray, leftward closes it, vertical movement does not open it. The explicit More control reaches the same actions. Touch-origin gestures use the same handler but have not been tested on a physical phone.
- Registration required an explicit confirmation. Meridian's next task changed after a local registration; Undo restored it. No operation is written merely by swiping.
- Quay110 selection stayed on the map; switching directly to202 showed its two upcoming calls. Selecting empty128 showed a real empty inspector without replacing the map. Clear restored the unfiltered map.
- Quay406 was activated directly on-map with Space, retaining focus/selection and showing one current plus one upcoming call. Enter received an explicit keydown handler after the browser test found reliance on Leaflet keypress insufficient.
- The quay picker is globally number-sorted, includes terminal names, and does not conflate ordered time with live ETA. Arctic at quay406 showed **08:09 ordered** plus **07:58 live ETA**. Dedicated regression tests cover Meridian09:03/09:04 and future-shift assignment times.
- Current-revision widths inspected: **320,390,768,1440,1920**; outer page stayed within the viewport. Light320px map, light/dark phone rows/OPS and desktop table reviewed. Space Grotesk verified in computed styles.
- Production-mode localhost4327 smoke check: no browser errors, phone row/table toggle, 21 columns,52px compact table rows, map and quay selection worked.

### Current release status

Application revision **bc131f8** (functional parity from094d2a8 plus the map lifecycle fix) is deployed at https://aarhus-havn-watchlist-v3.vercel.app/watchlist. Deployment **dpl_69KfuiQhXp1umV5gsB5HycbsWYuv** reported READY and was aliased to the public V3 address. The independent Vercel project remains `prj_6deqhp01HQqKqTIDmYXwA9v0gtGr`; V2 and portfolio are not modified or deployed by this revision.

Hosted checks repeated after deployment:

- `/watchlist` HTTP200 with private/no-store caching; anonymous API76 calls,0 restricted.
- 390px mobile:21 sort options, all21 Fuld columns,52px compact table rows, saved table/density restored on reload.
- Live OPS: Nordic's two shifts show their distinct times, states, quays, bollards and sides.
- Live rightward pen-pointer swipe opens Nordic's inline action tray; Escape closes OPS.
- Live map Enter activation on quay406 selects/zooms while retaining map view, with1 current and1 upcoming call. Ordered08:09 and live07:58 remain separately labelled.
- Live quay110 shows ordered09:03 plus live09:04; empty128 keeps the map and provides clear-filter recovery.
- 1440px live table has no page overflow and supports independent Bredde descending sort. Light/dark rendering checked.
- Final error-log review found a Leaflet CSS zoom completion timer firing after a rapid map→list unmount. Follow-up disables asynchronous CSS zoom and stops pan before disposal. Four rapid quay110/202 zoom→list cycles passed locally and again on the final public deployment, with **zero new browser errors**. Final HTTP200/private-no-store check passed. Handoff: Danish,dark,Kontor,compact,swipe mode,current shift,cleared filters; temporary viewport override removed.

This report's hosted-verification update is documentation-only and follows the application deployment.

### Evidence limits

Viewport emulation and pen-pointer dispatch do not establish physical iPhone/Safari/touch/VoiceOver compatibility. This remains a fictional-scenario prototype: local notes/registrations are not FlexPort/D365 writes, and workspace selection is not employee authentication. Old viewport and authentication checks below are prior-release evidence unless explicitly repeated above.

---

## Initial release evidence (historical)

## Local route/performance continuation — 5 September 2026

This dated entry concerns the current local working tree and preview on port 4327 (execution session 84472), not the historical deployment recorded below. No deployment was performed for this continuation.

- Final `npm.cmd run verify`: PASS — zero-warning lint, TypeScript, 190 tests across 18 files and production build. New tests cover route validity/gaps/degenerate points, SVG icon scope, DA/EN Copenhagen summer/winter date rollover and invalid dates.
- Controller browser QA at 390px dark and 320px light: route status bar is outside the map with no overlap/overflow; Leaflet SVG computed dimensions match its declared dimensions; route paths are visible inside the map. Quay 110 preserves whole-route fit; empty quay 128 produces zero route paths, empty-state text and no route-fit button. Selecting Saffron updates route and vessel name.
- Lazy detail opening, Escape and focus return passed. Zoom inside one quay-label threshold retained the same marker DOM node (52 before/after); this does not claim reuse across every selection or threshold transition. Browser errors: zero.
- Final Lighthouse 12.8.2 mobile scores 91/92/94, median92 versus baseline83; LCP median2604.64105ms versus2943.372325ms; TBT median261.5ms versus446ms (approximately41% lower). Final desktop performance100, LCP603.0063ms, TBT0; all final CLS0, accessibility100 and best practices100. SEO63 reflects preserved deliberate noindex. These are local synthetic measurements, not field evidence or full accessibility certification.
- V2 WatchlistPrototype CSS is absent from initial server HTML after shared-helper extraction. Next still merges Leaflet/CallDetail CSS into an initially linked chunk; their stylesheet network loading is not claimed to be on demand. JavaScript lazy loading is separate. Detailed measurements, limitations and raw filenames: `docs/V3_PERFORMANCE.md`.
- Remaining accessibility follow-up: final raw audits still fail the non-score-weighted `label-content-name-mismatch` check on mobile and desktop. Visible button wording and aria-labels need reconciliation; A100 does not mean full accessibility. There were no Lighthouse runWarnings, and noindex meta was confirmed as the SEO flag.

## Automated checks

- `npm.cmd run verify`: PASS. ESLint (zero warnings), TypeScript, 134 tests across 9 files, and Next.js production build.
- `npm.cmd audit --omit=dev`: zero known production dependency vulnerabilities at the time checked.
- Added placement tests cover current, upcoming, post-shift and historical/final berths, including delayed call-status updates. Historical berths are not active filters.
- Added local-state tests cover public/restricted/public transitions, unknown/revoked identifiers, validated notes, arrival/departure and service-order override keys, and malformed stored data.
- Hydration, projection, persistence and snapshot acceptance use the public-state sanitizer. Restricted contexts additionally disable storage entirely.

## Browser verification

Checked in the Codex Chromium browser using the production-mode build on port 4327, with additional note/registration checks in the development build on port 4326.

- Phone widths 320, 390 and 402 CSS pixels; tablet widths 768 and 834; landscape 874 x 402; desktop widths 1024, 1440 and 1920. The outer page remained within its viewport after the 320px minimum-width and mobile tooltip fixes. Wide tables scroll inside their own region.
- Dark and light list/card views, sidebar and mobile navigation; official wordmark and Space Grotesk loading confirmed from rendered UI/computed styles.
- Sidebar collapse increases the 1440px viewport's main area from approximately 1337px to 1425px (scrollbar excluded), then restores it.
- Fuld/Kontor/Havn retain their segmented control and expose role-specific mobile details.
- Search, clearing search through summary controls, quay 304 filtering (one active matching call), reset, manual refresh and empty-state recovery.
- Column selection and reordering: enabling Dimensions and moving Arrival before Quay changed the rendered table order correctly.
- Workspace selector: native radio selection, submitting Havnevagt, and preserving English/light preferences into the resulting workspace.
- Settings: Danish/English and light/dark changes, density controls, keyboard interaction and dismissible native dialogs.
- Mobile map: tiles and vessel markers load; Traffic/Quays layer switching works; selected-call facts and list remain accessible. Map mode removes list-only heading/metrics to preserve map area.
- Mobile detail: call, timeline, vessel and note tabs; planned versus live ETA labels; local note text retained unchanged; explicit registration confirmation; successful registration closes the dialog and exposes Undo; Undo restores the prior state.
- Mobile bottom navigation also exercised using actual mouse-pointer dispatch, not just programmatic keyboard activation.

## Contrast and styling

Measured rendered foreground/background pairs, with the standard relative-luminance contrast calculation. Representative final pairs: navy on ordered blue 9.53:1, navy on expected yellow 9.64:1, navy on actual coral 5.95:1, muted light text on raised light surface 5.01:1, muted dark text on raised dark surface 7.30:1. The light rail's former muted-text/sand pair measured 4.46:1 and was replaced with the darker navy shade `#203f5d`.

Active V3 components contain no gradients, decorative edge stripes or prototype disclaimer banners. Berths use neutral styling, separate from expected yellow. Focus outlines and reduced-motion rules are theme aware.

## Release boundary

The separate Vercel project is `aarhus-havn-watchlist-v3`; its project identifier differs from V2. The V2 repository and its pending sidebar fix are not part of this release.

Production: https://aarhus-havn-watchlist-v3.vercel.app/watchlist

Deployed application revision: `594eafb`. Deployment `dpl_H55qExR2oahcQz69Bwwvc9zyQ1UT` reported READY, then passed the hosted checks below. The first deployment exposed a hosting configuration problem (framework preset Other, resulting in 404); explicit Next.js project/configuration settings corrected it. This is why build success alone was not treated as acceptance. See [Vercel's framework configuration reference](https://vercel.com/docs/builds/configure-a-build).

### Hosted acceptance checks

- `/watchlist`, `/login` and `/api/watchlist`: HTTP 200. Dynamic responses carry private/no-store caching; `X-Frame-Options: DENY` is present.
- Anonymous API response: 76 calls, zero protected records.
- Live browser: correct Space Grotesk, dark/light themes, list/cards, detail and timeline, Leaflet tiles/markers and selected-call facts. Browser error log empty at the check.
- Live viewport measurements: 320, 390, 402, 768, 834, 874, 1440 and 1920 CSS pixels; no outer-page horizontal overflow. The 874px view was landscape (402px tall).
- Live workspace selection: protected workspace shows 80 calls; searching its restricted records yields four; the Fjord Sentinel note panel is read-only and has no registration action. Returned to public workspace and confirmed 76 calls again.
- Live departed filter: three calls, no active quay-filter buttons; final quay numbers render at 16px desktop / 17px phone size.
- Final handoff state: public workspace, Danish, dark theme, current shift, no search/status/berth filter, normal density, Kontor preset.

README and this QA report were updated locally after the application release. They do not change the deployed runtime.

## Limits of the evidence

Viewport emulation is not physical iPhone 17/17e, mobile Safari or VoiceOver testing. Touch swipe direction has automated domain coverage; actual touch-event injection was unavailable in this browser tool. Safe-area and reduced-motion support are implemented but have not been validated on physical hardware. Offline/error handling has source/domain review; no claim of a complete network-failure or assistive-technology certification is made.

This is a finished-design prototype using the documented fictional scenario. Workspace selection is not employee authentication. Notes and registrations are local; no real FlexPort/D365 delivery, document download or live AIS integration is claimed. See README.md for those implementation boundaries.
