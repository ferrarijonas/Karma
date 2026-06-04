#!/usr/bin/env node

/**
 * check-mocks — Script determinístico anti-mock
 *
 * Verifica se o diff (contra HEAD ou contra main) contém mocks (vi.mock/jest.mock)
 * em arquivos de teste, a menos que o SPEC.md da tarefa permita explicitamente.
 *
 * Uso:
 *   node .karma/scripts/check-mocks/index.mjs <spec_path>
 *
 * Exit codes:
 *   0 — nenhum mock detectado (ou mocks justificados)
 *   1 — mock detectado sem justificativa (ou SPEC.md inválido)
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, resolve } from 'path';

const SPEC_ARG = process.argv[2];

if (!SPEC_ARG) {
  console.error('[check-mocks] Uso: node .karma/scripts/check-mocks/index.mjs <spec_path>');
  process.exit(1);
}

// 1. Carregar SPEC.md
let specPath = resolve(SPEC_ARG);
const specDir = specPath.endsWith('SPEC.md') ? specPath : join(specPath, 'SPEC.md');
if (!existsSync(specDir)) {
  // tentar spec_path relativo ao .karma
  const alt = join(process.cwd(), SPEC_ARG, 'SPEC.md');
  if (existsSync(alt)) {
    specPath = alt;
  } else {
    console.error(`[check-mocks] SPEC.md não encontrado: ${specDir}`);
    console.error(`[check-mocks] Também tentei: ${alt}`);
    process.exit(1);
  }
} else {
  specPath = specDir;
}

let specContent;
try {
  specContent = readFileSync(specPath, 'utf-8');
} catch (err) {
  console.error(`[check-mocks] Erro ao ler SPEC.md: ${err.message}`);
  process.exit(1);
}

// 2. Extrair frontmatter YAML manualmente (sem dep)
function extractFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  return match[1];
}

const frontmatter = extractFrontmatter(specContent);
if (!frontmatter) {
  console.error('[check-mocks] SPEC.md sem frontmatter YAML');
  process.exit(1);
}

// 3. Extrair permite_mock
const permiteMockMatch = frontmatter.match(/^permite_mock:\s*(true|false)$/m);
const permiteMock = permiteMockMatch ? permiteMockMatch[1] === 'true' : false;

// 4. Se permite_mock: true, verificar se há justificativas
// Se permite_mock: false, qualquer vi.mock/jest.mock no diff é erro

// 5. Obter diff contra HEAD (ou main se não houver HEAD)
function getGitDiff() {
  try {
    // Tenta diff contra HEAD
    return execSync('git diff HEAD --name-only', {
      encoding: 'utf-8',
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    try {
      // Fallback: diff contra main
      return execSync('git diff main --name-only', {
        encoding: 'utf-8',
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      console.error('[check-mocks] Não foi possível obter diff git');
      process.exit(1);
    }
  }
}

function getGitDiffContent() {
  try {
    return execSync('git diff HEAD', {
      encoding: 'utf-8',
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    try {
      return execSync('git diff main', {
        encoding: 'utf-8',
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      console.error('[check-mocks] Não foi possível obter diff content');
      process.exit(1);
    }
  }
}

const diffFiles = getGitDiff().split('\n').filter(Boolean);
const diffContent = getGitDiffContent();

// 6. Verificar mocks no diff
const mockLines = [];
const mockRegex = /\b(vi\.mock|jest\.mock)\s*\(/g;

// Filtrar apenas arquivos de teste
const testFiles = diffFiles.filter(f => 
  f.endsWith('.test.ts') || f.endsWith('.spec.ts') || f.endsWith('.test.tsx') || f.endsWith('.spec.tsx') || f.endsWith('.test.mjs') || f.endsWith('.spec.mjs')
);

if (testFiles.length === 0) {
  console.log('[check-mocks] Nenhum arquivo de teste no diff — OK');
  process.exit(0);
}

// Para cada linha do diff, verificar se adiciona mock
const diffLines = diffContent.split('\n');
for (let i = 0; i < diffLines.length; i++) {
  const line = diffLines[i];
  // Só linhas adicionadas (começam com +) em arquivos de teste
  if (line.startsWith('+') && mockRegex.test(line)) {
    const content = line.slice(1); // remove o +
    const prevLine = i > 0 ? diffLines[i - 1] : '';
    const hasJustification = content.includes('// justificado:') || prevLine.includes('// justificado:');
    
    if (permiteMock) {
      if (!hasJustification) {
        mockLines.push({
          line: i + 1,
          content: content.trim(),
          missingJustification: true,
        });
      }
    } else {
      mockLines.push({
        line: i + 1,
        content: content.trim(),
        missingJustification: false,
      });
    }
  }
}

if (mockLines.length === 0) {
  console.log('[check-mocks] Nenhum mock detectado no diff — OK');
  process.exit(0);
}

// 7. Reportar problemas
console.error('[check-mocks] Mocks detectados no diff:');
for (const mock of mockLines) {
  if (permiteMock) {
    console.error(`  Linha ${mock.line}: ${mock.content}`);
    console.error(`    → permite_mock: true, mas falta "// justificado: <motivo>"`);
  } else {
    console.error(`  Linha ${mock.line}: ${mock.content}`);
    console.error(`    → SPEC.md declarou permite_mock: false`);
  }
}

// Resumo
const specPathRel = specPath.replace(process.cwd(), '.');
console.error(`\n[check-mocks] SPEC: ${specPathRel} | permite_mock: ${permiteMock}`);
console.error(`[check-mocks] ${mockLines.length} mock(s) não justificado(s) detectado(s)`);
process.exit(1);
