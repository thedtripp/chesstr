// Per-position mistake tracking, stored in localStorage. A "position" is
// identified by (opening, path-of-move-indices-to-reach-it) — the same node
// the trainer already walks. Getting it right pushes the next review further
// out (a simple Leitner-style ladder); getting it wrong brings it right back.
const STORAGE_KEY = 'chesstr:stats:v1'
const INTERVALS_DAYS = [0, 1, 3, 7, 14, 30, 60]

function loadStore() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
    } catch (error) {
        return {}
    }
}

function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function keyFor(openingId, path) {
    return openingId + '|' + path.join(',')
}

function intervalMs(streak) {
    var days = INTERVALS_DAYS[Math.min(streak, INTERVALS_DAYS.length - 1)]
    return days * 24 * 60 * 60 * 1000
}

export function recordResult(openingId, path, userColor, correct, now) {
    var store = loadStore()
    var key = keyFor(openingId, path)
    var entry = store[key] || {
        openingId: openingId,
        path: path.slice(),
        userColor: userColor,
        wrong: 0,
        right: 0,
        streak: 0,
    }

    if (correct) {
        entry.right += 1
        entry.streak += 1
    } else {
        entry.wrong += 1
        entry.streak = 0
    }
    entry.userColor = userColor
    entry.lastSeen = now
    entry.dueAt = now + intervalMs(entry.streak)

    store[key] = entry
    saveStore(store)
}

// Entries currently due for review, worst-missed first. The caller is
// responsible for checking each one still points at a real position — the
// opening tree can change shape (a rebuilt PGN, a swapped-in repertoire)
// out from under stored paths, and stats.js has no way to know that.
export function allDue(now) {
    var store = loadStore()
    return Object.keys(store)
        .map(function (k) {
            return store[k]
        })
        .filter(function (entry) {
            return entry.dueAt <= now
        })
        .sort(function (a, b) {
            return b.wrong - a.wrong || a.dueAt - b.dueAt
        })
}

export function dueCount(now) {
    return allDue(now).length
}

export function discard(openingId, path) {
    var store = loadStore()
    delete store[keyFor(openingId, path)]
    saveStore(store)
}
