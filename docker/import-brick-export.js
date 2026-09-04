'use strict'

// Imports a workspace exported from brick.do (see SELF-HOSTING.md, "Migrating from brick.do")
// into this instance's database. Run inside the server container:
//
//   node docker/import-brick-export.js /path/export.json --user you@example.com \
//     [--images-base https://HOST/uploads/migrated] [--images-manifest /path/manifest.json] \
//     [--domains docs.example.com,other.example.com | --no-domains] [--workspace-name "ZK workspace"]
//
// Page IDs, short IDs, slugs and ordering are preserved. Image URLs pointing at brick.do's CDN are
// rewritten to --images-base using the manifest produced by the export step. Public addresses are
// imported for subdomains always, and for custom domains only when listed in --domains.
// Safe to re-run: pages that already exist are skipped.

const fs = require('fs')
const path = require('path')
// pg is a dependency of apps/server (pnpm keeps it there), resolve it from that package
const { Client } = require(require.resolve('pg', { paths: [path.join(__dirname, '../apps/server')] }))

const args = process.argv.slice(2)
const file = args.find(a => !a.startsWith('--'))
const opt = (name, def) => {
  const i = args.indexOf('--' + name)
  return i === -1 ? def : args[i + 1]
}
const flag = name => args.includes('--' + name)
if (!file) {
  console.error('usage: import-brick-export.js export.json --user EMAIL [options]')
  process.exit(2)
}

const exp = JSON.parse(fs.readFileSync(file, 'utf8'))
const userEmail = opt('user')
const imagesBase = (opt('images-base', '') || '').replace(/\/$/, '')
const manifest = opt('images-manifest') ? JSON.parse(fs.readFileSync(opt('images-manifest'), 'utf8')) : {}
const keepDomains = flag('no-domains') ? new Set() : opt('domains') ? new Set(opt('domains').split(',').map(s => s.trim().toLowerCase())) : null
const workspaceName = opt('workspace-name', exp.workspace.name)

const rewriteUrls = html => {
  if (!html || !imagesBase) return html
  return html.replace(/https?:\/\/cdn-images\.brick\.do\/[^"'\s)]+/g, url => {
    const name = manifest[url]
    if (!name) {
      console.warn('  no local copy for image, URL left as-is:', url)
      return url
    }
    return `${imagesBase}/${name}`
  })
}

const client = new Client({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE,
})

async function main() {
  await client.connect()
  const { rows: users } = await client.query('select id, email from users where lower(email) = lower($1)', [userEmail])
  if (!users.length) throw new Error(`No user with email ${userEmail} on this instance; sign up first`)
  const userId = users[0].id
  const ws = exp.workspace
  const tree = exp.pagesTree
  const byId = Object.fromEntries(tree.map(p => [p.id, p]))
  console.log(`Importing "${workspaceName}" (${tree.length} pages) for ${userEmail}`)

  await client.query('begin')
  try {
    // 1. workspace (same id as on brick.do), root page links set after pages exist
    const { rowCount } = await client.query(
      `insert into workspaces (id, name, "userId", "collaborationInviteIds") values ($1, $2, $3, '{}')
       on conflict (id) do nothing`, [ws.id, workspaceName, userId])
    console.log(rowCount ? 'workspace created' : 'workspace already exists, adding missing pages')

    // 2. pages, parents before children (sort by mpath depth)
    const ordered = tree.slice().sort((a, b) => (a.mpath || '').split('.').length - (b.mpath || '').split('.').length)
    let inserted = 0, skipped = 0, images = 0
    for (const p of ordered) {
      const rec = exp.pages[p.id] || {}
      const content = rewriteUrls(rec.content ?? null)
      if (content) images += (content.match(new RegExp(imagesBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
      const styles = typeof rec.styles === 'string' ? rec.styles : rec.styles?.stylesScss ?? null
      const headTags = Array.isArray(rec.headTags) ? rec.headTags : rec.headTags?.headTags ?? null
      const renderCustomizations = headTags && headTags.length ? { headTags } : p.renderCustomizations ?? null
      const res = await client.query(
        `insert into pages (id, "shortId", name, content, "workspaceId", "parentId", "childrenOrder", "stylesScss",
           "customLink", "collaborationInviteIds", "themeId", "renderCustomizations", mpath)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'{}',$10,$11,$12) on conflict (id) do nothing`,
        [p.id, p.shortId, p.name, content, ws.id, p.parentId || null, p.childrenOrder || [], styles,
         p.customLink || null, p.themeId || null, renderCustomizations ? JSON.stringify(renderCustomizations) : null,
         p.mpath || ''])
      res.rowCount ? inserted++ : skipped++
    }
    console.log(`pages: ${inserted} inserted, ${skipped} already present, ${images} image URLs rewritten`)

    // 3. root pointers
    await client.query('update workspaces set "publicRootPageId" = $2, "privateRootPageId" = $3 where id = $1',
      [ws.id, ws.publicRootPageId, ws.privateRootPageId])

    // 4. public addresses whose root page belongs to this workspace
    let addrIn = 0, addrSkip = 0
    for (const a of exp.publicAddresses || []) {
      if (!byId[a.rootPageId]) continue
      if (a.externalDomain && keepDomains && !keepDomains.has(a.externalDomain.toLowerCase())) { addrSkip++; continue }
      const res = await client.query(
        `insert into "publicAddresses" (id, subdomain, "ownerId", "rootPageId", "externalDomain")
         values ($1,$2,$3,$4,$5) on conflict (id) do nothing`,
        [a.id, a.subdomain || null, userId, a.rootPageId, a.externalDomain || null])
      if (res.rowCount) addrIn++
    }
    console.log(`public addresses: ${addrIn} imported, ${addrSkip} custom domains skipped`)
    await client.query('commit')
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    await client.end()
  }
  console.log('done')
}

main().catch(e => { console.error('IMPORT FAILED:', e.message); process.exit(1) })
