# chesstr
Chess opnenings trainer app

Fully static: no backend, no build step to run it. Open `index.html`
directly or serve the repo root with any static file server, e.g.
`python3 -m http.server`.

Opening data lives in `openings/*.pgn` (one file per opening, PGN
variations = branches) -- this is the small, hand-curated set actually
loaded into the trainer. It's compiled into `static/openings.json`, which
the frontend fetches and walks entirely client-side. After editing any
file in `openings/`, regenerate it with:

```sh
pip install -r tools/requirements.txt
python3 tools/build_openings_json.py
```

Separately, `static/opening-catalog.json` is the *full* set of 149 named
opening families sourced fresh from lichess-org/chess-openings (CC0) --
not currently loaded by the trainer, meant for a future "choose your
openings" UI to read from. Includes real popularity data (total games
played, from Lichess's own database via their Opening Explorer API).
Regenerate it with:

```sh
python3 tools/build_opening_catalog.py
LICHESS_TOKEN=... python3 tools/fetch_opening_popularity.py
```

`fetch_opening_popularity.py` needs a personal API token (generate one
free at lichess.org/account/oauth/token, no scopes needed) passed as an
env var -- never commit it. A handful of very sparse families (1-3 rows
in the source dataset) don't have enough data to computationally
distinguish a family-specific position, so they legitimately share a
popularity number with an unrelated opening that reduces to the same
generic early position; not a bug, just a data-sparsity limit worth
knowing about if that number looks surprising.

## Testing

Unit tests cover the pure logic modules -- curriculum progression, spaced-
repetition scheduling, and the popularity-fetching tool's tree-walking
algorithm -- since that's where a silent regression is easiest to ship and
hardest to eyeball. A Playwright smoke test drives the real app in a real
browser to check the golden path end to end.

```sh
# JS unit tests (static/curriculum.js, static/stats.js, static/selection.js)
node --test

# Python unit tests (tools/build_opening_catalog.py, tools/fetch_opening_popularity.py)
python3 -m unittest discover -s tools/tests -p 'test_*.py'

# End-to-end smoke test (loads the real app in headless Chromium, plays a
# real book move, attempts an off-book one). Needs `npm install` once first.
npm install
node e2e/smoke.mjs
```

## TODO

- Tag one child at each branch as `mainline: true` in the tree data
  (the plainest-named entry -- no `: Sub-variation` suffix, or the
  fewest of them -- since that's how the source data itself signals
  "this is the parent line"). The depth-mastery tracker above follows
  only the mainline path for progression; every branch stays exactly as
  playable/correct as today, mainline or not -- this is about what
  counts toward advancing, not about narrowing valid answers. As
  breadth/depth expand under the adaptive curriculum, subvariations
  come into play same as they always have (via Hint / Guided mode), they
  just don't gate unlocking on their own.
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
