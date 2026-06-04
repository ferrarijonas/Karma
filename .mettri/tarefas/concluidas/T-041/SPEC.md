---
id: T-041
titulo: "Memory System — persistência de 4 tipos de memória com recall seletivo"
dominio: HARNESS
status: concluido
prioridade: 1
dependencias:
  - T-040
bloqueado_por: []
bloqueia:
  - T-042
  - T-044
  - T-045
tentativas: 0
max_tentativas: 3
nivel_auto_cura: null
backoff_ms: 10000
max_backoff_ms: 300000
criado_em: "2026-06-03"
iniciado_em: "2026-06-03T14:30:00Z"
concluido_em: "2026-06-03T19:30:00Z"
heartbeat_ultimo: "2026-06-03T19:30:00Z"
estimativa_min: 45
timeout_min: 120
escopo:
  modulos:
    - src/storage/memory-db.ts
    - src/modules/harness/memory-store.ts
    - src/modules/harness/types.ts
    - src/modules/ouvir/monta-prompt.ts
    - src/modules/ouvir/ouvinte.ts
  nao_tocar:
    - agent-loop.ts
    - tool-registry.ts
    - tools/*
    - inspector-popup.ts
    - motor-llm.ts
spec_ref: ""
tipo_output: "codigo"
migracao_necessaria: false
permite_mock: true
---

# T-041: Memory System — persistência de 4 tipos de memória com recall seletivo

## Propósito

O AgentLoop atual processa 1 mensagem por vez e "esquece" tudo entre turnos. Sem memória persistente, o agente não consegue manter uma conversa — no segundo turno já perdeu o contexto do primeiro. Esta tarefa implementa o sistema de memória com 4 tipos taxonômicos (inspirados no design do claude-code, adaptados para negócio de varejo/alimentação), persistência em IndexedDB, e injeção estruturada no prompt do LLM com separação static/dynamic.

## Escopo

- **Toca:**
  - `src/storage/memory-db.ts` — NOVO: classe MemoryDB com IndexedDB (schema: id, tipo, descricao, chatId?, dados, criada_em, atualizada_em)
  - `src/modules/harness/memory-store.ts` — NOVO: classe MemoryStore com prepararContexto(), salvarTurno(), atualizarPerfil()
  - `src/modules/harness/types.ts` — refinar interface `Memoria` para alinhar com os 4 tipos e novos campos
  - `src/modules/ouvir/monta-prompt.ts` — adicionar campo `memorias` no MontarPromptInput, estruturar userPrompt com 3 seções (diretrizes do negócio, preferências do cliente, conversa atual)
  - `src/modules/ouvir/ouvinte.ts` — adicionar chamada `memoryStore.prepararContexto()` entre estadoPercebido e dispatcher do AgentLoop (~linha 413). NÃO remover lógica existente.

- **NÃO toca:**
  - `agent-loop.ts` — só recebe `context` enriquecido, sem alterações internas
  - `tool-registry.ts`
  - `tools/*`
  - `inspector-popup.ts`
  - `motor-llm.ts`

## O que já existe

- `agent-loop.ts` — AgentLoop funcional com DeepSeek function calling (T-040), recebe contexto via 3º parâmetro (mensagem, tools, contexto enriquecido)
- `motor-llm.ts` — `ouvinteLlm()` com function calling, chama DeepSeek API
- `ouvinte.ts` — pipeline de atendimento: extração de perfil → classificação de intenção → dispatcher AgentLoop. Ring buffer `chatHistory` preserva histórico recente de mensagens.
- `monta-prompt.ts` — monta system prompt (cacheável) + user prompt (dinâmico) para o LLM do módulo ouvir
- `types.ts` — interface `Memoria` existente, interfaces do AgentLoop (`AgentTurno`, `ToolDescription`, `LlmToolResponse`)
- `tool-registry.ts` — registry consolidado com validação Zod (T-037), `listarDisponiveis()` retorna ToolDescription[]
- Padrão claude-code (explorado em 2026-06-03): taxonomia de 4 tipos, freshness tracking, boundary static/dynamic, micro-compact

## Onde verificar / input

- `src/modules/ouvir/ouvinte.ts` — linha ~400 (estadoPercebido) até ~415 (dispatcher), ponto exato de inserção
- `src/modules/ouvir/monta-prompt.ts` — interface `MontarPromptInput`, função `buildUserPrompt()`, estrutura atual do userPrompt
- `src/modules/harness/types.ts` — interface `Memoria` existente para extensão
- ZenSpec: `prompts/decisao-sistema.md` (tool-use instructions), `prompts/identidade-padaria.md` (swappable per business)

## O que produzir / output

### 1. MemoryDB (`src/storage/memory-db.ts`)
Classe com IndexedDB gerenciando tabela única `memories`:
- Schema: `id` (auto-increment), `tipo` (cliente|licao|negocio|referencia), `descricao` (string indexada), `chatId` (string opcional, indexada), `dados` (any), `criada_em` (ISO8601), `atualizada_em` (ISO8601)
- `getRelevantes(chatId, query, max=5)`: keyword match simples na `descricao`, retorna as N mais recentes com freshness warning (>2 dias → inclui "⚠️ registrada há X dias")
- `getPorTipo(tipo, chatId?)`: busca todas de um tipo, opcionalmente filtradas por chatId
- `merge(dados)`: upsert por id composto (tipo + chatId + descricao)
- `listarTipos()`: contagem por tipo

### 2. MemoryStore (`src/modules/harness/memory-store.ts`)
Orquestrador acima do MemoryDB:
- `prepararContexto(chatId, mensagem)`: busca memórias relevantes dos 4 tipos via keyword match, retorna estrutura `{ cliente: string[], licoes: string[], negocio: string[], referencias: string[] }`
- `salvarTurno(turno: AgentTurno)`: persiste o turno como memória tipo `licao` se contiver aprendizados (correções, confirmações, padrões detectados)
- `atualizarPerfil(chatId, dados)`: merge incremental no perfil do cliente (tipo `cliente`), preserva campos existentes não sobrescritos

### 3. montaPrompt.ts estendido
- Novo campo opcional `memorias` no `MontarPromptInput`
- `userPrompt` estruturado em 3 seções com boundary explícito:
  ```
  DIRETRIZES DO NEGÓCIO (siga estritamente — têm precedência)
  • [memórias tipo 'negocio']
  • [memórias tipo 'referencia']
  ⚠️ [freshness warnings]

  PREFERÊNCIAS DO CLIENTE
  • [memórias tipo 'cliente']
  • [memórias tipo 'licao']
  ⚠️ [freshness warnings]

  CONVERSA ATUAL
  • mensagem, catálogo, histórico recente, estado percebido
  ```
- Cabeçalhos genéricos (não "REGRAS DA PADARIA" — o Mettri é multi-negócio)

### 4. ouvinte.ts — integração mínima
- Entre o cálculo de `estadoPercebido` e o dispatcher `mettriHarness.loop.processarMensagem()`:
  ```typescript
  const memorias = await memoryStore.prepararContexto(chatId, text);
  ```
- Passar `memorias` dentro do objeto `context` (junto com profile, catalogoCandidatos, estadoPercebido, historicoContexto)
- Ring buffer `chatHistory` preservado — T-041 adiciona, não remove

## Onde salvar

- `src/storage/memory-db.ts` — NOVO
- `src/modules/harness/memory-store.ts` — NOVO
- `src/modules/harness/types.ts` — EDITAR (refinar interface Memoria)
- `src/modules/ouvir/monta-prompt.ts` — EDITAR (adicionar memorias ao MontarPromptInput + userPrompt)
- `src/modules/ouvir/ouvinte.ts` — EDITAR (1 chamada adicionada, ~5 linhas)
- `tests/unit/storage/memory-db.test.ts` — NOVO (testes com fake-indexeddb)
- `tests/unit/harness/memory-store.test.ts` — NOVO (testes com fake-indexeddb)

## Como validar

- [ ] `MemoryDB` com 4 tipos operando em IndexedDB (fake-indexeddb nos testes)
- [ ] `MemoryStore.prepararContexto()` retorna estrutura com arrays populados por keyword match
- [ ] Freshness warning ativo para memórias com >2 dias
- [ ] `montaPrompt()` injeta `memorias` no `userPrompt` com 3 seções e boundary
- [ ] Prefácio de override: "siga estritamente — têm precedência" nas diretrizes
- [ ] `ouvinte.ts` chama `memoryStore.prepararContexto()` antes de disparar AgentLoop
- [ ] Ring buffer `chatHistory` do ouvinte preservado (T-041 adiciona, não remove)
- [ ] Gate: lint ✓ typecheck ✓ build ✓ test:unit ✓ (248/248)
- [ ] Nenhum arquivo fora do escopo modificado

## Mock Policy

- `permite_mock: true` — definido no YAML frontmatter
- **Permitido:** `fake-indexeddb` nos testes unitários de MemoryDB e MemoryStore. Justificado: IndexedDB só existe em ambiente de browser; testes unitários em Node.js precisam do polyfill.
- **Proibido:** Array em memória como substituto do IndexedDB. O fake-indexeddb é um polyfill fiel — usar array em vez disso é mock leakage (Sabotagem #2).
- Cada uso de fake-indexeddb deve ter o comentário `// justificado: IndexedDB não disponível em Node.js, fake-indexeddb é polyfill fiel`.

---

## Taxonomia de Memória

| Tipo | Escopo | Persistência | Conteúdo |
|---|---|---|---|
| `cliente` | Por chatId | LTM | Quem é, preferências, restrições, endereço, pagamento |
| `licao` | Por chatId | LTM | Aprendizados: correções, confirmações, padrões |
| `negocio` | Global | LTM | Como o negócio opera: horários, políticas, promoções, status |
| `referencia` | Global | LTM | Links, códigos, contatos externos |

## Estratégia de Implementação

1. **MemoryDB primeiro** — classe com IndexedDB + fake-indexeddb nos testes. Validar CRUD completo.
2. **MemoryStore em seguida** — orquestrador que depende apenas de MemoryDB e tipos. Sem acoplamento com agent-loop ou motor-llm.
3. **montaPrompt estendido** — adicionar campo `memorias` ao input, estruturar userPrompt com 3 seções. Testes unitários com memórias mockadas.
4. **ouvinte.ts — integração mínima** — 1 chamada, ~5 linhas. Se o memoryStore falhar (IndexedDB não disponível), contexto segue sem memórias (degradação graciosa, sem throw).
5. **Gate final** — lint → typecheck → build → test:unit (248/248)

## Sabotagens Herdadas

> domínio: HARNESS — catálogo: `sabotagens/_global.md`

- ⚠️ **Overengineering** — criar sistema de embedding antes do keyword match funcionar. → **Antídoto:** keyword match primeiro. Embedding local (transformers.js) só quando >50 memórias.
- ⚠️ **Mock leakage** — testar com array em memória em vez de IndexedDB real. → **Antídoto:** usar fake-indexeddb nos testes unitários. Array em memória não é IndexedDB.
- ⚠️ **"Preciso de mais X antes de testar"** — postergar porque "falta o embedding". → **Antídoto:** testar com 3 memórias mock no IndexedDB. O sistema funciona com keyword match desde o primeiro commit.
- ⚠️ **Acoplamento** — memory-store importar motor-llm ou agent-loop. → **Antídoto:** memory-store só conhece MemoryDB e tipos. Loop recebe o que o ouvinte passa.
- ⚠️ **Perfeccionismo de prompt** — passar 2h ajustando a formatação das seções. → **Antídoto:** 3 memórias + boundary claro = suficiente. @avaliador acha edge cases.

## Memória Herdada

> buscado em `memory.md` por tags do domínio `HARNESS`

- **T-040 (AgentLoop real):** AgentLoop funcional com DeepSeek function calling, contexto injetado via 3º parâmetro. A integração do memory-store segue o mesmo padrão: enriquecer contexto, não modificar o loop.
- **T-037 (ToolRegistry):** registry com validação Zod consolidado. MemoryStore segue o mesmo princípio: classe autocontida, sem acoplamento com o resto do harness.
- **T-039 (InspectorPopup):** inspector escutando 6 eventos agent:*. MemoryStore não emite eventos — adiciona dados ao contexto silenciosamente.
- **Padrão claude-code:** taxonomia de 4 tipos, freshness tracking, boundary static/dynamic, micro-compact. Implementado como especificado, sem abstrações extras.
- **T-014 (Centralizar chaves):** "não criar sistema de config provider, só dois campos no Settings" — mesma filosofia: MemoryDB é uma classe, não um framework de persistência.
- **T-034 (Ouvinte LLM):** estrutura de prompts com seções independentes (identidade, extração, resposta). O `montaPrompt` estendido segue o mesmo padrão de seções com boundary explícito.
- **YAML `...`:** NUNCA usar `...` como placeholder em frontmatter YAML. Js-yaml interpreta como fim de documento. (memory.md, descoberto em T-019)
- **Context anxiety (Anthropic):** modelos tendem a "declarar vitória" quando contexto se aproxima do limite. A separação static/dynamic no userPrompt mitiga isso: diretrizes do negócio são compactas e estáveis, conversa atual é volátil.
