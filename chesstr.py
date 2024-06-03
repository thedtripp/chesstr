import chess
from flask import Flask
from flask import render_template

app = Flask(__name__)

challenges = [
        {
            'id': '0',
            'next': '1',
            'opening': 'Grand-Prix Attack',
            'position': 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
            'fen': 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'last' : '',
            'answer': 'e4',
            'result': 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR'
        },
        {
            'id': '1',
            'next': '2',
            'opening': 'Grand-Prix Attack',
            'position': 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR',
            'fen': 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
            'last' : 'c5',
            'answer': 'Nc3',
            'result': 'rnbqkbnr/pp1ppppp/8/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR'
        },
        {
            'id': '2',
            'next': '3',
            'opening': 'Grand-Prix Attack',
            'position': 'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR',
            'fen': 'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3',
            'last' : 'Nc6',
            'answer': 'f4',
            'result': 'r1bqkbnr/pp1ppppp/2n5/2p5/4PP2/2N5/PPPP2PP/R1BQKBNR'
        },
        {
            'id': '3',
            'next': '4',
            'opening': 'Grand-Prix Attack',
            'position': 'r1bqkbnr/pp2pppp/2np4/2p5/4PP2/2N5/PPPP2PP/R1BQKBNR',
            'fen': 'r1bqkbnr/pp2pppp/2np4/2p5/4PP2/2N5/PPPP2PP/R1BQKBNR w KQkq - 0 4',
            'last' : 'd6',
            'answer': 'Bb5',
            'result': 'r1bqkbnr/pp2pppp/2np4/1Bp5/4PP2/2N5/PPPP2PP/R1BQK1NR'
        },
        {
            'id': '4',
            'next': '5',
            'opening': 'Grand-Prix Attack',
            'position': 'r2qkbnr/pp1bpppp/2np4/1Bp5/4PP2/2N5/PPPP2PP/R1BQK1NR',
            'fen': 'r2qkbnr/pp1bpppp/2np4/1Bp5/4PP2/2N5/PPPP2PP/R1BQK1NR w KQkq - 2 5',
            'last' : 'Bd7',
            'answer': 'Nc3',
            'result': 'r2qkbnr/pp1bpppp/2np4/1Bp5/4PP2/2NP4/PPP3PP/R1BQK1NR'
        },
        {
            'id': '5',
            'next': '6',
            'opening': 'Grand-Prix Attack',
            'position': 'r2qkbnr/pp1bpp1p/2np2p1/1Bp5/4PP2/2NP4/PPP3PP/R1BQK1NR',
            'fen': 'r2qkbnr/pp1bpp1p/2np2p1/1Bp5/4PP2/2NP4/PPP3PP/R1BQK1NR w KQkq - 0 6',
            'last' : 'g6',
            'answer': 'Nf3',
            'result': 'r2qkbnr/pp1bpp1p/2np2p1/1Bp5/4PP2/2NP1N2/PPP3PP/R1BQK2R'
        },
        {
            'id': '6',
            'next': '1',
            'opening': 'Grand-Prix Attack',
            'position': 'r2qk1nr/pp1bppbp/2np2p1/1Bp5/4PP2/2NP1N2/PPP3PP/R1BQK2R',
            'fen': 'r2qk1nr/pp1bppbp/2np2p1/1Bp5/4PP2/2NP1N2/PPP3PP/R1BQK2R w KQkq - 2 7',
            'last' : 'Bg7',
            'answer': 'O-O',
            'result': 'r2qk1nr/pp1bppbp/2np2p1/1Bp5/4PP2/2NP1N2/PPP3PP/R1BQ1RK1'
        },
]

@app.route("/")
def demo():
    return render_template('demo.html', challenge=challenges[1])

@app.route("/challenge/<id>")
def get_challenge(id):
    id = int(id)
    if id > len(challenges):
        id = 1
    return render_template('demo.html', challenge=challenges[id])

@app.route("/test")
def test():
    return render_template('test.html')

@app.route("/api")
def api_test():
    return challenges[0]

@app.route("/api/challenge/<id>")
def api_get_test(id):
    id = int(id)
    if id > len(challenges):
        id = 1
    return challenges[id]

if __name__ == "__main__":
    Flask.run(app, debug=True)