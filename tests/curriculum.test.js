import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installFakeLocalStorage } from './helpers/fake-local-storage.js'
import {
    ensureInitialized,
    isOpeningUnlocked,
    unlockedOpenings,
    depthCapFor,
    streakFor,
    streakGoal,
    setStreakGoal,
    recordPlaythrough,
    resetAll,
} from '../static/curriculum.js'

var ORDER = ['opening_a', 'opening_b', 'opening_c']

beforeEach(function () {
    installFakeLocalStorage()
})

test('ensureInitialized unlocks only the first opening on a fresh account', function () {
    ensureInitialized(ORDER)
    assert.deepEqual(unlockedOpenings(), ['opening_a'])
    assert.equal(isOpeningUnlocked('opening_b'), false)
})

test('ensureInitialized is a no-op once something is already unlocked', function () {
    ensureInitialized(ORDER)
    recordPlaythrough('opening_a', 'w', true, 4, ORDER) // build up some state
    ensureInitialized(ORDER)
    assert.deepEqual(unlockedOpenings(), ['opening_a'])
})

test('depthCapFor and streakFor default before any progress is recorded', function () {
    assert.equal(depthCapFor('opening_a', 'w'), 4)
    assert.equal(streakFor('opening_a', 'w'), 0)
})

test('streakGoal defaults to 3 and setStreakGoal clamps to [1, 10]', function () {
    assert.equal(streakGoal(), 3)
    assert.equal(setStreakGoal(-5), 1)
    assert.equal(setStreakGoal(99), 10)
    assert.equal(setStreakGoal(5), 5)
    assert.equal(streakGoal(), 5)
})

test('setStreakGoal(0) falls back to the default rather than clamping to 1 -- 0 is falsy, same code path as garbage input', function () {
    assert.equal(setStreakGoal(0), 3)
})

test('setStreakGoal falls back to the default for garbage input', function () {
    assert.equal(setStreakGoal(NaN), 3)
})

test('recordPlaythrough is a no-op for an opening that is not unlocked', function () {
    var result = recordPlaythrough('opening_b', 'w', true, 10, ORDER)
    assert.deepEqual(result, {})
    assert.equal(streakFor('opening_b', 'w'), 0)
})

test('a wrong move resets the streak instead of incrementing it', function () {
    ensureInitialized(ORDER)
    recordPlaythrough('opening_a', 'w', true, 10, ORDER)
    assert.equal(streakFor('opening_a', 'w'), 1)
    recordPlaythrough('opening_a', 'w', false, 10, ORDER)
    assert.equal(streakFor('opening_a', 'w'), 0)
})

test('reaching the streak goal deepens the cap and resets the streak, without maxing out', function () {
    ensureInitialized(ORDER)
    setStreakGoal(3)
    recordPlaythrough('opening_a', 'w', true, 10, ORDER)
    recordPlaythrough('opening_a', 'w', true, 10, ORDER)
    var result = recordPlaythrough('opening_a', 'w', true, 10, ORDER)

    assert.equal(depthCapFor('opening_a', 'w'), 6) // STARTING_DEPTH(4) + DEPTH_INCREMENT(2)
    assert.equal(streakFor('opening_a', 'w'), 0)
    assert.equal(result.leveledUpTo, 6)
    assert.equal(result.mastered, undefined)
})

test('reaching maxDepth marks the opening mastered and unlocks the next one', function () {
    ensureInitialized(ORDER)
    setStreakGoal(1)
    // maxDepth 6 = STARTING_DEPTH(4) + DEPTH_INCREMENT(2): one clean streak caps out exactly at maxDepth.
    var result = recordPlaythrough('opening_a', 'w', true, 6, ORDER)

    assert.equal(result.mastered, true)
    assert.equal(result.unlockedNext, 'opening_b')
    assert.deepEqual(unlockedOpenings(), ['opening_a', 'opening_b'])
})

test('mastering the last opening in the order does not blow up', function () {
    ensureInitialized(['opening_a'])
    setStreakGoal(1)
    var result = recordPlaythrough('opening_a', 'w', true, 6, ['opening_a'])
    assert.equal(result.mastered, true)
    assert.equal(result.unlockedNext, undefined)
})

test('progress is tracked independently per color', function () {
    ensureInitialized(ORDER)
    setStreakGoal(1)
    recordPlaythrough('opening_a', 'w', true, 10, ORDER)

    assert.equal(depthCapFor('opening_a', 'w'), 6)
    assert.equal(depthCapFor('opening_a', 'b'), 4) // untouched
    assert.equal(streakFor('opening_a', 'b'), 0)
})

test('once mastered, further clean playthroughs are a no-op', function () {
    ensureInitialized(ORDER)
    setStreakGoal(1)
    recordPlaythrough('opening_a', 'w', true, 6, ORDER) // masters it at cap 6
    var result = recordPlaythrough('opening_a', 'w', true, 6, ORDER)
    assert.deepEqual(result, {})
    assert.equal(streakFor('opening_a', 'w'), 0)
})

test('resetAll wipes unlock state, depth caps, and streaks', function () {
    ensureInitialized(ORDER)
    recordPlaythrough('opening_a', 'w', true, 10, ORDER)
    resetAll()
    assert.deepEqual(unlockedOpenings(), [])
    assert.equal(depthCapFor('opening_a', 'w'), 4)
})
