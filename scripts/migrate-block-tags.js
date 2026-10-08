#!/usr/bin/env node
/**
 * migrate-block-tags.js - One-time migration to process all existing strands
 * 
 * This script:
 * 1. Processes all strands with block-processor.js
 * 2. Generates tag suggestions with block-tagging.js
 * 3. Rebuilds all indexes
 * 4. Creates a summary report
 * 
 * Usage:
 *   node scripts/migrate-block-tags.js
 *   node scripts/migrate-block-tags.js --dry-run
 *   node scripts/migrate-block-tags.js --with-ai --max-cost 10.00
 */

import fs from 'fs'
import path from 'path'
import { execSync, spawn } from 'child_process'
import matter from 'gray-matter'

// ============================================================================
// CONFIGURATION
// ============================================================================

const ROOT = process.cwd()
const WEAVES_DIR = path.join(ROOT, 'weaves')
const REPORT_PATH = path.join(ROOT, 'migration-report.json')

// ============================================================================
// UTILITIES
// ============================================================================

function runCommand(cmd, options = {}) {
  console.log(`  $ ${cmd}`)
  try {
    const output = execSync(cmd, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    })
    return { success: true, output }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

function countFiles(dir, ext = '.md') {
  let count = 0
  const walk = (d) => {
    const entries = fs.readdirSync(d, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(d, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        count++
      }
    }
  }
  walk(dir)
  return count
}

function analyzeCurrentState() {
  const stats = {
    totalStrands: 0,
    strandsWithBlocks: 0,
    totalExistingBlocks: 0,
    totalExistingTags: 0,
    strandsToProcess: []
  }

  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dir, entry.name)
      
      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }
      
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      
      stats.totalStrands++
      
      try {
        const raw = fs.readFileSync(fullPath, 'utf8')
        const { data } = matter(raw)
        
        if (data.blocks && Array.isArray(data.blocks) && data.blocks.length > 0) {
          stats.strandsWithBlocks++
          stats.totalExistingBlocks += data.blocks.length
          for (const block of data.blocks) {
            stats.totalExistingTags += (block.tags || []).length
          }
        } else {
          stats.strandsToProcess.push(path.relative(ROOT, fullPath))
        }
      } catch (err) {
        console.warn(`  ⚠️  Error reading ${entry.name}: ${err.message}`)
      }
    }
  }

  if (fs.existsSync(WEAVES_DIR)) {
    walk(WEAVES_DIR)
  }

  return stats
}

// ============================================================================
// MAIN MIGRATION
// ============================================================================

async function migrate(options = {}) {
  const { dryRun = false, withAi = false, maxCost = 5.0 } = options
  const startTime = Date.now()

  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║           Block-Level Tags Migration Script                    ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`  Mode: ${dryRun ? 'DRY RUN (no changes)' : 'WRITE'}`)
  console.log(`  AI Enhancement: ${withAi ? `Yes (max $${maxCost})` : 'No'}`)
  console.log('')

  // Step 1: Analyze current state
  console.log('📊 Step 1: Analyzing current state...')
  const beforeStats = analyzeCurrentState()
  console.log(`   Total threads: ${beforeStats.totalStrands}`)
  console.log(`   Already processed: ${beforeStats.strandsWithBlocks}`)
  console.log(`   Existing blocks: ${beforeStats.totalExistingBlocks}`)
  console.log(`   Existing tags: ${beforeStats.totalExistingTags}`)
  console.log(`   To process: ${beforeStats.strandsToProcess.length}`)
  console.log('')

  if (beforeStats.totalStrands === 0) {
    console.log('❌ No strands found in weaves/ directory')
    return
  }

  // Step 2: Run block processor
  console.log('🔧 Step 2: Processing blocks...')
  const processCmd = `node scripts/block-processor.js --all${dryRun ? ' --dry-run' : ''}`
  const processResult = runCommand(processCmd)
  
  if (!processResult.success) {
    console.error('❌ Block processing failed')
    return
  }
  console.log('')

  // Step 3: Generate tag suggestions
  console.log('🏷️  Step 3: Generating tag suggestions...')
  const tagCmd = `node lib/block-tagging.js --all${dryRun ? ' --dry-run' : ''}`
  const tagResult = runCommand(tagCmd)
  
  if (!tagResult.success) {
    console.error('❌ Tag generation failed')
    return
  }
  console.log('')

  // Step 4: Optional AI enhancement
  if (withAi && !dryRun) {
    console.log('🤖 Step 4: Running AI enhancement...')
    const aiCmd = `node scripts/ai-enhance-blocks.js --all --max-cost ${maxCost}`
    const aiResult = runCommand(aiCmd)
    
    if (!aiResult.success) {
      console.warn('⚠️  AI enhancement had errors (continuing anyway)')
    }
    console.log('')
  } else if (withAi && dryRun) {
    console.log('🤖 Step 4: AI enhancement (skipped in dry run)')
    console.log('')
  } else {
    console.log('🤖 Step 4: AI enhancement (skipped)')
    console.log('')
  }

  // Step 5: Rebuild indexes
  if (!dryRun) {
    console.log('📚 Step 5: Rebuilding indexes...')
    const indexCmd = 'node scripts/build-index.mjs'
    const indexResult = runCommand(indexCmd)
    
    if (!indexResult.success) {
      console.error('❌ Index build failed')
      return
    }
    console.log('')
  }

  // Step 6: Analyze final state
  console.log('📊 Step 6: Analyzing final state...')
  const afterStats = dryRun ? beforeStats : analyzeCurrentState()
  
  // Generate report
  const report = {
    migrationDate: new Date().toISOString(),
    duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    dryRun,
    withAi,
    before: {
      totalStrands: beforeStats.totalStrands,
      strandsWithBlocks: beforeStats.strandsWithBlocks,
      totalBlocks: beforeStats.totalExistingBlocks,
      totalTags: beforeStats.totalExistingTags
    },
    after: {
      totalStrands: afterStats.totalStrands,
      strandsWithBlocks: afterStats.strandsWithBlocks,
      totalBlocks: afterStats.totalExistingBlocks,
      totalTags: afterStats.totalExistingTags
    },
    changes: {
      newStrandsProcessed: afterStats.strandsWithBlocks - beforeStats.strandsWithBlocks,
      newBlocks: afterStats.totalExistingBlocks - beforeStats.totalExistingBlocks,
      newTags: afterStats.totalExistingTags - beforeStats.totalExistingTags
    }
  }

  if (!dryRun) {
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
    console.log(`   Report saved: ${REPORT_PATH}`)
  }

  // Summary
  console.log('')
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║                     Migration Complete                         ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`  Duration: ${report.duration}`)
  console.log(`  Threads processed: ${report.changes.newStrandsProcessed}`)
  console.log(`  New blocks created: ${report.changes.newBlocks}`)
  console.log(`  New tags suggested: ${report.changes.newTags}`)
  console.log('')

  if (dryRun) {
    console.log('ℹ️  This was a dry run. No files were modified.')
    console.log('   Run without --dry-run to apply changes.')
  } else {
    console.log('✅ Migration complete!')
    console.log('')
    console.log('Next steps:')
    console.log('  1. Review the changes: git diff weaves/')
    console.log('  2. Commit: git add weaves/ codex-*.json && git commit -m "feat: migrate block tags"')
    console.log('  3. Push: git push')
  }
}

// ============================================================================
// CLI
// ============================================================================

function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const withAi = args.includes('--with-ai')
  
  let maxCost = 5.0
  const maxCostIdx = args.indexOf('--max-cost')
  if (maxCostIdx !== -1 && args[maxCostIdx + 1]) {
    maxCost = parseFloat(args[maxCostIdx + 1])
  }

  migrate({ dryRun, withAi, maxCost }).catch(console.error)
}

main()

