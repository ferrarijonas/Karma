---
id: T-044
titulo: "Tool retomar_conversa — contexto de conversas anteriores"
dominio: HARNESS
status: em_andamento
prioridade: 2
dependencias: [T-041]
bloqueado_por: []
bloqueia: []
tentativas: 0
max_tentativas: 3
nivel_auto_cura: null
backoff_ms: 10000
max_backoff_ms: 300000
criado_em: "2026-06-03"
iniciado_em: "2026-06-04T10:50:00Z"
concluido_em: null
heartbeat_ultimo: null
estimativa_min: 30
timeout_min: 90
escopo:
  modulos:
    - src/modules/harness/tools/retomar-conversa.ts
    - src/modules/harness/memory-store.ts
    - src/modules/index.ts
  nao_tocar:
    - src/modules/harness/agent-loop.ts
    - src/modules/harness/ouvinte.ts
    - src/modules/harness/motor-llm.ts
spec_ref: ""
tipo_output: "codigo"
migracao_necessaria: false
permite_mock: false
---

# T-044: Tool retomar_conversa — contexto de conversas anteriores

## Propósito

Adicionar a ferramenta `retomar_conversa` ao ToolRegistry, permitindo que o agente busque o histórico completo de conversas anteriores com um cliente — pedidos passados, preferências descobertas e interações relevantes — sob demanda, diferentemente do MemorySystem que entrega memórias selecionadas por keyword match.

## Escopo

- **Toca:**
  - `src/modules/harness/tools/retomar-conversa.ts` — NOVO: tool com schema Zod, implementação que consulta MemoryStore
  - `src/modules/harness/memory-store.ts` — adicionar método `recuperarHistorico(chatId, dias?)` se não existir
  - `src/modules/index.ts` — registrar `retomarConversa` no ToolRegistry

- **NÃO toca:**
  - `src/modules/harness/agent-loop.ts` — a tool é registrada, o loop a chama via function calling
  - `src/modules/harness/ouvinte.ts` — o ouvinte já passa context, a tool é opcional
  - `src/modules/harness/motor-llm.ts` — as tools são definidas no tool-registry, o prompt já as descreve

## O que já existe

- `src/modules/harness/tool-registry.ts` — registro de tools com schema Zod, validação de entrada/saída
- `src/modules/harness/memory-store.ts` — MemoryStore com busca por keyword match, `salvarMemory()`, `buscarMemorias()`
- `src/modules/harness/memory-db.ts` — MemoryDB com IndexedDB, operações CRUD de memórias
- `src/modules/index.ts` — inicialização de módulos, registro de tools existentes
- Ferramentas existentes no ToolRegistry (ex: `buscar_pedido`, `consultar_catalogo`)

## Onde verificar / input

- `src/modules/harness/tool-registry.ts` — padrão de registro de tools com Zod
- `src/modules/harness/memory-store.ts` — interface existente de busca de memórias
- `src/modules/harness/memory-db.ts` — métodos de consulta ao IndexedDB
- `src/modules/index.ts` — ponto de registro de tools

## O que produzir / output

### `src/modules/harness/tools/retomar-conversa.ts` (NOVO)

```typescript
// Schema Zod para a tool
export const retomarConversaSchema = z.object({
  chatId: z.string().min(1, "chatId é obrigatório"),
  dias: z.number().int().min(1).max(365).optional().default(30),
  topico: z.string().optional(),
});

export type RetomarConversaInput = z.infer<typeof retomarConversaSchema>;

export interface RetomarConversaOutput {
  historicoPedidos: Array<{ ... }>;
  preferencias: Array<{ ... }>;
  interacoesRecentes: Array<{ ... }>;
  aprendizados: Array<{ ... }>;
}

export async function retomarConversa(
  input: RetomarConversaInput,
  deps: { memoryStore: MemoryStore }
): Promise<RetomarConversaOutput> {
  // 1. Valida input via Zod
  // 2. Chama memoryStore.recuperarHistorico(chatId, dias)
  // 3. Se topico fornecido, filtra resultados por relevância textual simples
  // 4. Retorna estrutura organizada: pedidos, preferências, interações, aprendizados
}
```

### `src/modules/harness/memory-store.ts` — método novo

Adicionar `recuperarHistorico(chatId: string, dias: number): Promise<HistoricoConversa>` que:
- Busca no MemoryDB todos os turnos e memórias do chatId nos últimos N dias
- Agrupa por tipo (pedido, preferência, interação, aprendizado)
- Ordena por data decrescente
- Retorna estrutura consolidada

### `src/modules/index.ts` — registro

```typescript
import { retomarConversa } from './harness/tools/retomar-conversa';
toolRegistry.register('retomar_conversa', retomarConversaSchema, retomarConversa);
```

## Onde salvar

- `src/modules/harness/tools/retomar-conversa.ts` — NOVO
- `src/modules/harness/memory-store.ts` — EDITAR (+ método)
- `src/modules/index.ts` — EDITAR (+ registro)

## Como validar

- [ ] `retomar-conversa.ts` com Zod schema e implementação
- [ ] Schema valida: chatId obrigatório, dias opcional (default 30), topico opcional
- [ ] `memory-store.ts` contém método `recuperarHistorico(chatId, dias?)`
- [ ] Método retorna histórico com pedidos, preferências, interações recentes, aprendizados
- [ ] Registrada no ToolRegistry via `modules/index.ts`
- [ ] Tool respeita limite de dias (não busca histórico além do especificado)
- [ ] Se `topico` fornecido, filtra resultados por relevância (match simples no texto)
- [ ] Gate: lint ✓ typecheck ✓ build ✓ test:unit ✓
- [ ] Nenhum arquivo fora do escopo modificado

## Mock Policy

- `permite_mock: false` — testar com dados reais do IndexedDB (usar fake-indexeddb como polyfill fiel, conforme feito em T-041). Nenhum `vi.mock` de módulo interno é permitido.

---

## Sabotagens Herdadas

> domínio: HARNESS — catálogo: `sabotagens/_global.md`

- ⚠️ **Overengineering** — criar parâmetros opcionais demais (filtros complexos, paginação, ordenação customizada). → **Antídoto:** apenas `chatId`, `dias` e `topico`. Nada além.
- ⚠️ **Mock leakage** — usar `vi.mock` em vez de fake-indexeddb para testar a tool. → **Antídoto:** `permite_mock: false`. Usar fake-indexeddb como em T-041.
- ⚠️ **Duplicação com MemoryStore** — a tool deve ser um wrapper THIN sobre o MemoryStore, não duplicar lógica de busca. → **Antídoto:** a tool chama `memoryStore.recuperarHistorico()` e organiza a saída. Toda lógica de busca fica no MemoryStore.
- ⚠️ **"Preciso de mais X antes de testar"** — adiar testes porque "preciso de dados reais". → **Antídoto:** fake-indexeddb com dados seed é suficiente para testar o fluxo completo.

## Memória Herdada

> buscado em `memory.md` por tags do domínio `HARNESS`

- **T-041 (Memory System — IndexedDB + MemoryStore):** implementou o MemoryStore e MemoryDB que esta tool vai consultar. O método `recuperarHistorico` é uma extensão natural do que já existe.
- **T-041 (permite_mock: true):** usou `fake-indexeddb` como polyfill fiel — serve de padrão para os testes desta tool.
- **Padrão de tool registration:** as tools existentes (T-040) seguem o padrão `schema Zod → função handler → registro no ToolRegistry`. `retomar_conversa` segue o mesmo padrão.
- **Sabotagem de escopo (T-040):** agent-loop não deve saber detalhes das tools — apenas chamá-las via function calling. Esta tool é um novo entry no registry, não uma modificação no loop.
