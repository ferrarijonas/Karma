#!/usr/bin/env node
// sync-html.mjs — Gera painel de visão de tarefas + claims ativos
// Uso: node scripts/sync-html/sync-html.mjs
// Saída: C:\Mettri4\.karma\tarefas.html

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join as pathJoin } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const ROOT = pathJoin(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const OUTPUT = pathJoin(ROOT, 'tarefas.html');

const TASK_DIRS = [
  { path: '.mettri/tarefas/pendentes', label: 'pendente' },
  { path: '.mettri/tarefas/em-andamento', label: 'em_andamento' },
  { path: '.mettri/tarefas/concluidas', label: 'concluido' },
];

const DOMINIO_CORES = {
  ATENDIMENTO: '#4fc3f7',
  MARKETING: '#ffb74d',
  CATALOGO: '#81c784',
  CADASTRO: '#aed581',
  RAG: '#ce93d8',
  PEDIDOS: '#4dd0e1',
  CLIENTES: '#fff59d',
  OPORTUNIDADES: '#ff8a65',
  INFRAESTRUTURA: '#90a4ae',
};

const DOMINIO_CORES_LIGHT = {
  ATENDIMENTO: '#0288d1',
  MARKETING: '#e65100',
  CATALOGO: '#2e7d32',
  CADASTRO: '#558b2f',
  RAG: '#7b1fa2',
  PEDIDOS: '#00838f',
  CLIENTES: '#f9a825',
  OPORTUNIDADES: '#bf360c',
  INFRAESTRUTURA: '#546e7a',
};

// ─── Parse Frontmatter ───
function parseFrontmatter(filePath) {
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, 'utf-8')
    .replace(/^\uFEFF/, '')                  // BOM
    .replace(/\r\n/g, '\n')                  // CRLF → LF
    .replace(/\r/g, '\n');                   // CR → LF (raro)
  // Match YAML frontmatter: opening ---, body, closing ---
  const match = content.match(/^---\n([\s\S]*?)\n---/m);
  if (!match) return null;
  let raw;
  try {
    raw = yaml.load(match[1]);
  } catch (_) {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  return {
    ...raw,
    prioridade: (typeof raw.prioridade === 'string' ? { urgente: 1, alta: 2, media: 3, baixa: 4 }[raw.prioridade] ?? 3 : raw.prioridade ?? 3),
    dependencias: (typeof raw.dependencias === 'string' ? [raw.dependencias] : Array.isArray(raw.dependencias) ? raw.dependencias : raw.dependencias ?? []),
    titulo: raw.titulo ?? 'sem título',
  };
}

function parseClaims() {
  const p = pathJoin(ROOT, '.mettri', 'claims.yaml');
  if (!existsSync(p)) return { dominios: {}, staleTimeout: 30 };
  const content = readFileSync(p, 'utf-8');
  const lines = content.split('\n');
  const dominios = {}; let stale = 30; let cur = null;
  for (const line of lines) {
    const dm = line.match(/^  (\w+):$/);
    if (dm) { cur = dm[1]; dominios[cur] = {}; continue; }
    const fm = line.match(/^    (\w+):\s*(.*)$/);
    if (fm && cur) { let v = fm[2].trim(); if (v === 'null') v = null; else if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1,-1); dominios[cur][fm[1]] = v; }
    const sm = line.match(/^stale_timeout_min:\s*(\d+)/);
    if (sm) stale = parseInt(sm[1], 10);
  }
  return { dominios, staleTimeout: stale };
}

function collectTasks() {
  const tasks = [];
  const warnings = [];
  for (const { path: dir, label } of TASK_DIRS) {
    const fp = pathJoin(ROOT, dir);
    if (!existsSync(fp)) continue;
    for (const e of readdirSync(fp, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const specPath = pathJoin(fp, e.name, 'SPEC.md');
      const d = parseFrontmatter(specPath);
      if (!d) {
        const msg = `${dir}/${e.name}`;
        process.stderr.write(`Aviso: SPEC.md inválida em ${msg}\n`);
        warnings.push(msg);
        continue;
      }
      tasks.push({ ...d, _status: label, _path: `${dir}/${e.name}` });
    }
  }
  return { tasks, warnings };
}

// ─── Helpers ───
function esc(t) {
  if (typeof t !== 'string') return String(t ?? '');
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timeAgo(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `há ${h}h${min%60?' '+min%60+'min':''}` : `há ${Math.floor(h/24)}d`;
}

function prioridadeLabel(p) { return {1:'Urgente',2:'Alta',3:'Média',4:'Baixa'}[p] ?? String(p); }

function corPorDominio(d, light = false) {
  const up = (d ?? '').toUpperCase();
  const paleta = light ? DOMINIO_CORES_LIGHT : DOMINIO_CORES;
  for (const [k, v] of Object.entries(paleta)) if (up.includes(k)) return v;
  return light ? '#666' : '#888';
}

// Identifica se é subtarefa (T-NNN.X)
function isSubtask(id) { return /^T-\d{3}\.\d+$/.test(id ?? ''); }
function subtaskParent(id) { const m = (id ?? '').match(/^(T-\d{3})\./); return m ? m[1] : null; }

// ─── Gera HTML ───
function generateHtml(tasks, claims, warnings = []) {
  const pendentes = tasks.filter(t => t._status === 'pendente' || t.status === 'pendente');
  const emAndamento = tasks.filter(t => !pendentes.includes(t) && (t._status === 'em_andamento' || t.status === 'em_andamento'));
  const concluidas = tasks.filter(t => !pendentes.includes(t) && !emAndamento.includes(t) && (t._status === 'concluido' || t.status === 'concluido'));
  const now = Date.now();
  const staleMin = claims.staleTimeout || 30;

  const claimsAtivos = Object.entries(claims.dominios).filter(([_,v]) => v.lock !== null)
    .map(([n, v]) => {
      const lb = v.heartbeat ? new Date(v.heartbeat).getTime() : null;
      const st = lb && (now - lb) > staleMin * 60000;
      return { nome: n, ...v, stalled: st, stalledDisplay: st ? `⚠ Stale (${timeAgo(v.heartbeat)})` : 'Ativo', timeAgo: timeAgo(v.lease_inicio) };
    });

  // Agrupa por domínio, separando pais de subtarefas
  function agrupar(lista) {
    const grupos = {};
    for (const t of lista) {
      const d = t.dominio ?? 'Outros';
      if (!grupos[d]) grupos[d] = { parents: {}, subs: [] };
      if (isSubtask(t.id)) {
        grupos[d].subs.push(t);
      } else {
        grupos[d].parents[t.id] = t;
      }
    }
    return Object.entries(grupos)
      .map(([dom, g]) => {
        // Associa subs aos pais
        const orphans = [];
        const parentsWithSubs = { ...g.parents };
        for (const sub of g.subs) {
          const parentId = subtaskParent(sub.id);
          if (parentId && parentsWithSubs[parentId]) {
            if (!parentsWithSubs[parentId]._subs) parentsWithSubs[parentId]._subs = [];
            parentsWithSubs[parentId]._subs.push(sub);
          } else {
            orphans.push(sub);
          }
        }
        const listaFinal = Object.values(parentsWithSubs).concat(orphans);
        return [dom, listaFinal];
      })
      .sort((a, b) => {
        const pA = Object.keys(DOMINIO_CORES).some(k => a[0].toUpperCase().includes(k)) ? 0 : 1;
        const pB = Object.keys(DOMINIO_CORES).some(k => b[0].toUpperCase().includes(k)) ? 0 : 1;
        if (pA !== pB) return pA - pB;
        return b[1].length - a[1].length;
      });
  }

  function cardTarefa(t, isSub = false) {
    const dep = t.dependencias?.length ? t.dependencias.join(', ') : null;
    const subs = t._subs || [];
    const subHtml = subs.map(s => cardTarefa(s, true)).join('');
    const cor = corPorDominio(t.dominio);
    return `
    <div class="task${isSub ? ' task-sub' : ''}">
      <div class="task-id" style="color:${isSub ? 'var(--sub-color)' : cor}">${esc(t.id)}</div>
      <div class="task-body">
        <div class="task-titulo">${esc(t.titulo || 'sem título')}</div>
        <div class="task-meta">${esc(prioridadeLabel(t.prioridade))}${dep ? ` · dep: ${esc(dep)}` : ''}${isSub ? '' : subs.length ? ` · ${subs.length} sub` : ''}</div>
      </div>
    </div>${subHtml}`;
  }

  function grupoHtml(entries) {
    return entries.map(([dominio, lista]) => {
      const listaOrd = lista.sort((a, b) => (a.prioridade ?? 3) - (b.prioridade ?? 3));
      return `
    <div class="grupo">
      <div class="grupo-header" style="border-left-color:${corPorDominio(dominio)}">
        <span class="grupo-nome">${esc(dominio)}</span>
        <span class="grupo-count">${lista.length + lista.reduce((a,t) => a + (t._subs?.length || 0), 0)}</span>
      </div>
      <div class="grupo-tasks">
        ${listaOrd.map(t => cardTarefa(t)).join('')}
      </div>
    </div>`; }).join('\n');
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Karma · Visão</title>
<style>
  :root {
    --bg: #0d0d1a; --bg2: #14142a; --bg3: #1a1a34; --border: #1e1e3a; --border2: #2a2a4a;
    --text: #c8c8d0; --text2: #e0e0e8; --text3: #999; --text4: #666; --text5: #555;
    --hover: #181834; --sub-border: #2a2a3a; --sub-color: #666;
    --prio-u: #e94560; --prio-a: #f0c040; --prio-m: #888; --prio-b: #555;
    --chip-bg: #1a1a34; --chip-color: #555; --vazio: #444; --footer: #333;
  }
  [data-theme="light"] {
    --bg: #f5f5f0; --bg2: #ffffff; --bg3: #f0efea; --border: #dddcd4; --border2: #cdccc4;
    --text: #444; --text2: #222; --text3: #777; --text4: #999; --text5: #aaa;
    --hover: #eae9e4; --sub-border: #e0dfd7; --sub-color: #aaa;
    --prio-u: #d32f2f; --prio-a: #e65100; --prio-m: #888; --prio-b: #bbb;
    --chip-bg: #eae9e4; --chip-color: #999; --vazio: #bbb; --footer: #ccc;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', 'Helvetica Neue', sans-serif; background: var(--bg); color: var(--text); font-size: 13px; line-height: 1.5; padding: 2rem; transition: background .2s; }
  .layout { max-width: 1100px; margin: 0 auto; }
  .top { display: flex; justify-content: space-between; align-items: baseline; }
  h1 { font-size: 18px; font-weight: 500; color: var(--text2); letter-spacing: -0.01em; margin-bottom: 0.25rem; }
  .sub { color: var(--text4); font-size: 11px; margin-bottom: 1.5rem; }
  .theme-btn { background: var(--bg2); border: 1px solid var(--border); color: var(--text4); cursor: pointer; font-size: 11px; padding: 4px 12px; border-radius: 4px; font-family: inherit; }

  /* Counters */
  .counters { display: flex; gap: 8px; margin-bottom: 2rem; }
  .counter { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 12px 20px; flex: 1; }
  .counter .num { font-size: 22px; font-weight: 500; font-variant-numeric: tabular-nums; }
  .counter .lbl { font-size: 10px; color: var(--text4); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
  .c-pendente .num { color: #f0c040; }
  .c-andamento .num { color: #4fc3f7; }
  .c-concluido .num { color: #66bb6a; }
  .c-agentes .num { color: #ce93d8; }

  /* Claims ativos */
  .claims { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 2rem; }
  .claims-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text4); margin-bottom: 12px; }
  .claims-grid { display: flex; gap: 12px; flex-wrap: wrap; }
  .claim-card { background: var(--bg3); border: 1px solid var(--border2); border-radius: 6px; padding: 12px 16px; min-width: 200px; flex: 1; }
  .claim-dominio { font-size: 12px; font-weight: 500; color: var(--text2); }
  .claim-tarefa { font-size: 11px; color: var(--text3); margin-top: 4px; }
  .claim-meta { font-size: 10px; color: var(--text4); margin-top: 4px; display: flex; gap: 8px; }
  .claim-stalled { color: #e94560; font-weight: 500; }
  .claim-ativo { color: #66bb6a; }
  .sem-claims { font-size: 12px; color: var(--text5); font-style: italic; }

  /* Grupos */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 2rem; }
  @media (max-width: 800px) { .grid-2 { grid-template-columns: 1fr; } }
  .grupo { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .grupo-header { padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid #888; }
  .grupo-nome { font-size: 12px; font-weight: 500; color: var(--text); }
  .grupo-count { background: var(--bg3); color: var(--text4); font-size: 10px; padding: 2px 8px; border-radius: 10px; font-variant-numeric: tabular-nums; }
  .grupo-tasks { border-top: 1px solid var(--border); }

  .task { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--hover); cursor: default; }
  .task:last-child { border-bottom: none; }
  .task:hover { background: var(--hover); }
  .task-sub { padding-left: 30px; border-left: 2px solid var(--sub-border); margin-left: 14px; border-bottom: 1px solid transparent; }
  .task-sub .task-titulo { font-size: 11px; color: var(--text3); }
  .task-sub + .task { border-top: none; }
  .task-id { font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace; font-size: 11px; font-weight: 500; min-width: 46px; }
  .task-body { flex: 1; min-width: 0; }
  .task-titulo { font-size: 12px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .task-meta { font-size: 10px; color: var(--text4); margin-top: 2px; }

  /* Concluídas */
  .concluidas { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 2rem; }
  .concluidas-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text4); margin-bottom: 12px; }
  .concluidas-grid { display: flex; flex-wrap: wrap; gap: 6px; }
  .concluida-chip { font-family: 'SF Mono', 'JetBrains Mono', monospace; font-size: 10px; color: var(--chip-color); background: var(--chip-bg); padding: 3px 10px; border-radius: 4px; }

  .vazio { color: var(--vazio); font-size: 12px; font-style: italic; padding: 12px 14px; }
  .footer { color: var(--footer); font-size: 10px; margin-top: 2rem; }

  /* Ideias */
  .ideias { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 2rem; }
  .ideias-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text4); margin-bottom: 12px; }
  .ideias-input-row { display: flex; gap: 8px; margin-bottom: 12px; }
  .ideias-input { flex: 1; background: var(--bg3); border: 1px solid var(--border2); border-radius: 6px; padding: 10px 12px; color: var(--text2); font-family: inherit; font-size: 12px; resize: vertical; min-height: 42px; outline: none; transition: border .2s; }
  .ideias-input:focus { border-color: #4fc3f7; }
  .ideias-btn { background: #1a5a3a; border: 1px solid #2a7a4a; color: #8fdaa0; border-radius: 6px; padding: 8px 16px; font-size: 12px; font-family: inherit; cursor: pointer; white-space: nowrap; transition: background .2s; }
  .ideias-btn:hover { background: #207a4a; }
  .ideias-list { border-top: 1px solid var(--border); padding-top: 8px; max-height: 300px; overflow-y: auto; }
  .ideias-empty { color: var(--text5); font-size: 12px; font-style: italic; padding: 12px 0; text-align: center; }
  .ideia-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px 4px; border-bottom: 1px solid var(--hover); }
  .ideia-item:last-child { border-bottom: none; }
  .ideia-texto { flex: 1; font-size: 12px; color: var(--text2); line-height: 1.4; }
  .ideia-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .ideia-meta span { font-size: 10px; color: var(--text4); }
  .ideia-remove { background: none; border: none; color: #e94560; cursor: pointer; font-size: 14px; padding: 2px 4px; line-height: 1; opacity: 0.5; transition: opacity .2s; }
  .ideia-remove:hover { opacity: 1; }
  .ideias-footer { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }
  .ideias-count { font-size: 10px; color: var(--text4); }
</style>
</head>
<body>
<div class="layout">
<div class="top">
  <div>
    <h1>Karma · Visão</h1>
    <div class="sub">${tasks.length} tarefas · ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
  </div>
  <button class="theme-btn" onclick="toggleTheme()" id="themeToggle">🌙</button>
</div>

<div class="counters">
  <div class="counter c-pendente"><div class="num">${pendentes.length}</div><div class="lbl">Pendentes</div></div>
  <div class="counter c-andamento"><div class="num">${emAndamento.length}</div><div class="lbl">Em Andamento</div></div>
  <div class="counter c-concluido"><div class="num">${concluidas.length}</div><div class="lbl">Concluídas</div></div>
  <div class="counter c-agentes"><div class="num">${claimsAtivos.length}</div><div class="lbl">Agentes</div></div>
</div>

${warnings.length > 0 ? `
<div style="background:#2a1a1a;border:1px solid #4a2020;border-radius:8px;padding:12px 16px;margin-bottom:1.5rem;font-size:12px;color:#e06060">
  ⚠ ${warnings.length} diretório(s) com SPEC.md inválida ou ausente:
  ${warnings.map(w => `<div style="font-family:monospace;font-size:10px;margin-top:4px;color:#c08080">${esc(w)}</div>`).join('')}
</div>` : ''}

<!-- Claims ativos -->
<div class="claims">
  <div class="claims-title">⚡ Agentes em atividade</div>
  ${claimsAtivos.length > 0 ? `
  <div class="claims-grid">
    ${claimsAtivos.map(c => `
    <div class="claim-card">
      <div class="claim-dominio">${esc(c.nome)}</div>
      <div class="claim-tarefa">${esc(c.tarefa || '?')}</div>
      <div class="claim-meta">
        <span>${c.timeAgo || '?'}</span>
        <span class="${c.stalled ? 'claim-stalled' : 'claim-ativo'}">${c.stalledDisplay}</span>
      </div>
    </div>`).join('')}
  </div>` : '<div class="sem-claims">Nenhum agente ativo no momento.</div>'}
</div>

<!-- Ideias Rápidas -->
<div class="ideias">
  <div class="ideias-title">💡 Ideias Rápidas</div>
  <div class="ideias-input-row">
    <textarea class="ideias-input" id="ideiaInput" placeholder="Digite uma ideia solta..." rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();salvarIdeia()}"></textarea>
    <button class="ideias-btn" onclick="salvarIdeia()">+ Adicionar</button>
  </div>
  <div class="ideias-list" id="ideiasList">
    <div class="ideias-empty">Nenhuma ideia ainda.</div>
  </div>
  <div class="ideias-footer">
    <span class="ideias-count" id="ideiasCount">0 ideias</span>
  </div>
</div>

${pendentes.length > 0 ? `
<h2 style="font-size:12px;font-weight:500;color:var(--text4);margin-bottom:10px;letter-spacing:0.03em;text-transform:uppercase">📌 Pendentes</h2>
<div class="grid-2">${grupoHtml(agrupar(pendentes))}</div>` : ''}

${emAndamento.length > 0 ? `
<h2 style="font-size:12px;font-weight:500;color:var(--text4);margin-bottom:10px;letter-spacing:0.03em;text-transform:uppercase">🔧 Em Andamento</h2>
<div class="grid-2">${grupoHtml(agrupar(emAndamento))}</div>` : ''}

${concluidas.length > 0 ? `
<div class="concluidas">
  <div class="concluidas-title">✅ Concluídas (${concluidas.length})</div>
  <div class="concluidas-grid">
    ${concluidas.map(t => `<span class="concluida-chip">${esc(t.id)}</span>`).join('')}
  </div>
</div>` : ''}

<div class="footer">sync-html · ${new Date().toISOString()}</div>
</div>
<script>
(function() {
  const t = localStorage.getItem('karma-theme');
  if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = t === 'light' ? '☀️' : '🌙';
})();
function toggleTheme() {
  const h = document.documentElement;
  const isLight = h.getAttribute('data-theme') === 'light';
  if (isLight) { h.removeAttribute('data-theme'); localStorage.setItem('karma-theme', 'dark'); document.getElementById('themeToggle').textContent = '🌙'; }
  else { h.setAttribute('data-theme', 'light'); localStorage.setItem('karma-theme', 'light'); document.getElementById('themeToggle').textContent = '☀️'; }
}

// ─── Ideias Rápidas ───
let ideias = [];
let dirHandle = null;

function escHtml(s) {
  if (typeof s !== 'string') return String(s ?? '');
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtData(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('pt-BR'); } catch(e) { return iso; }
}

function carregarIdeias() {
  try {
    const saved = localStorage.getItem('karma-ideias');
    ideias = saved ? JSON.parse(saved) : [];
  } catch(e) { ideias = []; }
  renderIdeias();
}

function salvarIdeia() {
  const input = document.getElementById('ideiaInput');
  const texto = input.value.trim();
  if (!texto) return;
  ideias.push({
    id: 'IDEA-' + Date.now().toString(36).slice(-6).toUpperCase(),
    data: new Date().toISOString(),
    texto: texto
  });
  input.value = '';
  persistirIdeias();
  input.focus();
  syncAoDisco();
}

function removerIdeia(id) {
  if (!confirm('Remover esta ideia?')) return;
  ideias = ideias.filter(function(i) { return i.id !== id; });
  persistirIdeias();
  syncAoDisco();
}

function persistirIdeias() {
  localStorage.setItem('karma-ideias', JSON.stringify(ideias));
  renderIdeias();
}

function renderIdeias() {
  var list = document.getElementById('ideiasList');
  var count = document.getElementById('ideiasCount');
  if (count) count.textContent = ideias.length + ' ideia(s)';
  if (!list) return;
  if (ideias.length === 0) {
    list.innerHTML = '<div class="ideias-empty">Nenhuma ideia ainda.</div>';
    return;
  }
  var html = '';
  for (var i = ideias.length - 1; i >= 0; i--) {
    var item = ideias[i];
    html += '<div class="ideia-item">'
      + '<div class="ideia-texto">' + escHtml(item.texto) + '</div>'
      + '<div class="ideia-meta"><span>' + fmtData(item.data) + '</span></div>'
      + '<button class="ideia-remove" onclick="removerIdeia(\\'' + item.id + '\\')" title="Remover">\u2715</button>'
      + '</div>';
  }
  list.innerHTML = html;
}

// ─── Auto-sync com disco (File System Access API) ───
async function syncAoDisco() {
  if (!ideias.length) return;
  try {
    if (!dirHandle) {
      dirHandle = await window.showDirectoryPicker({ id: 'karma-mettri', mode: 'readwrite' });
    }
    var opts = { mode: 'readwrite' };
    if ((await dirHandle.queryPermission(opts)) !== 'granted') {
      if ((await dirHandle.requestPermission(opts)) !== 'granted') return;
    }
    var ideiasDir = await dirHandle.getDirectoryHandle('ideias', { create: true });
    var fileHandle = await ideiasDir.getFileHandle('ideias.json', { create: true });
    var writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(ideias, null, 2));
    await writable.close();
  } catch(e) {
    // Silencioso — disco é bônus, localStorage já basta
  }
}

// Carrega ideias ao abrir a página
carregarIdeias();
</script>
</body>
</html>`;
}

// ─── Main ───
function main() {
  const { tasks, warnings } = collectTasks();
  const claims = parseClaims();
  if (tasks.length === 0) process.stderr.write('Aviso: Nenhuma tarefa encontrada.\n');
  const html = generateHtml(tasks, claims, warnings);
  writeFileSync(OUTPUT, html, 'utf-8');
  const ativos = Object.values(claims.dominios).filter(v => v.lock !== null).length;
  process.stdout.write(`tarefas.html · ${tasks.length} tarefas, ${ativos} claims ativos${warnings.length ? `, ${warnings.length} avisos` : ''}\n`);
}

main();
