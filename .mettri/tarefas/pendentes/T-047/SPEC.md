---
id: T-047
titulo: "Ciclo de aprendizado pós-conversa — salvar turno + evento memoria-salva"
dominio: HARNESS
status: pendente
prioridade: 2
dependencias: [T-046]
bloqueado_por: []
bloqueia: [T-045]
tentativas: 0
max_tentativas: 3
nivel_auto_cura: null
backoff_ms: 10000
max_backoff_ms: 300000
criado_em: "2026-06-04"
iniciado_em: null
concluido_em: null
heartbeat_ultimo: null
estimativa_min: 30
timeout_min: 90
escopo:
  modulos:
    - src/modules/harness/agent-loop.ts
    - src/modules/harness/memory-store.ts
    - src/modules/harness/types.ts
    - src/modules/harness/inspector-popup.ts
  nao_tocar:
    - src/modules/ouvir/monta-prompt.ts
    - src/modules/ouvir/motor-llm.ts
    - src/modules/ouvir/ouvinte.ts
    - src/modules/harness/tool-registry.ts
    - src/modules/harness/tools/*
    - src/modules/harness/env-config.ts
    - src/storage/memory-db.ts
spec_ref: ""
tipo_output: "codigo"
migracao_necessaria: false
permite_mock: false
---

# T-047: Ciclo de aprendizado pós-conversa — salvar turno + evento memoria-salva

## Propósito

O `memoryStore.salvarTurno()` existe (criado na T-041) mas **nunca é chamado**. Depois que o agent-loop termina um turno (respondeu ou estourou limite), nada é persistido. O aprendizado da conversa morre ali.

Sem esse ciclo, o sistema nunca melhora:
- Preferências do cliente descobertas durante a conversa são perdidas
- Correções aplicadas (erro → tool corrigida) não geram aprendizado
- Padrões de comportamento do cliente não se acumulam

Esta tarefa conecta o final do agent-loop com o memory-store, criando o ciclo completo: **conversa → decisão → resposta → aprendizado**.

## Escopo

- **Toca:**
  - `src/modules/harness/agent-loop.ts` — após emitir `RESPOSTA_PRONTA` (turno bem-sucedido) ou `ERRO` (turno com falha), chamar `memoryStore.salvarTurno(turno)` com o turno completo. Emitir novo evento `agent:memoria-salva` com o resultado.
  - `src/modules/harness/types.ts` — adicionar constante `MEMORIA_SALVA` e interface `AgentMemoriaSalvaEvent`.
  - `src/modules/harness/inspector-popup.ts` — escutar `agent:memoria-salva` e exibir na timeline com indicador 🧠 e detalhes verbosos.
  - `src/modules/harness/memory-store.ts` — `salvarTurno()` já existe (linhas 98-121). Pode ser enriquecido com extração de aprendizado mais refinada (ex: detectar preferências explícitas do cliente na mensagem).

- **NÃO toca:**
  - `src/modules/ouvir/monta-prompt.ts` — nada de prompt aqui
  - `src/modules/ouvir/motor-llm.ts` — o agent-loop decide quando salvar, não o motor
  - `src/modules/ouvir/ouvinte.ts` — o ouvinte já dispara o agent-loop. A escrita é pós-loop.
  - `src/modules/harness/tool-registry.ts` — sem mudanças
  - `src/modules/harness/tools/*` — sem mudanças
  - `src/storage/memory-db.ts` — `merge()` já existe e funciona

## O que já existe

- `src/modules/harness/memory-store.ts` — `salvarTurno(turno)` (linhas 98-121): recebe `AgentTurno`, extrai aprendizados via `extrairAprendizados()`, persiste como memória tipo `licao` via `memoryDB.merge()`. **Nunca chamado por ninguém.**
- `src/modules/harness/agent-loop.ts` — `processarMensagem()` termina em 3 cenários:
  1. `decisao.tipo === 'responder'` → emite `RESPOSTA_PRONTA` e `return`
  2. Timeout/erro → emite `ERRO` e `return`
  3. Limite de tools → emite `ERRO` e `return`
  **Em nenhum deles salva o turno.**
- `src/modules/harness/types.ts` — 6 constantes de evento (`AGENT_EVENTS`), interfaces de evento. **Não tem `MEMORIA_SALVA`.**
- `src/modules/harness/inspector-popup.ts` — 6 eventos escutados. Não tem entrada para memória salva.
- `src/modules/harness/memory-store.ts` — `prepararContexto()` é chamado pelo ouvinte. `salvarTurno()` existe mas órfão.

## Onde verificar / input

- `src/modules/harness/agent-loop.ts` — `processarMensagem()`: 3 pontos de saída (responder linha 142, timeout/erro linhas 98/134/156/216). Cada um precisa chamar `salvarTurno()` **antes** do `return`.
- `src/modules/harness/memory-store.ts` — `salvarTurno()` (linhas 98-121): já extrai aprendizados, já persiste. Só precisa ser chamado.
- `src/modules/harness/types.ts` — `AGENT_EVENTS` objeto, interfaces de evento.
- `src/modules/harness/inspector-popup.ts` — método `adicionarItem()`, switch de tipo de item, listener de eventos.

## O que produzir / output

### 1. `agent-loop.ts` — salvar turno nos 3 pontos de saída

```typescript
// Helper: tenta salvar o turno e emite evento
private async salvarEAprender(turno: AgentTurno): Promise<void> {
  try {
    const memoriaId = await memoryStore.salvarTurno(turno);
    if (memoriaId !== null) {
      const aprendizado = extrairResumoAprendizado(turno);
      this.eventBus.emit(AGENT_EVENTS.MEMORIA_SALVA, {
        chatId: turno.chatId,
        memoriaId,
        tipo: 'licao',
        descricao: aprendizado,
        ferramentasUsadas: turno.ferramentasChamadas.map(f => f.nome),
        totalFerramentas: turno.ferramentasChamadas.length,
        status: turno.status,
        duracaoMs: Date.now() - new Date(turno.iniciadoEm).getTime(),
      });
    }
  } catch {
    // Degradação graciosa — falha ao salvar não interrompe o fluxo
  }
}

// Chamado nos 3 pontos de saída:
// 1. RESPOSTA_PRONTA (linha 142): 
this.turno.status = 'dormindo';
await this.salvarEAprender(this.turno);  // NOVO
this.eventBus.emit(AGENT_EVENTS.RESPOSTA_PRONTA, { ... });

// 2. ERRO (timeout, repetição, etc):
this.turno.status = 'erro';
await this.salvarEAprender(this.turno);  // NOVO
this.eventBus.emit(AGENT_EVENTS.ERRO, { ... });

// 3. Limite de ferramentas (linha 216):
this.turno.status = 'erro';
await this.salvarEAprender(this.turno);  // NOVO
```

**Detalhe importante:** a chamada `salvarEAprender()` deve ser **fire-and-forget** com catch silencioso — nunca pode travar a resposta do agente.

### 2. `types.ts` — novo evento

```typescript
export interface AgentMemoriaSalvaEvent {
  chatId: string;
  memoriaId: number;
  tipo: 'licao' | 'cliente' | 'negocio' | 'referencia';
  descricao: string;
  ferramentasUsadas: string[];
  totalFerramentas: number;
  status: string;
  duracaoMs: number;
}

export const AGENT_EVENTS = {
  // ... existentes ...
  TURNO_INICIO: 'agent:turno-inicio',
  TOOL_CALL: 'agent:tool-call',
  TOOL_RESULT: 'agent:tool-result',
  RESPOSTA_PRONTA: 'agent:resposta-pronta',
  PRECISA_FERRAMENTA: 'agent:precisa-ferramenta',
  ERRO: 'agent:erro',
  MEMORIA_SALVA: 'agent:memoria-salva',   // NOVO
  COMPACTING: 'agent:compacting',           // reservado T-045
} as const;
```

### 3. `memory-store.ts` — extração de aprendizado enriquecida

O `extrairAprendizados()` atual (linhas 175-199) é simples: detecta erros e ferramentas usadas. Pode ser enriquecido para extrair **preferências explícitas do cliente** a partir da mensagem do turno:

```typescript
private extrairAprendizados(turno: AgentTurno): string | null {
  const partes: string[] = [];

  // 1. Erro → aprendizado de correção (já existe)
  if (turno.status === 'erro') {
    const toolsComErro = turno.ferramentasChamadas.filter(f => f.erro);
    if (toolsComErro.length > 0) {
      partes.push(`correção aplicada em: ${toolsComErro.map(f => f.nome).join(', ')}`);
    } else {
      partes.push('turno encerrado com erro');
    }
  }

  // 2. Tools usadas com sucesso (já existe)
  const toolsSucesso = turno.ferramentasChamadas.filter(f => !f.erro);
  if (toolsSucesso.length > 0) {
    const nomes = toolsSucesso.map(f => f.nome).join(', ');
    partes.push(`ferramentas utilizadas com sucesso: ${nomes}`);
  }

  // 3. NOVO: Detectar preferências na mensagem do cliente
  const preferencias = this.extrairPreferencias(turno.mensagemAtual);
  if (preferencias.length > 0) {
    partes.push(`preferências detectadas: ${preferencias.join('; ')}`);
  }

  // 4. NOVO: Duração como métrica de saúde
  const inicio = new Date(turno.iniciadoEm).getTime();
  const duracao = Date.now() - inicio;
  if (duracao > 20000) {
    partes.push(`turno longo (${Math.round(duracao / 1000)}s) — revisar`);
  }

  if (partes.length === 0) return null;
  return partes.join(' | ');
}

private extrairPreferencias(mensagem: string): string[] {
  const preferencias: string[] = [];
  const patterns = [
    /gosto\s+(mais|muito)\s+de\s+([^,.]+)/i,
    /prefiro\s+([^,.]+)/i,
    /não\s+gosto\s+de\s+([^,.]+)/i,
    /odeio\s+([^,.]+)/i,
  ];
  for (const pattern of patterns) {
    const match = mensagem.match(pattern);
    if (match) {
      preferencias.push(match[0].trim().toLowerCase());
    }
  }
  return preferencias;
}
```

### 4. `inspector-popup.ts` — timeline verbosa

Novo tipo de item na timeline:

```
🧠 Memória salva
   └ Tipo: licao
   └ Chat: Maria (5511999999999)
   └ Aprendizado: ferramentas utilizadas com sucesso: consultarCatalogo, registrarPedido
   └ Turno: 2 tools, 0 erros, dormindo
   └ Duração: 12s
   └ ID: #42
```

No código:

```typescript
// No listener do evento agent:memoria-salva:
this.eventBus.on(AGENT_EVENTS.MEMORIA_SALVA, (event: AgentMemoriaSalvaEvent) => {
  const nome = this.resolverNome?.(event.chatId) ?? event.chatId.substring(0, 20);
  const detalhes = [
    `Tipo: ${event.tipo}`,
    `Chat: ${nome}`,
    `Aprendizado: ${event.descricao}`,
    `Turno: ${event.totalFerramentas} ferramentas, status: ${event.status}`,
    `Duração: ${Math.round(event.duracaoMs / 1000)}s`,
    `ID: #${event.memoriaId}`,
  ];
  this.adicionarItem(event.chatId, {
    timestamp: new Date().toISOString(),
    chatId: event.chatId,
    tipo: 'info',
    descricao: `🧠 Memória salva — ${event.tipo}`,
    detalhes,
  });
});
```

## Onde salvar

- `src/modules/harness/agent-loop.ts` — EDITAR (chamar salvarEAprender nos 3 pontos de saída)
- `src/modules/harness/types.ts` — EDITAR (AGENT_EVENTS.MEMORIA_SALVA + interface)
- `src/modules/harness/memory-store.ts` — EDITAR (enriquecer extrairAprendizados)
- `src/modules/harness/inspector-popup.ts` — EDITAR (escutar evento + exibir)

## Como validar

- [ ] `agent-loop.ts` chama `memoryStore.salvarTurno()` após emitir `RESPOSTA_PRONTA`
- [ ] `agent-loop.ts` chama `memoryStore.salvarTurno()` após emitir `ERRO` (timeout, repetição, limite)
- [ ] `salvarEAprender()` nunca trava o fluxo — erros são capturados e ignorados
- [ ] Evento `agent:memoria-salva` é emitido apenas quando `salvarTurno()` retorna um ID (aprendizado detectado)
- [ ] Evento `agent:memoria-salva` não é emitido quando não há aprendizado (null)
- [ ] `AGENT_EVENTS` tem a constante `MEMORIA_SALVA`
- [ ] InspectorPopup escuta `agent:memoria-salva` e exibe item 🧠 com detalhes verbosos
- [ ] `extrairAprendizados()` enriquecido detecta padrões de preferência na mensagem
- [ ] Nenhuma memória é salva se `salvarTurno()` lançar exceção — degradação silenciosa
- [ ] Gate: lint ✓ typecheck ✓ construir ✓ test:unit ✓
- [ ] Nenhum arquivo fora do escopo modificado

## Mock Policy

- `permite_mock: false` — o `memoryStore.salvarTurno()` usa IndexedDB real (via `fake-indexeddb` nos tests). Testar com turnos sintéticos. A exceção deve ser testada com um mock no `memoryDB` que force erro (1 teste específico).

---

## Sabotagens Herdadas

> domínio: HARNESS — catálogo: `sabotagens/_global.md`

- ⚠️ **Overengineering** — criar sistema de classificação de aprendizado complexo (análise de sentimento, NLP) em vez de regex simples + código de status. → **Antídoto:** `extrairAprendizados()` começa com padrões regex simples. Melhora com uso real.
- ⚠️ **"Preciso de mais X antes de testar"** — achar que precisa de UI pra ver as memórias sendo salvas. → **Antídoto:** o InspectorPopup já mostra o evento `agent:memoria-salva` em tempo real. Testar com console.
- ⚠️ **Fazer tudo sozinho** — implementar agent-loop + memory-store + inspector em 1 checkpoint. → **Antídoto:** 2 checkpoints: (1) agent-loop + memory-store, (2) inspector-popup. Cada um com gate próprio.
- ⚠️ **Sabotagem de feedback loop (T-041):** salvar aprendizado de turnos que não tiveram interação real (ex: erros de comunicação com DeepSeek viram "lições" falsas). → **Antídoto:** `extrairAprendizados()` só persiste se detectar ferramentas usadas OU preferências explícitas. Erros de rede sem contexto são ignorados.

## Memória Herdada

> buscado em `memory.md` por tags do domínio `HARNESS`

- **T-041 (Memory System):** `salvarTurno()` foi criado na T-041 mas nunca conectado. O `extrairAprendizados()` original só detecta erro/sucesso de ferramentas — esta tarefa enriquece com preferências do cliente.
- **T-040 (AgentLoop real):** Os 3 pontos de saída do `processarMensagem()` são claros: responder, timeout/erro, limite de ferramentas. Cada um precisa do `salvarEAprender()` antes do `return`.
- **T-043 (Inspector Popup):** O popup já escuta 6 eventos com `this.eventBus.on()`. Adicionar o 7º segue o mesmo padrão. O `TimelineItem.tipo: 'info'` já existe, então 🧠 é só mais um item info com ícone no texto.
- **T-046 (Consciência situacional):** Antes de aprender, o agente precisa saber quem é e onde está. T-047 depende de T-046 porque as memórias salvas aqui serão lidas por T-046 no próximo turno — formando o ciclo completo.
