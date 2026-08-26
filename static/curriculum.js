// Adaptive curriculum: which openings are unlocked, and how deep into each
// one the player has earned the right to be quizzed. Stored in localStorage,
// separate from stats.js's per-position mistake tracking.
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

// First-ever visit unlocks just the first opening in the given fixed order.
// Safe to call on every load -- a no-op once something is already unlocked.
export function ensureInitialized(orderedOpeningIds) {
    var state = loadState()
    if (state.unlocked.length === 0 && orderedOpeningIds.length > 0) {
        var first = orderedOpeningIds[0]
        state.unlocked = [first]
        state.depthCaps[first] = STARTING_DEPTH
        state.streaks[first] = 0
        saveState(state)
    }
    return state
}

export function isUnlocked(openingId) {
    return loadState().unlocked.indexOf(openingId) !== -1
}

export function unlockedOpenings() {
    return loadState().unlocked.slice()
}

export function depthCapFor(openingId) {
    return loadState().depthCaps[openingId] || STARTING_DEPTH
}

export function streakFor(openingId) {
    return loadState().streaks[openingId] || 0
}

export function streakGoal() {
    return STREAK_TO_LEVEL_UP
}

// Call once a full playthrough (a real book leaf, or hitting the depth cap)
// finishes on an opening the curriculum is actively tracking. Returns what
// changed, if anything, so the UI can surface it.
export function recordPlaythrough(openingId, clean, maxDepth, orderedOpeningIds) {
    var state = loadState()
    if (state.unlocked.indexOf(openingId) === -1) return {}

    var currentCap = state.depthCaps[openingId] || STARTING_DEPTH
    var alreadyMastered = currentCap >= maxDepth

    if (!clean || alreadyMastered) {
        if (!clean) state.streaks[openingId] = 0
        saveState(state)
        return {}
    }

    state.streaks[openingId] = (state.streaks[openingId] || 0) + 1
    var result = {}

    if (state.streaks[openingId] >= STREAK_TO_LEVEL_UP) {
        state.streaks[openingId] = 0
        var newCap = Math.min(currentCap + DEPTH_INCREMENT, maxDepth)
        state.depthCaps[openingId] = newCap

        if (newCap >= maxDepth) {
            result.mastered = true
            var idx = orderedOpeningIds.indexOf(openingId)
            var next = orderedOpeningIds[idx + 1]
            if (next && state.unlocked.indexOf(next) === -1) {
                state.unlocked.push(next)
                state.depthCaps[next] = STARTING_DEPTH
                state.streaks[next] = 0
                result.unlockedNext = next
            }
        } else {
            result.leveledUpTo = newCap
        }
    }

    saveState(state)
    return result
}
