#!/usr/bin/env node
/**
 * Generate changelog from git commits (append-only JSONL format)
 * Records the commits that reached master, one line for each day, in monthly JSONL files
 *
 * Format: One JSON object per line (JSONL)
 * File: codex-history/YYYY-MM.jsonl
 *
 * A commit reaches master with the first-parent commit that brings it: a merge commit brings the commits of the branch it
 * merges, any other commit brings itself. Each line is the day, in UTC, that first-parent commit was made (its committer
 * date), so a pull request's commits are recorded on the day it merged, whenever they were written. Only complete days are
 * recorded, up to the day before --until, and a day already recorded is skipped, so a later run never changes a day.
 *
 * Usage:
 *   node scripts/generate-changelog.js [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--output-dir path]
 *
 *   --until  the first day not recorded (default: today, in UTC)
 *   --since  the first day recorded (default: the day after the last day of commits recorded, or seven days before
 *            --until when none is recorded)
 *
 * Run it from the repository's root: it reads the history of the commit checked out.
 */

import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DAY = 24 * 60 * 60 * 1000

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

// A day of commits, as opposed to a line of GitHub activity
const isCommitDay = (entry) => entry && entry.type === undefined && typeof entry.date === 'string' && Array.isArray(entry.commits)

/**
 * Parse a conventional commit message
 * @param {string} message - Full commit message
 * @returns {object} Parsed commit
 */
function parseCommit(message) {
  const lines = message.split('\n')
  const firstLine = lines[0]
  
  // Match: type(scope): description
  const match = firstLine.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/)
  
  if (match) {
    return {
      type: match[1],
      scope: match[2] || null,
      description: match[3],
      body: lines.slice(1).join('\n').trim() || null
    }
  }
  
  // Fallback for non-conventional commits
  return {
    type: 'other',
    scope: null,
    description: firstLine,
    body: lines.slice(1).join('\n').trim() || null
  }
}

// git's output; a git that fails stops the run, so nothing is recorded from a history it could not read
const git = (...argv) => execFileSync('git', argv, { encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 })

/**
 * Fields of git log -z output: each field ends with a NUL, which no commit message, name or date holds, so a message of
 * several lines stays whole
 * @param {string} output - The output
 * @param {number} width - Fields for each commit
 * @returns {Array<Array<string>>} One array of fields for each commit
 */
function records(output, width) {
  const fields = output.split('\0')
  const rows = []
  for (let at = 0; at + width <= fields.length - 1; at += width) {
    rows.push(fields.slice(at, at + width))
  }
  return rows
}

/**
 * The first-parent commits of the commit checked out, newest first
 * @returns {Array<{sha: string, parents: Array<string>, landed: number}>} Each one's parents and committer date
 */
function mainline() {
  return records(git('log', '--first-parent', '-z', '--format=%H%x00%P%x00%cI', 'HEAD'), 3).map(([sha, parents, date]) => ({
    sha,
    parents: parents.split(' ').filter(Boolean),
    landed: Date.parse(date)
  }))
}

/**
 * The commits a first-parent commit brought to master, newest first: a merge commit's branch, without merge commits, or
 * the commit itself
 * @param {{sha: string, parents: Array<string>}} first - The first-parent commit
 * @returns {Array} Commit objects
 */
function broughtBy(first) {
  const range = first.parents.length > 1 ? [`${first.sha}^1..${first.sha}`] : ['-n', '1', first.sha]
  const output = git('log', '--no-merges', '-z', '--format=%H%x00%an%x00%ae%x00%aI%x00%B', ...range)
  return records(output, 5).map(([sha, author, email, date, message]) => ({
    sha: sha.substring(0, 7),
    fullSha: sha,
    author,
    email,
    date,
    url: `https://github.com/framerslab/codex/commit/${sha}`,
    ...parseCommit(message.replace(/\n+$/, ''))
  }))
}

/**
 * Append changelog entries to monthly JSONL file
 * @param {string} date - YYYY-MM-DD
 * @param {Array} commits - The commits that reached master that day
 * @param {string} outputDir - Output directory
 */
function appendDay(date, commits, outputDir) {
  // Group by type
  const byType = {}
  for (const commit of commits) {
    if (!byType[commit.type]) {
      byType[commit.type] = []
    }
    byType[commit.type].push(commit)
  }

  const entry = {
    date,
    totalCommits: commits.length,
    byType,
    commits
  }

  // Append as single line
  fs.appendFileSync(path.join(outputDir, `${date.substring(0, 7)}.jsonl`), JSON.stringify(entry) + '\n')
  console.log(`✅ Appended ${commits.length} commits for ${date}`)
}

// Main execution
console.log('📝 Generating changelog (JSONL format)...\n')

const until = startOf('--until', option('--until') ?? dayOf(Date.now()))
const history = readHistory(outputDir)
const recorded = new Set(history.filter(isCommitDay).map((entry) => entry.date))
const lastDay = [...recorded].sort().pop()
const since = option('--since') !== undefined
  ? startOf('--since', option('--since'))
  : lastDay !== undefined
    ? startOf('the last day recorded', lastDay) + DAY
    : until - 7 * DAY

if (since >= until) {
  console.log(`Nothing to record: every day before ${dayOf(until)} is recorded.`)
  process.exit(0)
}

console.log(`Recording the commits that reached master from ${dayOf(since)} to ${dayOf(until - DAY)}, in UTC\n`)

// The commits each day brought, by the day, in UTC
const days = new Map()
for (const first of mainline()) {
  if (!(first.landed >= since && first.landed < until)) continue
  const day = dayOf(first.landed)
  if (!days.has(day)) days.set(day, [])
  days.get(day).push(...broughtBy(first))
}

fs.mkdirSync(outputDir, { recursive: true })

let totalNew = 0
for (const day of [...days.keys()].sort()) {
  if (recorded.has(day)) {
    console.log(`⏭️  Skipping ${day} (already exists)`)
    continue
  }
  const commits = days.get(day)
  if (commits.length === 0) continue
  appendDay(day, commits, outputDir)
  totalNew++
}

if (totalNew === 0) {
  console.log('\n✨ No new entries (no commits reached master on a day not yet recorded)')
} else {
  console.log(`\n✨ Done! Added ${totalNew} new entries to ${outputDir}`)
}
