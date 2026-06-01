#!/usr/bin/env node
//
// rename-session.mjs — Renomeia a sessão atual do OpenCode
//
// Uso: node .karma\scripts\rename-session\rename-session.mjs "T-020 — título reduzido"
//
// Acessa o SQLite do OpenCode diretamente via node:sqlite (Node 22+).
// Path do banco obtido via: opencode db path

import { execSync } from 'child_process';
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'fs';

function main() {
  const title = process.argv[2];
  if (!title) {
    console.error('Uso: node .karma\\scripts\\rename-session\\rename-session.mjs "T-XXX — título"');
    process.exit(1);
  }

  // 1. Pega path do banco
  let dbPath;
  try {
    dbPath = execSync('opencode db path', { encoding: 'utf-8', timeout: 5000 }).trim();
  } catch {
    console.error('[rename-session] opencode CLI nao disponivel');
    process.exit(1);
  }

  if (!dbPath || !dbPath.endsWith('.db') || !existsSync(dbPath)) {
    console.error(`[rename-session] Banco nao encontrado: ${dbPath}`);
    process.exit(1);
  }

  // 2. Abre banco e busca sessao mais recente do .karma
  const db = new DatabaseSync(dbPath, { readWrite: true });
  db.exec('PRAGMA journal_mode=WAL');

  const stmt = db.prepare(
    "SELECT id FROM session WHERE directory LIKE ? ORDER BY time_updated DESC LIMIT 1"
  );
  const row = stmt.get('%.karma');

  if (!row) {
    console.error('[rename-session] Nenhuma sessao encontrada para .karma');
    db.close();
    process.exit(1);
  }

  const id = row.id;
  const now = Date.now();

  // 3. Renomeia
  const updateStmt = db.prepare(
    "UPDATE session SET title = ?, time_updated = ? WHERE id = ?"
  );
  updateStmt.run(title, now, id);

  db.close();
  console.log(`[rename-session] Sessao renomeada para: "${title}"`);
}

main();
