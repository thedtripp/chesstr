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

- Port to a mobile app (possibly using React Native)
