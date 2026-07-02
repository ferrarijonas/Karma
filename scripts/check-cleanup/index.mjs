#!/usr/bin/env node

/**
 * check-cleanup — Gate de limpeza pré-consolidação
 *
 * Verifica se o repositório do projeto (../) contém:
 *   1. Dados pessoais (telefones, emails, CPF, CNPJ)
 *   2. Tokens e sessões (CSRF, API keys, wa-session)
 *   3. Arquivos indevidos (currículos, snapshots WhatsApp, _temp-*)
 *   4. Branches órfãos (>7 dias sem merge)
 *
 * Uso:
 *   node .karma/scripts/check-cleanup/index.mjs <spec_path>
 *
 * Modos:
 *   --full : verifica branches órfãos + .gitignore (para Fase 5/Consolidar)
 *   (padrão): verifica só dados pessoais + tokens + arquivos indevidos (para Fase 3/gate-runner)
 *
 * Exit codes:
 *   0 — repositório limpo
 *   1 — problemas encontrados (lista em stderr)
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { join, resolve, basename } from 'path';

// ── Args ──────────────────────────────────────────────
const SPEC_ARG = process.argv[2];
const FULL_MODE = process.argv.includes('--full');

if (!SPEC_ARG) {
  console.error('[check-cleanup] Uso: node .karma/scripts/check-cleanup/index.mjs <spec_path> [--full]');
  process.exit(1);
}

// ── Caminhos ──────────────────────────────────────────
// Detecta se está rodando de dentro do .karma/ ou da raiz do projeto
const cwd = process.cwd();
const isInsideKarma = basename(cwd) === '.karma';
const KARMA_DIR = isInsideKarma ? cwd : join(cwd, '.karma');
const PROJ_DIR = isInsideKarma ? resolve(cwd, '..') : cwd;
const SPEC_PATH = resolve(SPEC_ARG);
const specFile = SPEC_PATH.endsWith('SPEC.md') ? SPEC_PATH : join(SPEC_PATH, 'SPEC.md');

// ── 1. Carregar SPEC.md ───────────────────────────────
let specContent;
try {
  specContent = readFileSync(specFile, 'utf-8');
} catch {
  console.error(`[check-cleanup] SPEC.md não encontrado: ${specFile}`);
  process.exit(1);
}

function extractFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : '';
}
const fm = extractFrontmatter(specContent);

function fmFlag(key) {
  const m = fm.match(new RegExp(`^${key}:\\s*(true|false)`, 'm'));
  return m ? m[1] === 'true' : false;
}

const permiteDados = fmFlag('cleanup_permite_dados_pessoais');
const permiteTokens = fmFlag('cleanup_permite_tokens');
const permiteTmp = fmFlag('cleanup_permite_temp_files');

// ── 2. Helpers ────────────────────────────────────────
const issues = [];

function add(cat, file, detail) {
  issues.push({ cat, file, detail });
}

function readIfExists(path) {
  try { return readFileSync(path, 'utf-8'); } catch { return ''; }
}

function listFiles(dir, maxDepth = 3) {
  const results = [];
  function walk(d, depth) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
        walk(full, depth + 1);
      } else {
        results.push(full);
      }
    }
  }
  walk(dir, 0);
  return results;
}

// ── 3. Scan de dados pessoais ─────────────────────────
function scanDadosPessoais() {
  if (permiteDados) {
    console.log('[check-cleanup] Dados pessoais permitidos pela SPEC — pulando scan');
    return;
  }

  const patterns = [
    { name: 'Telefone BR', regex: /\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g, severity: '🔴' },
    { name: 'Email pessoal', regex: /[a-zA-Z0-9._%+-]+@(?!example\.com|test\.com|noreply)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, severity: '🔴' },
    { name: 'CPF', regex: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, severity: '🔴' },
    { name: 'CNPJ', regex: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, severity: '🔴' },
  ];

  // Arquivos a IGNORAR no scan (bibliotecas, fixtures esperadas)
  const skipPatterns = [
    /node_modules/, /\.git/, /dist/, /\.test\./, /\.spec\./,
    /package-lock\.json/, /pnpm-lock/, /yarn\.lock/,
    /\.jpg$/, /\.png$/, /\.gif$/, /\.svg$/, /\.ico$/,
    /\.pdf$/, /\.woff/, /\.ttf/, /\.eot$/,
    /chrome-debug/, /\.heapsnapshot/,
  ];

  const files = listFiles(PROJ_DIR, 4);

  for (const file of files) {
    if (skipPatterns.some(p => p.test(file))) continue;

    const content = readIfExists(file);
    if (!content) continue;

    for (const pat of patterns) {
      const matches = content.match(pat.regex);
      if (matches) {
        // Filtrar falsos positivos (ex: emails de libs, CNPJ em docs de API)
        const realMatches = matches.filter(m => {
          if (pat.name === 'Email pessoal' && (
            m.includes('@goog') || m.includes('@broofa') || m.includes('@github') ||
            m.includes('@npmjs') || m.includes('@types')
          )) return false;
          return true;
        });

        if (realMatches.length > 0) {
          add('DADOS PESSOAIS', file,
            `${pat.severity} ${pat.name}: ${realMatches.slice(0, 3).join(', ')}${realMatches.length > 3 ? ` +${realMatches.length - 3} mais` : ''}`
          );
          break; // 1 issue por arquivo basta
        }
      }
    }
  }
}

// ── 4. Scan de tokens / sessões ───────────────────────
function scanTokens() {
  if (permiteTokens) {
    console.log('[check-cleanup] Tokens permitidos pela SPEC — pulando scan');
    return;
  }

  // Arquivos específicos que NUNCA devem existir
  const forbiddenFiles = [
    'wa-session.json',
    'bee-session.json',
    'whatsapp-snapshot.md',
    'whatsapp-initial.md',
    'whatsapp-initial.json',
  ];

  for (const f of forbiddenFiles) {
    const path = join(PROJ_DIR, f);
    if (existsSync(path)) {
      add('TOKEN/SESSÃO', f, '🔴 Arquivo de sessão proibido. DELETE e rotacione credenciais.');
    }
    // Também verificar dentro do .karma
    const karmaPath = join(KARMA_DIR, f);
    if (existsSync(karmaPath)) {
      add('TOKEN/SESSÃO', join('.karma', f), '🔴 Sessão no harness. DELETE e rotacione credenciais.');
    }
  }

  // Buscar CSRF tokens e API keys em arquivos de texto
  const tokenPatterns = [
    { name: 'CSRF Token', regex: /X-CSRF-TOKEN[:\s=]+([\w]{30,})/gi },
    { name: 'API Key exposta', regex: /api[_-]?key["\s:=]+(["']?[a-zA-Z0-9_-]{20,}["']?)/gi },
  ];

  const files = listFiles(PROJ_DIR, 3);
  const skipPatterns = [/node_modules/, /\.git/, /dist/, /\.jpg$/, /\.png$/, /\.pdf$/];

  for (const file of files) {
    if (skipPatterns.some(p => p.test(file))) continue;
    const content = readIfExists(file);
    if (!content) continue;

    for (const pat of tokenPatterns) {
      if (pat.regex.test(content)) {
        add('TOKEN/SESSÃO', file, `🔴 ${pat.name} detectado. DELETE o arquivo e rotacione a credencial.`);
        break;
      }
    }
  }
}

// ── 5. Arquivos indevidos ─────────────────────────────
function scanArquivosIndevidos() {
  if (permiteTmp) {
    console.log('[check-cleanup] Arquivos temporários permitidos pela SPEC — pulando scan');
    return;
  }

  // Padrões de nome de arquivo proibidos
  const forbiddenNames = [
    /curriculo/i, /Curriculo/i, /CV_/i, /cv\./i,
    /leia\.txt/i,
    /whatsapp-snapshot/i, /whatsapp-initial/i,
    /page-state\.md/i,
    /wa-recheck/i, /wa-initial/i, /wa-after/i,
    /session-ses_/i,
    /^_temp-/i, /^_diagnose/i,
  ];

  // Diretórios proibidos
  const forbiddenDirs = [
    /tmp\/chrome-debug/i,
    /\.karma\/\.karma/i,
  ];

  const files = listFiles(PROJ_DIR, 3);

  for (const file of files) {
    const name = basename(file);

    // Verificar diretórios proibidos
    for (const d of forbiddenDirs) {
      if (d.test(file)) {
        add('ARQUIVO INDEVIDO', file, '🟠 Diretório de lixo (chrome debug, estrutura duplicada). Remova e adicione ao .gitignore.');
        break;
      }
    }

    // Verificar nomes proibidos
    for (const n of forbiddenNames) {
      if (n.test(name)) {
        let action = '🟠 Arquivo indevido no repositório. Remova ou adicione ao .gitignore.';
        if (/curriculo|CV/i.test(name)) action = '🔴 Currículo com dados pessoais. DELETE IMEDIATAMENTE.';
        if (/whatsapp-snapshot|whatsapp-initial|wa-recheck|wa-initial|wa-after|page-state|session-ses/i.test(name))
          action = '🔴 Snapshot do WhatsApp com dados de clientes. DELETE IMEDIATAMENTE.';
        if (/^_temp-|^_diagnose/i.test(name))
          action = '🟠 Arquivo temporário de debug. Remova.';

        add('ARQUIVO INDEVIDO', file, action);
        break;
      }
    }
  }
}

// ── 6. Branches órfãos (modo --full) ──────────────────
function scanBranches() {
  let output;
  try {
    output = execSync('git branch -r --no-merged main', {
      encoding: 'utf-8',
      cwd: PROJ_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return; // sem remote
  }

  const branches = output.split('\n').map(b => b.trim()).filter(Boolean);
  const ghostBranches = branches.filter(b => b.includes('tarefa/') || b.includes('fix-') || b.includes('feature/'));

  // Também branches locais não mergeados
  let localOutput;
  try {
    localOutput = execSync('git branch --no-merged main', {
      encoding: 'utf-8',
      cwd: PROJ_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch { localOutput = ''; }

  const localBranches = localOutput.split('\n').map(b => b.replace('*', '').trim()).filter(Boolean);
  const localGhosts = localBranches.filter(b => b.includes('tarefa/') || b.includes('fix-') || b.includes('feature/'));

  // Verificar idade dos branches (via git log)
  const allGhosts = [...new Set([...ghostBranches, ...localGhosts])];

  for (const branch of allGhosts) {
    try {
      const lastCommit = execSync(`git log -1 --format=%ct ${branch}`, {
        encoding: 'utf-8',
        cwd: PROJ_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      const ageDays = Math.floor((Date.now() / 1000 - parseInt(lastCommit)) / 86400);

      if (ageDays > 7) {
        add('BRANCH ÓRFÃO', branch, `🟠 Branch não mergeado há ${ageDays} dias. Verifique se deve ser mergeado ou deletado.`);
      } else {
        add('BRANCH ÓRFÃO', branch, `🟡 Branch ativo (${ageDays}d). Se a tarefa foi concluída, faça merge ou delete.`);
      }
    } catch {
      add('BRANCH ÓRFÃO', branch, 'Não foi possível verificar idade.');
    }
  }
}

// ── 7. .gitignore audit (modo --full) ──────────────────
function auditGitignore() {
  const giPath = join(PROJ_DIR, '.gitignore');
  let gi = '';
  try { gi = readFileSync(giPath, 'utf-8'); } catch { /* sem .gitignore */ }

  const required = [
    { pattern: '*.log', desc: 'logs' },
    { pattern: 'tmp/', desc: 'arquivos temporários' },
    { pattern: '*.heapsnapshot', desc: 'heap snapshots' },
  ];

  for (const r of required) {
    if (!gi.includes(r.pattern)) {
      add('.GITIGNORE', '.gitignore', `🟡 Não ignora ${r.desc}. Adicione "${r.pattern}".`);
    }
  }
}

// ── 8. Executar scans ─────────────────────────────────
console.log(`[check-cleanup] Iniciando scan${FULL_MODE ? ' completo' : ''}...`);
console.log(`[check-cleanup] Projeto: ${PROJ_DIR}`);
console.log(`[check-cleanup] SPEC: ${SPEC_PATH.replace(PROJ_DIR, '')}`);
console.log(`[check-cleanup] Flags: dados=${permiteDados} tokens=${permiteTokens} tmp=${permiteTmp}\n`);

scanDadosPessoais();
scanTokens();
scanArquivosIndevidos();

if (FULL_MODE) {
  scanBranches();
  auditGitignore();
}

// ── 9. Reportar ───────────────────────────────────────
if (issues.length === 0) {
  const mode = FULL_MODE ? 'completo (Fase 5)' : 'básico (Fase 3)';
  console.log(`[check-cleanup] ✅ Repositório limpo — modo ${mode}`);
  console.log(`[check-cleanup] Nenhum dado pessoal, token, arquivo indevido ou branch órfão detectado.`);
  process.exit(0);
}

console.error(`[check-cleanup] ❌ ${issues.length} problema(s) encontrado(s):\n`);

// Agrupar por categoria
const cats = [...new Set(issues.map(i => i.cat))];
for (const cat of cats) {
  console.error(`\n── ${cat} ──`);
  for (const issue of issues.filter(i => i.cat === cat)) {
    const relFile = issue.file.replace(PROJ_DIR, '').replace(/\\/g, '/').replace(/^\//, '');
    console.error(`  ${relFile}`);
    console.error(`    ${issue.detail}`);
  }
}

// Resumo
const specRel = specFile.replace(PROJ_DIR, '').replace(/\\/g, '/').replace(/^\//, '');
console.error(`\n[check-cleanup] SPEC: ${specRel}`);
console.error(`[check-cleanup] Flags: dados=${permiteDados} tokens=${permiteTokens} tmp=${permiteTmp}`);
console.error(`[check-cleanup] Corrija os problemas acima e re-execute o gate.`);
process.exit(1);
