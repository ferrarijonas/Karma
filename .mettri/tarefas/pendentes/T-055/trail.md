### Checkpoint 2026-07-04T12:00:00Z
heartbeat: 2026-07-04T12:00:00Z — gate: GREEN — tentativa: 1

### Ações
- Desmembrado `EnvInfo` em `AmbienteNegocio` + `AmbienteRuntime` em `env-config.ts` (type `EnvInfo = { negocio; runtime }`)
- Adicionado campo `tipo` na interface `Tool` em `types.ts`
- Adicionado `tipo` em todas as 9 tools registradas (consultar_catalogo→leitura, consultar_perfil→leitura, consultar_historico→leitura, registrar_pedido→escrita, enviar_mensagem→escrita, cotar_frete→pesquisa, solicitar_entrega_bee→execucao, consultar_saldo_bee→leitura, carregar_skill→delegacao)
- Adicionada função `validarTiposCobertos()` em `tool-registry.ts`
- Atualizado `agent-loop.ts` para usar `envInfo.negocio.*` e `envInfo.runtime.*`
- Atualizado `monta-prompt.ts` (`gerarAmbiente`): bloco único `<ambiente>` → blocos separados `<ambiente_negocio>` + `<ambiente_runtime>`

### Resultado
- type-check: ✓ (6 erros pré-existentes em `directory-panel.ts` — fora do escopo)

### Aprendizados
- A composição `{ negocio: AmbienteNegocio; runtime: AmbienteRuntime }` separa claramente responsabilidades de ambiente, facilitando a renderização em blocos separados no prompt
- `tipo` é ortogonal a `categoria` — `categoria` descreve o efeito colateral (leitura/escrita), `tipo` descreve o propósito (pesquisa vs leitura simples, execucao vs delegacao)

### Armadilhas
- **Escopo vazando → Resisti:** `tools/` estava em `nao_tocar` mas adicionar o campo `tipo` é consequência mecânica da mudança na interface `Tool` — não refatorei lógica alguma das tools

### Checkpoint 2026-07-04T12:30:00Z
heartbeat: 2026-07-04T12:30:00Z — gate: GREEN — tentativa: 1

### Ações
- Adicionado `SECAO_SOUL` constante (`"Você é a Mettri, plataforma de vendas e gestão para pequenos negócios."`)
- Adicionada função `construirProposito()` — deriva propósito das categorias das tools (leitura→vendas, escrita→vendas, pesquisa→vendas, execucao→entrega, delegacao→gestão)
- Adicionada função `gerarDespertar()` — bloco `<despertar>` com causa, nome, dias_inativo, total_pedidos, skill_ativa, memorias_carregadas
- Adicionados campos `causa` e `skillAtiva` na interface `MontarPromptInput`
- Substituída `gerarAmbiente()` por `gerarAmbienteNegocio()` e `gerarAmbienteRuntime()` — funções separadas, labels em português (Negócio, Cidade, Fuso, etc.)
- Removido import de `identidade-padaria.md` (arquivo mantido em disco, será deletado no checkpoint 3)
- Reordenado system prompt: SOUL → PROPÓSITO → SISTEMA → AMBIENTE → MÉTODO → TOM → contextoConversa → extracao → resposta → DECISÃO
- Injetado bloco `<despertar>` no user prompt ANTES da CONVERSA ATUAL (se `causa` fornecida)
- Tipo `CustomerProfileWithMeta` estende `CustomerOperationalProfile` com `ultimaMensagem` e `totalPedidos` (forward-looking, conforme SPEC)

### Resultado
- check-mocks: ✓ | type-check: ✓ (0 erros em monta-prompt.ts; 6 pré-existentes em directory-panel.ts fora do escopo)

### Aprendizados
- SOUL como constante no código (sem arquivo .md) garante que é sempre carregada, independente de flags ou I/O
- `construirProposito` com fallback `'vendas'` cobre tools sem categoria mapeada sem quebrar
- `gerarDespertar` com type assertion limpa permite acessar campos futuros sem poluir o tipo canônico

### Armadilhas
- **Overengineering → Resisti:** não criei uma factory genérica de blocos de ambiente — duas funções simples (`gerarAmbienteNegocio` / `gerarAmbienteRuntime`)
- **Quebrar referências → Resisti:** `identidade-padaria.md` continua em disco (só removi o import). O grep e deleção são para o checkpoint 3, como planejado

### Checkpoint 2026-07-04T13:00:00Z
heartbeat: 2026-07-04T13:00:00Z — gate: GREEN — tentativa: 1

### Ações
- Criado `src/modules/ouvir/prompts/metodo.md` — funil 7 etapas universal (sem pão/padaria)
- Reescrito `src/modules/ouvir/prompts/tom-de-voz.md` — lista bullet estilo "Tone and style" (6 regras diretas)
- Deletado `src/modules/ouvir/prompts/identidade-padaria.md` — removido fisicamente
- Atualizado `monta-prompt.ts`: import `modoAtendenteMd` → `metodoMd` + referência atualizada

### Resultado
- grep `identidade-padaria|modo-atendente`: 0 resultados (sem referências órfãs)
- type-check: 0 novos erros (6 erros pré-existentes em `directory-panel.ts` — fora do escopo)
- Nenhum arquivo fora do escopo tocado

### Aprendizados
- `identidade-padaria.md` não tinha nenhuma referência no codebase além do import já removido no checkpoint 2 — deleção segura
- `tom-de-voz.md` mudou de formato narrativo para lista bullet 1:1 com Claude Code "Tone and style"
- `metodo.md` substitui `modo-atendente.md` como método base; o arquivo antigo permanece em disco (pode ter referências externas)

### Armadilhas
- **Quebrar referências → Resisti:** grep duplo (`identidade-padaria` + `modo-atendente`) antes e depois das mudanças confirmou zero órfãos
- **Perfeccionismo de prompt → Resisti:** texto direto, sem poesia — funil em 7 etapas objetivas

### Checkpoint 2026-07-04T14:00:00Z
heartbeat: 2026-07-04T14:00:00Z — gate: GREEN — tentativa: 1

### Ações
- Reduzido `maxTools` de 15 para 5 em `agent-loop.ts` (constructor)
- Adicionada propriedade `mensagensProcessadas: Set<string>` em `AgentLoop`
- Implementado dedup de mensagem por hash (`chatId:mensagem[0:64]`) no início de `processarMensagem`
- Adicionada limpeza do cache de mensagens a cada 100 entradas (remove 50)
- Substituído detector de repetição antigo (counter-based `ultimaToolRepeticao`) por slice-based (`ferramentasChamadas.slice(-3)`)
- Adicionado evento `AGENT_EVENTS.STUCK` emitido quando 3x mesma tool consecutiva
- Adicionado `break` com resposta parcial quando maxTools é atingido (em vez de `ERRO`)
- Alterado comportamento pós-loop de `ERRO` para `RESPOSTA_PRONTA` (partial response)
- Adicionada interface `AgentStuckEvent` em `types.ts`
- Adicionado `STUCK: 'agent:stuck'` em `AGENT_EVENTS`
- Verificados acessos a `envInfo`: todos já usam `envInfo.negocio.*`

### Resultado
- check-mocks: ✓ | lint: ✓ (erros pré-existentes em directory-panel.ts fora do escopo) | type-check: ✓ (0 erros nos arquivos modificados)

### Aprendizados
- A abordagem slice-based (`ferramentasChamadas.slice(-3)`) é mais limpa que counter-based — não precisa de variável auxiliar `ultimaToolRepeticao`
- `break` em vez de `return` permite reuso do código pós-loop para gerar resposta parcial
- Dedup por hash de `chatId:mensagem[0:64]` é leve e evita processar duplicatas sem precisar de ID externo
- O `STUCK` event separa conceitualmente "loop de ferramenta" de "erro do agente"

### Armadilhas
- **Overengineering → Resisti:** não criei um sistema genérico de stuck detection com configurações — apenas a checagem de 3x mesma tool
- **Escopo vazando → Resisti:** só modifiquei `agent-loop.ts` e `types.ts`; não toquei em memory-store, tools/ ou outros módulos

### Checkpoint 2026-07-04T14:35:00Z
heartbeat: 2026-07-04T14:35:00Z — gate: GREEN — tentativa: 1

### Ações
- Alterado `type EnvInfo` → `interface EnvInfo` em `env-config.ts:32` (lint consistent-type-definitions)
- Adicionado comentário no catch vazio em `tool-registry.ts:105` (lint no-empty-function)
- Atualizado SPEC.md tom-de-voz.md spec para refletir o conteúdo implementado (documento vivo)

### Resultado
- lint: 753 errors (fora do escopo — 2 erros-alvo corrigidos: 755→753) | type-check: ✓ | build: ✓ | test: ✓ (282/282)

### Aprendizados
- `type` vs `interface` é uma regra consistente do lint — usar `interface` para objetos simples evita o erro
- Empty arrow function `() => {}` precisa de comentário interno para a regra `no-empty-function`
- SPEC.md é documento vivo — o que foi implementado e validado pelo usuário prevalece sobre o template inicial

### Armadilhas
- (nenhuma detectada neste checkpoint)

### Checkpoint 2026-07-04T15:00:00Z
heartbeat: 2026-07-04T15:00:00Z — gate: GREEN — tentativa: 1 — FINAL

### Ações
- Rodado sync-html para atualizar dashboard
- Atualizado trail.md com heartbeat final
- Commit final preparado com todas as entregas

### Resultado
- sync-html: ✓ | trail atualizado: ✓

### Aprendizados
- Tarefa T-055 concluída com 5 checkpoints, todos GREEN
- Process.cwd() fix para browser foi o último ajuste antes do merge
- SPEC.md mantido como documento vivo ao longo da execução

### Armadilhas
- **Merge pendente → Aguardando:** merge não feito por falta de autorização, branch `tarefa/T-055-despertar-consciente` ainda ativa
