---
id: T-055
titulo: "Despertar Consciente — SOUL + ambiente + método + identidade + stuck detector"
dominio: HARNESS
status: concluido
prioridade: 2
dependencias: []
bloqueado_por: []
bloqueia: []
tentativas: 1
max_tentativas: 3
nivel_auto_cura: null
backoff_ms: 10000
max_backoff_ms: 300000
criado_em: "2026-07-04"
iniciado_em: "2026-07-04T12:00:00Z"
concluido_em: "2026-07-04T14:35:00Z"
heartbeat_ultimo: "2026-07-04T14:35:00Z"
estimativa_min: 60
timeout_min: 120
escopo:
  modulos:
    - src/modules/ouvir/monta-prompt.ts
    - src/modules/ouvir/prompts/metodo.md
    - src/modules/ouvir/prompts/tom-de-voz.md
    - src/modules/ouvir/prompts/identidade-padaria.md
    - src/modules/harness/env-config.ts
    - src/modules/harness/agent-loop.ts
    - src/modules/harness/tool-registry.ts
  nao_tocar:
    - src/modules/ouvir/prompts/sistema.md
    - src/modules/ouvir/prompts/decisao-sistema.md
    - src/modules/ouvir/prompts/extracao-sistema.md
    - src/modules/ouvir/prompts/resposta-confirmacao.md
    - src/modules/ouvir/prompts/contexto-conversa.md
    - skills/
    - src/modules/harness/memory-store.ts
    - src/modules/harness/tools/
    - prompts/agente_retomar.md
spec_ref: ""
tipo_output: "codigo"
migracao_necessaria: false
permite_mock: false
modo: normal
cleanup_permite_dados_pessoais: false
cleanup_permite_tokens: false
cleanup_permite_temp_files: false
---

# T-055: Despertar Consciente — SOUL + ambiente + método + identidade + stuck detector

## Propósito

Centralizar e fortalecer a identidade do agente (SOUL + PROPÓSITO), separar responsabilidades de ambiente (negócio vs runtime), substituir o método legado de padaria por um funil universal, remover artefatos da persona Jonas, e adicionar mecanismos anti-stuck (dedup, throttling, pokayoke de tipo de tool).

## Escopo

- **Toca:**
  - `src/modules/ouvir/monta-prompt.ts` — adicionar seção SOUL + PROPÓSITO, bloco <despertar>, blocos de ambiente separados, reordenar system prompt
  - `src/modules/ouvir/prompts/metodo.md` — CRIAR (funil 7 etapas universal)
  - `src/modules/ouvir/prompts/tom-de-voz.md` — REESCREVER (lista bullet "Tone and style")
  - `src/modules/ouvir/prompts/identidade-padaria.md` — DELETAR
  - `src/modules/harness/env-config.ts` — desmembrar EnvInfo em AmbienteNegocio + AmbienteRuntime
  - `src/modules/harness/agent-loop.ts` — maxTools 15→5, dedup de mensagem, 3x mesma tool → interrompe, resposta parcial se >5 tools
  - `src/modules/harness/tool-registry.ts` — adicionar campo `tipo` na interface Tool, pokayoke test

- **NÃO toca:**
  - `src/modules/ouvir/prompts/sistema.md` — permanece como está, apenas muda de posição na ordem
  - `src/modules/ouvir/prompts/decisao-sistema.md` — inalterado
  - `src/modules/ouvir/prompts/extracao-sistema.md` — inalterado
  - `src/modules/ouvir/prompts/resposta-confirmacao.md` — inalterado
  - `src/modules/ouvir/prompts/contexto-conversa.md` — inalterado
  - `skills/` — não tocar
  - `src/modules/harness/memory-store.ts` — não tocar
  - `src/modules/harness/tools/` — não tocar
  - `prompts/agente_retomar.md` — não tocar

## O que já existe

- `src/modules/ouvir/monta-prompt.ts` — monta system prompt + user prompt a partir de seções, flags e contexto. Já existe sistema de flags (microfone, localizacao, etc.).
- `src/modules/ouvir/prompts/identidade-padaria.md` — persona Jonas, legado da padaria. Será deletado.
- `src/modules/ouvir/prompts/tom-de-voz.md` — tom de voz atual (formato a ser confirmado).
- `src/modules/ouvir/prompts/modo-atendente.md` — método base atual (será substituído por metodo.md).
- `src/modules/harness/env-config.ts` — interface EnvInfo com businessName, city, timezone, today, horarioFuncionamento, directory, modelName, version, platform.
- `src/modules/harness/agent-loop.ts` — loop principal, maxTools = 15, sem dedup, sem stuck detection funcional.
- `src/modules/harness/tool-registry.ts` — registro central de tools, sem campo `tipo`.
- Ordem atual do system prompt: SISTEMA → IDENTIDADE → TOM → AMBIENTE → SKILL ATIVA → DECISÃO.

## Onde verificar / input

- `src/modules/ouvir/monta-prompt.ts` — ordem atual de montagem, sistema de flags, como seções são injetadas
- `src/modules/ouvir/prompts/identidade-padaria.md` — conteúdo a ser deletado, referências órfãs
- `src/modules/ouvir/prompts/tom-de-voz.md` — formato atual para reescrever
- `src/modules/ouvir/prompts/modo-atendente.md` — método atual para substituir
- `src/modules/harness/env-config.ts` — interface atual EnvInfo
- `src/modules/harness/agent-loop.ts` — loop principal, maxTools, dedup, stuck detection
- `src/modules/harness/tool-registry.ts` — interface Tool, registro de tools
- `memory.md` — T-035 (reorganizar ouvir), T-041 (Memory System), T-045 (compactação)

## O que produzir / output

### 1. SOUL + PROPÓSITO em monta-prompt.ts

- **SOUL:** Nova seção `soul` sempre ativa (indepente de flags). Texto fixo: `"Você é a Mettri, plataforma de vendas e gestão para pequenos negócios."`
- **PROPÓSITO:** Primeira linha do system prompt. Texto dinâmico: `"Você é um atendente que ajuda com vendas, atendimento e operação do negócio."`
- **Pokayoke:** PROPÓSITO derivado das categorias das tools registradas via `toolRegistry.listarTools()` → se alguma tool tem tipo que propósito não cobre, alerta

```typescript
// SOUL — sempre ativo
const soul = "Você é a Mettri, plataforma de vendas e gestão para pequenos negócios.";

// PROPÓSITO — primeira linha do system prompt
const proposito = "Você é um atendente que ajuda com vendas, atendimento e operação do negócio.";
```

### 2. AMBIENTE em env-config.ts

Desmembrar `EnvInfo` em duas interfaces:

```typescript
interface AmbienteNegocio {
  businessName: string;
  city: string;
  timezone: string;
  today: string;
  horarioFuncionamento: string;
}

interface AmbienteRuntime {
  directory: string;
  modelName: string;
  version: string;
  platform: string;
}

// EnvInfo atual vira composição:
interface EnvInfo extends AmbienteNegocio, AmbienteRuntime {}
```

No `monta-prompt.ts`, dois blocos separados:

```
<ambiente_negocio>
businessName: ...
city: ...
timezone: ...
today: ...
horarioFuncionamento: ...
</ambiente_negocio>

<ambiente_runtime>
directory: ...
modelName: ...
version: ...
platform: ...
</ambiente_runtime>
```

### 3. MÉTODO — novo arquivo metodo.md

Criar `src/modules/ouvir/prompts/metodo.md` com funil 7 etapas universal (sem exemplos de pão/padaria):

1. **Entender** — escute o que o cliente precisa, faça perguntas para esclarecer
2. **Mostrar** — apresente opções com base no que entendeu
3. **Confirmar** — verifique se a escolha está correta
4. **Acertar** — ajuste detalhes (quantidade, variações, etc.)
5. **Informar** — passe prazos, valores, condições
6. **Sugerir** — ofereça complementos relevantes
7. **Fechar** — finalize o atendimento com resumo claro

Substitui `modo-atendente.md` como método base. O arquivo `modo-atendente.md` deve ser mantido (pode ter outras referências), mas o método ativo passa a ser `metodo.md`.

### 4. IDENTIDADE

- **Deletar:** `src/modules/ouvir/prompts/identidade-padaria.md` (persona Jonas — legado)
- **Reescrever tom-de-voz.md** como lista bullet:

```markdown
# Tom e Estilo

- Só use emojis se o cliente usar primeiro.
- Suas respostas devem ser curtas e diretas.
- Não use linguagem corporativa ou robótica.
- Não liste JSON, metadados ou justificativas na resposta.
- Quando falar de produto, use o nome real do item.
- Se o cliente estiver confuso, faça perguntas diretas.
```

### 5. DESPERTAR — novo bloco no user prompt

Bloco `<despertar>` injetado ANTES da mensagem do cliente no user prompt:

```xml
<despertar causa="mensagem_recebida" cliente_perfil="..." dias_inativo="..." skill_ativa="...">
```

- `causa`: razão do despertar (`mensagem_recebida`, `retomada`, `gatilho`)
- `cliente_perfil`: perfil resumido do cliente (se disponível)
- `dias_inativo`: dias desde último contato (se disponível)
- `skill_ativa`: skill que está ativa no momento (se houver)

### 6. STUCK DETECTOR em agent-loop.ts

- **maxTools:** reduzir de 15 para 5
- **Dedup de mensagem:** ID único por mensagem (mensagem.id ou hash). Não processar mensagem já processada.
- **3x mesma tool consecutiva:** verificar se `3x mesma tool consecutiva → interrompe` já existe. Se sim, garantir que está funcionando (testar com fixture). Se não, implementar.
- **Resposta parcial:** se passar de 5 tools, gerar resposta com resultados atuais (não parar com erro — entregar o que tem).

```typescript
// Lógica de dedup
const mensagemJaProcessada = mensagem.id && this.processadas.has(mensagem.id);
if (mensagemJaProcessada) return;

// Stuck detection
if (this.ultimasTools.length >= 3 &&
    this.ultimasTools.every(t => t === toolName)) {
  // interrompe — mesma tool 3x consecutiva
  break;
}
```

### 7. POKAYOKE em tool-registry.ts

```typescript
interface Tool {
  // ... campos existentes
  tipo: 'leitura' | 'escrita' | 'execucao' | 'pesquisa' | 'delegacao';
}
```

Teste que varre registry e alerta se existir tool com tipo que propósito não cobre:

```typescript
function verificarPokayoke(tools: Tool[]): string[] {
  const tiposCobertos = new Set(['leitura', 'escrita', 'execucao', 'pesquisa', 'delegacao']);
  const alertas: string[] = [];
  for (const tool of tools) {
    if (!tiposCobertos.has(tool.tipo)) {
      alertas.push(`Tool ${tool.name}: tipo "${tool.tipo}" não coberto pelo propósito`);
    }
  }
  return alertas;
}
```

### 8. Ordem final do system prompt

1. SOUL
2. PROPÓSITO
3. SISTEMA (existente, move para 3ª posição)
4. AMBIENTE (blocos separados: <ambiente_negocio> + <ambiente_runtime>)
5. MÉTODO (novo metodo.md)
6. TOM (tom-de-voz.md reescrito)
7. SKILL ATIVA (existente)
8. DECISÃO (existente, última)

## Onde salvar

- `src/modules/ouvir/monta-prompt.ts` — EDITAR (SOUL, PROPÓSITO, despertar, blocos ambiente, reordenar)
- `src/modules/ouvir/prompts/metodo.md` — CRIAR (funil 7 etapas)
- `src/modules/ouvir/prompts/tom-de-voz.md` — REESCREVER (lista bullet)
- `src/modules/ouvir/prompts/identidade-padaria.md` — DELETAR
- `src/modules/harness/env-config.ts` — EDITAR (desmembrar interfaces)
- `src/modules/harness/agent-loop.ts` — EDITAR (maxTools, dedup, stuck detection)
- `src/modules/harness/tool-registry.ts` — EDITAR (campo tipo, pokayoke)

## Como validar

- [ ] SOUL carregado sempre, independente de flags
- [ ] PROPÓSITO é a primeira linha do system prompt
- [ ] PROPÓSITO deriva das categorias das tools registradas (pokayoke)
- [ ] `ambiente_negocio` e `ambiente_runtime` em blocos separados no prompt
- [ ] `metodo.md` substitui `modo-atendente.md` como método base ativo
- [ ] `identidade-padaria.md` deletado, sem referências órfãs (grep no codebase)
- [ ] `tom-de-voz.md` organizado como lista bullet (formato "Tone and style")
- [ ] `<despertar>` presente no user prompt, antes da mensagem do cliente
- [ ] `maxTools` = 5 (era 15)
- [ ] Dedup de mensagem: mesma mensagem não é processada duas vezes
- [ ] 3x mesma tool consecutiva → interrompe o loop
- [ ] Se >5 tools, gerar resposta com resultados atuais (não erro)
- [ ] `Tool.tipo` implementado na interface
- [ ] Teste pokayoke varre registry e alerta sobre tipos não cobertos
- [ ] Ordem final do system prompt: SOUL → PROPÓSITO → SISTEMA → AMBIENTE → MÉTODO → TOM → SKILL ATIVA → DECISÃO
- [ ] Gate: lint ✓ typecheck ✓ build ✓ test ✓
- [ ] Nenhum arquivo fora do escopo modificado

## Mock Policy

- `permite_mock: false` — nenhum mock é permitido. Testes devem usar instâncias reais dos módulos (ToolRegistry real, AgentLoop real, EnvConfig real). Se precisar mockar I/O (ex: FileSystem para ler metodo.md), justifique e peça aprovação.

## Modos de Execução

- `modo: normal` — aplica a Escada de Decisão (Ponytail) integralmente — 7 degraus, sem atalhos.

## Cleanup Policy

- `cleanup_permite_dados_pessoais: false` — bloqueia telefones, emails, CPF, CNPJ no diff
- `cleanup_permite_tokens: false` — bloqueia CSRF tokens, API keys, wa-session
- `cleanup_permite_temp_files: false` — bloqueia currículos, snapshots WhatsApp, `_temp-*`, `_diagnose*`

---

## Sabotagens Herdadas

> domínio: HARNESS — catálogo: `sabotagens/_global.md`

- ⚠️ **Overengineering** — criar sistema de tipos genérico demais para os blocos de ambiente em vez de duas interfaces simples. → **Antídoto:** duas interfaces, composição simples. Sem generic factories.
- ⚠️ **Perfeccionismo de prompt** — passar horas refinando o texto do SOUL/PROPÓSITO/método em vez de implementar e testar. → **Antídoto:** texto direto, sem poesia. O avaliador ajusta depois se necessário.
- ⚠️ **Fazer tudo sozinho** — tentar editar 6 arquivos + deletar 1 + criar 1 em 1 checkpoint gigante. → **Antídoto:** 4 checkpoints: (1) env-config + tool-registry, (2) monta-prompt (SOUL/PROPÓSITO/despertar/ambiente/reordenação), (3) metodo.md + tom-de-voz.md + deletar identidade-padaria.md, (4) agent-loop (stuck detector).
- ⚠️ **Quebrar referências** — deletar identidade-padaria.md sem verificar se outros arquivos importam ou referenciam. → **Antídoto:** grep de `identidade-padaria` e `padaria` em todo o codebase antes de deletar. Atualizar referências ou garantir que estão mortas.
- ⚠️ **Escopo vazando** — modificar arquivos fora do escopo (ex: sistema.md, decisao-sistema.md) durante a reordenação do system prompt. → **Antídoto:** não tocar nos prompts proibidos. A reordenação é feita em monta-prompt.ts, não movendo arquivos no disco.

## Memória Herdada

> buscado em `memory.md` por tags do domínio `HARNESS`

- **T-041 (Memory System):** MemoryStore se comunica via types, monta-prompt importa types sem dependência circular. A seção SOUL/PROPÓSITO segue o mesmo padrão: dados injetados via types, sem dependência circular.
- **T-045 (Compactação):** monta-prompt.ts já foi alterado para incluir sliding window + budget check. A reordenação do system prompt (SOUL → ... → DECISÃO) deve preservar a lógica de compactação existente.
- **T-035 (Reorganizar ouvir):** alerta de prompt duplicado — ao criar metodo.md, garantir que modo-atendente.md não tenha versão duplicada em outro local. Verificar antes de substituir.
- **T-040 (AgentLoop real):** agent-loop passou por várias iterações. O stuck detector deve preservar o fluxo existente de coleta → prompt → motor → processamento. A redução de maxTools e dedup são aditivas, não estruturais.
