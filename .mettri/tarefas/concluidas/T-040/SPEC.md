---
id: T-040
titulo: "Agent Loop real — substituir mockDecidir() por DeepSeek function calling"
dominio: HARNESS
status: concluido
prioridade: 1
dependencias: []
bloqueado_por: []
bloqueia: []
tentativas: 0
max_tentativas: 3
nivel_auto_cura: null
backoff_ms: 10000
max_backoff_ms: 300000
criado_em: "2026-06-03"
iniciado_em: "2026-06-03"
concluido_em: "2026-06-03T12:45:00Z"
heartbeat_ultimo: null
estimativa_min: 20
timeout_min: 90
escopo:
  modulos:
    - agent-loop.ts
    - motor-llm.ts
  nao_tocar:
    - tool-registry.ts
    - tools/*
    - inspector-popup.ts
    - ouvinte.ts
    - storage/*
    - ui/*
    - types.ts
    - llm-tool-parser.ts
spec_ref: ""
tipo_output: "codigo"
migracao_necessaria: false
permite_mock: false
---

# T-040: Agent Loop real — substituir mockDecidir() por DeepSeek function calling

## Propósito

Substituir a decisão mockada (`Math.random`) do AgentLoop por chamada real ao DeepSeek com function calling, permitindo que o agente decida qual tool chamar ou quando responder baseado na mensagem do cliente.

## Escopo

- **Toca:**
  - `agent-loop.ts` — substituir `mockDecidir()` e o while decisório por chamadas reais ao LLM com tools + histórico do turno
  - `motor-llm.ts` — adicionar/exportar função pública para chamada de ciclo (LLM com tools + histórico), sem acoplar o agent-loop ao módulo ouvinte
- **NÃO toca:**
  - `tool-registry.ts` — completo com validação Zod e execução real
  - `tools/*` — 5 ferramentas reais já funcionam
  - `inspector-popup.ts` — timeline visual consome eventos agent:* e não precisa de alteração
  - `llm-tool-parser.ts` — já parseia tool_calls corretamente
  - `types.ts` — interfaces já definidas
  - `ouvinte.ts` — já dispara `loop.processarMensagem()`

## O que já existe

- `agent-loop.ts` — esqueleto com while decisório, travas (maxTools=8, maxDuracaoMs=30s, maxRepeticoes=3), emissão de eventos agent:*
- `motor-llm.ts` — `ouvinteLlm()` já suporta function calling (tools + tool_choice: auto), chama DeepSeek API
- `llm-tool-parser.ts` — parseia tool_calls da DeepSeek em `{ tipo, nome, argumentos }`
- `types.ts` — `ToolDescription`, `LlmToolResponse` (responder/tool_use/preciso_ferramenta), `ToolCall`, eventos agent:*

## O que produzir

AgentLoop.processarMensagem() modificado para:
1. Montar array `ToolDescription[]` a partir do registry
2. Chamar LLM com tools + mensagem original + resultados parciais do turno
3. Executar tool ou responder conforme retorno do LLM
4. Repetir até LLM responder ou estourar travas de segurança

## Como validar

- [ ] `mockDecidir()` removido — zero referências a `Math.random()` no agent-loop.ts
- [ ] Agent-loop chama LLM real e recebe `tool_use` com argumentos válidos
- [ ] Tools executadas com argumentos reais (não mais `{}`)
- [ ] Resposta `'responder'` interrompe loop e emite `agent:resposta-pronta`
- [ ] Travas preservadas: maxTools=8, maxDuracaoMs=30s, maxRepeticoes=3
- [ ] lint passa (0 erros)
- [ ] typecheck passa (0 erros)
- [ ] construir passa
- [ ] Nenhum arquivo fora do escopo modificado

## Estratégia

1. Exportar função `agenteDecidir(tools, mensagem, historicoToolResults)` em `motor-llm.ts` que chama `ouvinteLlm()` com tools preenchidos
2. Agent-loop troca `mockDecidir()` por chamada a essa função
3. Reaproveita 100% do que existe — sem nova abstração

## Sabotagens Herdadas

> domínio: HARNESS

- ⚠️ Overengineering → não criar interface nova entre agent-loop e LLM. `ouvinteLlm()` já aceita tools e retorna `LlmToolResponse`.
- ⚠️ Mock leakage → remover `mockDecidir()` completamente, sem fallback com Math.random()
- ⚠️ Acoplamento → agent-loop não importa ouvinte. Usar reexportação limpa via `harness/index.ts` ou função estática.

## Memória Herdada

- T-037 (ToolRegistry + types): registry com validação Zod consolidado. Usar `registry.listarDisponiveis()` pra montar ToolDescription[].
- T-038 (Tools + parser): 5 tools reais. Parser cobre tool_calls DeepSeek.
- T-039 (Inspector + integração): ouvinte.ts já dispara agent-loop. Só precisa do loop real.
