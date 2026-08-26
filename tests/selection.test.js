import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installFakeLocalStorage } from './helpers/fake-local-storage.js'
import { getSelected, setSelected } from '../static/selection.js'

beforeEach(function () {
    installFakeLocalStorage()
})

test('getSelected defaults to an empty list', function () {
    assert.deepEqual(getSelected(), [])
})

test('setSelected/getSelected round-trip', function () {
    setSelected(['sicilian_najdorf', 'caro_kann_defense'])
    assert.deepEqual(getSelected(), ['sicilian_najdorf', 'caro_kann_defense'])
})

test('getSelected recovers to an empty list from corrupted storage', function () {
    localStorage.setItem('chesstr:selected-openings:v1', '{"not": "an array"}')
    assert.deepEqual(getSelected(), [])
})
