import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, 'diagnostico.json');

const say = (s) => console.log(`[DIAG] ${s}`);

async function analisePagina(page) {
  const url = page.url();
  let titulo = '(erro)';
  let carregada = false;
  try {
    titulo = await page.evaluate(() => document.title);
    carregada = true;
  } catch { titulo = '(não carregada)'; }

  say(`URL: ${url}`);
  say(`Título: ${titulo}`);
  say(`Carregada: ${carregada}`);

  return { url, titulo, carregada };
}

async function diagnosticoCompleto(page) {
  const info = {};

  await page.bringToFront();
  say('=> page.bringToFront() ok');

  await new Promise(r => setTimeout(r, 3000));
  say('=> aguardou 3s');

  const screenshotPath = resolve(__dirname, 'wa-snapshot2.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  say(`=> screenshot salva em ${screenshotPath}`);
  info.screenshot = screenshotPath;

  const html = await page.content();
  info.htmlAmostra = html.substring(0, 3000);
  say(`=> page.content(): ${html.length} chars totais, amostra 3000`);

  info.documentTitle = await page.evaluate(() => document.title);
  say(`=> document.title: ${info.documentTitle}`);

  info.shadowHost = await page.evaluate(() => {
    const el = document.querySelector('#app-shadow-host');
    return el ? 'EXISTE' : 'null';
  });
  say(`=> #app-shadow-host: ${info.shadowHost}`);

  info.idsInteressantes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[id]'))
      .map(el => el.id)
      .filter(id => id.includes('shadow') || id.includes('app') || id.includes('karma') || id.includes('ext'));
  });
  say(`=> ids filtrados (${info.idsInteressantes.length}): ${info.idsInteressantes.join(', ') || '(nenhum)'}`);

  info.bodyPreview = await page.evaluate(() => {
    return document.querySelector('body')?.innerHTML?.substring(0, 2000) || '(vazio)';
  });
  say(`=> body.innerHTML: ${info.bodyPreview.substring(0, 120)}...`);

  info.userAgent = await page.evaluate(() => navigator.userAgent);
  say(`=> navigator.userAgent: ${info.userAgent}`);

  return info;
}

(async () => {
  say('Conectando ao Chrome em http://localhost:9222');
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null,
  });
  say('Conectado!');

  const allPages = await browser.pages();
  say(`Total de páginas/alvos: ${allPages.length}`);

  const paginasInfo = [];
  for (let i = 0; i < allPages.length; i++) {
    const p = allPages[i];
    say(`--- Página ${i + 1} ---`);
    try {
      const info = await analisePagina(p);
      paginasInfo.push({ index: i, ...info });
    } catch (err) {
      say(`ERRO página ${i + 1}: ${err.message}`);
      paginasInfo.push({ index: i, url: '(erro)', titulo: err.message, carregada: false });
    }
  }

  const waPage = allPages.find(p => {
    try { return p.url().includes('web.whatsapp.com'); } catch { return false; }
  });

  let waInfo = null;

  if (waPage) {
    say('=== web.whatsapp.com ENCONTRADO ===');
    waInfo = await diagnosticoCompleto(waPage);
  } else {
    say('=== web.whatsapp.com NÃO encontrado. Navegando... ===');
    const novaPag = await browser.newPage();
    await novaPag.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded' });
    say('Aguardando 8s para carregamento...');
    await new Promise(r => setTimeout(r, 8000));
    waInfo = await diagnosticoCompleto(novaPag);
  }

  const resultado = {
    timestamp: new Date().toISOString(),
    totalPaginas: allPages.length,
    paginas: paginasInfo,
    whatsapp: waInfo,
  };

  writeFileSync(OUT, JSON.stringify(resultado, null, 2), 'utf-8');
  say(`=== Diagnóstico salvo em ${OUT} ===`);
  say('FIM');

  await browser.disconnect();
})();
