// End-to-end smoke test: serves the real static site, drives the real
// trainer.js in a real headless browser, and checks the golden path
// (loads with a fresh account, accepts a book move, rejects an off-book
// one) actually works end to end. This is deliberately data-driven --
// it reads static/openings.json and static/chess.js to compute a real
// book move and a real off-book move at runtime, rather than hardcoding
// a move sequence from memory (a mistake made more than once earlier in
// this project when a hardcoded sequence silently drifted from the data).
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { Chess } from '../static/chess.js'

const PORT = 8934
const BASE_URL = `http://localhost:${PORT}/`

function fail(message) {
    console.error('FAIL:', message)
    process.exitCode = 1
}

function pass(message) {
    console.log('PASS:', message)
}

async function waitForServer() {
    for (let i = 0; i < 50; i++) {
        try {
            const res = await fetch(BASE_URL)
            if (res.ok) return
        } catch (error) {
            // not up yet
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('static server never came up')
}

async function squareCenter(page, square, orientationWhite) {
    const box = await page.locator('cg-board').boundingBox()
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0)
    const rank = parseInt(square[1], 10) - 1
    const size = box.width / 8
    const col = orientationWhite ? file : 7 - file
    const row = orientationWhite ? 7 - rank : rank
    return { x: box.x + col * size + size / 2, y: box.y + row * size + size / 2 }
}

async function clickMove(page, uci) {
    const from = await squareCenter(page, uci.slice(0, 2), true)
    const to = await squareCenter(page, uci.slice(2, 4), true)
    await page.mouse.click(from.x, from.y)
    await page.mouse.click(to.x, to.y)
}

async function main() {
    const server = spawn('python3', ['-m', 'http.server', String(PORT)], { stdio: 'ignore' })
    try {
        await waitForServer()

        // Figure out what a real book move and a real off-book move look
        // like for whichever opening loads first on a fresh account, by
        // reading the same data the app itself reads.
        const openings = JSON.parse(await readFile(new URL('../static/openings.json', import.meta.url)))
        const first = openings[0]
        const bookUci = first.tree.children[0].uci
        const bookGame = new Chess()
        const legalUcis = bookGame.moves({ verbose: true }).map((m) => m.from + m.to)
        const bookUcis = new Set(first.tree.children.map((c) => c.uci))
        const offBookUci = legalUcis.find((u) => !bookUcis.has(u))
        if (!offBookUci) throw new Error('could not find an off-book legal move to test against')

        const browser = await chromium.launch()

        // Golden path: fresh account, correct book move accepted.
        {
            const context = await browser.newContext()
            const page = await context.newPage()
            await page.goto(BASE_URL)
            await page.waitForFunction(() => document.querySelectorAll('#opening-select option').length > 0)
            await page.waitForSelector('cg-board piece', { timeout: 5000 })

            const optionCount = await page.locator('#opening-select option').count()
            if (optionCount > 0) pass(`opening dropdown populated (${optionCount} options)`)
            else fail('opening dropdown is empty')

            const selectedId = await page.locator('#opening-select').inputValue()
            if (selectedId === first.id) pass(`fresh account starts on the first curated opening (${first.id})`)
            else fail(`expected fresh account to start on ${first.id}, got ${selectedId}`)

            const titleBefore = await page.locator('#opening-title').textContent()
            if (titleBefore && titleBefore.trim().length > 0) pass('opening title is shown on load')
            else fail('opening title is empty on load')

            await clickMove(page, bookUci)
            await page.waitForTimeout(300)

            const resultClass = await page.locator('#result').getAttribute('class')
            if (!resultClass.includes('result-error')) pass('a real book move is accepted, not flagged as a mistake')
            else fail(`book move ${bookUci} was rejected: result classes were "${resultClass}"`)

            await context.close()
        }

        // Off-book move: fresh account/context again so we're testing the
        // very first move from a known position, not wherever the previous
        // scenario's auto-play left the game.
        {
            const context = await browser.newContext()
            const page = await context.newPage()
            await page.goto(BASE_URL)
            await page.waitForFunction(() => document.querySelectorAll('#opening-select option').length > 0)
            await page.waitForSelector('cg-board piece', { timeout: 5000 })

            await clickMove(page, offBookUci)
            await page.waitForTimeout(300)

            const resultText = await page.locator('#result').textContent()
            const resultClass = await page.locator('#result').getAttribute('class')
            if (resultClass.includes('result-error') && /not a book move/i.test(resultText)) {
                pass(`an off-book move (${offBookUci}) is rejected with a clear error`)
            } else {
                fail(`expected an off-book-move error, got class="${resultClass}" text="${resultText}"`)
            }

            await context.close()
        }

        await browser.close()
    } finally {
        server.kill()
    }
}

main()
    .then(() => {
        if (process.exitCode) {
            console.error('\nSmoke test FAILED')
            process.exit(process.exitCode)
        }
        console.log('\nSmoke test passed')
    })
    .catch((error) => {
        console.error('\nSmoke test crashed:', error)
        process.exit(1)
    })
