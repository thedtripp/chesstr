import chess
from flask import Flask
from flask import render_template


app = Flask(__name__)

challenges=[
    {
        'id': '1',
        'opening': 'Grand-Prix Attack',
        'position': 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR',
        'last' : 'c5',
        'answer': 'Nc3',
        'result': 'rnbqkbnr/pp1ppppp/8/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR'
    },
    {
        'id': '2',
        'opening': 'Grand-Prix Attack',
        'position': 'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR',
        'last' : 'Nc6',
        'answer' : 'f4',
        'result': 'r1bqkbnr/pp1ppppp/2n5/2p5/4PP2/2N5/PPPP2PP/R1BQKBNR'
    }
]

@app.route("/")
def demo():
    return render_template('home.html', data=challenges)

@app.route("/test")
def test():
    return render_template('test.html')

if __name__ == "__main__":
    Flask.run(app, debug=True)