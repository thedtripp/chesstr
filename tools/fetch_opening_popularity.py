#!/usr/bin/env python3
"""Enrich static/opening-catalog.json with real popularity data (total games
played, from Lichess's own database) via the Lichess Opening Explorer API.

Requires a LICHESS_TOKEN env var -- generate a personal API token at
lichess.org/account/oauth/token (no scopes needed) and export it locally.
Never commit the token; this script only reads it from the environment.

Run tools/build_opening_catalog.py first to (re)build the base catalog.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

CATALOG_PATH = os.path.join(os.path.dirname(__file__), "..", "static", "opening-catalog.json")
EXPLORER_URL = "https://explorer.lichess.ovh/lichess"
REQUEST_DELAY_SECONDS = 1.5
MAX_RETRIES = 5


DOMINANCE_THRESHOLD = 0.8


def leaf_count(node):
    if not node["children"]:
        return 1
    return sum(leaf_count(c) for c in node["children"])


def defining_path(tree):
    """Walk from the tree root toward the family's defining position: the
    point where real opening theory first branches into meaningfully
    distinct choices. A handful of family names (e.g. "Queen's Gambit
    Declined") bundle in a couple of rows that transpose from a different
    first move -- 80%+ of that family's rows still share the real first
    move, with a few stray rows making the root technically "branch" a
    move early. Rather than stopping there, keep walking through any
    branch that holds >=80% of the leaf weight below it (clearly the real
    line, not a meaningful split) and only stop at a branch point where
    multiple children hold a comparable share -- that's real theory
    diverging, e.g. the Sicilian's ~74/10/4% split over which system White
    chooses.

    The one exception is the very first ply: a family with a genuine,
    even split right at the root (no version of "the real first move")
    still needs *a* position to measure popularity at, since stopping
    there means querying the bare starting position -- i.e. every game
    ever played, useless as a popularity signal for a specific opening.
    So the first step always takes the single most common move even
    without a clear majority; the dominance check only governs every
    step after that.
    """
    ucis = []
    node = tree
    while node["children"]:
        weighted = sorted(((leaf_count(c), c) for c in node["children"]), key=lambda x: -x[0])
        total = sum(w for w, _ in weighted)
        top_weight, top_child = weighted[0]
        dominant = len(weighted) == 1 or top_weight / total >= DOMINANCE_THRESHOLD
        if not dominant and ucis:
            break
        node = top_child
        ucis.append(node["uci"])
    return ucis


def fetch_games(token, ucis):
    params = {"variant": "standard"}
    if ucis:
        params["play"] = ",".join(ucis)
    url = EXPLORER_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})

    for attempt in range(MAX_RETRIES):
        try:
            with urllib.request.urlopen(req) as response:
                data = json.load(response)
            return data.get("white", 0) + data.get("draws", 0) + data.get("black", 0)
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < MAX_RETRIES - 1:
                wait = float(e.headers.get("Retry-After", 2 ** (attempt + 1)))
                time.sleep(wait)
                continue
            raise


def main():
    token = os.environ.get("LICHESS_TOKEN")
    if not token:
        print("Set LICHESS_TOKEN first (see this script's docstring).", file=sys.stderr)
        sys.exit(1)

    with open(CATALOG_PATH) as f:
        catalog = json.load(f)

    # Idempotent: skip anything already fetched (including a prior bad
    # reading from before the dominance-threshold fix, so a retry after
    # edits corrects those too).
    todo = [o for o in catalog if "popularity" not in o or o.get("popularityNeedsRefetch")]

    for i, opening in enumerate(todo):
        path = defining_path(opening["tree"])
        try:
            games = fetch_games(token, path)
        except urllib.error.HTTPError as e:
            print(f"  [{i+1}/{len(todo)}] {opening['name']}: HTTP {e.code}, skipping", file=sys.stderr)
            continue
        opening["popularity"] = games
        opening.pop("popularityNeedsRefetch", None)
        print(f"  [{i+1}/{len(todo)}] {opening['name']}: {games:,} games")
        time.sleep(REQUEST_DELAY_SECONDS)

        if i % 10 == 0:
            with open(CATALOG_PATH, "w") as f:
                json.dump(catalog, f, separators=(",", ":"))

    with open(CATALOG_PATH, "w") as f:
        json.dump(catalog, f, separators=(",", ":"))

    have = sum(1 for o in catalog if "popularity" in o)
    print(f"Wrote popularity for {have}/{len(catalog)} openings to {CATALOG_PATH}")


if __name__ == "__main__":
    main()
