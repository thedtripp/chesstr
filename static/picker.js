// The "choose your openings" modal. Lets the player pick from the full
// opening-catalog.json (149 families) to add to their training path,
// on top of the always-included curated openings/*.pgn set.
import { getSelected, setSelected } from './selection.js'
import { resetAll as resetStats } from './stats.js'
import { resetAll as resetCurriculum } from './curriculum.js'

var catalogData = []
var curatedIds = []
var meta = {}
var pending = new Set()

var $overlay = $('#picker-overlay')
var $list = $('#picker-list')
var $search = $('#picker-search')
var $sort = $('#picker-sort')
var $resultCount = $('#picker-result-count')
var $selectedCount = $('#picker-selected-count')
var $emptyState = $('#picker-empty-state')
var $emptyQuery = $('#picker-empty-query')

function leafCount(node) {
    if (node.children.length === 0) return 1
    return node.children.reduce(function (sum, c) {
        return sum + leafCount(c)
    }, 0)
}

function maxTreeDepth(node, depth) {
    depth = depth || 0
    if (node.children.length === 0) return depth
    return node.children.reduce(function (max, c) {
        return Math.max(max, maxTreeDepth(c, depth + 1))
    }, depth)
}

function previewLine(node, plies) {
    plies = plies || 6
    var sans = []
    var n = node
    for (var i = 0; i < plies && n.children.length > 0; i++) {
        n = n.children[0]
        sans.push(n.san)
    }
    var out = []
    for (var j = 0; j < sans.length; j++) {
        out.push(j % 2 === 0 ? Math.floor(j / 2) + 1 + '.' + sans[j] : sans[j])
    }
    return out.join(' ')
}

function formatPopularity(n) {
    if (!n) return 'no data'
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B games'
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M games'
    if (n >= 1e3) return Math.round(n / 1e3) + 'K games'
    return n + ' games'
}

var SORTERS = {
    name: function (a, b) {
        return a.name.localeCompare(b.name)
    },
    'popularity-desc': function (a, b) {
        return (b.popularity || 0) - (a.popularity || 0)
    },
    'lines-desc': function (a, b) {
        return meta[b.id].lines - meta[a.id].lines
    },
    'depth-desc': function (a, b) {
        return meta[b.id].depth - meta[a.id].depth
    },
}

function render() {
    var query = $search.val().trim().toLowerCase()
    var filtered = catalogData.filter(function (o) {
        return !query || o.name.toLowerCase().indexOf(query) !== -1
    })
    filtered.sort(SORTERS[$sort.val()] || SORTERS.name)

    $resultCount.text(filtered.length + ' / ' + catalogData.length)

    if (filtered.length === 0) {
        $list.empty()
        $emptyQuery.text($search.val())
        $emptyState.show()
        return
    }
    $emptyState.hide()

    $list.html(
        filtered
            .map(function (o) {
                var isCurated = curatedIds.indexOf(o.id) !== -1
                var checked = isCurated || pending.has(o.id)
                var m = meta[o.id]
                var classes = 'picker-row' + (checked ? ' checked' : '') + (isCurated ? ' locked' : '')
                return (
                    '<label class="' + classes + '" data-id="' + o.id + '">' +
                    '<input type="checkbox"' + (checked ? ' checked' : '') + (isCurated ? ' disabled' : '') + ' />' +
                    '<div class="picker-row-body">' +
                    '<div class="picker-row-head">' +
                    '<span class="picker-row-name">' +
                    o.name +
                    (isCurated ? ' <span class="picker-row-badge">already in your repertoire</span>' : '') +
                    '</span>' +
                    '<span class="picker-row-stats">' +
                    formatPopularity(o.popularity) +
                    ' &middot; ' +
                    m.lines +
                    ' lines &middot; ' +
                    m.depth +
                    ' plies</span>' +
                    '</div>' +
                    '<div class="picker-row-preview">' +
                    m.preview +
                    '</div>' +
                    '</div>' +
                    '</label>'
                )
            })
            .join('')
    )
}

function updateSelectedCount() {
    $selectedCount.text(pending.size)
}

function closePicker() {
    $overlay.attr('hidden', true)
}

function openPicker() {
    pending = new Set(getSelected())
    $search.val('')
    render()
    updateSelectedCount()
    $overlay.removeAttr('hidden')
}

$list.on('click', function (e) {
    var $row = $(e.target).closest('.picker-row')
    if (!$row.length || $row.hasClass('locked')) return
    var id = $row.data('id')
    if (pending.has(id)) {
        pending.delete(id)
    } else {
        pending.add(id)
    }
    $row.toggleClass('checked', pending.has(id))
    $row.find('input').prop('checked', pending.has(id))
    updateSelectedCount()
    e.preventDefault()
})

$search.on('input', render)
$sort.on('change', render)

$('#picker-cancel').on('click', closePicker)
$overlay.on('click', function (e) {
    if (e.target === this) closePicker()
})
$(document).on('keydown', function (e) {
    if (e.key === 'Escape' && !$overlay.attr('hidden')) closePicker()
})

$('#picker-save').on('click', function () {
    var current = getSelected().slice().sort()
    var next = Array.from(pending).sort()
    var changed = JSON.stringify(current) !== JSON.stringify(next)

    if (!changed) {
        closePicker()
        return
    }

    var ok = window.confirm('Changing your training path will reset your progress and mistake history for every opening. Continue?')
    if (!ok) return

    setSelected(Array.from(pending))
    resetStats()
    resetCurriculum()
    location.reload()
})

export function initPicker(catalog, curated) {
    catalogData = catalog
    curatedIds = curated
    catalogData.forEach(function (o) {
        meta[o.id] = {
            lines: leafCount(o.tree),
            depth: maxTreeDepth(o.tree),
            preview: previewLine(o.tree),
        }
    })
    $('#choose-openings-btn').on('click', openPicker)
}
