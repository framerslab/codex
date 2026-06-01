#!/usr/bin/env node
/**
 * Generate changelog from git commits (append-only JSONL format)
 * Parses conventional commits and appends to monthly JSONL files
 * 
 * Format: One JSON object per line (JSONL)
 * File: codex-history/YYYY-MM.jsonl
 * 
 * Usage:
 *   node scripts/generate-changelog.js [--since YYYY-MM-DD] [--output-dir path]
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Parse CLI args
const args = process.argv.slice(2)
const sinceIndex = args.indexOf('--since')
const outputDirIndex = args.indexOf('--output-dir')

const sinceDate = sinceIndex >= 0 ? args[sinceIndex + 1] : null
const outputDir = outputDirIndex >= 0 
  ? path.resolve(args[outputDirIndex + 1])
  : path.resolve(__dirname, '../codex-history')

// Ensure output directory exists
fs.mkdirSync(outputDir, { recursive: true })

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

/**
 * Get git log for a date range
 * @param {string|null} since - ISO date string or null for all
 * @returns {Array} Array of commit objects
 */
function getGitLog(since) {
  const sinceArg = since ? `--since="${since}"` : '--all'
  const format = '%H%x00%an%x00%ae%x00%aI%x00%s%x00%b%x00'
  
  try {
    const output = execSync(
      `git log ${sinceArg} --pretty=format:"${format}" --no-merges`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    )
    
    if (!output.trim()) return []
    
    const commits = output.trim().split('\n').map(line => {
      const [sha, author, email, date, subject, body] = line.split('\x00')
      const parsed = parseCommit(subject + (body ? '\n' + body : ''))
      
      return {
        sha: sha.substring(0, 7),
        fullSha: sha,
        author,
        email,
        date,
        url: `https://github.com/framerslab/codex/commit/${sha}`,
        ...parsed
      }
    })
    
    return commits
  } catch (error) {
    console.error('Error fetching git log:', error.message)
    return []
  }
}

/**
 * Group commits by date and month
 * @param {Array} commits - Array of commit objects
 * @returns {Object} Commits grouped by month, then date
 */
function groupByMonth(commits) {
  const grouped = {}
  
  for (const commit of commits) {
    const date = commit.date.split('T')[0] // YYYY-MM-DD
    const month = date.substring(0, 7) // YYYY-MM
    
    if (!grouped[month]) {
      grouped[month] = {}
    }
    if (!grouped[month][date]) {
      grouped[month][date] = []
    }
    grouped[month][date].push(commit)
  }
  
  return grouped
}

/**
 * Append changelog entries to monthly JSONL file
 * @param {string} month - YYYY-MM
 * @param {Object} dateGroups - Commits grouped by date
 * @param {string} outputDir - Output directory
 */
function appendToMonthlyLog(month, dateGroups, outputDir) {
  const filename = `${month}.jsonl`
  const filepath = path.join(outputDir, filename)
  
  // Read existing entries to avoid duplicates
  const existingDates = new Set()
  if (fs.existsSync(filepath)) {
    const lines = fs.readFileSync(filepath, 'utf-8').trim().split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const entry = JSON.parse(line)
        existingDates.add(entry.date)
      } catch (e) {
        // Skip malformed lines
      }
    }
  }
  
  // Append new entries (skip if date already exists)
  const dates = Object.keys(dateGroups).sort()
  let newEntries = 0
  
  for (const date of dates) {
    if (existingDates.has(date)) {
      console.log(`⏭️  Skipping ${date} (already exists)`)
      continue
    }
    
    const commits = dateGroups[date]
    
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
    fs.appendFileSync(filepath, JSON.stringify(entry) + '\n')
    console.log(`✅ Appended ${commits.length} commits for ${date}`)
    newEntries++
  }
  
  return newEntries
}

// Main execution
console.log('📝 Generating changelog (JSONL format)...\n')

const commits = getGitLog(sinceDate)

if (commits.length === 0) {
  console.log('No commits found for the specified period.')
  process.exit(0)
}

console.log(`Found ${commits.length} commits`)

const grouped = groupByMonth(commits)
const months = Object.keys(grouped).sort()

console.log(`Processing ${months.length} month(s)...\n`)

let totalNew = 0
for (const month of months) {
  const newEntries = appendToMonthlyLog(month, grouped[month], outputDir)
  totalNew += newEntries
}

if (totalNew === 0) {
  console.log('\n✨ No new entries (all dates already recorded)')
} else {
  console.log(`\n✨ Done! Added ${totalNew} new entries to ${outputDir}`)
}

