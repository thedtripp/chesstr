import { Chess } from './chess.js'
import { Chessground } from './chessground/chessground.js'
import { recordResult, allDue, discard } from './stats.js'

var cg = null
var game = null
var openingsData = []
var currentOpeningId = null
var currentTree = null
var currentPath = []
var userColor = 'w'
var lastMove = null
var guidedMode = false

var $result = $('#result')
var $title = $('#opening-title')
var $select = $('#opening-select')
var $colorSelect = $('#color-select')
var $guidedToggle = $('#guided-toggle')
var $drillCount = $('#drill-count')

var AUTO_MOVE_DELAY = 600

function setResult(text, type) {
    $result.text(text)
    $result.removeClass('result-success result-error result-info')
    $result.addClass('result-' + (type || 'info'))
}

function getNodeAtPath(path) {
    var node = currentTree
    for (var i = 0; i < path.length; i++) {
        node = node.children[path[i]]
    }
    return node
}

// All legal destinations for the side to move, in the shape chessground
// wants for movable.dests: a map of origin square -> reachable squares.
function legalDests(g) {
    var dests = new Map()
    g.moves({ verbose: true }).forEach(function (move) {
        if (!dests.has(move.from)) dests.set(move.from, [])
        dests.get(move.from).push(move.to)
    })
    return dests
}

// Lichess-style green arrows (chessground's own default "green" brush is
// literally lichess's analysis-board color) pointing at every book move
// that would count as correct from here.
function guidedShapes(node) {
    if (!guidedMode) return []
    return node.children.map(function (child) {
        return { orig: child.uci.slice(0, 2), dest: child.uci.slice(2, 4), brush: 'green' }
    })
}

// Board config derived from current game/lastMove state. Movable destinations
// are only populated when it's the player's turn — otherwise the board is
// inert while the computer "thinks", after the game has ended, or once the
// book line has run out (there's nothing left to quiz, so further "legal but
// off-book" moves shouldn't be accepted and scored as misses).
function boardConfig() {
    var turnColor = game.turn() === 'w' ? 'white' : 'black'
    var node = getNodeAtPath(currentPath)
    var atBookEnd = node.children.length === 0
    var interactive = !game.isGameOver() && !atBookEnd && game.turn() === userColor

    return {
        fen: game.fen(),
        turnColor: turnColor,
        check: game.isCheck(),
        lastMove: lastMove,
        movable: {
            color: interactive ? turnColor : undefined,
            dests: interactive ? legalDests(game) : new Map(),
        },
        drawable: {
            autoShapes: interactive ? guidedShapes(node) : [],
        },
    }
}

function syncBoard() {
    cg.set(boardConfig())
}

// Replays a stored (openingId, path) from scratch against the opening's
// CURRENT tree. Returns null if the path doesn't hold up any more — an index
// out of range, or landing on a position with no book children left to quiz
// — which happens whenever the underlying PGN has since changed shape.
function replayPath(opening, path) {
    var node = opening.tree
    var g = new Chess()
    var cp = []
    var lm = null

    for (var i = 0; i < path.length; i++) {
        var child = node.children[path[i]]
        if (!child) return null
        try {
            g.move({ from: child.uci.slice(0, 2), to: child.uci.slice(2, 4), promotion: child.uci.slice(4) || undefined })
        } catch (error) {
            return null
        }
        lm = [child.uci.slice(0, 2), child.uci.slice(2, 4)]
        cp = cp.concat([path[i]])
        node = child
    }

    if (node.children.length === 0) return null
    return { game: g, currentPath: cp, lastMove: lm }
}

// Due entries that still replay cleanly against today's opening trees.
// Anything that doesn't validate is stale (a rebuilt PGN moved the position
// it used to point at) and gets discarded on the spot rather than left to
// keep inflating the due count or breaking the drill button forever.
function dueValidEntries(now) {
    if (openingsData.length === 0) return []
    return allDue(now).filter(function (entry) {
        var opening = openingsData.find(function (o) {
            return o.id === entry.openingId
        })
        var ok = !!opening && !!replayPath(opening, entry.path)
        if (!ok) discard(entry.openingId, entry.path)
        return ok
    })
}

function refreshDrillBadge() {
    var count = dueValidEntries(Date.now()).length
    $drillCount.text(count > 0 ? count : '')
}

// Board config that doesn't depend on the current position — set once per
// session (on load, on restart, on color change) alongside boardConfig().
function sessionBoardConfig() {
    return {
        orientation: userColor === 'w' ? 'white' : 'black',
        coordinates: true,
        animation: { enabled: true, duration: 200 },
        highlight: { lastMove: true, check: true },
        movable: { free: false, showDests: true, events: { after: onUserMove } },
    }
}

// Object.assign only shallow-merges — since both sessionBoardConfig() and
// boardConfig() set a `movable` key, a plain assign would let boardConfig()'s
// {color, dests} silently clobber sessionBoardConfig()'s {events, showDests}
// instead of combining with them. Merge that one nested object explicitly.
function fullBoardConfig() {
    var session = sessionBoardConfig()
    var position = boardConfig()
    return Object.assign({}, session, position, {
        movable: Object.assign({}, session.movable, position.movable),
    })
}

function ensureBoard(config) {
    if (!cg) {
        cg = Chessground(document.getElementById('board'), config)
    } else {
        cg.set(config)
    }
}

// Called by chessground once it has already applied a legal user move on the
// board. Checks whether it matches a book move in the opening tree; if not,
// reverts both the rules engine and the board back to before the move.
function onUserMove(orig, dest) {
    var beforeFen = game.fen()
    var quizPath = currentPath.slice()
    var move = game.move({ from: orig, to: dest, promotion: 'q' })
    var uci = orig + dest + (move.promotion || '')
    var node = getNodeAtPath(quizPath)
    var index = node.children.findIndex(function (child) {
        return child.uci === uci
    })

    recordResult(currentOpeningId, quizPath, userColor, index !== -1, Date.now())
    refreshDrillBadge()

    if (index === -1) {
        game = new Chess(beforeFen)
        syncBoard()
        setResult('Not a book move here. Try again.', 'error')
        return
    }

    var child = node.children[index]
    currentPath = quizPath.concat([index])
    lastMove = [orig, dest]
    syncBoard()
    maybeAutoPlay({
        path: currentPath,
        turn: game.turn(),
        is_leaf: child.children.length === 0,
        last_move: child.san,
    })
}

// After any move lands on a node, either hand control back to the player
// or, if it's the computer's turn, play its book reply after a short pause.
function maybeAutoPlay(node) {
    if (node.is_leaf) {
        setResult('Line complete! Nice work.', 'success')
        return
    }

    if (node.turn === userColor) {
        setResult("What's the next move?", 'info')
        return
    }

    setResult('Computer is thinking...', 'info')
    setTimeout(function () {
        var treeNode = getNodeAtPath(node.path)
        var index = Math.floor(Math.random() * treeNode.children.length)
        var child = treeNode.children[index]
        var uci = child.uci
        var from = uci.slice(0, 2)
        var to = uci.slice(2, 4)

        game.move({ from: from, to: to, promotion: uci.slice(4) || undefined })
        currentPath = node.path.concat([index])
        lastMove = [from, to]
        syncBoard()
        setResult('Computer played: ' + child.san, 'info')

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
    lastMove = null
    game = new Chess()
    $title.text(opening.name)

    ensureBoard(fullBoardConfig())

    maybeAutoPlay({
        path: currentPath,
        turn: game.turn(),
        is_leaf: currentTree.children.length === 0,
        last_move: null,
    })
}

// Jump straight into the position the player has missed the most / longest,
// replaying the book line that leads there instantly, then handing back
// control right at the point they need to answer again.
function drillWeakSpot() {
    var due = dueValidEntries(Date.now())
    var entry = due[0]
    if (!entry) {
        setResult('No weak spots due for review right now — nice work!', 'success')
        return
    }

    var opening = openingsData.find(function (o) {
        return o.id === entry.openingId
    })
    var replay = replayPath(opening, entry.path)

    userColor = entry.userColor
    $colorSelect.val(userColor)
    currentOpeningId = entry.openingId
    $select.val(currentOpeningId)
    currentTree = opening.tree
    game = replay.game
    currentPath = replay.currentPath
    lastMove = replay.lastMove
    $title.text(opening.name + ' — weak spot')

    ensureBoard(fullBoardConfig())
    setResult('Weak spot — missed ' + entry.wrong + 'x so far. What\'s the move?', 'error')
    refreshDrillBadge()
}

$('#restart').on('click', function () {
    if (currentOpeningId) loadOpening(currentOpeningId)
})

$('#drill').on('click', drillWeakSpot)

$select.on('change', function () {
    loadOpening($select.val())
})

$guidedToggle.on('change', function () {
    guidedMode = this.checked
    if (cg) syncBoard()
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
        setResult("No more book moves — you've reached the end!", 'success')
    } else {
        setResult('Hint: ' + moves.join(' or '), 'info')
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
    refreshDrillBadge()
})
