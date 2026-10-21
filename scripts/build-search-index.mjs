#!/usr/bin/env node
/**
 * Build BM25 postings and semantic embeddings for Frame Codex search (npm run build:search).
 *
 * @remarks
 * Reads codex-index.json in the current directory and writes codex-search.json beside it; scripts/search-index.mjs
 * holds the build. This script is intended to run in CI after the auto-index step.
 */

import { buildSearchIndex } from './search-index.mjs'

buildSearchIndex().catch((error) => {
  console.error('❌ Failed to build search index:', error)
  process.exit(1)
})
