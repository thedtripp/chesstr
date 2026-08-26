import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installFakeLocalStorage } from './helpers/fake-local-storage.js'
import { recordResult, allDue, dueCount, discard, resetAll } from '../static/stats.js'

var DAY = 24 * 60 * 60 * 1000

beforeEach(function () {
    installFakeLocalStorage()
})

test('a fresh position has nothing due', function () {
    assert.deepEqual(allDue(0), [])
    assert.equal(dueCount(0), 0)
})

test('recording a miss makes the position due immediately', function () {
    var now = 1000
    recordResult('opening_a', [0, 1], 'w', false, now)
    var due = allDue(now)
    assert.equal(due.length, 1)
    assert.equal(due[0].wrong, 1)
    assert.equal(due[0].streak, 0)
})

test('a correct answer is not due again until its interval elapses', function () {
    var now = 1000
    recordResult('opening_a', [0, 1], 'w', true, now) // streak 1 -> due after 1 day
    assert.equal(allDue(now).length, 0) // not due right away
    assert.equal(allDue(now + DAY - 1).length, 0)
    assert.equal(allDue(now + DAY).length, 1)
})

test('a miss resets the streak, bringing the review interval back to immediate', function () {
    var now = 1000
    recordResult('opening_a', [0, 1], 'w', true, now)
    recordResult('opening_a', [0, 1], 'w', true, now)
    recordResult('opening_a', [0, 1], 'w', false, now) // miss resets streak to 0
    assert.equal(allDue(now).length, 1) // due immediately again
})

test('allDue sorts worst-missed first, then soonest-due', function () {
    var now = 1000
    recordResult('opening_a', [0], 'w', false, now) // wrong=1
    recordResult('opening_a', [1], 'w', false, now)
    recordResult('opening_a', [1], 'w', false, now) // wrong=2, worse
    recordResult('opening_a', [2], 'w', false, now) // wrong=1, same as first but recorded later (same dueAt)

    var due = allDue(now)
    assert.equal(due[0].wrong, 2)
    assert.deepEqual(due[0].path, [1])
})

test('discard removes a specific entry only', function () {
    var now = 1000
    recordResult('opening_a', [0], 'w', false, now)
    recordResult('opening_a', [1], 'w', false, now)
    discard('opening_a', [0])
    var due = allDue(now)
    assert.equal(due.length, 1)
    assert.deepEqual(due[0].path, [1])
})

test('resetAll clears every tracked position', function () {
    var now = 1000
    recordResult('opening_a', [0], 'w', false, now)
    resetAll()
    assert.equal(allDue(now).length, 0)
})
