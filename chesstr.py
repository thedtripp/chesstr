from flask import Flask, render_template, request

import openings

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/openings")
def api_list_openings():
    return openings.list_openings()


@app.route("/api/openings/<opening_id>/node")
def api_get_node(opening_id):
    path = request.args.get("path", "")
    node = openings.get_node(opening_id, path)
    if node is None:
        return {"error": "not found"}, 404
    return openings.node_to_dict(opening_id, node, path)


@app.route("/api/openings/<opening_id>/hint")
def api_get_hint(opening_id):
    path = request.args.get("path", "")
    sans = openings.hint_sans(opening_id, path)
    if sans is None:
        return {"error": "not found"}, 404
    return {"moves": sans}


@app.route("/api/openings/<opening_id>/move", methods=["POST"])
def api_check_move(opening_id):
    body = request.get_json(force=True, silent=True) or {}
    path = body.get("path", "")
    uci = body.get("uci", "")

    child, next_path = openings.check_move(opening_id, path, uci)
    if child is None:
        return {"correct": False}

    return {
        "correct": True,
        **openings.node_to_dict(opening_id, child, next_path),
    }


@app.route("/api/openings/<opening_id>/auto", methods=["POST"])
def api_auto_move(opening_id):
    body = request.get_json(force=True, silent=True) or {}
    path = body.get("path", "")

    child, next_path = openings.auto_move(opening_id, path)
    if child is None:
        return {"error": "no moves available"}, 400

    return openings.node_to_dict(opening_id, child, next_path)


if __name__ == "__main__":
    Flask.run(app, debug=True)
