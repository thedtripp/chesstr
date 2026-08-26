// Adaptive curriculum: which openings are unlocked, and how deep into each
// one the player has earned the right to be quizzed. Stored in localStorage,
// separate from stats.js's per-position mistake tracking.
//
// Unlocking is per-opening (drives the dropdown: once "Vienna Gambit" is
// unlocked, it's unlocked full stop). Depth cap and streak, though, are
// tracked per (opening, color) pair -- training the White side of an
// opening and training the Black side are different skills that happen to
// share a tree, and mastering one shouldn't silently mark the other as
// mastered too. Reaching an opening's max depth in whichever color you're
// currently on is what unlocks the next opening -- it doesn't require
// mastering both colors first.
const STORAGE_KEY = 'chesstr:curriculum:v1'
const STARTING_DEPTH = 4
const DEPTH_INCREMENT = 2
const STREAK_TO_LEVEL_UP = 3

function loadState() {
    try {
        var raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
        if (raw && Array.isArray(raw.unlocked)) return raw
    } catch (error) {
        // fall through to a fresh state
    }
    return { unlocked: [], depthCaps: {}, streaks: {} }
}

function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function trackKey(openingId, color) {
    return openingId + ':' + color
}

// First-ever visit unlocks just the first opening in the given fixed order.
// Safe to call on every load -- a no-op once anything is already unlocked.
export function ensureInitialized(orderedOpeningIds) {
    var state = loadState()
    if (state.unlocked.length === 0 && orderedOpeningIds.length > 0) {
        state.unlocked = [orderedOpeningIds[0]]
        saveState(state)
    }
    return state
}

export function isOpeningUnlocked(openingId) {
    return loadState().unlocked.indexOf(openingId) !== -1
}

export function unlockedOpenings() {
    return loadState().unlocked.slice()
}

export function depthCapFor(openingId, color) {
    return loadState().depthCaps[trackKey(openingId, color)] || STARTING_DEPTH
}

export function streakFor(openingId, color) {
    return loadState().streaks[trackKey(openingId, color)] || 0
}

export function streakGoal() {
    return STREAK_TO_LEVEL_UP
}

// Call once a full playthrough (a real book leaf, or hitting the depth cap)
// finishes on an opening+color the curriculum is actively tracking. Returns
// what changed, if anything, so the UI can surface it.
export function recordPlaythrough(openingId, color, clean, maxDepth, orderedOpeningIds) {
    var state = loadState()
    if (state.unlocked.indexOf(openingId) === -1) return {}

    var key = trackKey(openingId, color)
    var currentCap = state.depthCaps[key] || STARTING_DEPTH
    var alreadyMastered = currentCap >= maxDepth

    if (!clean || alreadyMastered) {
        if (!clean) state.streaks[key] = 0
        saveState(state)
        return {}
    }

    state.streaks[key] = (state.streaks[key] || 0) + 1
    var result = {}

    if (state.streaks[key] >= STREAK_TO_LEVEL_UP) {
        state.streaks[key] = 0
        var newCap = Math.min(currentCap + DEPTH_INCREMENT, maxDepth)
        state.depthCaps[key] = newCap

        if (newCap >= maxDepth) {
            result.mastered = true
            var idx = orderedOpeningIds.indexOf(openingId)
            var next = orderedOpeningIds[idx + 1]
            if (next && state.unlocked.indexOf(next) === -1) {
                state.unlocked.push(next)
                result.unlockedNext = next
            }
        } else {
            result.leveledUpTo = newCap
        }
    }

    saveState(state)
    return result
}

export function resetAll() {
    localStorage.removeItem(STORAGE_KEY)
}
