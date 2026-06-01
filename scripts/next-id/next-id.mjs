#!/usr/bin/env node
// next-id.mjs — Gera o próximo ID sequencial para uma nova tarefa
// Veja SPEC.md para documentação completa

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KARMA_ROOT = join(__dirname, '..', '..', '..');
const METTRI_TASKS = join(KARMA_ROOT, '.mettri', 'tarefas');
const KARMA_TASKS = join(KARMA_ROOT, '.karma', 'tarefas');

// Parse --parent argument
const parentIndex = process.argv.indexOf('--parent');
const parentId = parentIndex !== -1 ? process.argv[parentIndex + 1] : null;

function extractRootId(id) {
  const match = id.match(/^T-(\d{3})$/);
  return match ? parseInt(match[1], 10) : null;
}

function extractSubtarefaNumber(id, parent) {
  const match = id.match(new RegExp(`^${parent}\\.(\\d+)$`));
  return match ? parseInt(match[1], 10) : null;
}

function parseIdsFromDir(baseDir) {
  const ids = [];
  if (!existsSync(baseDir)) return ids;

  let entries;
  try {
    entries = readdirSync(baseDir, { withFileTypes: true });
  } catch {
    return ids;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const specPath = join(baseDir, entry.name, 'SPEC.md');
    if (!existsSync(specPath)) continue;

    const content = readFileSync(specPath, 'utf-8');
    const idMatch = content.match(/^id:\s*"?([^"\s]+)"?\s*$/m);
    if (!idMatch) continue;

    // Try frontmatter-style or inline
    const altMatch = content.match(/id:\s*"?([^"\s]+)"?\s*/);
    const rawId = idMatch[1] || (altMatch ? altMatch[1] : null);
    if (!rawId) continue;
    ids.push(rawId.trim());
  }
  return ids;
}

function parseIdsFromGlob(baseDir) {
  const ids = [];
  if (!existsSync(baseDir)) return ids;

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === 'SPEC.md') {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          // Match YAML frontmatter: id: "T-XXX" or id: T-XXX
          const lines = content.split('\n');
          let inFrontmatter = false;
          let id = null;
          for (const line of lines) {
            if (line.trim() === '---') {
              inFrontmatter = !inFrontmatter;
              continue;
            }
            if (inFrontmatter) {
              const m = line.match(/^id:\s*"?([^"\s]+)"?\s*$/);
              if (m) { id = m[1]; break; }
            }
          }
          if (id) ids.push(id.trim());
        } catch {
          // skip unreadable
        }
      }
    }
  }
  walk(baseDir);
  return ids;
}

function getAllIds() {
  const ids = [];

  // .mettri/tarefas/pendentes/*/SPEC.md
  for (const status of ['pendentes', 'em-andamento', 'concluidas']) {
    ids.push(...parseIdsFromDir(join(METTRI_TASKS, status)));
  }

  // .karma/tarefas/**/SPEC.md (legacy)
  ids.push(...parseIdsFromGlob(KARMA_TASKS));

  return ids;
}

function main() {
  const allIds = getAllIds();

  if (parentId) {
    // Subtarefa mode
    let maxSub = 0;
    for (const id of allIds) {
      const subNum = extractSubtarefaNumber(id, parentId);
      if (subNum !== null && subNum > maxSub) {
        maxSub = subNum;
      }
    }
    const nextSub = maxSub + 1;
    console.log(`${parentId}.${nextSub}`);
  } else {
    // Root ID mode
    let maxRoot = 0;
    for (const id of allIds) {
      const rootNum = extractRootId(id);
      if (rootNum !== null && rootNum > maxRoot) {
        maxRoot = rootNum;
      }
    }
    const nextRoot = maxRoot + 1;
    console.log(`T-${String(nextRoot).padStart(3, '0')}`);
  }
}

main();
