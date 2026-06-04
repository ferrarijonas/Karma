---
id: T-043
titulo: "Agent Inspector Popup — timeline multi-abas em tempo real"
dominio: HARNESS
status: verificando_retroativo
prioridade: 2
dependencias: [T-040]
bloqueado_por: []
bloqueia: []
tentativas: 0
max_tentativas: 3
nivel_auto_cura: null
backoff_ms: 10000
max_backoff_ms: 300000
criado_em: "2026-06-03"
iniciado_em: null
concluido_em: null
heartbeat_ultimo: null
estimativa_min: 0
timeout_min: 0
escopo:
  modulos:
    - src/modules/harness/inspector-popup.ts
    - src/modules/index.ts
  nao_tocar: []
spec_ref: ""
tipo_output: "codigo"
migracao_necessaria: false
permite_mock: false
---

# T-043: Agent Inspector Popup — timeline multi-abas em tempo real

## Propósito

Popup flutuante acoplado ao painel Mettri que exibe em tempo real o que o agente está fazendo: mensagens recebidas, ferramentas chamadas, respostas dadas, erros. Organizado por abas de chatId com filtro de atividade recente (última hora), overflow button para chats inativos, resolvedor de nomes de contato via window.Store.Chat.

## Escopo

- **Toca:**
  - `src/modules/harness/inspector-popup.ts` — implementação completa (~526 linhas)
  - `src/modules/index.ts` — init do InspectorPopup com resolverNome callback

- **NÃO toca:** Nenhum outro arquivo. SPEC é retroativo — a implementação já existe e está funcional.

## O que já existe

- `src/modules/harness/inspector-popup.ts` — classe InspectorPopup com:
  - Popup flutuante com timeline de eventos por chatId (abas dinâmicas)
  - Máximo 5 abas visíveis (atividade na última hora)
  - Overflow "📋 +N" com dropdown para chats inativos
  - Resolvedor de nomes via `window.Store.Chat.get()` ou fallback `getModelsArray()`
  - Timeline com ícones de status: 🆕 turno-inicio, 🔧 tool-call, ✅ tool-result, 💬 respondendo, ❌ erro, 🛌 dormindo
  - Auto-scroll para novos eventos
  - Drag para reposicionar, resize para redimensionar
  - CSS injetado no `<head>`, sem Shadow DOM
  - 6 eventos `agent:*` escutados: `agent:turno-inicio`, `agent:tool-call`, `agent:tool-result`, `agent:resposta-pronta`, `agent:erro`, `agent:precisa-ferramenta`
- `src/modules/index.ts` — registra e inicializa o InspectorPopup passando callback `resolverNome`

## Onde verificar / input

- `src/modules/harness/inspector-popup.ts` — implementação completa
- `src/modules/index.ts` — ponto de inicialização
- Painel Mettri em execução — inspecionar visualmente o popup

## O que produzir / output

Esta é uma SPEC **retroativa** — o código já está implementado, testado e aprovado. Nenhuma produção nova é necessária. A SPEC formaliza o contrato para registro histórico.

## Onde salvar

- Já implementado: `src/modules/harness/inspector-popup.ts`
- Já integrado: `src/modules/index.ts`

## Como validar

- [x] Popup flutuante com timeline de eventos por chatId
- [x] Abas dinâmicas, no máximo 5 visíveis (última hora de atividade)
- [x] Overflow "📋 +N" com dropdown para chats inativos
- [x] Resolvedor de nomes via window.Store.Chat.get() ou fallback getModelsArray()
- [x] Timeline com ícones de status (✅ thinking, ⚡ tool, 💬 respondendo, ❌ erro, 💤 dormindo)
- [x] Auto-scroll para novos eventos
- [x] Drag para reposicionar, resize para redimensionar
- [x] CSS injetado no <head> da página, sem Shadow DOM
- [x] Gate: lint ✓ typecheck ✓ construir ✓ test ✓
- [ ] Nenhum arquivo fora do escopo modificado

## Mock Policy

- `permite_mock: false` — SPEC retroativa. Nenhum mock novo é permitido. O código já está em produção.

---

## Sabotagens Herdadas

> domínio: HARNESS — catálogo: `sabotagens/_global.md`

- ⚠️ **Overengineering** — popup com drag, resize, abas dinâmicas, overflow. Mas é funcionalidade UI explícita e necessária para debug em tempo real. → **Antídoto:** o escopo está fechado. Não adicionar novas features (filtros, busca, temas).
- ⚠️ **Perfeccionismo de UI (só CSS, sem lógica)** — gastar tempo ajustando estética do popup. → **Antídoto:** lógica já implementada. CSS já injetado. Não reestilizar.
- ⚠️ **Fazer tudo sozinho** — esta SPEC é retroativa, o trabalho já foi feito no ciclo T-040. → **Antídoto:** apenas formalizar.

## Memória Herdada

> buscado em `memory.md` por tags do domínio `HARNESS`

- **T-040 (AgentLoop real):** ciclo que gerou este popup como ferramenta de debug. O InspectorPopup nasceu da necessidade de ver o que o agente faz em tempo real durante o desenvolvimento do AgentLoop.
- **Padrão de eventos:** os 6 eventos `agent:*` seguem o mesmo padrão de eventos customizados usado no AgentLoop (`agent:thinking`, `agent:respondendo`, etc.).
- **Resolvedor de nomes:** fallback `getModelsArray()` veio de descoberta durante T-040 — window.Store.Chat.get() nem sempre está disponível.
