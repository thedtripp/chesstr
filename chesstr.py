import chess
from flask import Flask
from flask import render_template


app = Flask(__name__)

challenges=[
    {
        'id': '1',
        'opening': 'Grand-Prix Attack',
        'position': 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR',
        'fen': 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        'last' : 'c5',
        'answer': 'Nc3',
        'result': 'rnbqkbnr/pp1ppppp/8/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR'
    },
]

@app.route("/")
def demo():
    return render_template('home.html', challenge=challenges[0])

@app.route("/test")
def test():
    return render_template('test.html')

if __name__ == "__main__":
    Flask.run(app, debug=True)