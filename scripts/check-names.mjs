#!/usr/bin/env node
/**
 * check-names.mjs: the rename guard (plan Task 3). The same file lives in every renamed repository as scripts/check-names.mjs.
 *
 *   node scripts/check-names.mjs [<scope dir>]       scope defaults to the repository root (the monorepo passes packages/codex-viewer)
 *
 * Reads, relative to the scope:
 *   rename/protected-identifiers.txt   one exact identifier per line (stored names: tables, columns, storage keys, stored values); exempt by exact match
 *   rename/use-sites.txt               path:line:identifier, one per line; each must still contain its identifier (with RENAME_DONE unset too)
 *   rename/public-allowlist.txt        path prefixes where the old names may stay (the README's migration section, the deprecation notice, rename/)
 * Scans only `git ls-files` under the scope. Patterns: openstrand (any case); the word strand/strands; CamelCase Strand identifiers
 * (never the strand inside openstrand); also file and directory names. With RENAME_DONE=1 every public occurrence outside the allowlist fails.
 * Prints every offending path:line and exits 1. Never edits anything.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const scope = resolve(process.argv[2] ?? '.');
const renameDone = process.env.RENAME_DONE === '1';
const lines = (p) => (existsSync(p) ? readFileSync(p, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : []);
const protectedIds = lines(join(scope, 'rename/protected-identifiers.txt'));
const useSites = lines(join(scope, 'rename/use-sites.txt'));
const allow = lines(join(scope, 'rename/public-allowlist.txt'));
const PATTERNS = [
  ['openstrand', /openstrand/gi],
  ['strand_word', /(?<![A-Za-z])strands?(?![A-Za-z])/gi],
  ['strand_ident', /(?<![A-Za-z])(?:[a-z][A-Za-z0-9]*Strand[A-Za-z0-9]*|[Ss]trand[A-Z][A-Za-z0-9]*)/g],
];
const BINARY = /\.(png|jpe?g|gif|webp|svg|ico|pdf|woff2?|ttf|otf|zip|gz|sqlite3?|db|mp[34]|wav|webm)$/i;
const files = execFileSync('git', ['ls-files', '-z'], { cwd: scope }).toString().split('\0').filter(Boolean);
const problems = [];

// 1. Protected identifiers must still be present at every recorded use site (a renamed key with its old spelling elsewhere is the failure this catches).
for (const site of useSites) {
  const m = site.match(/^(.*):(\d+):(.+)$/);
  if (!m) { problems.push(`unreadable use site: ${site}`); continue; }
  const [, rel, line, id] = m;
  const full = join(scope, rel);
  if (!existsSync(full)) { problems.push(`${rel}:${line}: use site file is gone (protected identifier ${id})`); continue; }
  const text = readFileSync(full, 'utf8').split('\n')[Number(line) - 1] ?? '';
  if (!text.includes(id)) problems.push(`${rel}:${line}: protected identifier ${id} no longer at its use site`);
}

// 2. With RENAME_DONE=1, no public occurrence of the old names outside the allowlist, in contents or in file and directory names.
if (renameDone) {
  const exempt = (s) => protectedIds.some((id) => s === id);
  for (const rel of files) {
    if (allow.some((a) => rel.startsWith(a))) continue;
    if (rel.startsWith('rename/') || rel.endsWith('check-names.mjs')) continue;
    for (const [name, re] of PATTERNS) {
      re.lastIndex = 0;
      for (const hit of rel.matchAll(re)) {
        if (name === 'strand_ident' && /openstrand/i.test(hit[0])) continue;
        problems.push(`${rel}: file or directory name carries the old word (${hit[0]})`);
        break;
      }
    }
    if (BINARY.test(rel)) continue;
    let text; try { text = readFileSync(join(scope, rel), 'utf8'); } catch { continue; }
    if (text.includes('\u0000')) continue;
    text.split('\n').forEach((lineText, i) => {
      for (const [name, re] of PATTERNS) {
        re.lastIndex = 0;
        for (const hit of lineText.matchAll(re)) {
          if (name === 'strand_ident' && /openstrand/i.test(hit[0])) continue;
          // an occurrence inside a protected identifier is exempt by exact token: expand to the full token around the hit
          const start = hit.index, end = start + hit[0].length;
          let a = start, b = end;
          while (a > 0 && /[A-Za-z0-9_:.\-]/.test(lineText[a - 1])) a--;
          while (b < lineText.length && /[A-Za-z0-9_:.\-]/.test(lineText[b])) b++;
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

if (problems.length) {
  for (const p of problems) console.error(p);
  console.error(`check-names: ${problems.length} problem(s) in ${relative(process.cwd(), scope) || '.'}${renameDone ? ' (RENAME_DONE=1)' : ''}`);
  process.exit(1);
}
console.log(`check-names: ok (${files.length} tracked files, ${protectedIds.length} protected identifiers, ${useSites.length} use sites${renameDone ? ', RENAME_DONE=1' : ''})`);
