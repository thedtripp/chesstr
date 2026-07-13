import { Chess } from './chess.js'

var board = null
var game = null
var openingsData = []
var currentOpeningId = null
var currentTree = null
var currentPath = []
var userColor = 'w'
var selectedSquare = null

var $result = $('#result')
var $title = $('#opening-title')
var $select = $('#opening-select')
var $colorSelect = $('#color-select')

var AUTO_MOVE_DELAY = 600

function canSelect(piece) {
    if (!game || game.isGameOver() || game.turn() !== userColor) return false
    return piece && piece[0] === userColor
}

function getNodeAtPath(path) {
    var node = currentTree
    for (var i = 0; i < path.length; i++) {
        node = node.children[path[i]]
    }
    return node
}

// Shared by drag-and-drop and click-to-move: applies the move locally,
// then checks whether it matches a book move in the opening tree.
function submitMove(move, beforeFen) {
    var uci = move.from + move.to + (move.promotion || '')
    var node = getNodeAtPath(currentPath)
    var index = node.children.findIndex(function (child) {
        return child.uci === uci
    })

    if (index === -1) {
        game = new Chess(beforeFen)
        board.position(beforeFen)
        $result.text('Not a book move here. Try again.')
        return
    }

    var child = node.children[index]
    currentPath = currentPath.concat([index])
    maybeAutoPlay({
        path: currentPath,
        turn: game.turn(),
        is_leaf: child.children.length === 0,
        last_move: child.san,
    })
}

function attemptMove(source, target) {
    var beforeFen = game.fen()
    var move

    try {
        move = game.move({ from: source, to: target, promotion: 'q' })
    } catch (error) {
        return 'snapback'
    }

    board.position(game.fen())
    submitMove(move, beforeFen)
}

function clearSelection() {
    if (selectedSquare) {
        $('#board [data-square="' + selectedSquare + '"]').removeClass('selected-square')
    }
    selectedSquare = null
}

function selectSquare(square) {
    clearSelection()
    selectedSquare = square
    $('#board [data-square="' + square + '"]').addClass('selected-square')
}

// chessboard.js fires onDragStart on mousedown for ANY occupied square, even a
// plain click with no movement, but only if the square holds a piece — clicking
// an empty square never reaches here (see the click handler below for that case).
// That makes this the right place for reselecting, capturing, and deselecting
// via click, in addition to its usual job of allowing/denying a real drag.
function onDragStart(source, piece) {
    if (selectedSquare) {
        if (source === selectedSquare) {
            clearSelection()
            return false
        }

        if (!canSelect(piece)) {
            // occupied by an opponent piece: capture it with the selected piece
            var from = selectedSquare
            clearSelection()
            attemptMove(from, source)
            return false
        }
        // else: a different one of our own pieces — fall through and reselect it
    }

    clearSelection()
    if (canSelect(piece)) {
        selectSquare(source)
        return true
    }
    return false
}

function onDrop(source, target) {
    if (source === target) return // handled entirely by onDragStart above
    clearSelection()
    return attemptMove(source, target)
}

function onSnapEnd() {
    board.position(game.fen())
}

// Clicking an empty square while a piece is selected: chessboard.js has no hook
// for this (mousedownSquare ignores empty squares), so handle it directly.
$('#board').on('click', '[data-square]', function () {
    if (!game || !selectedSquare) return
    var square = $(this).attr('data-square')
    if ((board.position() || {})[square]) return // occupied squares go through onDragStart

    var from = selectedSquare
    clearSelection()
    attemptMove(from, square)
})

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
        var treeNode = getNodeAtPath(node.path)
        var index = Math.floor(Math.random() * treeNode.children.length)
        var child = treeNode.children[index]
        var uci = child.uci

        game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || undefined })
        currentPath = node.path.concat([index])
        board.position(game.fen())
        $result.text('Computer played: ' + child.san)

        setTimeout(function () {
            maybeAutoPlay({
                path: currentPath,
                turn: game.turn(),
                is_leaf: child.children.length === 0,
                last_move: child.san,
            })
        }, AUTO_MOVE_DELAY / 2)
    }, AUTO_MOVE_DELAY)
}

function loadOpening(openingId) {
    var opening = openingsData.find(function (o) {
        return o.id === openingId
    })
    if (!opening) return

    currentOpeningId = openingId
    currentTree = opening.tree
    currentPath = []
    game = new Chess()
    $title.text(opening.name)

    if (!board) {
        board = Chessboard('board', {
            draggable: true,
            position: game.fen(),
            orientation: userColor === 'w' ? 'white' : 'black',
            onDragStart: onDragStart,
            onDrop: onDrop,
            onSnapEnd: onSnapEnd,
        })
    } else {
        board.orientation(userColor === 'w' ? 'white' : 'black')
        board.position(game.fen(), false)
    }

    maybeAutoPlay({
        path: currentPath,
        turn: game.turn(),
        is_leaf: currentTree.children.length === 0,
        last_move: null,
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
    var node = getNodeAtPath(currentPath)
    var moves = node.children.map(function (child) {
        return child.san
    })
    if (moves.length === 0) {
        $result.text("No more book moves — you've reached the end!")
    } else {
        $result.text('Hint: ' + moves.join(' or '))
    }
})

$.getJSON('static/openings.json').done(function (data) {
    openingsData = data
    openingsData.forEach(function (opening) {
        $select.append($('<option>', { value: opening.id, text: opening.name }))
    })
    if (openingsData.length > 0) {
        loadOpening(openingsData[0].id)
    }
})
