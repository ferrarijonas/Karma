---
id: T-041
titulo: "Memory System — persistência de 4 tipos de memória com recall seletivo"
dominio: HARNESS
status: concluido
concluido_em: "2026-06-03T19:30:00Z"
criado_em: "2026-06-03"
iniciado_em: "2026-06-03T14:30:00Z"
tentativas: 1
gates: [lint, typecheck, build, test]
veredito_avaliador: PASS
---

# Relatório de Consolidação — T-041: Memory System

## Resumo Executivo

Sistema de memória persistente com 4 tipos taxonômicos (cliente, licao, negocio, referencia) implementado no harness do Mettri. MemoryDB gerencia IndexedDB com upsert por chave composta, keyword match case-insensitive e freshness warning. MemoryStore orquestra preparação de contexto, salvamento de turnos e atualização incremental de perfil. Integração no ouvinte injeta memórias no contexto do AgentLoop com degradação graciosa. 23 novos testes unitários com fake-indexeddb. Gate final: 271/271 testes verdes.

## O que foi implementado

### Arquivos criados
| Arquivo | Descrição |
|---------|-----------|
| `src/storage/memory-db.ts` | Classe MemoryDB com IndexedDB gerenciando store `memories`. Índices por tipo, chatId, criada_em, e composto (tipo+chatId+descricao) para upsert. Métodos: getRelevantes (keyword match substring CI + freshness warning), getPorTipo, merge (upsert), listarTipos. Schema: id, tipo, descricao, chatId?, dados?, criada_em, atualizada_em. |
| `src/modules/harness/memory-store.ts` | Classe MemoryStore — orquestrador com prepararContexto() (busca nos 4 tipos por keyword match), salvarTurno() (persiste aprendizados como tipo `licao`), atualizarPerfil() (merge incremental no tipo `cliente`). Degradação graciosa com try-catch interno. |
| `tests/unit/storage/memory-db.test.ts` | 11 testes: CRUD, keyword match, freshness warning, upsert merge, contagem por tipo, isolamento entre testes (clearAll). |
| `tests/unit/harness/memory-store.test.ts` | 12 testes: prepararContexto com match em 4 tipos, salvarTurno com detecção de aprendizado, atualizarPerfil com merge incremental, degradação graciosa em falha. |

### Arquivos editados
| Arquivo | Descrição |
|---------|-----------|
| `src/modules/harness/types.ts` | Interface `Memoria` refinada: 4 tipos (cliente|licao|negocio|referencia), novos campos (descricao, chatId?, dados?, criada_em, atualizada_em). Removidos MemoriaEscopo, conteudo, validaAte. |
| `src/modules/ouvir/monta-prompt.ts` | Adicionado campo `memorias?: ContextoMemorias` no MontarPromptInput. userPrompt reformulado com 3 seções: DIRETRIZES DO NEGÓCIO, PREFERÊNCIAS DO CLIENTE, CONVERSA ATUAL. Freshness warnings ao final. Cabeçalhos genéricos (multi-negócio). |
| `src/modules/ouvir/ouvinte.ts` | Adicionado import do memoryStore + chamada `memoryStore.prepararContexto(chatId, text)` entre estadoPercebido e dispatcher do AgentLoop. Memórias passadas no objeto de contexto. Degradação graciosa com `.catch(() => undefined)`. Ring buffer preservado. |

## Resultado dos Gates

| Gate | Resultado | Detalhes |
|------|-----------|----------|
| **lint** | ✅ PASS | 0 erros nos meus arquivos (4 erros pré-existentes em ouvinte.ts ignorados) |
| **typecheck** | ✅ PASS | Sem erros de tipo |
| **build** | ✅ PASS | Build completo sem erros |
| **test:unit** | ✅ PASS | 271/271 testes (42 files), 23 novos |
| **@avaliar** | ✅ PASS | Veredito adversarial: spec compliance, escopo respeitado, sabotagens resistidas |

## Aprendizados (para memory.md)

### Técnicos
- **IndexedDB pattern**: O padrão do projeto usa `keyPath` + `autoIncrement`, com `ensureReady()` pattern e `fake-indexeddb/auto` disponível globalmente via `tests/setup.ts`.
- **Chave composta para upsert**: `tipo + chatId + descricao` como chave composta permite upsert sem duplicação de tuplas.
- **Comunicação via types**: MemoryStore e monta-prompt se comunicam via type-only import (`ContextoMemorias`), sem dependência circular.
- **Ponto de inserção**: O ponto exato para injeção de contexto no ouvinte é antes do dispatch do AgentLoop, dentro do `if (result.ok)` block (~linha 413).
- **Isolamento entre testes**: Necessário `clearAll()` explícito no MemoryDB para evitar contaminação entre testes com fake-indexeddb (tabela única compartilhada).

### De processo
- **Commit scoping**: O @avaliar detectou que o commit inicial incluía 7 arquivos de T-040 (vazamento de escopo). Corrigido com reset seletivo. Lição: verificar `git diff` antes de submeter para avaliação.
- **freshness tracking**: Freshness warning >2 dias é implementado com cálculo de diferença de timestamps na exibição, sem alterar a persistência.
- **ChatId vazio**: ChatId deve ser normalizado para `''` no IndexedDB quando não especificado, para que a chave composta funcione corretamente em upserts globais.

### Sabotagens resistidas (para catálogo)
- **Overengineering** → Resistido: keyword match simples (substring), sem embedding. Embedding local (transformers.js) postergado para >50 memórias.
- **Mock leakage** → Resistido: fake-indexeddb real nos testes, não array em memória. Comentário de justificativa em cada uso.
- **Acoplamento** → Resistido: MemoryStore só importa MemoryDB + types. Não importa motor-llm, agent-loop ou tool-registry.
- **Perfeccionismo de prompt** → Resistido: 3 seções com `•` bullet e boundary claro. Sem refinamento excessivo de formatação.
- **"Preciso de mais X"** → Resistido: testado com 4 tipos desde o primeiro commit. Sem esperar por embedding.
- **Vazamento de escopo** → Detectado e corrigido: commit inicial incluía arquivos de T-040. Corrigido com reset seletivo antes da avaliação.

## Fragilidades Registradas

1. **Keyword match é substring case-insensitive simples** — não há suporte a stemming, sinônimos ou relevância tf-idf. Adequado para <50 memórias. Acima disso, embedding se torna necessário.
2. **IndexedDB é browser-only** — `fake-indexeddb` nos testes é suficiente para CI, mas o sistema depende de IndexedDB estar disponível no runtime alvo (browser ou Electron). Se rodar em Node.js puro sem polyfill, `prepararContexto` retorna vazio (degradação graciosa).
3. **Sem TTL/expurgo** — memórias acumulam indefinidamente. Futuramente pode ser necessário política de retenção por tipo (ex: `licao` expurga após 90 dias sem acesso).
4. **4 erros pré-existentes de lint em ouvinte.ts** — linhas 45, 60, 229. Não foram tocados por T-041 conforme escopo. Precisam ser endereçados em tarefa futura.

## Sabotagens Herdadas (reamostradas)

> As sabotagens abaixo foram confirmadas ativas durante a implementação. Mantidas em catálogo para tarefas futuras do domínio HARNESS.

- ⚠️ **Overengineering** — sistema pede embedding, mas keyword match resolve até 50 memórias.
- ⚠️ **Mock leakage** — tentação de usar array em vez de IndexedDB real nos testes.
- ⚠️ **Acoplamento** — memory-store tende a importar agent-loop. Resistir.
- ⚠️ **Perfeccionismo de prompt** — ajustar formatação por horas é armadilha.

## Comandos para o Karma

```yaml
# 1. Mover diretório
# mv .mettri/tarefas/pendentes/T-041 .mettri/tarefas/concluidas/T-041

# 2. Liberar claim (claims.yaml)
# Editar claims.yaml: remover lock do domínio HARNESS, adicionar ao histórico

# 3. Desbloquear dependentes
# T-042, T-044, T-045 estão bloqueadas por T-041 — verificar se podem ser despachadas

# 4. Atualizar HTML (tarefas.html)
# .karma/next-id.mjs sync-html (ou ferramenta equivalente)
```

## Memórias para Consolidação (@aprender)

Sugestão de entradas para memory.md:

```yaml
- tag: HARNESS.persistencia
  aprendizado: "IndexedDB com keyPath+autoIncrement + ensureReady() é o padrão de persistência. fake-indexeddb/auto via setup global."
  origem: "T-041"

- tag: HARNESS.comunicacao
  aprendizado: "Módulos do harness se comunicam via type-only imports. MemoryStore exporta tipos, monta-prompt importa só o type."
  origem: "T-041"

- tag: HARNESS.escopo
  aprendizado: "Vazamento de escopo em commits é detectável pelo @avaliar via git diff. Verificar diff antes de submeter."
  origem: "T-041"

- tag: HARNESS.acoplamento
  aprendizado: "Sabotagem de acoplamento resistida: MemoryStore só conhece MemoryDB+types, sem importar agent-loop ou motor-llm."
  origem: "T-041"

- tag: HARNESS.testes
  aprendizado: "clearAll() explícito é necessário no MemoryDB para isolamento entre testes com fake-indexeddb."
  origem: "T-041"
```
