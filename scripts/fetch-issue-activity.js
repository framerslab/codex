#!/usr/bin/env node
/**
 * Fetch GitHub issue and PR activity via GraphQL API (append-only JSONL format)
 * Records the issues created and closed and the pull requests merged over a span of complete days, as one line
 *
 * Format: One JSON object per line (JSONL)
 * File: codex-history/YYYY-MM.jsonl (same file as git changelog), the month of the span's first day
 *
 * The span runs from --since to the day before --until, in UTC. By default it starts where the last recorded span ended, or
 * seven days before --until when none is recorded, so one run's span follows the last. An item an earlier line holds is
 * left out, so a span that reaches back (a manual --since) never counts an item twice.
 *
 * Usage:
 *   GH_PAT=ghp_xxx node scripts/fetch-issue-activity.js [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--output-dir path]
 *
 *   --until  the first day not recorded (default: today, in UTC)
 *   --since  the first day recorded (default: the day the last recorded span ended, or seven days before --until)
 *
 * Requires:
 *   - GH_PAT environment variable (GitHub Personal Access Token with repo scope)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const GITHUB_TOKEN = process.env.GH_PAT
const REPO_OWNER = 'framerslab'
const REPO_NAME = 'codex'
const DAY = 24 * 60 * 60 * 1000

if (!GITHUB_TOKEN) {
  console.error('❌ Error: GH_PAT environment variable not set')
  console.error('   Set it with: export GH_PAT=ghp_xxxxx')
  process.exit(1)
}

// Parse CLI args
const args = process.argv.slice(2)
const option = (name) => {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : undefined
}

/**
 * The UTC midnight that starts a day written YYYY-MM-DD; any other text stops the run
 * @param {string} name - The option the day came from, for the error
 * @param {string} value - The day
 * @returns {number} Milliseconds since 1970
 */
function startOf(name, value) {
  const time = /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? Date.parse(`${value}T00:00:00Z`) : NaN
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== value) {
    console.error(`❌ ${name} takes a day written YYYY-MM-DD, not ${JSON.stringify(value ?? null)}`)
    process.exit(1)
  }
  return time
}

const dayOf = (time) => new Date(time).toISOString().slice(0, 10)

const outputDir = option('--output-dir') !== undefined
  ? path.resolve(option('--output-dir'))
  : path.resolve(__dirname, '../codex-history')

/**
 * Every line of the monthly files, oldest month first; a line that does not parse is reported and left out
 * @param {string} dir - The history folder
 * @returns {Array} Entries
 */
function readHistory(dir) {
  if (!fs.existsSync(dir)) return []
  const entries = []
  const files = fs.readdirSync(dir).filter((name) => /^\d{4}-\d{2}\.jsonl$/.test(name)).sort()
  for (const name of files) {
    const lines = fs.readFileSync(path.join(dir, name), 'utf-8').split('\n')
    lines.forEach((line, index) => {
      if (!line.trim()) return
      try {
        entries.push(JSON.parse(line))
      } catch (e) {
        console.warn(`⚠️  ${name}:${index + 1} is not JSON, so it is left out`)
      }
    })
  }
  return entries
}

// What makes an item one: an issue is created once and a pull request merges once, but an issue reopened and closed again
// is closed twice
const keys = {
  created: (item) => `created:${item.number}`,
  closed: (item) => `closed:${item.number}:${item.closedAt}`,
  merged: (item) => `merged:${item.number}`
}

/**
 * Execute GraphQL query
 * @param {string} query - GraphQL query
 * @param {object} variables - Query variables
 * @returns {Promise<object>} Response data
 */
async function graphqlQuery(query, variables = {}) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables })
  })
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
  }
  
  const json = await response.json()
  
  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`)
  }
  
  return json.data
}

/**
 * Every page of a connection, 100 nodes a page, until its last page, or until a page whose last node ends the nodes that
 * count (the connection's order makes every later node end them too)
 * @param {string} query - GraphQL query that takes $after and selects pageInfo
 * @param {object} variables - Query variables besides $after
 * @param {Function} connectionOf - The connection in the response data
 * @param {Function} pastTheSpan - Whether a node, and every one after it, falls before the span
 * @returns {Promise<Array>} Nodes
 */
async function everyPage(query, variables, connectionOf, pastTheSpan = () => false) {
  const nodes = []
  let after = null
  for (;;) {
    const connection = connectionOf(await graphqlQuery(query, { ...variables, after }))
    nodes.push(...connection.nodes)
    const last = connection.nodes[connection.nodes.length - 1]
    if (!connection.pageInfo.hasNextPage || last === undefined || pastTheSpan(last)) return nodes
    after = connection.pageInfo.endCursor
  }
}

// Whether a time GitHub gives falls in the span
const within = (time, span) => {
  const at = Date.parse(time ?? '')
  return at >= span.since && at < span.until
}

/**
 * Fetch issues created in the span. GitHub's `since` filter lists the issues updated at or after the date
 * (IssueFilters.since), so the query narrows the list to those, newest first, and the issues created outside the span are
 * dropped here.
 * @param {{since: number, until: number}} span - The span
 * @returns {Promise<Array>} Issues
 */
async function fetchCreatedIssues(span) {
  const query = `
    query($owner: String!, $name: String!, $since: DateTime!, $after: String) {
      repository(owner: $owner, name: $name) {
        issues(first: 100, after: $after, filterBy: { since: $since }, orderBy: { field: CREATED_AT, direction: DESC }) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            number
            title
            url
            createdAt
            author {
              login
            }
            labels(first: 10) {
              nodes {
                name
              }
            }
          }
        }
      }
    }
  `
  
  const nodes = await everyPage(
    query,
    { owner: REPO_OWNER, name: REPO_NAME, since: `${dayOf(span.since)}T00:00:00Z` },
    (data) => data.repository.issues,
    (issue) => Date.parse(issue.createdAt) < span.since
  )
  
  return nodes
    .filter(issue => within(issue.createdAt, span))
    .map(issue => ({
      number: issue.number,
      title: issue.title,
      url: issue.url,
      createdAt: issue.createdAt,
      author: issue.author?.login || 'ghost',
      labels: issue.labels.nodes.map(l => l.name)
    }))
}

/**
 * Fetch issues closed in the span: closing one updates it, so every page of the issues updated since the first day holds
 * them
 * @param {{since: number, until: number}} span - The span
 * @returns {Promise<Array>} Issues
 */
async function fetchClosedIssues(span) {
  const query = `
    query($owner: String!, $name: String!, $since: DateTime!, $after: String) {
      repository(owner: $owner, name: $name) {
        issues(first: 100, after: $after, states: CLOSED, filterBy: { since: $since }, orderBy: { field: UPDATED_AT, direction: DESC }) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            number
            title
            url
            closedAt
            author {
              login
            }
            labels(first: 10) {
              nodes {
                name
              }
            }
          }
        }
      }
    }
  `
  
  const nodes = await everyPage(
    query,
    { owner: REPO_OWNER, name: REPO_NAME, since: `${dayOf(span.since)}T00:00:00Z` },
    (data) => data.repository.issues
  )
  
  return nodes
    .filter(issue => within(issue.closedAt, span))
    .map(issue => ({
      number: issue.number,
      title: issue.title,
      url: issue.url,
      closedAt: issue.closedAt,
      author: issue.author?.login || 'ghost',
      labels: issue.labels.nodes.map(l => l.name)
    }))
}

/**
 * Fetch PRs merged in the span. The pullRequests connection takes no date argument, so the query asks for the merged pull
 * requests most recently updated first and the span is applied here; a pull request is updated when it merges, so the
 * pages stop at one whose last pull request was updated before the first day. GitHub refuses an operation that declares a
 * variable it does not use ("Variable $since is declared by anonymous query but not used"), so this query declares no
 * $since.
 * @param {{since: number, until: number}} span - The span
 * @returns {Promise<Array>} PRs
 */
async function fetchMergedPRs(span) {
  const query = `
    query($owner: String!, $name: String!, $after: String) {
      repository(owner: $owner, name: $name) {
        pullRequests(first: 100, after: $after, states: MERGED, orderBy: { field: UPDATED_AT, direction: DESC }) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            number
            title
            url
            mergedAt
            updatedAt
            author {
              login
            }
            labels(first: 10) {
              nodes {
                name
              }
            }
          }
        }
      }
    }
  `
  
  const nodes = await everyPage(
    query,
    { owner: REPO_OWNER, name: REPO_NAME },
    (data) => data.repository.pullRequests,
    (pr) => Date.parse(pr.updatedAt) < span.since
  )
  
  return nodes
    .filter(pr => within(pr.mergedAt, span))
    .map(pr => ({
      number: pr.number,
      title: pr.title,
      url: pr.url,
      mergedAt: pr.mergedAt,
      author: pr.author?.login || 'ghost',
      labels: pr.labels.nodes.map(l => l.name)
    }))
}

/**
 * Append activity entry to monthly JSONL file
 * @param {{since: number, until: number}} span - The span
 * @param {object} activity - Activity data
 * @param {string} outputDir - Output directory
 * @returns {boolean} True if new entry was added
 */
function appendActivity(span, activity, outputDir) {
  const date = dayOf(span.since)
  const data = {
    type: 'github_activity',
    date,
    until: dayOf(span.until),
    repository: `${REPO_OWNER}/${REPO_NAME}`,
    summary: {
      issuesCreated: activity.created.length,
      issuesClosed: activity.closed.length,
      prsMerged: activity.merged.length,
      total: activity.created.length + activity.closed.length + activity.merged.length
    },
    created: activity.created,
    closed: activity.closed,
    merged: activity.merged
  }
  
  // Skip if no activity
  if (data.summary.total === 0) {
    console.log(`⏭️  Skipping ${date} to ${dayOf(span.until - DAY)} (no activity not yet recorded)`)
    return false
  }
  
  // Append as single line
  fs.mkdirSync(outputDir, { recursive: true })
  fs.appendFileSync(path.join(outputDir, `${date.substring(0, 7)}.jsonl`), JSON.stringify(data) + '\n')
  console.log(`✅ Appended activity for ${date} to ${dayOf(span.until - DAY)}`)
  console.log(`   Created: ${data.summary.issuesCreated}, Closed: ${data.summary.issuesClosed}, Merged: ${data.summary.prsMerged}`)
  
  return true
}

// Main execution
console.log('🔍 Fetching GitHub activity (JSONL format)...\n')
console.log(`Repository: ${REPO_OWNER}/${REPO_NAME}`)

const until = startOf('--until', option('--until') ?? dayOf(Date.now()))
const history = readHistory(outputDir).filter((entry) => entry && entry.type === 'github_activity')
const ends = history.map((entry) => entry.until).filter((day) => typeof day === 'string').sort()
const since = option('--since') !== undefined
  ? startOf('--since', option('--since'))
  : ends.length > 0
    ? startOf('the end of the last recorded span', ends[ends.length - 1])
    : until - 7 * DAY
const span = { since, until }

if (since >= until) {
  console.log(`\nNothing to record: the activity before ${dayOf(until)} is recorded.`)
  process.exit(0)
}

console.log(`Span: ${dayOf(since)} to ${dayOf(until - DAY)}, in UTC\n`)

try {
  const [created, closed, merged] = await Promise.all([
    fetchCreatedIssues(span),
    fetchClosedIssues(span),
    fetchMergedPRs(span)
  ])
  
  // Leave out what an earlier line holds
  const held = new Set(
    history.flatMap((entry) =>
      Object.entries(keys).flatMap(([kind, key]) => (Array.isArray(entry[kind]) ? entry[kind].map(key) : []))
    )
  )
  const fresh = (kind, items) => items.filter((item) => !held.has(keys[kind](item)))
  const activity = { created: fresh('created', created), closed: fresh('closed', closed), merged: fresh('merged', merged) }
  
  const added = appendActivity(span, activity, outputDir)
  
  if (added) {
    console.log(`\n✨ Done! Activity appended to ${outputDir}`)
  } else {
    console.log(`\n✨ No new activity to record`)
  }
} catch (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}
