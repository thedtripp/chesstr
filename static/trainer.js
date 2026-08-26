import { Chess } from './chess.js'
import { Chessground } from './chessground/chessground.js'
import { recordResult, allDue, discard } from './stats.js'
import {
    ensureInitialized,
    isOpeningUnlocked,
    unlockedOpenings,
    depthCapFor,
    streakFor,
    streakGoal,
    recordPlaythrough,
} from './curriculum.js'
import { getSelected } from './selection.js'
import { initPicker } from './picker.js'

var cg = null
var game = null
var openingsData = []
var currentOpeningId = null
var currentTree = null
var currentPath = []
var userColor = 'w'
var lastMove = null
var guidedMode = false

// A "normal" session (loadOpening, via Continue or the opening picker) counts
// toward curriculum progression; exploring via Drill weak spots doesn't.
// sessionClean tracks whether the current normal session has hit any wrong
// move yet.
var progressionActive = false
var sessionClean = true
var curriculumOrder = []
var maxDepths = {}

var $result = $('#result')
var $title = $('#opening-title')
var $progress = $('#curriculum-progress')
var $select = $('#opening-select')
var $colorSelect = $('#color-select')
var $guidedToggle = $('#guided-toggle')
var $drillCount = $('#drill-count')

var AUTO_MOVE_DELAY = 600

function playSound(name) {
    new Audio('static/sound/' + name + '.mp3').play().catch(function () {})
}

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

function treeMaxDepth(node, depth) {
    depth = depth || 0
    if (node.children.length === 0) return depth
    var max = depth
    node.children.forEach(function (child) {
        var d = treeMaxDepth(child, depth + 1)
        if (d > max) max = d
    })
    return max
}

// A position is "book end" either because the tree really has no more
// moves there, or — only during a normal (curriculum-tracked) session —
// because the player hasn't earned depth past this point yet.
function isAtBookEnd(node, pathLength) {
    if (node.children.length === 0) return true
    if (progressionActive && pathLength >= depthCapFor(currentOpeningId, userColor)) return true
    return false
}

// Board config derived from current game/lastMove state. Movable destinations
// are only populated when it's the player's turn — otherwise the board is
// inert while the computer "thinks", after the game has ended, or once the
// book line has run out (there's nothing left to quiz, so further "legal but
// off-book" moves shouldn't be accepted and scored as misses).
function boardConfig() {
    var turnColor = game.turn() === 'w' ? 'white' : 'black'
    var node = getNodeAtPath(currentPath)
    var atBookEnd = isAtBookEnd(node, currentPath.length)
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

// Replays a (openingId, path) from scratch against the opening's CURRENT
// tree. Returns null only if the path itself doesn't hold up any more — an
// index out of range — which happens whenever the underlying PGN has since
// changed shape. Landing on a leaf is a valid outcome here; callers that
// specifically need a quizzable (non-leaf) position filter that themselves.
function replayMoves(opening, path) {
    var node = opening.tree
    var g = new Chess()
    var cp = []
    var lm = null
    var lastCaptured = false

    for (var i = 0; i < path.length; i++) {
        var child = node.children[path[i]]
        if (!child) return null
        var move
        try {
            move = g.move({ from: child.uci.slice(0, 2), to: child.uci.slice(2, 4), promotion: child.uci.slice(4) || undefined })
        } catch (error) {
            return null
        }
        lm = [child.uci.slice(0, 2), child.uci.slice(2, 4)]
        lastCaptured = !!move.captured
        cp = cp.concat([path[i]])
        node = child
    }

    return { game: g, currentPath: cp, lastMove: lm, node: node, lastCaptured: lastCaptured }
}

// Weak-spot drilling specifically needs a position that's still quizzable —
// a stale entry that now lands on a leaf isn't useful to drill.
function replayPath(opening, path) {
    var result = replayMoves(opening, path)
    if (!result || result.node.children.length === 0) return null
    return result
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
        sessionClean = false
        game = new Chess(beforeFen)
        syncBoard()
        setResult('Not a book move here. Try again.', 'error')
        return
    }

    var child = node.children[index]
    currentPath = quizPath.concat([index])
    lastMove = [orig, dest]
    syncBoard()
    playSound(move.captured ? 'Capture' : 'Move')
    maybeAutoPlay({
        path: currentPath,
        turn: game.turn(),
        is_leaf: isAtBookEnd(child, currentPath.length),
        last_move: child.san,
    })
}

// After any move lands on a node, either hand control back to the player
// or, if it's the computer's turn, play its book reply after a short pause.
function maybeAutoPlay(node) {
    if (node.is_leaf) {
        handleLineComplete()
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

        var computerMove = game.move({ from: from, to: to, promotion: uci.slice(4) || undefined })
        currentPath = node.path.concat([index])
        lastMove = [from, to]
        syncBoard()
        playSound(computerMove.captured ? 'Capture' : 'Move')
        setResult('Computer played: ' + child.san, 'info')

        setTimeout(function () {
            maybeAutoPlay({
                path: currentPath,
                turn: game.turn(),
                is_leaf: isAtBookEnd(child, currentPath.length),
                last_move: child.san,
            })
        }, AUTO_MOVE_DELAY / 2)
    }, AUTO_MOVE_DELAY)
}

// A line just finished — either the book really ran out, or (during a
// normal, curriculum-tracked session) the player hit their current depth
// cap. Score it toward curriculum progression when that applies, and
// surface whatever changed.
function handleLineComplete() {
    if (!progressionActive) {
        setResult('Line complete! Nice work.', 'success')
        return
    }

    var result = recordPlaythrough(currentOpeningId, userColor, sessionClean, maxDepths[currentOpeningId], curriculumOrder)
    refreshCurriculumUI()

    if (result.unlockedNext) {
        var unlocked = openingsData.find(function (o) {
            return o.id === result.unlockedNext
        })
        setResult('Opening mastered! New opening unlocked: ' + (unlocked ? unlocked.name : result.unlockedNext), 'success')
    } else if (result.mastered) {
        setResult('Opening fully mastered! Nice work.', 'success')
    } else if (result.leveledUpTo) {
        setResult('Line complete! Going deeper next time (' + result.leveledUpTo + ' plies).', 'success')
    } else {
        setResult('Line complete! Nice work.', 'success')
    }
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
    progressionActive = true
    sessionClean = true
    $title.text(opening.name)
    refreshCurriculumUI()

    ensureBoard(fullBoardConfig())
    playSound('Confirmation')

    maybeAutoPlay({
        path: currentPath,
        turn: game.turn(),
        is_leaf: isAtBookEnd(currentTree, currentPath.length),
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

    progressionActive = false
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
    playSound('Confirmation')
    setResult('Weak spot — missed ' + entry.wrong + 'x so far. What\'s the move?', 'error')
    refreshDrillBadge()
}

// Keeps the opening dropdown's locked/unlocked options and the progress
// line under the title in sync with curriculum state. Depth/streak are
// shown for the color currently selected -- White and Black progress
// through the same opening independently.
function refreshCurriculumUI() {
    $select.find('option').each(function () {
        $(this).prop('disabled', !isOpeningUnlocked($(this).val()))
    })

    if (!currentOpeningId || !isOpeningUnlocked(currentOpeningId)) {
        $progress.text('')
        return
    }

    var colorLabel = userColor === 'w' ? 'White' : 'Black'
    var cap = depthCapFor(currentOpeningId, userColor)
    var max = maxDepths[currentOpeningId] || cap
    if (cap >= max) {
        $progress.text('Fully unlocked as ' + colorLabel + ' (' + max + ' plies)')
    } else {
        $progress.text(
            'As ' + colorLabel + ': depth ' + cap + '/' + max + ' plies · streak ' + streakFor(currentOpeningId, userColor) + '/' + streakGoal() + ' to go deeper'
        )
    }
}

$('#continue-btn').on('click', function () {
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

// Curated openings/*.pgn are always part of the training path; the full
// opening-catalog.json (149 families) is filtered down to whatever the
// player has explicitly added via the "Choose openings" picker.
$.when($.getJSON('static/openings.json'), $.getJSON('static/opening-catalog.json')).done(function (curatedResult, catalogResult) {
    var curated = curatedResult[0]
    var catalog = catalogResult[0]
    var curatedIds = curated.map(function (o) {
        return o.id
    })
    var selected = getSelected()
    var fromCatalog = catalog.filter(function (o) {
        return selected.indexOf(o.id) !== -1 && curatedIds.indexOf(o.id) === -1
    })

    openingsData = curated.concat(fromCatalog)
    curriculumOrder = openingsData.map(function (o) {
        return o.id
    })
    openingsData.forEach(function (opening) {
        maxDepths[opening.id] = treeMaxDepth(opening.tree)
        $select.append($('<option>', { value: opening.id, text: opening.name }))
    })
    ensureInitialized(curriculumOrder)
    initPicker(catalog, curatedIds)

    var unlocked = unlockedOpenings()
    var startId = unlocked.length > 0 ? unlocked[unlocked.length - 1] : (openingsData[0] && openingsData[0].id)
    if (startId) loadOpening(startId)
    refreshCurriculumUI()
    refreshDrillBadge()
})
