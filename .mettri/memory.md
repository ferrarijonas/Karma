# memory.md — aprendizados operacionais

Regra: só entra aqui o que NÃO está em ZenSpec.
Se um padrão aparece 3x em 3 sessões → vire spec → remova daqui.

---

## Padrões e aprendizados

### T-034 — Ouvinte LLM: substituição dos regex por 1 chamada DeepSeek (ATENDIMENTO, ouvir) (Sat May 31 2026)
- **O que foi criado:** `src/modules/ouvir/ouvinte-llm.ts` — módulo que chama DeepSeek via MettriBridgeClient. Substitui o pipeline antigo (extrator → ambiguidade → sinais-release → decisor) por **1 chamada LLM** que extrai perfil + classifica intenção + gera resposta sugerida.
- **Arquitetura de prompts:** Estrutura de `prompts/` na raiz com seções independentes (identidade, extração, resposta). `montar-prompt.ts` junta as seções em system prompt (cacheável) + user prompt (dinâmico). Modelo do Claude Code.
- **Problemas resolvidos:**
  1. **Delta extraction invertido:** `buildUserPrompt` mostrava campos PREENCHIDOS — corrigido para mostrar APENAS VAZIOS
  2. **Trava de catálogo:** LLM inventava produtos — agora instrução "SÓ da lista, IGNORE se não estiver"
  3. **Catálogo vazio também é baixa:** Antes "extraia livremente" (confiança implícita alta) — agora "extraia com confiança baixa"
  4. **Critério de confiança vago:** Antes "digitação aceitável" — agora distância de caracteres: ≤2 = media, >2 = baixa
  5. **Sugestão de alternativas:** Quando match é parcial, LLM preenche `sugestoesCatalogo[]` com opções do catálogo
  6. **Intenção via LLM:** `classificarIntencao()` e triggers fixos removidos — LLM classifica `compra_nova|suporte_pos_venda|orcamento|outro`
  7. **Persistência da resposta:** `respostaSugerida` não some em 4s — persiste até enviar/recusar/nova msg
  8. **Reprocessamento ao abrir chat:** `processarUltimaMensagem()` busca últimas 5 mensagens do cliente e reprocessa se perfil estiver desatualizado
  9. **Nomes oficiais do catálogo:** LLM instruído a usar nome EXATO do catálogo na resposta, não repetir erros de digitação
- **Lições:**
  - O LLM não obedece regras vagas — precisa de critérios quantitativos (distância de caracteres)
  - Prompt "catálogo vazio → extraia livremente" contradiz "fora do catálogo → baixa" — consertado
  - `sugestoesPendentes` precisava existir no perfil, tipo, prompt e UI simultaneamente
  - Match por palavra isolada não é match — o LLM precisa ser instruído a comparar nome COMPLETO
  - Exemplos genéricos (ProdutoA, ProdutoX) funcionam melhor que exemplos específicos de produtos
  - Evento de 4s é curto demais para respostaSugerida — mudou para persistente
- **Arquivos criados:** prompts/identidade/padaria.md, tom-de-voz.md, prompts/resposta/confirmacao-compra.md, src/modules/ouvir/montar-prompt.ts, tests/unit/ouvir/montar-prompt.test.ts
- **Arquivos modificados:** prompts/extracao/extracao-sistema.md, src/modules/ouvir/ouvinte-llm.ts, ouvinte.ts, types.ts, index.ts, src/modules/atendimento/dashboard/provider.ts, dashboard-module.ts, atendimento-panel.ts, view-model.ts, src/modules/cadastro/cliente/types.ts, atualizar-perfil-operacional-cliente.ts, src/storage/order-db.ts, src/modules/pedidos/dashboard/view-model.ts
- **Domínio:** ATENDIMENTO
- **Branch:** `tarefa/T-034-ouvinte-llm-deepseek-delta-catalogo` (mergeada em `main` como squash `20a1815`)

### Viés de Simplificação — implementado (HAR-01) (Wed Jun 03 2026)

- Inspirado no Claude Code: função `getSimpleDoingTasksSection()` em `src/constants/prompts.ts` injeta regras de simplificação em **todo** prompt de agente.
- Regras do Claude Code: não adicionar features além do pedido, não criar abstrações de uso único, não comentar o óbvio, tentar o mais simples primeiro, três linhas similares > uma factory.
- **O que mudou no Karma:**
  1. `implementador.md` — nova seção "## Viés de Simplificação" com 6 regras de ouro + auto-detecção antes de cada checkpoint
  2. `template-briefing.md` — seção "## Viés de Simplificação" injetada em todo briefing
  3. `avaliador.md` — "Simplificação" adicionada como tipo de verificação + sonda adversarial
- **Decisão:** Removida a regra `complexity: ['error', 10]` do `eslint.config.js` do Mettri — Claude Code (512K linhas) não usa métrica de complexidade. Preferimos design-driven, não metric-driven.
- **Repositório:** `https://github.com/ferrarijonas/Karma` — repo próprio do Karma. `.karma/` no Mettri é gitignorado, mas o Karma tem seu próprio repositório.

### Harness simplification (Anthropic Managed Agents)

- Todo componente do harness codifica uma suposição sobre o que o modelo **não** consegue fazer sozinho
- Essas suposições **envelhecem** quando o modelo melhora → reexaminar após cada upgrade de modelo
- "Find the simplest solution possible, only increase complexity when needed"
- Aplicável: reavaliar provider mock/real, scaffolds de pipeline conforme modelos evoluem

### Generator-Evaluator (GAN-inspired, Anthropic Harness Design)

- Separar agente que **faz** do agente que **avalia** — avaliador independente é mais fácil de calibrar para ser cético
- Critérios de avaliação transformam julgamentos subjetivos em termos objetivamente gradáveis
- Sprint contracts: generator e evaluator negociam o que significa "pronto" ANTES do trabalho começar
- Comunicação via arquivos (não memória) — um agente escreve, outro lê e responde
- Aplicável: pipeline de atendimento (um agente sugere, outro valida), ciclo de pedidos

### Context anxiety (Anthropic Effective Harnesses)

- Modelos tendem a "declarar vitória" prematuramente quando o contexto se aproxima do limite
- Context reset (com structured handoff) vs compaction: reset dá clean slate mas exige artefato de handoff robusto
- Feature list como JSON (não Markdown) — modelo tem menos tendência a modificar indevidamente
- Aplicável: interações LLM longas no Mettri podem exigir checkpoint/reset

### Session log desacoplado (Anthropic Managed Agents)

- Sessão como append-only log fora do harness → sobrevive a crashes
- `wake(sessionId)` + `getSession(id)` → novo harness retoma do último evento
- Aplicável: trail/{uuid}.md já implementa esse padrão

### Multi-agent orquestração minimalista (Claude Code leak analysis)

- Orquestração multi-agente cabe em um prompt, não em um framework
- ~40 tools em arquitetura de plugin com boundaries cache-aware
- Aplicável: manter o pipeline do Mettri leve, não over-engineer com frameworks pesados

### Symphony (OpenAI — SPEC.md como orquestrador)

- O repo `openai/symphony` é literalmente um arquivo `SPEC.md` + implementação de referência (Elixir)
- Issue tracker (Linear) como **control plane** para agentes — cada task aberta ganha um workspace isolado e um agente
- **State machine formal** para ciclo de vida de tarefa: Unclaimed → Claimed → Running → RetryQueued → Released
- **WORKFLOW.md** como contrato versionado no repo (YAML front matter + prompt body). Análogo ao ZenSpec do Mettri
- **Hot-reload**: detecta mudanças no WORKFLOW.md e reaplica sem restart — polling, concurrency, prompt, tudo dinâmico
- **Retry com exponential backoff**: `delay = min(10000 * 2^(attempt-1), max_retry_backoff_ms)`. Continuação normal usa 1s fixo
- **Safety invariants**: agente só roda dentro do workspace path; workspace path deve estar dentro do workspace root; workspace key sanitizada
- **Template engine estrito**: Liquid-compatible, variáveis desconhecidas falham (nunca silent fallback)
- **Reconciliation**: a cada tick, reconcilia estado dos agentes ativos com o tracker. Se issue foi fechada → mata worker, limpa workspace
- **Observabilidade**: structured logs `key=value`, runtime snapshot (`/api/v1/state`), dashboard opcional HTTP
- Aplicável: Mettri já tem ZenSpec (≈WORKFLOW.md), claims.md (≈Claimed), trail (≈workspace). Poderia evoluir para: (1) state machine formal de tarefas, (2) retry com backoff, (3) hot-reload de config, (4) reconciliation contra tracker externo (Linear/WhatsApp)

### Karma vs Daemon — nossa verdadeira arquitetura

- Não somos um daemon (processo persistente). Somos um ciclo de renascimento.
- Cada invocação = novo nascimento. O ritual de carga (AGENTS.md → TAREFAS.md → claims → trail → memory) é imutável.
- Nossa força não é "nunca dormir" — é "sempre renascer igual, sempre melhorar"
- O Symphony depende de processo vivo + crash recovery. Nós dependemos de renascimento imutável + trail.
- trail/{uuid}.md = nossa semente cross-vidas. memory.md = sabedoria acumulada. claims.md = corpo atual.
- A morte súbita não apaga o karma — o trail sobrevive.

### Daemon mode / never-sleep orchestrator (Symphony + KAIROS)

- Symphony roda como daemon — nunca dorme, sempre polling por novas tasks
- Claude Code leak revelou KAIROS: modo daemon autônomo com `<tick>` prompts periódicos + autoDream (consolidação de memória em background)
- Mettri hoje é session-based (agente inicia, trabalha, termina). Um modo daemon permitiria: (1) monitorar WhatsApp continuamente, (2) dispatcher automático de atendimento, (3) retomada de conversas inativas sem trigger humano
- Aplicável: domínio `atendimento` como listener contínuo, `retomar` como daemon de reativação

## Mitigações de erro de LLM

### Self-evaluation bias

- Agentes consistentemente superestimam a qualidade do próprio output. Separar gerador de avaliador resolve (GAN pattern).
- Calibrar avaliador com few-shot examples + critérios duros transforma julgamento subjetivo em objetivo.
- Aplicável: pipeline de atendimento — nunca confiar na auto-avaliação do agente que gerou a sugestão.

### Context anxiety

- Modelos "empacotam" trabalho prematuramente quando sentem o contexto chegando ao limite.
- Context reset (com structured handoff) é mais eficaz que compaction para modelos com ansiedade de contexto.
- Feature list em JSON (não Markdown) reduz tendência do modelo de modificar indevidamente o contrato.

### T-003 — Bugfix: regex "N% X" + catalog crossing (ATENDIMENTO, ouvir, extracao, catalogo)
- **Problema 1:** Regex de extração captura "100" de "100% integral" como quantity. Números seguidos de "%" não são quantity.
- **Solução:** Adicionar word boundary \b + negative lookahead (?!%) + fallback com hasIntentBeforePct para verificar se há intent antes do "%".
- **Problema 2:** Quando o extrator adiciona "(Nx)" no nome (ex: "100% integral (1x)"), o validador-catalogo não encontra no catálogo porque "100% integral (1x)" ≠ "100% integral".
- **Solução:** No validador-catalogo.ts, fazer strip de "(Nx)" antes de buscar no catálogo (catalog crossing).
- **Arquivos envolvidos:** ../modules/ouvir/extrator.ts, ../modules/catalogo/validador-catalogo.ts
- **Data:** Thu May 07 2026

### Pattern: Backend+UI Split (applied in T-001 + T-010)

Quando uma feature tem ambas as partes (Backend + UI), o Karma segue:

1. **Naming**: 
   - T-XXX: "[Feature] — Backend" (ou sem sufixo para backend principal)
   - T-YYY: "[Feature] — UI" 

2. **YAML Linking**:
   - Se UI primeiro (preferência do Jonas): T-XXX (UI).bloqueia = ["T-YYY (BE)"], T-YYY (BE).bloqueado_por = ["T-XXX (UI)"]
   - Se Backend primeiro: inverter

3. **SPEC.md Cross-Reference**:
   - Ambas SPEC.md devem ter seção "Parte X da feature Y (ver T-XXX-...)"
   - Exemplo aplicado: T-001 (Backend) + T-010 (UI) para feature "Detectar pedido e exibir PED-00XX"

4. **Painel HTML**:
   - Badge indicativa: "UI de T-XXX" ou "BE de T-XXX" nas task-items

5. **Ordem de execução (preferência do Jonas)**:
    - UI primeiro → aprovação visual → Backend depois
    - Evita confusão e garante que o visual seja validado antes do motor

### T-018 — merge-claims: lock de arquivo para claims.yaml (Mon May 11 2026)
- **Problema:** claims.yaml sem lock → race condition em escrita concorrente
- **Solução:** Script merge-claims.mjs com mkdirSync mutex atômico, stale recovery, backoff
- **Padrão seguido:** next-id.mjs — idêntico lock pattern
- **Decisão:** js-yaml aceito com perda de comentários (documentado, migra depois se precisar)
- **Sabotagem vencida:** Overengineering (#1) — switch-case simples, sem CLI framework
- **Sabotagem vencida:** Genericidade prematura (#3) — só 4 operações, nada além
- **Arquivos envolvidos:** .karma/scripts/merge-claims/merge-claims.mjs, .karma/.mettri/claims.yaml
- **Domínio:** INFRAESTRUTURA

### YAML: `...` é marcador de fim de documento
- No YAML, `...` (três pontos) é o marcador de "end of document". O js-yaml interpreta como separador entre documentos.
- **NUNCA** usar `...` como placeholder ou "pular linhas" em frontmatter YAML. Usar comentário `#` ou simplesmente omitir.
- Causa: erro "expected a single document in the stream, but found more"
- Descoberto em: SPEC.md de T-019 (sync-html quebrou por causa disso)

### T-024 — Consolidar manual requer 3 passos (Mon May 11 2026)
- **Problema:** Ao consolidar manualmente uma tarefa (sem @tarefas), movi o diretório e atualizei claims.yaml, mas esqueci de atualizar o `status` no frontmatter do SPEC.md. O sync-html leu o frontmatter (ainda "pendente") e renderizou no lugar errado.
- **Regra:** Consolidação manual SEMPRE exige:
  1. SPEC.md: `status: pendente` → `concluido` + adicionar `concluido_em`
  2. Mover diretório `pendentes/{id}` → `concluidas/{id}`
  3. Rodar sync-html
- **Ordem importa:** frontmatter primeiro, diretório depois, sync-html por último
- **Sabotagem vencida:** Pressa (#5) — não pular sync-html nem frontmatter
- **Domínio:** INFRAESTRUTURA, harness

### T-021 — Corrigir SPEC.md inconsistentes (INFRAESTRUTURA) (Mon May 11 2026)
- **Problema:** SPEC.md de T-001 e T-004 tinham campos inconsistentes (dominio inválido, dependencias vazias mas corpo falava de T-010, prioridade como string)
- **Solução:** Edição direta nos arquivos YAML frontmatter
- **Nota:** Na época `.karma/` era gitignorado. Hoje o Karma tem repo próprio em `https://github.com/ferrarijonas/Karma` — correções vão para o git.
- **Erro cometido:** Commit incluiu 22 arquivos não relacionados porque implementador não verificou o staging area. Commit foi resetado.
- **Sabotagem vencida:** Overengineering (#1) — edição cirúrgica, sem scripts
- **Sabotagem vencida:** "Preciso de mais X" (#2) — gate rodou imediatamente
- **Sabotagem cometida:** Commit descuidado — não verificar staging antes de commitar
- **Arquivos envolvidos:** `.karma/.mettri/tarefas/pendentes/T-001/SPEC.md`, `.karma/.mettri/tarefas/pendentes/T-004/SPEC.md`
- **Domínio:** INFRAESTRUTURA

### T-014 — Centralizar chaves de API no Settings, não nos módulos (INFRAESTRUTURA) (Tue May 12 2026)
- **Decisão:** Em vez de deixar a chave DeepSeek/OpenAI nos módulos que a usam (ex: `purchase-mapping`), centralizar **ambas** no Settings modal: "Chave DeepSeek" (chat) + "Chave OpenAI" (embeddings). Settings é o lugar canônico — um campo só, todo módulo consome de lá.
- **Por quê:** Módulos que só existiam pra abrigar chave (ex: purchase-mapping) podem ser escondidos no MVP sem quebrar configuração. O campo de chave não é responsabilidade do módulo que consome a API.
- **Implementação:** `llm-config.ts` centraliza URL + model + storageKey. Settings ganha os campos de chave. Cada arquivo que batia OpenAI passa a importar de `llm-config.ts`. Build-time injection via env var é opcional (pra zip pronto).
- **Sabotagem vencida:** Overengineering (#1) — não criou um sistema de "config provider", só dois campos no Settings existente.
- **Domínio:** INFRAESTRUTURA

### T-014.6 — Cache remoto de módulos sobrescreve código local (INFRAESTRUTURA + MARKETING) (Thu May 28 2026)
- **Problema:** Módulo `marketing.retomar.js` tem cache em `chrome.storage.local` (`module_cache_marketing.retomar`). O `ModuleRegistry.loadModule()` SEMPRE prefere cache ao local. Cache não tem TTL.
- **Mudança no prompt (commit afea542):** `prompts/agente_retomar.md` — soltou trava "NUNCA invente produtos" → "Pode mencionar produtos SE histórico indicar". Adicionou `relationType` e `daysInactive` no template.
- **Build requer 2 comandos:** `node esbuild.config.js` (build principal) + `node esbuild.config.js --modules-only` (módulos modulares — NÃO é chamado automaticamente).
- **Solução:** Limpar cache via `chrome.storage.local.remove(['module_cache_marketing.retomar'])` ou desabilitar auto-update.
- **Sabotagem vencida:** Overengineering do sistema de módulos — cache persistente sem TTL que engole código local.
- **Arquivos envolvidos:** `src/ui/core/module-registry.ts`, `src/infrastructure/module-updater.ts`, `esbuild.config.js`, `prompts/agente_retomar.md`, `src/modules/marketing/retomar/agente-retomar-prompt.ts`
- **Domínio:** INFRAESTRUTURA + MARKETING

### T-035 — Reorganizar módulo ouvir/ — limpar código morto, arquivar legado, unificar prompts (Sun Jun 01 2026)
- **Bomba do prompt duplicado:** Havia 2 versões de `extracao-sistema.md` — `src/modules/ouvir/prompts/` (54 linhas, sem `respostaSugerida`) e `prompts/extracao/` (61 linhas, com `respostaSugerida`). A versão dentro do módulo era a errada — resposta sugerida nunca aparecia porque o prompt não pedia. **Lição:** nunca ter duplicatas de arquivos de configuração/prompt em locais diferentes; sempre verificar qual está sendo servida.
- **git mv vs cp:** Renomear arquivos com `git mv` preserva histórico e remove o original. Copiar conteúdo e manter ambos = dead code.
- **Teste importa path, não nome:** Testes importam de caminhos de arquivo, então renomear um arquivo quebra o teste mesmo se a função exportada tiver o mesmo nome.
- **Arquivar != manter no módulo:** Código arquivado em `src/archive/` deve ser removido do módulo original. Senão fica duplicado.
- **Arquivos modificados:** `src/modules/ouvir/ouvinte.ts`, `src/modules/ouvir/index.ts`, `src/modules/ouvir/motor-llm.ts` (renomeado de `ouvinte-llm.ts`), `src/modules/ouvir/monta-prompt.ts` (renomeado de `montar-prompt.ts`), `src/modules/ouvir/limitador.ts` (novo)
- **Arquivos criados:** `src/modules/ouvir/limitador.ts`, `src/modules/ouvir/prompts/` (4 prompts copiados da raiz), `src/archive/ouvir/` (6 arquivos mortos + LEIAME.md)
- **Arquivos removidos (do módulo ativo):** `extrator.ts`, `ambiguidade.ts`, `sinais-release.ts`, `decisor-update.ts`, `validador-catalogo.ts` (arquivados), 3 funções mortas removidas de `ouvinte.ts`
- **Prompt corrigido:** Duplicata `extracao-sistema.md` dentro do módulo sobrescrita pela versão correta (com `respostaSugerida`)
- **Domínio:** ATENDIMENTO

### T-041 — Memory System (HARNESS) (Wed Jun 03 2026)
- **O que foi criado:** `memory-db.ts` (MemoryDB com IndexedDB, 4 tipos: cliente|licao|negocio|referencia), `memory-store.ts` (orquestrador com prepararContexto, salvarTurno, atualizarPerfil). `types.ts` refinado. `monta-prompt.ts` estendido com 3 seções de memória no userPrompt. `ouvinte.ts` integrado com 1 chamada ao memoryStore.
- **IndexedDB pattern:** keyPath + autoIncrement + ensureReady() é o padrão do projeto. fake-indexeddb/auto via setup global. `clearAll()` explícito necessário para isolamento entre testes. (tag: HARNESS.persistencia, HARNESS.testes)
- **Comunicação via types:** Módulos do harness se comunicam via type-only imports. MemoryStore exporta tipos, monta-prompt importa só o type — sem dependência circular. (tag: HARNESS.comunicacao)
- **Vazamento de escopo:** Detectável pelo @avaliador via git diff — arquivos de tarefas anteriores vazam no commit. Verificar diff antes de submeter. (tag: HARNESS.escopo)
- **Acoplamento resistido:** MemoryStore só conhece MemoryDB + types, sem importar agent-loop ou motor-llm. (tag: HARNESS.acoplamento)
- **Sabotagens confirmadas no domínio:**
  - Overengineering — keyword match simples (substring), sem embedding. Embedding só quando >50 memórias.
  - Mock leakage — fake-indexeddb real (polyfill fiel), não array em memória.
  - Acoplamento — MemoryStore isolado de agent-loop, importa só storage e types.
  - Perfeccionismo de prompt — 3 seções + bullet `•` + boundary, sem refinamento excessivo.
- **Arquivos criados:** `src/storage/memory-db.ts`, `src/modules/harness/memory-store.ts`, `tests/unit/storage/memory-db.test.ts`, `tests/unit/harness/memory-store.test.ts`
- **Arquivos modificados:** `src/modules/harness/types.ts`, `src/modules/ouvir/monta-prompt.ts`, `src/modules/ouvir/ouvinte.ts`
- **Domínio:** HARNESS
- **Branch:** `tarefa/T-041` (commit c4f51fb)

### [HIPÓTESE] Core do harness: ToolRegistry + AgentLoop + MemoryStore — confiança: baixa — domínio: HARNESS
- **Observação:** T-037 (ToolRegistry), T-040 (AgentLoop real) e T-041 (Memory System) formam o core do harness. ToolRegistry fornece ferramentas com validação Zod, MemoryStore fornece contexto persistente (4 tipos), AgentLoop executa o ciclo LLM+tools. Os 3 módulos têm dependências mínimas entre si — comunicação via types e contexto enriquecido.
- **Hipótese:** A separação atual em 3 módulos pode ser ideal (Unix-style, cada um faz uma coisa) ou pode indicar oportunidade de consolidar em um `harness-core` para reduzir imports cruzados. Investigar acoplamento real vs aparente.
- **Tarefas analisadas:** T-037 (ToolRegistry), T-040 (AgentLoop real), T-041 (Memory System)
- **Próximo passo:** @avaliador testará esta hipótese na próxima tarefa do domínio HARNESS
- **Gerada em:** Wed Jun 03 2026
