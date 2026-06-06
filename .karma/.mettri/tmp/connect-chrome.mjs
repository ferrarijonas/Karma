import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tmpDir = __dirname;
const mettriDir = join(__dirname, '..');

async function main() {
  console.log('[1/8] Conectando ao Chrome via Puppeteer em http://localhost:9222...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  console.log('[2/8] Conectado! Obtendo página...');

  const pages = await browser.pages();
  let page = pages[0];
  if (!page) {
    page = await browser.newPage();
  }

  const currentUrl = page.url();
  console.log(`[3/8] URL atual: ${currentUrl}`);

  if (!currentUrl.includes('web.whatsapp.com')) {
    console.log('  → Navegando para https://web.whatsapp.com...');
    await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2' });
  } else {
    console.log('  → Já está no WhatsApp Web.');
  }

  console.log('[4/8] Aguardando 5 segundos...');
  await new Promise(r => setTimeout(r, 5000));

  console.log('[5/8] Salvando screenshot...');
  const screenshotPath = join(tmpDir, 'wa-snapshot.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`  → Screenshot salvo em: ${screenshotPath}`);

  console.log('[6/8] Verificando shadow host da extensão...');
  const hasShadow = await page.evaluate(() =>
    !!document.querySelector('#app-shadow-host')?.shadowRoot
  );
  console.log(`  → Shadow host existe: ${hasShadow}`);

  if (hasShadow) {
    console.log('[7/8] Listando módulos...');
    const modules = await page.evaluate(() => {
      const host = document.querySelector('#app-shadow-host');
      return Array.from(host.shadowRoot.querySelectorAll('[data-module-id]'))
        .map(el => el.getAttribute('data-module-id'));
    });
    console.log(`  → Módulos encontrados (${modules.length}):`, modules);
  } else {
    console.log('[7/8] Shadow host não encontrado — pulando listagem de módulos.');
  }

  console.log('[8/8] Salvando storage state...');
  const cookies = await page.cookies();
  const localStorageData = await page.evaluate(() =>
    JSON.parse(JSON.stringify(localStorage))
  );

  const sessionData = {
    url: page.url(),
    timestamp: new Date().toISOString(),
    cookies,
    localStorage: localStorageData,
  };

  const sessionPath = join(mettriDir, 'wa-session.json');
  writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
  console.log(`  → Session salva em: ${sessionPath}`);

  console.log('\n✅ Script concluído com sucesso.');

  await browser.disconnect();
}

main().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
