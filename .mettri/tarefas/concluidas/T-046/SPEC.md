---
id: T-046
titulo: "Consciência situacional — identidade do sistema + env info + memórias no agent-loop"
dominio: HARNESS
status: concluido
prioridade: 1
dependencias: [T-041]
bloqueado_por: []
bloqueia: [T-047]
tentativas: 0
max_tentativas: 3
nivel_auto_cura: null
backoff_ms: 10000
max_backoff_ms: 300000
criado_em: "2026-06-04"
iniciado_em: "2026-06-05T10:00:00Z"
concluido_em: null
heartbeat_ultimo: null
estimativa_min: 45
timeout_min: 120
escopo:
  modulos:
    - src/modules/ouvir/monta-prompt.ts
    - src/modules/ouvir/motor-llm.ts
    - src/modules/harness/agent-loop.ts
    - src/modules/harness/types.ts
    - src/modules/harness/inspector-popup.ts
    - src/modules/harness/env-config.ts
  nao_tocar:
    - src/modules/harness/memory-store.ts
    - src/modules/harness/memory-db.ts
    - src/modules/harness/tool-registry.ts
    - src/modules/harness/tools/*
    - src/modules/ouvir/ouvinte.ts
spec_ref: ""
tipo_output: "codigo"
migracao_necessaria: false
permite_mock: false
---

# T-046: Consciência situacional — identidade do sistema + env info + memórias no agent-loop

## Propósito

O LLM do agent-loop (chamado via `agenteDecidir()`) hoje não sabe:
- **Quem ele é** como sistema — só tem identidade da padaria, não do Mettri
- **Onde está** — data, cidade, modelo, versão, business name
- **O que sabe do cliente** — `memorias` não são passadas para o LLM decisório

Sem essas 3 camadas, o agente toma decisões no escuro: não sabe se é segunda ou sábado, não sabe o fuso horário do cliente, não sabe preferências já registradas. O Claude Code faz isso com bloco `<env>` + identidade funcional. O Mettri precisa do equivalente em pt-BR.

## Escopo

- **Toca:**
  - `src/modules/ouvir/monta-prompt.ts` — adicionar seção `<env>` no system prompt (data, cidade, modelo, business name, versão). Refinar identidade em duas camadas. Adicionar inputs `envInfo`, `memorias` no `MontarPromptInput`.
  - `src/modules/ouvir/motor-llm.ts` — `AgenteDecidirInput` ganha campo `memorias`; `agenteDecidir()` passa `memorias` para `montarPrompt()`.
  - `src/modules/harness/agent-loop.ts` — `processarMensagem()` passa `context.memorias` para `agenteDecidir()`. Enriquecer evento `agent:turno-inicio` com dados do env info + contagem de memórias carregadas.
  - `src/modules/harness/types.ts` — adicionar constante `COMPACTING` (reservado para T-045). Adicionar campo `memoriasCarregadas` nos eventos de turno se necessário.
  - `src/modules/harness/inspector-popup.ts` — exibir env info no header do popup. Timeline items mais verbosos: "🆕 Turno — Maria, 3 memórias carregadas", "🧠 Contexto: env=production, business=Pão de Verdade, data=04/06".
  - `src/modules/harness/env-config.ts` — NOVO: módulo que centraliza a leitura de parâmetros de ambiente (nome do negócio, cidade, fuso, versão, modelo). Junta `process.env` + `chrome.storage.local` + defaults.

- **NÃO toca:**
  - `src/modules/harness/memory-store.ts` — a leitura de memórias já é feita pelo `ouvinte.ts`. Só falta repassar.
  - `src/modules/harness/tool-registry.ts` — sem mudanças.
  - `src/modules/harness/tools/*` — sem mudanças.
  - `src/modules/ouvir/ouvinte.ts` — já busca memórias e passa no context. Não mexer.
  - `src/storage/memory-db.ts` — sem mudanças.

## O que já existe

- `src/modules/ouvir/monta-prompt.ts` — monta system + user prompt. Já tem input `memorias` (criado na T-041). Já injeta `identidade-padaria.md` no system prompt. **Mas não tem env info, e não recebe `memorias` quando chamado pelo agent-loop.**
- `src/modules/ouvir/motor-llm.ts` — `agenteDecidir()` chama `montarPrompt()` com `decisao: true`. **Não passa `memorias`.** `AgenteDecidirInput` não tem campo `memorias`.
- `src/modules/harness/agent-loop.ts` — `processarMensagem()` recebe `context` com `memorias` (vindo do ouvinte). **Mas não repassa para `agenteDecidir()`.**
- `src/modules/harness/inspector-popup.ts` — popup com timeline de 6 eventos `agent:*`. Mostra tool calls, erros, respostas. **Não mostra contexto de turno, memórias carregadas, nem env info.**
- `src/modules/ouvir/prompts/identidade-padaria.md` — "Você é Mettri, atendente virtual da padaria artesanal Pão de Verdade, escrevendo no WhatsApp." Mistura sistema + negócio em 1 linha.
- `src/modules/ouvir/prompts/decisao-sistema.md` — instruções de decisão para o agent-loop.

## Onde verificar / input

- `src/modules/ouvir/monta-prompt.ts` — função `montarPrompt()`, interfaces `MontarPromptInput` e `MontarPromptOutput`. Como as seções são montadas (systemPrompt vs userPrompt).
- `src/modules/ouvir/motor-llm.ts` — função `agenteDecidir()`, interface `AgenteDecidirInput`. Linhas 400-410: como `montarPrompt()` é chamado sem `memorias`.
- `src/modules/harness/agent-loop.ts` — `processarMensagem()` linhas 52-120: como o `context` é recebido e repassado para `agenteDecidir()`.
- `src/modules/harness/types.ts` — `AGENT_EVENTS`, interfaces de evento `AgentTurnoInicioEvent`.
- `src/modules/harness/inspector-popup.ts` — `TimelineItem` tipo, método `adicionarItem()`, CSS do header.
- `src/modules/ouvir/prompts/identidade-padaria.md` — prompt atual, 1 linha.
- Código do Claude Code (referência): `src/constants/prompts.ts` — `computeSimpleEnvInfo()` (~linha 651), `getSimpleIntroSection()` (~linha 175). `src/context.ts` — `getSystemContext()` (~linha 116).

## O que produzir / output

### 1. `env-config.ts` — NOVO módulo

```typescript
// src/modules/harness/env-config.ts
// Centraliza parâmetros de ambiente do Mettri.
//
// Hierarquia de resolução:
// 1. process.env.METTRI_* (deploy-time)
// 2. chrome.storage.local (runtime, via configurações)
// 3. defaults fixos
//
// Ainda não temos UI para configurar isso. Use env vars ou defaults.
// @TODO: criar UI de configuração para nome do negócio, cidade, fuso.

export interface EnvInfo {
  /** Nome do negócio (ex: "Pão de Verdade") */
  businessName: string;
  /** Cidade do negócio (ex: "São Paulo") */
  city: string;
  /** Fuso horário (ex: "America/Sao_Paulo") */
  timezone: string;
  /** Versão do Mettri (injetado no build) */
  version: string;
  /** Nome do modelo (ex: "DeepSeek Chat") */
  modelName: string;
  /** Ambiente: produção ou desenvolvimento */
  environment: 'production' | 'development';
}

const DEFAULTS: EnvInfo = {
  businessName: 'Pão de Verdade',
  city: 'São Paulo',
  timezone: 'America/Sao_Paulo',
  version: '1.0.0',
  modelName: 'DeepSeek Chat',
  environment: 'development',
};

export async function getEnvInfo(): Promise<EnvInfo> {
  // Versão via injeção no build (esbuild define)
  const version = typeof METTRI_VERSION !== 'undefined'
    ? METTRI_VERSION
    : DEFAULTS.version;

  return {
    businessName: process.env.METTRI_BUSINESS_NAME ?? DEFAULTS.businessName,
    city: process.env.METTRI_CITY ?? DEFAULTS.city,
    timezone: process.env.METTRI_TIMEZONE ?? DEFAULTS.timezone,
    version,
    modelName: DEFAULTS.modelName,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  };
}
```

### 2. `monta-prompt.ts` — identidade em 2 camadas + env block

**System prompt identity (topo do systemPrompt, antes de tudo):**

```
Você é a Mettri, atendente de IA para WhatsApp.

<ambiente>
Negócio: Pão de Verdade
Cidade: São Paulo
Fuso: America/Sao_Paulo
Hoje: 04/06/2026 (quinta-feira)
Versão: 1.0.0
Modelo: DeepSeek Chat
</ambiente>
```

**Mudanças na interface:**

```typescript
export interface MontarPromptInput {
  // ... campos existentes ...
  
  /** NOVO: Informações de ambiente (data, cidade, modelo, negócio) */
  envInfo?: {
    businessName: string;
    city: string;
    timezone: string;
    today: string;
    version: string;
    modelName: string;
  };
  
  // memorias já existe no input, mas não era passado pelo agent-loop
}
```

**System prompt passa a incluir:**

1. Linha de identidade: `Você é a Mettri, atendente de IA para WhatsApp.\n`
2. `<ambiente>` block com dados do `envInfo` (só se fornecido)
3. Seção `identidade-padaria.md` (já existe — fala do negócio específico)
4. Seções existentes: contextoConversa, extracao, resposta, decisao

**Separação clara:**
- **Camada 1 (Mettri):** "Você é a Mettri, atendente de IA para WhatsApp." — identidade do sistema, invariável
- **Camada 2 (Negócio):** conteúdo de `identidade-padaria.md` — "atendente virtual da padaria artesanal Pão de Verdade" — trocável por deploy
- **Camada 3 (Ambiente):** `<ambiente>` block com dados dinâmicos — data, cidade, nome do negócio

### 3. `motor-llm.ts` — `AgenteDecidirInput` + `agenteDecidir()` com memórias

```typescript
export interface AgenteDecidirInput {
  // ... campos existentes ...
  /** NOVO: Memórias persistentes para contexto */
  memorias?: ContextoMemorias;
}
```

`agenteDecidir()` linha 400 passa a incluir:
```typescript
const prompt = montarPrompt({
  // ... existente ...
  memorias: input.memorias,        // NOVO
  envInfo: await getEnvInfo(),     // NOVO
});
```

### 4. `agent-loop.ts` — repassar memórias + enriquecer evento

```typescript
// Dentro de processarMensagem(), antes de chamar agenteDecidir:
const decisao = await agenteDecidir({
  mensagem,
  chatId,
  tools: toolsDescriptions,
  toolResults: ferramentasChamadas,
  profile: context?.profile as never,
  catalogoCandidatos: context?.catalogoCandidatos,
  estadoPercebido: context?.estadoPercebido as never,
  historicoContexto: context?.historicoContexto as never,
  memorias: context?.memorias as ContextoMemorias | undefined,  // NOVO
});

// Enriquecer agent:turno-inicio com metadados:
this.eventBus.emit(AGENT_EVENTS.TURNO_INICIO, {
  chatId,
  mensagem,
  ferramentasDisponiveis,
  // NOVOS campos:
  totalMemoriasCarregadas: contarMemorias(context?.memorias),
  envInfo: await getEnvInfo(),  // ou versão simplificada
});
```

### 5. `inspector-popup.ts` — verbose

**Header do popup** passa a mostrar:
```
Mettri Inspector | Pão de Verdade | qui 04/06/2026
```

**Timeline items** mais descritivos (em pt-BR):
```
🆕 Turno iniciado
   └ Cliente: Maria (5511999999999)
   └ Ambiente: dev, 3 memórias carregadas
   └ Ferramentas disponíveis: 4

🔧 Chamou ferramenta: consultarCatalogo
   └ Argumentos: { "produto": "pão francês" }
   └ Duração: 320ms

✅ Resultado: consultarCatalogo
   └ Dados: 3 produtos encontrados
   └ (Resultado completo: ver console)

💬 Resposta do agente
   └ "Olá Maria! Temos pão francês sim, sai por R$ 0,50 a unidade."
   └ Ferramentas usadas: consultarCatalogo

🧠 Contexto do turno
   └ Ambiente: development
   └ Negócio: Pão de Verdade
   └ Data: 04/06/2026
   └ Memórias: 2 cliente, 1 negócio
```

Para isso, o `TimelineItem` ganha um campo opcional `detalhes?: string[]`:

```typescript
interface TimelineItem {
  timestamp: string;
  chatId: string;
  tipo: 'tool-call' | 'tool-result' | 'resposta' | 'precisa-ferramenta' | 'erro' | 'turno-inicio' | 'info';
  descricao: string;
  detalhes?: string[];  // NOVO: linhas verbosas expandidas
}
```

### 6. `types.ts` — novos eventos

```typescript
export interface AgentTurnoInicioEvent {
  chatId: string;
  mensagem: string;
  ferramentasDisponiveis: string[];
  // NOVOS campos opcionais (não quebram outras fontes do evento):
  totalMemoriasCarregadas?: number;
  /** Informações resumidas do ambiente para exibição no Inspector */
  envInfo?: {
    businessName: string;
    environment: string;
    today: string;
  };
}

// NOVO evento (reservado para consistência):
export const AGENT_EVENTS = {
  // ... existentes ...
  COMPACTING: 'agent:compacting',  // reservado T-045
} as const;
```

## Onde salvar

- `src/modules/harness/env-config.ts` — NOVO
- `src/modules/ouvir/monta-prompt.ts` — EDITAR
- `src/modules/ouvir/motor-llm.ts` — EDITAR
- `src/modules/harness/agent-loop.ts` — EDITAR
- `src/modules/harness/types.ts` — EDITAR
- `src/modules/harness/inspector-popup.ts` — EDITAR

## Como validar

- [ ] `monta-prompt.ts` com `decisao: true` + `envInfo` preenchido → system prompt começa com "Você é a Mettri, atendente de IA para WhatsApp." + `<ambiente>` block
- [ ] `monta-prompt.ts` com `decisao: true` + `memorias` preenchido → userPrompt inclui seções DIRETRIZES DO NEGÓCIO e PREFERÊNCIAS DO CLIENTE
- [ ] `agenteDecidir()` recebe `memorias` e repassa para `montarPrompt()` — sem quebrar chamadas existentes
- [ ] `agent-loop.ts` passa `context.memorias` para `agenteDecidir()` — sem quebrar quando `context.memorias` é undefined
- [ ] Evento `agent:turno-inicio` inclui `totalMemoriasCarregadas` e `envInfo` quando disponíveis
- [ ] InspectorPopup mostra:
  - Header com nome do business + data
  - Turno items com `detalhes[]` expandidos (cliente, memórias, env)
  - Item "🧠 Contexto do turno" no início de cada turno
- [ ] `env-config.ts` funciona com defaults sem env vars configuradas
- [ ] Gate: lint ✓ typecheck ✓ construir ✓ test:unit ✓
- [ ] Nenhum arquivo fora do escopo modificado

## Mock Policy

- `permite_mock: false` — lógica puramente funcional (entrada → saída). Testar com objetos sintéticos. `getEnvInfo()` pode ser testado com env vars mockadas via `process.env` temporário.

---

## Sabotagens Herdadas

> domínio: HARNESS — catálogo: `sabotagens/_global.md`

- ⚠️ **Overengineering** — criar sistema de configuração complexo com UI, persistência, fallback hierárquico. → **Antídoto:** `env-config.ts` começa com defaults + env vars. Sem UI. Sem storage. O @TODO marca onde a UI vai entrar depois.
- ⚠️ **Perfeccionismo de prompt** — passar 2h ajustando a frase de identidade. → **Antídoto:** "Você é a Mettri, atendente de IA para WhatsApp." é o MVP. Refina com uso real.
- ⚠️ **Fazer tudo sozinho** — tentar implementar env-config + monta-prompt + agent-loop + inspector em 1 checkpoint. → **Antídoto:** 3 checkpoints: (1) env-config + monta-prompt, (2) agent-loop + motor-llm, (3) inspector-popup. Cada um com gate próprio.
- ⚠️ **Vazamento de escopo** — começar a refatorar `identidade-padaria.md` ou criar sistema de múltiplos negócios. → **Antídoto:** não mexer nos prompts `.md`. Só adicionar a camada Mettri + env block **acima** deles.

## Memória Herdada

> buscado em `memory.md` por tags do domínio `HARNESS`

- **T-041 (Memory System):** `memorias` já existe como campo em `MontarPromptInput` e já é populado pelo `ouvinte.ts`. Só não é repassado para o agent-loop. O `memory-store.ts` já tem `prepararContexto()` funcional.
- **T-040 (AgentLoop real):** `agent-loop.ts` recebe `context` com `memorias` via 3º parâmetro. Passar para `agenteDecidir()` é 1 linha.
- **T-043 (Inspector Popup):** `TimelineItem` com `tipo: 'info'` já existe. Adicionar `detalhes[]` é extensão segura. O header customizável segue o padrão existente.
- **Claude Code env info (referência):** `computeSimpleEnvInfo()` em `prompts.ts` ~linha 651 — usa `<env>` block com CWD, git, plataforma, modelo. O Mettri adapta para WhatsApp: business, cidade, data, versão.
- **Claude Code identity (referência):** `getSimpleIntroSection()` ~linha 175 — "You are an interactive agent that helps users..." — identidade funcional curta antes de tudo.
