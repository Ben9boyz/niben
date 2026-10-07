// Which built files does the live site actually use? Starts at index.html and follows every
// "name-hash.js" it finds (entry → chunks → their chunks, workers too). Prints one name per line.
const base = process.argv[2] || 'https://niben.no/'
const seen = new Set()
const queue = ['index.html']
const NAME = /[\w.-]+-[\w-]{8}(?:-[a-z0-9]+)?\.js/g
while (queue.length) {
  const f = queue.shift()
  const r = await fetch(new URL(f, base) + (f === 'index.html' ? `?v=${Date.now()}` : ''), { cache: 'no-store' })
  if (!r.ok) { console.error(`! ${f}: HTTP ${r.status}`); process.exitCode = 2; continue }
  const text = await r.text()
  for (const m of text.matchAll(NAME)) {
    const n = m[0].replace(/^.*\//, '')
    if (!seen.has(n)) { seen.add(n); queue.push(n) }
  }
}
for (const n of seen) console.log(n)
