# Local performance evidence — 5 September 2026

Lighthouse 12.8.2, headless Chrome, local production preview on port 4327. These are synthetic local measurements, not field data or production traffic. Three mobile runs are summarized by their median; ordinary run-to-run noise must not be presented as a reliable improvement.

| Stage | Mobile performance | LCP median | TBT median | Accessibility |
| --- | --- | --- | --- | --- |
| Baseline | 84 / 83 / 83; median 83 | 2943 ms | 446 ms | 96 |
| Route fix and initial lazy loading | 87 / 83 / 84; median 84 | 2864 ms | 456 ms | 100 |
| CSS-free lifecycle helpers and reused formatters | 91 / 92 / 94; median 92 | 2604.64105 ms | 261.5 ms | 100 |

Baseline desktop: performance 100, LCP 623 ms, TBT 18 ms, accessibility 100. After initial changes desktop performance remains 100. Baseline CLS was 0. SEO 63 reflects deliberate noindex; noindex is preserved. The first change set does not establish a meaningful mobile speed improvement: TBT is slightly worse and the scores overlap.

## Targeted second change set

- Pure lifecycle data/label helpers moved to `components/watchlist/lifecycleData.ts`. The V2 JSX module imports/re-exports the same implementation for compatibility; V3 imports the CSS-free module directly. No duplicate business logic. Root's preceding audit identified 27,946 unused bytes in a V2 stylesheet pulled through the old helper import.
- A fixed small set of Intl.DateTimeFormat instances now serves date/time cells, with identical Copenhagen timezone and formatting options. Tests cover DA/EN, summer/winter date rollover and invalid inputs.
- No responsive DOM rewrite or broad map-layer recreation refactor. Initial baseline had 3,488 DOM elements; that remains a separate possible cost, not a proven cause resolved here.

## Final measurements and browser verification

Final mobile LCP runs: 2684.0753 / 2604.64105 / 2047.188075 ms; TBT: 262.5 / 249 / 261.5 ms. Against the precise baseline LCP median 2943.372325 ms and TBT median 446 ms, the final medians are approximately 11.5% and 41.4% lower respectively. This is a local synthetic comparison, not a field-performance or causal attribution claim for either individual change.

Final desktop: performance 100, LCP 603.0063 ms, TBT 0 ms, CLS 0. Final accessibility and best practices are 100 in all runs; mobile CLS is also 0 in every run. SEO remains 63 with deliberate noindex preserved.

Accessibility follow-up remains: `label-content-name-mismatch` fails as a non-score-weighted audit on mobile and desktop. Visible button text and aria-label wording must be reconciled in a later scoped change. A100 is therefore not a claim of complete accessibility. No runWarnings were reported; the noindex meta was confirmed as the SEO flag.

The server HTML no longer loads WatchlistPrototype CSS. However, Next's CSS chunk merging still includes Leaflet and CallDetail classes in a stylesheet linked by initial server HTML (observed chunk `2rqovi7sft_a7.css`, 77,240 decoded characters). Moving the imports did NOT establish on-demand network loading of those stylesheets. JavaScript lazy loading is separate and remains implemented.

Controller browser checks: 390px dark and 320px light; route bar outside map; Leaflet declared/computed SVG dimensions match; route inside map; quay 110 retains route fit; empty quay 128 shows zero route paths, empty text and no route-fit button; selecting Saffron changes route/name; lazy detail opens and Escape restores focus; no browser errors. Zoom within the same quay-label threshold retained marker DOM identity (node 52 before/after). This does not claim reuse across all selections or threshold changes.

Raw audits are preserved in the task's `v3-design-handoff/performance/` folder: `final-mobile-1.json`, `final-mobile-2.json`, `final-mobile-3.json`, `final-desktop.json`, alongside baseline and intermediate results. Current local preview session is 84472; no deployment was performed for this change set.
