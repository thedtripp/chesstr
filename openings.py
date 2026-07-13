import glob
import os
import random

import chess
import chess.pgn

OPENINGS_DIR = "openings"

_GAMES = {}


def _load():
    _GAMES.clear()
    for path in sorted(glob.glob(os.path.join(OPENINGS_DIR, "*.pgn"))):
        with open(path) as pgn:
            game = chess.pgn.read_game(pgn)
        opening_id = os.path.splitext(os.path.basename(path))[0]
        _GAMES[opening_id] = game


_load()


def list_openings():
    return [
        {"id": opening_id, "name": game.headers.get("Event", opening_id)}
        for opening_id, game in _GAMES.items()
    ]


def _parse_path(path):
    if not path:
        return []
    return [int(i) for i in path.split(",")]


def _path_str(indices):
    return ",".join(str(i) for i in indices)


def get_node(opening_id, path):
    game = _GAMES.get(opening_id)
    if game is None:
        return None
    node = game
    try:
        for i in _parse_path(path):
            node = node.variations[i]
    except (IndexError, ValueError):
        return None
    return node


def node_to_dict(opening_id, node, path):
    return {
        "opening_id": opening_id,
        "path": path,
        "fen": node.board().fen(),
        "turn": "w" if node.board().turn == chess.WHITE else "b",
        "is_root": node.parent is None,
        "is_leaf": not node.variations,
        "last_move": node.san() if node.parent is not None else None,
    }


def hint_sans(opening_id, path):
    node = get_node(opening_id, path)
    if node is None:
        return None
    return [child.san() for child in node.variations]


def auto_move(opening_id, path):
    node = get_node(opening_id, path)
    if node is None or not node.variations:
        return None, None
    indices = _parse_path(path)
    i = random.randrange(len(node.variations))
    child = node.variations[i]
    return child, _path_str(indices + [i])


def check_move(opening_id, path, uci):
    node = get_node(opening_id, path)
    if node is None:
        return None, None
    try:
        move = chess.Move.from_uci(uci)
    except ValueError:
        return None, None
    indices = _parse_path(path)
    for i, child in enumerate(node.variations):
        if child.move == move:
            return child, _path_str(indices + [i])
    return None, None
