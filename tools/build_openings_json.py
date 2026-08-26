#!/usr/bin/env python3
"""Compile openings/*.pgn into static/openings.json for the static frontend.

Run this after adding or editing any file in openings/. python-chess is only
needed at build time -- the deployed site is plain HTML/JS/JSON.
"""
import glob
import json
import os

import chess.pgn

OPENINGS_DIR = os.path.join(os.path.dirname(__file__), "..", "openings")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "static", "openings.json")


def node_to_tree(node):
    return {
        "children": [
            {
                "uci": child.move.uci(),
                "san": child.san(),
                **({"name": child.comment} if child.comment else {}),
                **node_to_tree(child),
            }
            for child in node.variations
        ]
    }


def main():
    openings = []
    for path in sorted(glob.glob(os.path.join(OPENINGS_DIR, "*.pgn"))):
        with open(path) as pgn:
            game = chess.pgn.read_game(pgn)
        opening_id = os.path.splitext(os.path.basename(path))[0]
        name = game.headers.get("Event", opening_id)
        openings.append({"id": opening_id, "name": name, "tree": node_to_tree(game)})

    with open(OUTPUT_PATH, "w") as f:
        json.dump(openings, f, separators=(",", ":"))

    print(f"Wrote {len(openings)} openings to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
