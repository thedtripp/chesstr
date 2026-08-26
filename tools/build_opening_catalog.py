#!/usr/bin/env python3
"""Build static/opening-catalog.json: the full browsable set of named
openings, sourced fresh from lichess-org/chess-openings (CC0). This is
separate from openings/*.pgn + static/openings.json, which represent the
smaller, hand-curated set actually loaded into the trainer -- the catalog
is what a future "choose your openings" UI reads from to let a user add
to that active set.

Rows sharing a name prefix before the first ":" (e.g. all "Sicilian
Defense: ..." lines) are merged into one branching tree per family, same
approach used to hand-build openings/vienna_gambit.pgn etc.
"""
import csv
import json
import os
import re
import urllib.request

import chess
import chess.pgn

SOURCE_URL = "https://raw.githubusercontent.com/lichess-org/chess-openings/master/{}.tsv"
VOLUMES = ["a", "b", "c", "d", "e"]
MOVE_NUM_RE = re.compile(r"^\d+\.+$")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "static", "opening-catalog.json")


def fetch_rows():
    rows = []
    for volume in VOLUMES:
        with urllib.request.urlopen(SOURCE_URL.format(volume)) as response:
            text = response.read().decode("utf-8")
        reader = csv.reader(text.splitlines(), delimiter="\t")
        next(reader)  # header
        for eco, name, moves in reader:
            rows.append((eco, name, moves))
    return rows


def family_of(name):
    return name.split(":")[0].strip()


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def node_to_dict(node):
    return {
        "children": [
            {"uci": child.move.uci(), "san": child.san(), **node_to_dict(child)}
            for child in node.variations
        ]
    }


def build_family_tree(entries):
    game = chess.pgn.Game()
    for eco, name, moves in entries:
        node = game
        board = game.board()
        tokens = [t for t in moves.split() if not MOVE_NUM_RE.match(t)]
        for san in tokens:
            move = board.parse_san(san)
            board.push(move)
            existing = next((v for v in node.variations if v.move == move), None)
            node = existing if existing is not None else node.add_variation(move)
    return node_to_dict(game)


def main():
    rows = fetch_rows()
    families = {}
    for eco, name, moves in rows:
        families.setdefault(family_of(name), []).append((eco, name, moves))

    catalog = []
    for family_name, entries in families.items():
        catalog.append(
            {
                "id": slugify(family_name),
                "name": family_name,
                "tree": build_family_tree(entries),
            }
        )
    catalog.sort(key=lambda o: o["name"])

    with open(OUTPUT_PATH, "w") as f:
        json.dump(catalog, f, separators=(",", ":"))

    print(f"Wrote {len(catalog)} families ({len(rows)} source rows) to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
