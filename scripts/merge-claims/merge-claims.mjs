#!/usr/bin/env node
// merge-claims.mjs — Manipula claims.yaml com lock de arquivo (mutex atômico)
// Uso: node merge-claims.mjs {ocupar|liberar|heartbeat|listar} [args...]

import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const CLAIMS_PATH = join(ROOT, '.mettri', 'claims.yaml');
const LOCK_DIR = join(ROOT, '.mettri', '.claims.lock');
const LOCK_TIMEOUT_MS = 5000;
const MAX_RETRIES = 20;

// ─── Node version check ───
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor < 18) {
  process.stderr.write('Error: Node.js >= 18 required\n');
  process.exit(1);
}

// ─── Lock (mutex atômico via mkdirSync) ───
function acquireLock() {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      mkdirSync(LOCK_DIR);
      return;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;

      // Lock existe — verificar se é stale
      try {
        const stats = statSync(LOCK_DIR);
        const age = Date.now() - stats.birthtimeMs;
        if (age > LOCK_TIMEOUT_MS) {
          rmSync(LOCK_DIR, { recursive: true, force: true });
          continue;
        }
      } catch {
        // Lock removido entre verificação e remoção — tentar de novo
        continue;
      }

      // Lock válido — aguardar com backoff
      const delay = Math.min(50 * Math.pow(1.5, attempt), 500);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
    }
  }

  process.stderr.write('Error: Não foi possível adquirir lock. Outro processo pode estar manipulando claims.yaml.\n');
  process.exit(1);
}

function releaseLock() {
  try {
    rmSync(LOCK_DIR, { recursive: true, force: true });
  } catch {
    // lock já foi removido — ok
  }
}

// ─── YAML I/O ───
function readClaims() {
  const content = readFileSync(CLAIMS_PATH, 'utf-8');
  return yaml.load(content);
}

function writeClaims(data) {
  const content = yaml.dump(data, {
    sortKeys: false,
    noRefs: true,
    lineWidth: -1,
  });
  writeFileSync(CLAIMS_PATH, content, 'utf-8');
}

// ─── Operações ───

function cmdOcupar(dominio, tarefaId, lockUuid) {
  const data = readClaims();

  if (!data.dominios || !data.dominios[dominio]) {
    process.stderr.write(JSON.stringify({
      ok: false, erro: `dominio '${dominio}' não encontrado`
    }) + '\n');
    process.exit(1);
  }

  const dom = data.dominios[dominio];

  if (dom.lock !== null) {
    process.stderr.write(JSON.stringify({
      ok: false,
      erro: 'dominio ocupado',
      atual: { lock: dom.lock, tarefa: dom.tarefa, lease_inicio: dom.lease_inicio }
    }) + '\n');
    process.exit(1);
  }

  const now = new Date().toISOString();
  dom.lock = lockUuid;
  dom.tarefa = tarefaId;
  dom.lease_inicio = now;
  dom.heartbeat = now;

  writeClaims(data);

  process.stdout.write(JSON.stringify({
    ok: true, acao: 'ocupar', dominio, tarefa_id: tarefaId, lock_uuid: lockUuid
  }) + '\n');
}

function cmdLiberar(dominio, lockUuid, titulo) {
  const data = readClaims();

  if (!data.dominios || !data.dominios[dominio]) {
    process.stderr.write(JSON.stringify({
      ok: false, erro: `dominio '${dominio}' não encontrado`
    }) + '\n');
    process.exit(1);
  }

  const dom = data.dominios[dominio];

  if (dom.lock !== lockUuid) {
    process.stderr.write(JSON.stringify({
      ok: false,
      erro: 'lock uuid não confere',
      esperado: dom.lock,
      recebido: lockUuid
    }) + '\n');
    process.exit(1);
  }

  // Montar entrada no histórico
  const entry = {
    id: dom.tarefa,
    titulo: titulo || null,
    dominio: dominio,
    status: 'concluido',
    iniciado_em: dom.lease_inicio,
    concluido_em: new Date().toISOString(),
    commit: null,
    merge_commit: null,
    branch: null,
    testes_passou: null,
    gate_status: null,
  };

  if (!data.historico) {
    data.historico = [];
  }
  data.historico.push(entry);

  // Limpar lock (preserva heartbeat para auditoria)
  dom.lock = null;
  dom.tarefa = null;
  dom.lease_inicio = null;

  writeClaims(data);

  process.stdout.write(JSON.stringify({
    ok: true, acao: 'liberar', dominio
  }) + '\n');
}

function cmdHeartbeat(dominio, lockUuid) {
  const data = readClaims();

  if (!data.dominios || !data.dominios[dominio]) {
    process.stderr.write(JSON.stringify({
      ok: false, erro: `dominio '${dominio}' não encontrado`
    }) + '\n');
    process.exit(1);
  }

  const dom = data.dominios[dominio];

  if (dom.lock !== lockUuid) {
    process.stderr.write(JSON.stringify({
      ok: false,
      erro: 'lock uuid não confere',
      esperado: dom.lock,
      recebido: lockUuid
    }) + '\n');
    process.exit(1);
  }

  dom.heartbeat = new Date().toISOString();

  writeClaims(data);

  process.stdout.write(JSON.stringify({
    ok: true, acao: 'heartbeat', dominio
  }) + '\n');
}

function cmdListar() {
  const data = readClaims();

  const dominios = {};
  if (data.dominios) {
    for (const [dom, info] of Object.entries(data.dominios)) {
      if (info.lock !== null) {
        dominios[dom] = {
          lock: info.lock,
          tarefa: info.tarefa,
          lease_inicio: info.lease_inicio,
          heartbeat: info.heartbeat,
        };
      } else {
        dominios[dom] = { status: 'livre' };
      }
    }
  }

  process.stdout.write(JSON.stringify({
    ok: true,
    acao: 'listar',
    dominios,
    wip_global: data.wip_global || null,
  }) + '\n');
}

// ─── Main ───
function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  switch (cmd) {
    case 'ocupar': {
      // node merge-claims.mjs ocupar <dominio> <tarefa_id> <lock_uuid>
      if (args.length < 4) {
        process.stderr.write('Error: uso: node merge-claims.mjs ocupar <dominio> <tarefa_id> <lock_uuid>\n');
        process.exit(1);
      }
      acquireLock();
      try {
        cmdOcupar(args[1], args[2], args[3]);
      } finally {
        releaseLock();
      }
      break;
    }

    case 'liberar': {
      // node merge-claims.mjs liberar <dominio> <lock_uuid> [titulo]
      if (args.length < 3) {
        process.stderr.write('Error: uso: node merge-claims.mjs liberar <dominio> <lock_uuid> [titulo]\n');
        process.exit(1);
      }
      acquireLock();
      try {
        cmdLiberar(args[1], args[2], args[3] || null);
      } finally {
        releaseLock();
      }
      break;
    }

    case 'heartbeat': {
      // node merge-claims.mjs heartbeat <dominio> <lock_uuid>
      if (args.length < 3) {
        process.stderr.write('Error: uso: node merge-claims.mjs heartbeat <dominio> <lock_uuid>\n');
        process.exit(1);
      }
      acquireLock();
      try {
        cmdHeartbeat(args[1], args[2]);
      } finally {
        releaseLock();
      }
      break;
    }

    case 'listar': {
      cmdListar();
      break;
    }

    default: {
      if (cmd) {
        process.stderr.write(`Error: comando desconhecido: '${cmd}'\n`);
      }
      process.stderr.write('Uso: node merge-claims.mjs {ocupar|liberar|heartbeat|listar} [args...]\n');
      process.exit(1);
    }
  }
}

main();
