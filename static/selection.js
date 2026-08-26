// Which catalog openings (beyond the always-included curated set) the
// player has chosen as part of their training path. A plain ordered list
// of opening-catalog.json ids, stored separately from stats/curriculum so
// wiping one doesn't touch the others.
const STORAGE_KEY = 'chesstr:selected-openings:v1'

export function getSelected() {
    try {
        var raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
        if (Array.isArray(raw)) return raw
    } catch (error) {
        // fall through
    }
    return []
}

export function setSelected(ids) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}
