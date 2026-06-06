# WA Board — Mapa de elementos estáveis

Registry de seletores congelados para navegação rápida no WhatsApp Web + extensão Mettri.
O @testar consulta este mapa em vez de descobrir elementos do zero.

---

## Extensão Mettri (shadow DOM)

Host: `#app-shadow-host` (tag `<mettri-root>`)

```
document.querySelector('#app-shadow-host')?.shadowRoot
```

### Barra de navegação (módulos)

| Módulo | data-module-id | Título |
|--------|---------------|--------|
| Atendimento | `atendimento` | Atendimento |
| Catálogo | `catalogo` | Catalogo |
| Vitrine | `vitrine` | Vitrine |
| Campanhas | `campanhas` | Campanhas — gestão e simulador de ofertas |
| Clientes | `clientes` | Clientes - Histórico de conversas |
| Infraestrutura | `infraestrutura` | Infraestrutura - Testes e Sentinela |
| Marketing | `marketing` | Marketing - Enviar |
| Cadastro | `cadastro` | Cadastro - Mapear compras já existentes |
| Pedidos | `pedidos` | Pedidos |

Seletor universal:
```javascript
host.shadowRoot.querySelector(`[data-module-id="atendimento"]`)
```

### Container principal

```javascript
host.shadowRoot.querySelector('#mettri-shadow-container')
host.shadowRoot.querySelector('#mettri-messages')
```

### API interna

```javascript
window.AppAPI.getModules()           // lista todos os módulos
window.AppAPI.getModule('atendimento') // módulo específico
window.Mettri?.module?.getModules()  // alternativa
```

---

## WA Web nativo

### Página de login (QR code)

Seletor do QR code presente:
```javascript
document.querySelector('canvas')
```

Se WA Web está logado:
```javascript
document.querySelector('#app')  // presente quando logado
```

### Estado da conexão

```javascript
window.require('WAWebSocketModel')?.Socket?.state
// Valores: 'CONNECTED' | 'OPENING' | 'PAIRING' | 'TIMEOUT'
```

---

## Chrome Extensions

Host: `chrome://extensions/`

```javascript
document.querySelector('extensions-manager')?.shadowRoot
  .querySelector('extensions-toolbar')?.shadowRoot
    .querySelector('#devMode')  // toggle modo desenvolvedor
```

```javascript
document.querySelector('extensions-manager')?.shadowRoot
  .querySelector('extensions-item-list')?.shadowRoot
    .querySelectorAll('extensions-item')  // todas as extensões
```

Cada `extensions-item` tem no shadowRoot:
```javascript
item.shadowRoot.querySelector('#name')    // nome da extensão
item.shadowRoot.querySelector('#reload')  // botão recarregar
```

---

## Sessão (storage state)

Arquivo de sessão salvo em: `.karma/.mettri/wa-session.json`

Salvar:
```
playwright_browser_storage_state filename: .karma/.mettri/wa-session.json
```

Restaurar (após navegar para web.whatsapp.com):
```
playwright_browser_navigate url: https://web.whatsapp.com
playwright_browser_set_storage_state filename: .karma/.mettri/wa-session.json
playwright_browser_navigate url: https://web.whatsapp.com  (recarrega com sessão)
```

---

## Fluxo rápido (warm start)

1. `playwright_browser_snapshot` — ver se WA já está logado
2. Se logado → `playwright_browser_evaluate` com `host.shadowRoot.querySelector('[data-module-id="atendimento"]')` → navega direto
3. Se não logado → restaurar sessão do `wa-session.json`
4. Se wa-session.json não existe → avisar dev que precisa logar manualmente
