import chess
from flask import Flask
from flask import render_template


app = Flask(__name__)

challenges=[
    {
        'id': '1',
        'opening': 'Grand-Prix Attack',
        'position': 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        'moves': ['Nc3', 'e4', 'd4', 'f4', 'Nf3'],
        'answer': 'Nc3'
    },
    {
        'id': '2',
        'opening': 'Grand-Prix Attack',
        'position': 'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3',
        'moves': ['Nc3', 'e4', 'd4', 'f4', 'Nf3'],
        'answer' : 'f4'
    }
]

for challenge in challenges:
    board = chess.Board(challenge['position'])
    legal_moves =  board.legal_moves
    challenge['moves'] = [board.san(move) for move in legal_moves]

@app.route("/")
def hello_world():
    return "<p>Hello, Chesstr!</p>"

@app.route("/test")
def test():
    return render_template('home.html', data=challenges)

if __name__ == "__main__":
    Flask.run(app, debug=True)