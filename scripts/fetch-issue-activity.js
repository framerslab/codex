#!/usr/bin/env node
/**
 * Fetch GitHub issue and PR activity via GraphQL API (append-only JSONL format)
 * Appends to monthly JSONL files with created/closed/merged items
 * 
 * Format: One JSON object per line (JSONL)
 * File: codex-history/YYYY-MM.jsonl (same file as git changelog)
 * 
 * Usage:
 *   GH_PAT=ghp_xxx node scripts/fetch-issue-activity.js [--since YYYY-MM-DD] [--output-dir path]
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

if (!GITHUB_TOKEN) {
  console.error('❌ Error: GH_PAT environment variable not set')
  console.error('   Set it with: export GH_PAT=ghp_xxxxx')
  process.exit(1)
}

// Parse CLI args
const args = process.argv.slice(2)
const sinceIndex = args.indexOf('--since')
const outputDirIndex = args.indexOf('--output-dir')

const sinceDate = sinceIndex >= 0 ? args[sinceIndex + 1] : getYesterday()
const outputDir = outputDirIndex >= 0 
  ? path.resolve(args[outputDirIndex + 1])
  : path.resolve(__dirname, '../codex-history')

// Ensure output directory exists
fs.mkdirSync(outputDir, { recursive: true })

/**
 * Get yesterday's date in ISO format
 * @returns {string} YYYY-MM-DD
 */
function getYesterday() {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return date.toISOString().split('T')[0]
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
 * Fetch issues created since a date
 * @param {string} since - ISO date string
 * @returns {Promise<Array>} Issues
 */
async function fetchCreatedIssues(since) {
  const query = `
    query($owner: String!, $name: String!, $since: DateTime!) {
      repository(owner: $owner, name: $name) {
        issues(first: 100, filterBy: { since: $since }, orderBy: { field: CREATED_AT, direction: DESC }) {
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
  
  const data = await graphqlQuery(query, {
    owner: REPO_OWNER,
    name: REPO_NAME,
    since: `${since}T00:00:00Z`
  })
  
  return data.repository.issues.nodes.map(issue => ({
    number: issue.number,
    title: issue.title,
    url: issue.url,
    createdAt: issue.createdAt,
    author: issue.author?.login || 'ghost',
    labels: issue.labels.nodes.map(l => l.name)
  }))
}

/**
 * Fetch issues closed since a date
 * @param {string} since - ISO date string
 * @returns {Promise<Array>} Issues
 */
async function fetchClosedIssues(since) {
  const query = `
    query($owner: String!, $name: String!, $since: DateTime!) {
      repository(owner: $owner, name: $name) {
        issues(first: 100, states: CLOSED, filterBy: { since: $since }, orderBy: { field: UPDATED_AT, direction: DESC }) {
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
  
  const data = await graphqlQuery(query, {
    owner: REPO_OWNER,
    name: REPO_NAME,
    since: `${since}T00:00:00Z`
  })
  
  // Filter to only issues closed on or after the since date
  return data.repository.issues.nodes
    .filter(issue => issue.closedAt && issue.closedAt >= `${since}T00:00:00Z`)
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
 * Fetch PRs merged since a date
 * @param {string} since - ISO date string
 * @returns {Promise<Array>} PRs
 */
async function fetchMergedPRs(since) {
  const query = `
    query($owner: String!, $name: String!, $since: DateTime!) {
      repository(owner: $owner, name: $name) {
        pullRequests(first: 100, states: MERGED, orderBy: { field: UPDATED_AT, direction: DESC }) {
          nodes {
            number
            title
            url
            mergedAt
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
  
  const data = await graphqlQuery(query, {
    owner: REPO_OWNER,
    name: REPO_NAME,
    since: `${since}T00:00:00Z`
  })
  
  // Filter to only PRs merged on or after the since date
  return data.repository.pullRequests.nodes
    .filter(pr => pr.mergedAt && pr.mergedAt >= `${since}T00:00:00Z`)
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
 * @param {string} date - ISO date string
 * @param {object} activity - Activity data
 * @param {string} outputDir - Output directory
 * @returns {boolean} True if new entry was added
 */
function appendActivity(date, activity, outputDir) {
  const month = date.substring(0, 7) // YYYY-MM
  const filename = `${month}.jsonl`
  const filepath = path.join(outputDir, filename)
  
  // Check if this date already has activity recorded
  if (fs.existsSync(filepath)) {
    const lines = fs.readFileSync(filepath, 'utf-8').trim().split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const entry = JSON.parse(line)
        if (entry.date === date && entry.type === 'github_activity') {
          console.log(`⏭️  Skipping ${date} (activity already exists)`)
          return false
        }
      } catch (e) {
        // Skip malformed lines
      }
    }
  }
  
  const data = {
    type: 'github_activity',
    date,
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
    console.log(`⏭️  Skipping ${date} (no activity)`)
    return false
  }
  
  // Append as single line
  fs.appendFileSync(filepath, JSON.stringify(data) + '\n')
  console.log(`✅ Appended activity for ${date}`)
  console.log(`   Created: ${data.summary.issuesCreated}, Closed: ${data.summary.issuesClosed}, Merged: ${data.summary.prsMerged}`)
  
  return true
}

// Main execution
console.log('🔍 Fetching GitHub activity (JSONL format)...\n')
console.log(`Repository: ${REPO_OWNER}/${REPO_NAME}`)
console.log(`Since: ${sinceDate}\n`)

try {
  const [created, closed, merged] = await Promise.all([
    fetchCreatedIssues(sinceDate),
    fetchClosedIssues(sinceDate),
    fetchMergedPRs(sinceDate)
  ])
  
  const activity = { created, closed, merged }
  
  const added = appendActivity(sinceDate, activity, outputDir)
  
  if (added) {
    console.log(`\n✨ Done! Activity appended to ${outputDir}`)
  } else {
    console.log(`\n✨ No new activity to record`)
  }
} catch (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

