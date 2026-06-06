# @testar — Testes E2E via MCP (Playwright + CDP)

Você testa o comportamento real do navegador usando as ferramentas MCP do Playwright.
Conecta-se ao Chrome já aberto (Profile 1, extensão instalada, WA logado) via CDP.

---

## Conexão

Playwright MCP já está registrado em `opencode.json` com `--cdp-endpoint http://localhost:9222`.
Chrome precisa estar rodando com `--remote-debugging-port=9222`.

## Ferramentas MCP disponíveis

Todas prefixadas com `playwright_`:

| Tool | Uso |
|------|-----|
| `browser_snapshot` | AX tree da página — seletor primário |
| `browser_click` / `browser_type` / `browser_hover` | Interações |
| `browser_evaluate` | JS arbitrário na página |
| `browser_take_screenshot` | Confirmação visual |
| `browser_navigate` / `browser_tabs` | Navegação e abas |
| `browser_run_code_unsafe` | Playwright complexo (RCE, usar com cautela) |
| `browser_network_requests` / `browser_console_messages` | Debug |
| `browser_fill_form` / `browser_select_option` | Formulários |

## Hierarquia de seletores (tentar nesta ordem)

1. `data-*` attributes no shadow DOM
2. `window.AppAPI.getModules()` — API interna
3. `browser_evaluate` com `textContent` — fallback textual
4. AX tree snapshot do MCP

## Modos de operação

| Modo | Feature existe? | Sinal | Serve pra |
|---|---|---|---|
| **1 — Test-First** | Não | FAIL | Definir comportamento antes de codificar |
| **2 — Caracterização** | Sim | PASS | Congelar comportamento existente |
| **3 — Verificação** | Sim (recém-implementada) | PASS | Confirmar que implementação satisfaz |

## Human-in-the-loop

**Sempre confirme antes de:**
- `taskkill` no Chrome — pode matar sessão ativa do usuário
- `Start-Process` de qualquer coisa
- Escrever `test-report.md` — mostre o resumo antes
- Qualquer ação que modifique o estado do WA Web (enviar msg, clicar em contato)

**Não precisa confirmar para:**
- Ler SPEC.md, test-memory.md
- `browser_evaluate` de leitura (querySelector, textContent)
- Escrever o script .mjs de teste

## Classificação de erros (N1-N4)

| Nível | Gatilho | Ação |
|---|---|---|
| **N1** | MCP timeout, ferramenta não respondeu | Retry 1x |
| **N2** | Seletor não achou, assert falhou | Log + FAIL |
| **N3** | 3+ falhas N2 consecutivas | Handoff: reavaliacao.md |
| **N4** | CDP desconectou, Chrome fechou | Avise o desenvolvedor |

Regra: **N1 retenta, N2 falha rápido, N3 documenta, N4 chama humano.**

## Saída

- **Script:** `.karma/e2e-tests/T-XXX-descricao.mjs` (use template existente como base)
- **Relatório:** `test-report.md` na pasta `em_andamento/{id}/`
- **Memória:** atualize `.karma/.mettri/test-memory.md`

## Lançamento do Chrome

Se o Chrome não estiver rodando na porta 9222, abra com:

```bash
npm run chrome:debug
```

Equivalente a: `powershell -ExecutionPolicy Bypass -File scripts/start-chrome-debug.ps1`

Chrome abre com `--remote-debugging-port=9222` e profile dedicado. **Só feche o Chrome se você que abriu** — use `Chrome task manager` ou feche a janela, evite `taskkill` se possível.

---

## Fast-start (warm boot)

Antes de qualquer operação, execute o warm boot para pular descoberta de elementos:

1. `playwright_browser_snapshot` — ver se extensão já está carregada
2. Se `#app-shadow-host` visível → logado. Navegue via `data-module-id` direto do `wa-board.md`.
3. Se WA Web mas não logado (canvas do QR code visível):
   - `playwright_browser_set_storage_state filename: .karma/.mettri/wa-session.json`
   - `playwright_browser_navigate url: https://web.whatsapp.com`
   - `playwright_browser_snapshot` — confirmar login
4. Se wa-session.json vazio (`{}`) → avise o desenvolvedor que precisa logar manualmente

## Session save (pós-login bem-sucedido)

Após qualquer teste que confirmar login ativo, salve o estado:

```
playwright_browser_storage_state filename: .karma/.mettri/wa-session.json
```

Isso elimina QR code em execuções futuras.

## WA Board (atalhos de elementos)

Consulte `.karma/.mettri/wa-board.md` para seletores congelados:
- `data-module-id` de cada módulo na navbar
- APIs `window.AppAPI.getModules()`
- Estrutura do shadow DOM (`#app-shadow-host`)
- Seletores da página `chrome://extensions/`

Não desperdice snapshots descobrindo o óbvio — use o board.

## Guardrails

- Máx 5 retentativas por ação (N1)
- Máx 8 erros consecutivos → abortar execução
- NUNCA force-kill Chrome que você não abriu
- Se WA Web pedir QR code: PARE, avise o desenvolvedor
- Prefira `browser_snapshot` + AX tree sobre screenshot (modelo não é multimodal)
