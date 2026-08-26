// curriculum.js / stats.js / selection.js are written for the browser and
// reference the bare `localStorage` global. Node has no such global by
// default, so tests install this minimal in-memory stand-in before each
// test runs rather than pulling in a browser environment just for this.
class FakeLocalStorage {
    constructor() {
        this.store = new Map()
    }
    getItem(key) {
        return this.store.has(key) ? this.store.get(key) : null
    }
    setItem(key, value) {
        this.store.set(key, String(value))
    }
    removeItem(key) {
        this.store.delete(key)
    }
    clear() {
        this.store.clear()
    }
}

export function installFakeLocalStorage() {
    var fake = new FakeLocalStorage()
    globalThis.localStorage = fake
    return fake
}
