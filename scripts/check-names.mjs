#!/usr/bin/env node
/**
 * check-names.mjs: the rename guard. Stored names stay; public names go. The same file lives in every renamed repository
 * as scripts/check-names.mjs.
 *
 *   node scripts/check-names.mjs [<scope dir>]       scope defaults to the repository root (the monorepo passes packages/codex-viewer)
 *
 * Reads, relative to the scope:
 *   rename/protected-identifiers.txt   one exact identifier per line (stored names: tables, columns, storage keys, stored values); exempt by exact match
 *   rename/use-sites.txt               path:line:identifier, one per line: where each stored name is used (see "Use sites" below)
 *   rename/public-allowlist.txt        path prefixes where the old names may stay (the README's migration section, the deprecation notice, rename/)
 * Scans only `git ls-files` under the scope. Patterns: openstrand (any case); the word strand/strands; CamelCase Strand identifiers
 * (never the strand inside openstrand).
 *
 * RENAME_DONE=1: a line fails when it carries a pattern and the classification would call it public (scripts/rename/classify.py,
 * Task 2: prose files, and in code the URL, package and product names, quoted strings and JSX text). Code lines (identifiers,
 * comments), private lines (stored names), test, generated and history files stay out, as do the allowlisted paths, protected
 * identifiers, and a line that carries `rename-guard: keep` (a public line that keeps an old name on purpose, such as a migration
 * note). A path fails when it carries openstrand; the word strand in a path is the stored layout (looms/, strands/) or a route kept
 * as an alias, so paths are not held to it.
 *
 * Use sites: a bare word (strand, strands, openstrand) counts only as a quoted literal ('strand', "strand", `strand`), any other
 * identifier only as a whole token. A row passes on its recorded line. When edits elsewhere in the file moved that line, the row passes
 * on the nearest line that holds the identifier in the same form and is not matched to another row; moved rows are listed so they can
 * be re-recorded. A row fails when no such line is left: the stored name was renamed, or the code using it was removed. With
 * RENAME_STRICT=1 a moved row fails too: set it for a rename sweep, after re-recording the rows against the sweep's parent commit.
 * Prints every offending path:line and exits 1. Never edits anything.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, resolve, relative } from 'node:path';

const scope = resolve(process.argv[2] ?? '.');
const renameDone = process.env.RENAME_DONE === '1';
const strict = process.env.RENAME_STRICT === '1';
const lines = (p) => (existsSync(p) ? readFileSync(p, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : []);
const protectedIds = lines(join(scope, 'rename/protected-identifiers.txt'));
const useSites = [...new Set(lines(join(scope, 'rename/use-sites.txt')))];
const allow = lines(join(scope, 'rename/public-allowlist.txt'));
const PATTERNS = [
  ['openstrand', /openstrand/gi],
  ['strand_word', /(?<![A-Za-z])strands?(?![A-Za-z])/gi],
  ['strand_ident', /(?<![A-Za-z])(?:[a-z][A-Za-z0-9]*Strand[A-Za-z0-9]*|[Ss]trand[A-Z][A-Za-z0-9]*)/g],
];
// The classification's rules (scripts/rename/classify.py), so RENAME_DONE demands exactly what Task 2 called public.
const PRIVATE_HINTS = [
  /indexedDB\.open\(|localStorage\.(get|set|remove)Item\(|sessionStorage\.|openDB\(/i,
  /CREATE TABLE|ALTER TABLE|\btable\b\s*[:=]|\.table\(|tableName/i,
  /backup[-_ ]?file|\.backup|backup-\$\{|export.*filename/i,
  /\bstorageKey\w*|\bSTORAGE_KEY\w*|\bDB_NAME\b|\bdbName\b|STORE_NAME|objectStore/i,
  /\bstrandPaths\b|\bstrandIds?\b\s*[:=]|\bstrandId\b|\bstrand_id\b|\bstrand_ids\b/,
  /["'](strand|openstrand)["']\s*[,:}\]]|level\s*[:=]\s*["']strand["']|type\s*[:=]\s*["']strand["']/,
];
const PUBLIC_HINTS = [
  /@framers\/openstrand|framers(ai|lab)\/openstrand|openstrand\.ai|openstrand-(sdk|app|admin|teams-backend|monorepo|plugins)/i,
  /\/api\/strands|['"`]\/strands\/|['"`]strands\/|weaves\/[\w-]+\/openstrand|looms\/openstrand|\/strands\/\[/i,
  />[^<]*\b(open)?strands?\b[^<]*<|\b(label|title|name|description|placeholder|heading|tooltip|aria-label)\s*[:=]\s*['"`][^'"`]*\b(open)?strands?\b/i,
  /['"`][^'"`]*\b(open)?strands?\b[^'"`]*['"`]/i,
];
const GENERATED_FILES = /(^|\/)(index\.json|codex-(report|search|blocks|index|embeddings)\.json|.*\.sqlite3|.*\.db|.*\.tsbuildinfo|db_data\/|android\/app\/src\/main\/assets\/public\/|ios\/App\/App\/public\/|_next\/|\.next\/|out\/)/;
const HISTORY_FILES = /(^|\/)(CHANGELOG\.md|docs\/archive\/|.*build-errors\.txt)/;
const TEST_FILES = /(^|\/)(__tests__\/|tests?\/|.*\.test\.[jt]sx?$|.*\.spec\.[jt]sx?$)/;
const I18N_FILES = /(^|\/)(i18n|locales)\/.*\.json$/;
const PROSE_EXT = new Set(['.md', '.mdx', '.txt', '.html', '.rst', '.webmanifest']);
const KEEP = 'rename-guard: keep';
// a test file's public rows are code in the classification; generated and history files are never renamed
const outOfScope = (rel) => HISTORY_FILES.test(rel) || GENERATED_FILES.test(rel) || TEST_FILES.test(rel);
const isPublicLine = (rel, line) => {
  if (I18N_FILES.test(rel)) return true;
  if (PRIVATE_HINTS.some((h) => h.test(line))) return false;
  if (PROSE_EXT.has(extname(rel).toLowerCase()) || ['docs/', 'weaves/', 'README'].some((p) => rel.startsWith(p))) return true;
  return PUBLIC_HINTS.some((h) => h.test(line));
};
const BINARY = /\.(png|jpe?g|gif|webp|svg|ico|pdf|woff2?|ttf|otf|zip|gz|sqlite3?|db|mp[34]|wav|webm)$/i;
const files = execFileSync('git', ['ls-files', '-z'], { cwd: scope }).toString().split('\0').filter(Boolean);
const problems = [];
const moved = [];

// 1. Every protected identifier is still used where it was recorded (a renamed stored name with its old spelling left elsewhere is the failure this catches).
const BARE = /^(open)?strands?$/i;
const forms = new Map();
const formOf = (id) => {
  if (!forms.has(id)) {
    const e = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // a boundary applies only at an edge that is itself a word character, so a prefix such as `openstrand-backup-` still
    // matches inside `openstrand-backup-${date}`
    const before = /^[A-Za-z0-9_$]/.test(id) ? '(?<![A-Za-z0-9_$-])' : '';
    const after = /[A-Za-z0-9_$]$/.test(id) ? '(?![A-Za-z0-9_$-])' : '';
    forms.set(id, BARE.test(id) ? new RegExp(`(?<=["'\`])${e}(?=["'\`])`) : new RegExp(`${before}${e}${after}`));
  }
  return forms.get(id);
};
const byFile = new Map();
for (const site of useSites) {
  const m = site.match(/^(.*):(\d+):(.+)$/);
  if (!m) { problems.push(`unreadable use site: ${site}`); continue; }
  const [, rel, line, id] = m;
  if (!byFile.has(rel)) byFile.set(rel, []);
  byFile.get(rel).push({ line: Number(line), id });
}
for (const [rel, rows] of byFile) {
  const full = join(scope, rel);
  if (!existsSync(full)) { for (const r of rows) problems.push(`${rel}:${r.line}: use site file is gone (protected identifier ${r.id})`); continue; }
  const text = readFileSync(full, 'utf8').split('\n');
  const holds = (n, id) => n >= 1 && n <= text.length && formOf(id).test(text[n - 1]);
  const taken = new Set();
  const pending = [];
  for (const r of rows) {
    if (holds(r.line, r.id)) taken.add(`${r.line}:${r.id}`);
    else pending.push(r);
  }
  for (const r of pending) {
    let best = 0;
    for (let n = 1; n <= text.length; n++) {
      if (taken.has(`${n}:${r.id}`) || !holds(n, r.id)) continue;
      if (!best || Math.abs(n - r.line) < Math.abs(best - r.line)) best = n;
    }
    if (!best) problems.push(`${rel}:${r.line}: protected identifier ${r.id} is gone from the file (a stored name was renamed, or the code using it was removed: restore it, or delete its row from rename/use-sites.txt in the same commit)`);
    else { taken.add(`${best}:${r.id}`); moved.push(`${rel}:${r.line} -> ${best} (${r.id})`); }
  }
}
if (strict) for (const m of moved) problems.push(`${m}: use site moved (RENAME_STRICT=1: re-record the row)`);

// 2. With RENAME_DONE=1, no public occurrence of the old names outside the allowlist, in contents or in file and directory names.
if (renameDone) {
  const exempt = (s) => protectedIds.some((id) => s === id);
  for (const rel of files) {
    if (allow.some((a) => rel.startsWith(a))) continue;
    if (rel.startsWith('rename/') || rel.endsWith('check-names.mjs') || rel.endsWith('check-names.test.mjs')) continue;
    if (outOfScope(rel)) continue;
    const named = rel.match(/openstrand/i);
    if (named) problems.push(`${rel}: file or directory name carries the old word (${named[0]})`);
    if (BINARY.test(rel)) continue;
    let text; try { text = readFileSync(join(scope, rel), 'utf8'); } catch { continue; }
    if (text.includes('\u0000')) continue;
    text.split('\n').forEach((lineText, i) => {
      if (lineText.includes(KEEP) || !isPublicLine(rel, lineText)) return;
      for (const [name, re] of PATTERNS) {
        re.lastIndex = 0;
        for (const hit of lineText.matchAll(re)) {
          if (name === 'strand_ident' && /openstrand/i.test(hit[0])) continue;
          // an occurrence inside a protected identifier is exempt by exact token: expand to the full token around the hit
          const start = hit.index, end = start + hit[0].length;
          let a = start, b = end;
          // the token is the identifier around the hit: member access (row.strand_paths), object keys (strand_path:) and
          // template expressions (openstrand-backup-${date}) end it
          while (a > 0 && /[A-Za-z0-9_\-]/.test(lineText[a - 1])) a--;
          while (b < lineText.length && /[A-Za-z0-9_\-]/.test(lineText[b])) b++;
          const token = lineText.slice(a, b);
          const quoted = a > 0 && /["'`]/.test(lineText[a - 1]) && b < lineText.length && /["'`]/.test(lineText[b]);
          const bare = /^(open)?strands?$/i.test(token);
          // a bare word (strand, strands, openstrand) is a protected stored value only as a quoted literal; any other protected identifier is exempt by its exact token
          if ((exempt(token) && (!bare || quoted)) || (exempt(hit[0]) && !bare)) continue;
          problems.push(`${rel}:${i + 1}: public occurrence remains (${hit[0]})`);
          break;
        }
      }
    });
  }
}

for (const m of moved) console.log(`moved use site: ${m}`);
if (problems.length) {
  for (const p of problems) console.error(p);
  console.error(`check-names: ${problems.length} problem(s) in ${relative(process.cwd(), scope) || '.'}${renameDone ? ' (RENAME_DONE=1)' : ''}${strict ? ' (RENAME_STRICT=1)' : ''}`);
  process.exit(1);
}
console.log(`check-names: ok (${files.length} tracked files, ${protectedIds.length} protected identifiers, ${useSites.length} use sites, ${moved.length} moved${renameDone ? ', RENAME_DONE=1' : ''}${strict ? ', RENAME_STRICT=1' : ''})`);
