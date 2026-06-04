---
id: T-045
titulo: "Compactação de contexto — sliding window + sumarização de histórico"
dominio: HARNESS
status: pendente
prioridade: 3
dependencias: [T-041]
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
estimativa_min: 30
timeout_min: 90
escopo:
  modulos:
    - src/modules/ouvir/monta-prompt.ts
    - src/modules/harness/agent-loop.ts
    - src/modules/harness/inspector-popup.ts
  nao_tocar:
    - src/modules/harness/motor-llm.ts
    - src/modules/harness/ouvinte.ts
    - src/modules/harness/memory-store.ts
    - src/modules/harness/tool-registry.ts
spec_ref: ""
tipo_output: "codigo"
migracao_necessaria: false
permite_mock: false
---

# T-045: Compactação de contexto — sliding window + sumarização de histórico

## Propósito

O contexto enviado ao LLM cresce a cada turno da conversa. Sem compactação, conversas longas (>20 turnos) estouram o limite de tokens do modelo (DeepSeek ~8k tokens de contexto). Esta tarefa implementa sliding window + sumarização de tool results antigos para manter o prompt dentro do budget de tokens.

## Escopo

- **Toca:**
  - `src/modules/ouvir/monta-prompt.ts` — aplicar sliding window no `historicoContexto`, truncar se passar do budget, avisar o LLM sobre compactação
  - `src/modules/harness/agent-loop.ts` — passar `historicoContexto` já truncado, emitir evento `agent:compacting` quando houver compactação
  - `src/modules/harness/inspector-popup.ts` — ouvir evento `agent:compacting` e exibir indicador visual no timeline

- **NÃO toca:**
  - `src/modules/harness/motor-llm.ts` — a compactação é upstream, o motor recebe o prompt já enxuto
  - `src/modules/harness/ouvinte.ts` — o ouvinte coleta mensagens, a compactação é feita no montaPrompt
  - `src/modules/harness/memory-store.ts` — memórias já são selecionadas por keyword match (poucas), não precisam compactação
  - `src/modules/harness/tool-registry.ts`

## O que já existe

- `src/modules/ouvir/monta-prompt.ts` — monta o prompt final com `systemMessage`, `historicoContexto`, `memorias`, tools. O `historicoContexto` cresce sem limites.
- `src/modules/harness/agent-loop.ts` — loop principal: coleta mensagens do ouvinte → monta prompt → chama motor-llm → processa resposta → repete. Passa `historicoContexto` bruto para `montaPrompt`.
- `src/modules/harness/inspector-popup.ts` — popup de timeline que escuta eventos `agent:*` e exibe em tempo real. Já escuta 6 eventos.
- `src/modules/harness/motor-llm.ts` — chamada ao modelo DeepSeek com limite de ~8k tokens de contexto.

## Onde verificar / input

- `src/modules/ouvir/monta-prompt.ts` — função que monta o prompt final
- `src/modules/harness/agent-loop.ts` — onde `historicoContexto` é construído e passado
- `src/modules/harness/inspector-popup.ts` — sistema de eventos `agent:*`
- `src/modules/harness/motor-llm.ts` — limite de contexto (~8k tokens)

## O que produzir / output

### 1. Sliding window em `monta-prompt.ts`

```typescript
// Parâmetros configuráveis
const MAX_TURNOS = 10;
const MAX_TOKENS_ESTIMATED = 5600; // 70% de 8000
const CHARS_PER_TOKEN = 4; // estimativa conservadora

function compactarHistorico(historico: Turno[]): Turno[] {
  // Sliding window: manter no máximo MAX_TURNOS turnos recentes
  if (historico.length <= MAX_TURNOS) return historico;
  
  const recentes = historico.slice(-MAX_TURNOS);
  const compactados = historico.slice(0, -MAX_TURNOS);
  
  // Tool result compaction: substituir resultados de tools antigas por placeholder
  for (const turno of compactados) {
    if (turno.toolResult) {
      turno.toolResult = '[Resultado removido — economizar contexto]';
    }
  }
  
  return [...compactados, ...recentes];
}

function estimarTokens(texto: string): number {
  return Math.ceil(texto.length / CHARS_PER_TOKEN);
}
```

### 2. Budget check em `monta-prompt.ts`

- Antes de retornar o prompt final, estimar tokens totais
- Se > 70% do limite (~5600 tokens de 8000), truncar mensagens mais antigas
- Inserir aviso no prompt: `[Nota: histórico foi compactado para caber no limite de contexto. Mensagens anteriores a {timestamp} foram resumidas.]`

### 3. Evento `agent:compacting` em `agent-loop.ts`

- Se `montaPrompt` retornou com compactação, emitir evento antes de chamar o motor-llm:

```typescript
window.dispatchEvent(new CustomEvent('agent:compacting', {
  detail: { turnosOriginais: N, turnosCompactados: M, estimativaTokens: K }
}));
```

### 4. Indicador visual em `inspector-popup.ts`

- Escutar evento `agent:compacting`
- Adicionar entrada na timeline com indicador 🔄 e texto: "Contexto compactado: {N}→{M} turnos (~{K} tokens)"

## Onde salvar

- `src/modules/ouvir/monta-prompt.ts` — EDITAR (sliding window + budget check)
- `src/modules/harness/agent-loop.ts` — EDITAR (emitir evento agent:compacting)
- `src/modules/harness/inspector-popup.ts` — EDITAR (escutar evento e exibir indicador)

## Como validar

- [ ] Sliding window: máximo 10 turnos no historicoContexto
- [ ] Tool results antigos (fora da window) substituídos por placeholder `[Resultado removido — economizar contexto]`
- [ ] Budget de tokens: aviso inserido no prompt quando >70% (~5600 tokens de 8000)
- [ ] Aviso de compactação é claramente marcado no prompt para o LLM
- [ ] Evento `agent:compacting` emitido quando `montaPrompt` compacta o histórico
- [ ] InspectorPopup mostra indicador 🔄 com detalhes da compactação
- [ ] Gate: lint ✓ typecheck ✓ build ✓ test:unit ✓
- [ ] Nenhum arquivo fora do escopo modificado

## Mock Policy

- `permite_mock: false` — testar com histórico real simulado (array de turnos). A lógica de compactação é puramente funcional (entrada → saída), não precisa de mock de I/O. Testes unitários com dados sintéticos são suficientes.

---

## Sabotagens Herdadas

> domínio: HARNESS — catálogo: `sabotagens/_global.md`

- ⚠️ **Perfeccionismo** — passar 2h calculando tokens exatos com tokenizer real em vez de usar estimativa chars/4. → **Antídoto:** estimativa chars/4 é suficiente pro MVP. Pode ser refinado depois com dados reais.
- ⚠️ **Perder informação crítica** — sliding window corta mensagens antigas sem avisar o LLM. → **Antídoto:** inserir aviso explícito no prompt sempre que houver compactação.
- ⚠️ **Acoplamento** — agent-loop saber detalhes da compactação (budget, sliding window). → **Antídoto:** `montaPrompt` recebe `historicoContexto` e devolve truncado. agent-loop só emite o evento. Responsabilidade única.
- ⚠️ **Overengineering** — implementar sumarização semântica (LLM resumindo histórico) em vez de sliding window simples. → **Antídoto:** sliding window + placeholder de tool results. Sem LLM no loop de compactação.
- ⚠️ **Fazer tudo sozinho** — tentar implementar os 3 arquivos em 1 checkpoint gigante. → **Antídoto:** 3 checkpoints: (1) monta-prompt, (2) agent-loop, (3) inspector-popup. Cada um com seu próprio gate.

## Memória Herdada

> buscado em `memory.md` por tags do domínio `HARNESS`

- **T-043 (Inspector Popup):** já implementa 6 eventos `agent:*`. Adicionar `agent:compacting` segue o mesmo padrão de evento customizado com `window.dispatchEvent`.
- **T-040 (AgentLoop real):** o agent-loop atual passa `historicoContexto` bruto. Esta tarefa insere a camada de compactação sem alterar o fluxo geral.
- **DeepSeek contexto ~8k tokens:** descoberta durante T-040. Conversas com >20 turnos estouram esse limite. A compactação é necessária para viabilizar conversas longas.
- **Padrão de eventos (T-043):** InspectorPopup já escuta eventos com `window.addEventListener('agent:*', ...)`. Basta adicionar mais um listener no mesmo formato.
