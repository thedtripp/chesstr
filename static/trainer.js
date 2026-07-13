import { Chess } from '/static/chess.js'

var board = null
var game = null
var currentOpeningId = null
var currentPath = ''
var userColor = 'w'

var $result = $('#result')
var $title = $('#opening-title')
var $select = $('#opening-select')
var $colorSelect = $('#color-select')

var AUTO_MOVE_DELAY = 600

function onDragStart(source, piece, position, orientation) {
    if (!game || game.isGameOver()) return false
    if (game.turn() !== userColor) return false

    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false
    }
}

function onDrop(source, target) {
    var beforeFen = game.fen()
    var move

    try {
        move = game.move({ from: source, to: target, promotion: 'q' })
    } catch (error) {
        return 'snapback'
    }

    var uci = move.from + move.to + (move.promotion || '')

    $.ajax({
        url: '/api/openings/' + currentOpeningId + '/move',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ path: currentPath, uci: uci }),
    }).done(function (data) {
        if (data.correct) {
            currentPath = data.path
            game = new Chess(data.fen)
            board.position(data.fen)
            maybeAutoPlay(data)
        } else {
            game = new Chess(beforeFen)
            board.position(beforeFen)
            $result.text('Not a book move here. Try again.')
        }
    })
}

function onSnapEnd() {
    board.position(game.fen())
}

// After any move lands on a node, either hand control back to the player
// or, if it's the computer's turn, play its book reply after a short pause.
function maybeAutoPlay(node) {
    if (node.is_leaf) {
        $result.text('Line complete! Nice work.')
        return
    }

    if (node.turn === userColor) {
        $result.text("What's the next move?")
        return
    }

    $result.text('Computer is thinking...')
    setTimeout(function () {
        $.ajax({
            url: '/api/openings/' + currentOpeningId + '/auto',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ path: node.path }),
        }).done(function (data) {
            currentPath = data.path
            game = new Chess(data.fen)
            board.position(data.fen)
            $result.text('Computer played: ' + data.last_move)
            setTimeout(function () {
                maybeAutoPlay(data)
            }, AUTO_MOVE_DELAY / 2)
        })
    }, AUTO_MOVE_DELAY)
}

function loadOpening(openingId) {
    $.getJSON('/api/openings/' + openingId + '/node', { path: '' }).done(function (data) {
        currentOpeningId = openingId
        currentPath = data.path
        game = new Chess(data.fen)
        $title.text($select.find(':selected').text())

        if (!board) {
            board = Chessboard('board', {
                draggable: true,
                position: data.fen,
                orientation: userColor === 'w' ? 'white' : 'black',
                onDragStart: onDragStart,
                onDrop: onDrop,
                onSnapEnd: onSnapEnd,
            })
        } else {
            board.orientation(userColor === 'w' ? 'white' : 'black')
            board.position(data.fen, false)
        }

        maybeAutoPlay(data)
    })
}

$('#restart').on('click', function () {
    if (currentOpeningId) loadOpening(currentOpeningId)
})

$select.on('change', function () {
    loadOpening($select.val())
})

$colorSelect.on('change', function () {
    userColor = $colorSelect.val()
    if (currentOpeningId) loadOpening(currentOpeningId)
})

$('#hint').on('click', function () {
    if (!currentOpeningId) return
    $.getJSON('/api/openings/' + currentOpeningId + '/hint', { path: currentPath }).done(function (data) {
        if (data.moves.length === 0) {
            $result.text("No more book moves — you've reached the end!")
        } else {
            $result.text('Hint: ' + data.moves.join(' or '))
        }
    })
})

$.getJSON('/api/openings').done(function (openings) {
    openings.forEach(function (opening) {
        $select.append($('<option>', { value: opening.id, text: opening.name }))
    })
    if (openings.length > 0) {
        loadOpening(openings[0].id)
    }
})
