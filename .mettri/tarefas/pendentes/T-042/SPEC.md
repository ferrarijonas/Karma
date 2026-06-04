---
id: T-042
titulo: "Fortalecer defesas anti-mock — gate determinístico, coverage, mutation sonda, auditoria de testes"
dominio: HARNESS
status: pendente
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
iniciado_em: null
concluido_em: null
heartbeat_ultimo: null
estimativa_min: 45
timeout_min: 120
escopo:
  modulos:
    - .karma/AGENTS.md
    - .karma/.opencode/agents/implementador.md
    - .karma/.opencode/agents/avaliador.md
    - .karma/.mettri/thresholds.yaml
    - .karma/scripts/check-mocks/
    - tests/unit/storage/message-capturer.test.ts
    - tests/unit/rag/orquestrador_indexacao_rag.test.ts
    - tests/unit/rag/orquestrador_consulta_rag.test.ts
    - tests/unit/rag/vectorIndexLocal.test.ts
    - tests/unit/marketing/retomar/diagnose-retomar-faixas.test.ts
    - tests/unit/marketing/retomar/retomar-import-dates-audit.test.ts
    - tests/e2e/auto-mapping.spec.ts
  nao_tocar:
    - src/**/*.ts
    - .karma/.mettri/memory.md
    - .karma/.mettri/sabotagens/
    - .karma/.mettri/template-SPEC.md
spec_ref: ""
tipo_output: "codigo"
migracao_necessaria: false
permite_mock: false
---

# T-042: Fortalecer defesas anti-mock

## Propósito

O sistema atual depende do @avaliador (outro LLM) para detectar mocks — sem enforcement determinístico. `min_coverage_pct: 0` desativa o gate de cobertura. E 9 testes usam `expect(true).toBe(true)` como placeholder. Esta tarefa introduz 4 camadas de defesa determinística para que o pipeline detecte testes vazios ANTES que um LLM precise "lembrar" de verificar.

## Escopo

- **Toca:**
  - `.karma/AGENTS.md` — adicionar `check-mocks` na ordem de verificação do gate-runner
  - `.karma/.opencode/agents/implementador.md` — atualizar fluxo do gate-runner
  - `.karma/.opencode/agents/avaliador.md` — adicionar sonda de mutation
  - `.karma/.mettri/thresholds.yaml` — `min_coverage_pct: 0 → 50`
  - `.karma/scripts/check-mocks/` — NOVO: script determinístico anti-mock
  - `tests/unit/storage/message-capturer.test.ts` — remover teste tautológico + reescrever
  - `tests/unit/rag/orquestrador_indexacao_rag.test.ts` — adicionar 1 teste de integração
  - `tests/unit/rag/orquestrador_consulta_rag.test.ts` — adicionar 1 teste de integração
  - `tests/unit/rag/vectorIndexLocal.test.ts` — remover `expect(true).toBe(true)`
  - `tests/unit/marketing/retomar/diagnose-retomar-faixas.test.ts` — remover `expect(true).toBe(true)`
  - `tests/unit/marketing/retomar/retomar-import-dates-audit.test.ts` — remover `expect(true).toBe(true)`
  - `tests/e2e/auto-mapping.spec.ts` — remover placeholders `expect(true).toBe(true)`

- **NÃO toca:**
  - `src/**/*.ts` — nenhuma lógica de produção é alterada
  - `.karma/.mettri/memory.md`, `sabotagens/`, `template-SPEC.md` — sem mudanças de contrato
  - Outros arquivos de teste além dos 6 listados

## O que já existe

- `AGENTS.md:230` — ordem atual: `lint → type-check → build → test:unit`
- `implementador.md:15` — gate-runner: `lint → typecheck → build → test:unit`
- `avaliador.md:86-93` — sondas adversariais (Mock Syndrome na linha 93, mas é prompt, não código)
- `avaliador.md:137` — critério de cobertura: `≥ thresholds.yaml.min_coverage_pct`
- `thresholds.yaml:9` — `min_coverage_pct: 0`
- `template-SPEC.md:27` — `permite_mock: false` como padrão
- `sabotagens/_global.md:50-58` — Mock Syndrome catalogado com sinais e antídotos
- `scripts/` — diretório com scripts utilitários (merge-claims, next-id, pulse, etc.), todos Node.js
- `message-capturer.test.ts:7,14` — 2 `vi.mock()` substituindo módulos internos; linha 48: `expect(true).toBe(true)`
- 9 ocorrências de `expect(true).toBe(true)` em 5 arquivos de teste (3 são placeholders E2E)
- Análise cross-codebase (2026-06-03): Claude Code NÃO tem gate determinístico anti-mock nem coverage mínima — ambas seriam vantagens exclusivas do Karma

## Onde verificar / input

- `.karma/AGENTS.md:230` — ordem de verificação atual
- `.karma/.opencode/agents/implementador.md:15` — fluxo do gate-runner
- `.karma/.opencode/agents/avaliador.md:86-93` — sondas adversariais (adicionar mutation)
- `.karma/.mettri/thresholds.yaml:9` — `min_coverage_pct: 0`
- `C:\Mettri4\tests\unit\storage\message-capturer.test.ts` — testes frágeis (mock de DB, `expect(true)`)
- `C:\Mettri4\tests\unit\rag\orquestrador_indexacao_rag.test.ts` — 100% mockado (spies em fonte, embed_index, guardar)
- `C:\Mettri4\tests\unit\rag\orquestrador_consulta_rag.test.ts` — 100% dependências injetadas como fakes
- `C:\Mettri4\tests\unit\rag\vectorIndexLocal.test.ts:40` — `expect(true).toBe(true)`
- `C:\Mettri4\tests\unit\marketing\retomar\diagnose-retomar-faixas.test.ts:51,60` — `expect(true).toBe(true)`
- `C:\Mettri4\tests\unit\marketing\retomar\retomar-import-dates-audit.test.ts:45,54` — `expect(true).toBe(true)`
- `C:\Mettri4\tests\e2e\auto-mapping.spec.ts:17,23,28` — placeholders `expect(true).toBe(true)`

## O que produzir / output

### Passo 1: Gate determinístico anti-mock

**Script `scripts/check-mocks/index.mjs`:**
- Lê o SPEC.md da tarefa atual (caminho passado como argumento ou inferido de `claims.yaml`)
- Extrai `permite_mock` do YAML frontmatter
- Se `false`: faz grep no `git diff --cached` + `git diff` (staged + unstaged) por estes padrões:
  - `vi.mock(`, `jest.mock(`, `vi.fn()`, `jest.fn()`, `vi.spyOn(`, `jest.spyOn(`
  - `mockResolvedValue`, `mockRejectedValue`, `mockImplementation`
  - `as unknown as` (type-cast mock — indicador forte)
- Se encontrar QUALQUER padrão → `exit 1` com mensagem listando arquivo:linha:padrão
- Se `true`: verifica se cada mock tem `// justificado:` no comentário da linha anterior ou mesma linha. Se faltar → `exit 1`
- Se nenhum mock → `exit 0` silencioso

**Integração no gate-runner:**
- `AGENTS.md:230` — alterar ordem para: `check-mocks → lint → type-check → build → test:unit`
- `implementador.md:15` — mesma alteração. Adicionar nota: "check-mocks é determinístico (script, não LLM). Se RED, corrija ANTES de prosseguir."
- No trail.md, o gate deve incluir: `check-mocks: ✓ | lint: ✓ | typecheck: ✓ | build: ✓ | test:unit: ✓`

### Passo 2: Coverage mínima

**`thresholds.yaml`:**
```yaml
min_coverage_pct: 50
```

**Nota:** O valor 50 é suficientemente baixo para não forçar overengineering, mas alto o suficiente para que um teste que mocka tudo e testa nada produza cobertura real baixa e seja rejeitado pelo @avaliador.

**`implementador.md`:** Adicionar ao gate-runner: `test:unit` passa a incluir `--coverage`. O implementador deve verificar se a cobertura está ≥ 50%. Se abaixo, o gate é RED (N2 — corrigir adicionando testes).

### Passo 3: Sonda de mutation no @avaliador

**`avaliador.md`:** Adicionar à lista de sondas adversariais (após linha 93):

```
- **Mutation:** escolha UMA função alterada no diff. Substitua o corpo por `return null`/`return []`/`throw new Error("mutated")`. Rode os testes. Se NENHUM teste quebrar → FAIL (teste tautológico detectado). Restaure o original imediatamente após.
```

A sonda é executada na Fase 4 pelo @avaliador. É UMA função por verificação — não mutation testing completo.

### Passo 4: Auditoria dos testes fracos

**`message-capturer.test.ts`:**
- Remover `vi.mock('../../src/storage/message-db', ...)` — substituir por fake IndexedDB (como feito em `memory-db.test.ts`)
- Remover `vi.mock('../../../config/selectors.json', ...)` — usar import real ou fixture inline
- Remover teste `'deve registrar callback'` (linhas 44-49) — `expect(true).toBe(true)` é tautológico
- Reescrever para testar o MessageCapturer com dependências reais (MessageDB fake, selectors carregados)

**`orquestrador_indexacao_rag.test.ts`:**
- Manter testes atuais (spies são aceitáveis para orquestrador)
- ADICIONAR 1 teste de integração: chain `fonte → embed_index → guardar` com implementações REAIS (IndexedDB fake, embedding real com vector fixo)

**`orquestrador_consulta_rag.test.ts`:**
- ADICIONAR 1 teste de integração: chain `buscar → embed_consulta → prompt → avaliar` com 2 dos 4 componentes reais

**Demais `expect(true).toBe(true)` (6 ocorrências em 3 arquivos):**
- `vectorIndexLocal.test.ts:40` — substituir por assert real (ex: verificar que índice foi criado)
- `diagnose-retomar-faixas.test.ts:51,60` — substituir por asserts reais
- `retomar-import-dates-audit.test.ts:45,54` — substituir por asserts reais
- `auto-mapping.spec.ts:17,23,28` — remover placeholders (teste E2E vazio é pior que nenhum teste)

## Onde salvar

- `.karma/scripts/check-mocks/index.mjs` — NOVO
- `.karma/scripts/check-mocks/package.json` — NOVO (type: module)
- `.karma/AGENTS.md` — EDITAR (linha 230: ordem de verificação)
- `.karma/.opencode/agents/implementador.md` — EDITAR (gate-runner + coverage)
- `.karma/.opencode/agents/avaliador.md` — EDITAR (sonda mutation, linha 93)
- `.karma/.mettri/thresholds.yaml` — EDITAR (min_coverage_pct)
- `../tests/unit/storage/message-capturer.test.ts` — EDITAR (reescrita)
- `../tests/unit/rag/orquestrador_indexacao_rag.test.ts` — EDITAR (+1 teste integração)
- `../tests/unit/rag/orquestrador_consulta_rag.test.ts` — EDITAR (+1 teste integração)
- `../tests/unit/rag/vectorIndexLocal.test.ts` — EDITAR (remover expect(true))
- `../tests/unit/marketing/retomar/diagnose-retomar-faixas.test.ts` — EDITAR
- `../tests/unit/marketing/retomar/retomar-import-dates-audit.test.ts` — EDITAR
- `../tests/e2e/auto-mapping.spec.ts` — EDITAR (remover placeholders)

## Como validar

- [ ] `scripts/check-mocks/index.mjs` detecta `vi.mock` e retorna exit 1 quando `permite_mock: false`
- [ ] `scripts/check-mocks/index.mjs` retorna exit 0 para diff sem mocks
- [ ] `scripts/check-mocks/index.mjs` exige `// justificado:` quando `permite_mock: true`
- [ ] Gate-runner executa `check-mocks` ANTES de `lint`
- [ ] `thresholds.yaml` contém `min_coverage_pct: 50`
- [ ] `implementador.md` inclui `--coverage` no comando `test:unit`
- [ ] `avaliador.md` lista sonda de mutation com instruções claras
- [ ] `message-capturer.test.ts` não contém `vi.mock`
- [ ] `message-capturer.test.ts` não contém `expect(true).toBe(true)`
- [ ] Nenhum `expect(true).toBe(true)` restante nos 6 arquivos listados
- [ ] `orquestrador_indexacao_rag.test.ts` tem pelo menos 1 teste de integração
- [ ] `orquestrador_consulta_rag.test.ts` tem pelo menos 1 teste de integração
- [ ] Gate-runner completo passa: `check-mocks ✓ | lint ✓ | typecheck ✓ | build ✓ | test:unit ✓`
- [ ] Cobertura dos arquivos modificados ≥ 50%
- [ ] Nenhum arquivo fora do escopo modificado
- [ ] Trail.md mostra gate GREEN com os 5 passos

## Mock Policy

- `permite_mock: false` — esta tarefa é SOBRE eliminar mocks desnecessários. Nenhum mock novo é permitido.
- O script `check-mocks` criado por esta tarefa será usado para verificar a PRÓPRIA tarefa (meta-circular). Como o SPEC.md tem `permite_mock: false`, qualquer `vi.mock`/`jest.mock` no diff desta tarefa resultará em gate RED.
- Testes modificados (message-capturer, orquestradores) devem usar dependências reais ou fakes fiéis (fake-indexeddb), não mocks.

---

## Sabotagens Herdadas

> domínio: HARNESS — catálogo: `sabotagens/_global.md`

- ⚠️ **Mock Syndrome** — irony: esta tarefa existe para combatê-lo. O script `check-mocks` é a defesa determinística. → **Antídoto:** o próprio script verifica esta tarefa. Se o implementador tentar mockar algo, o gate quebra.
- ⚠️ **Overengineering** — tentar fazer mutation testing completo (stryker) em vez de 1 sonda manual. → **Antídoto:** 1 função mutada por verificação do @avaliador. Nada de framework externo.
- ⚠️ **"Preciso de mais X antes de testar"** — postergar porque "preciso rodar todos os testes de integração primeiro". → **Antídoto:** os testes existentes já passam. As mudanças são incrementais. Rode o gate a cada checkpoint.
- ⚠️ **Perfeccionismo de threshold** — debater se `min_coverage_pct` deve ser 50, 60, ou 70. → **Antídoto:** 50 agora. O número pode ser ajustado depois com dados reais de tarefas concluídas.
- ⚠️ **Fazer tudo sozinho** — tentar implementar os 4 passos em 1 checkpoint. → **Antídoto:** 4 checkpoints (1 por passo). Cada checkpoint tem seu próprio gate GREEN.

## Memória Herdada

> buscado em `memory.md` por tags do domínio `HARNESS`

- **T-041 (Memory System):** `permite_mock: true` com `fake-indexeddb` como polyfill fiel. Serve de exemplo para a reescrita do `message-capturer.test.ts`: usar fake-indexeddb, não `vi.mock`.
- **T-040 (AgentLoop real):** padrão de implementação em fases (agente → tool → gate). Esta tarefa segue o mesmo padrão: script → threshold → sonda → auditoria.
- **Viés de Simplificação (HAR-01):** regras do Claude Code injetadas no implementador e avaliador. A sonda de mutation é uma extensão natural dessas regras: "não adicionar features além do pedido" aplicado a testes.
- **Generator-Evaluator (Anthropic):** separar quem faz de quem avalia. O script `check-mocks` é o "avaliador determinístico" que não depende de LLM — fecha o ciclo que o @avaliador (LLM) não consegue fechar sozinho.
