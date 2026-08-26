# chesstr
Chess opnenings trainer app

Fully static: no backend, no build step to run it. Open `index.html`
directly or serve the repo root with any static file server, e.g.
`python3 -m http.server`.

Opening data lives in `openings/*.pgn` (one file per opening, PGN
variations = branches). It's compiled into `static/openings.json`, which
the frontend fetches and walks entirely client-side. After editing any
file in `openings/`, regenerate it with:

```sh
pip install -r tools/requirements.txt
python3 tools/build_openings_json.py
```

## TODO

- Adaptive curriculum: start the learner on one opening at a shallow
  depth cap (~3-4 plies) and expand both breadth (more openings) and
  depth (deeper into each one) as mastery is demonstrated. Track, per
  user in `localStorage`: which openings are unlocked, and a depth cap
  per active opening. Reuse the existing `atBookEnd`/`is_leaf` check in
  `boardConfig()` so the depth cap just acts like an artificial leaf --
  hitting it early triggers the same "Line complete!" state, no new UI
  concept needed. Layer a rolling "clean playthrough" streak on top of
  the existing per-position mistake tracker in `stats.js` (any miss
  resets it; N clean run-throughs at the current cap bumps the cap and
  resets the streak); once an opening's cap reaches its real max depth,
  unlock the next opening in a fixed curriculum order.
- Tag one child at each branch as `mainline: true` in the tree data
  (the plainest-named entry -- no `: Sub-variation` suffix, or the
  fewest of them -- since that's how the source data itself signals
  "this is the parent line"). The depth-mastery tracker above follows
  only the mainline path for progression; every branch stays exactly as
  playable/correct as today, mainline or not -- this is about what
  counts toward advancing, not about narrowing valid answers. As
  breadth/depth expand under the adaptive curriculum, subvariations
  come into play same as they always have (via Hint / New line /
  Guided mode), they just don't gate unlocking on their own.
- Show the specific opening + variation name for the *current position*
  as you play, the way Lichess's opening explorer does (e.g. "Sicilian
  Defense" narrowing to "Sicilian Defense: Najdorf Variation, English
  Attack" as moves are played) -- not just the static per-file title
  shown today. For openings sourced from lichess-org/chess-openings,
  each source row already carries the exact name for the position its
  move sequence reaches; that just needs preserving through
  `tools/build_openings_json.py` into the tree JSON instead of being
  discarded at merge time. Hand-curated openings (Vienna Gambit, from
  Gotham Chess's video) have no such per-line names in the source and
  would need them backfilled manually.
- Let users import their own repertoire instead of hand-editing files in
  `openings/`. PGN with recursive variations (nested `( ... )`) is the
  format to target -- it's what a Lichess Study export gives you, and
  it's already what `openings/*.pgn` uses and what
  `tools/build_openings_json.py` parses. The missing piece is getting a
  user-supplied PGN into that pipeline: either an in-browser upload with
  a JS PGN parser, or keeping it a local build step like today but
  pointed at a user's own file. Also worth supporting a folder of
  separate single-line PGN games (e.g. a ChessBase-style export),
  merged into one tree by shared move prefix -- same approach used to
  build the current curated openings from lichess-org/chess-openings.
- Port to a mobile app (possibly using React Native)
