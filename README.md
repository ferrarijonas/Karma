# Karma Harness

Orquestrador de desenvolvimento orientado a tarefas para **opencode**.

## O que é

O Karma é um **harness de produtividade** — uma camada de orquestração multi-agente que transforma o opencode em um sistema de pipeline com:

- **5 fases** — Despertar → Despacho → Agir → Verificar → Consolidar
- **6 agentes especializados** — @tarefas, @implementador, @avaliador, @sonhador, @testador, @plan
- **Memória cross-sessão** — aprendizados sobrevivem entre execuções via `memory.md`
- **Auto-cura (N1-N4)** — tratamento progressivo de erros sem perder o fluxo
- **Claims por domínio** — coordenação para evitar conflitos entre tarefas
- **Sabotagens catalogadas** — 9 padrões de falha universais + catálogo por domínio

## Como usar

```bash
# 1. Clone o template no seu projeto
git clone https://github.com/seu-usuario/karma-harness meu-projeto/.karma-tmp
cd meu-projeto
mv .karma-tmp .karma
rm -rf .karma/.git

# Ou use o setup.sh
cd karma-harness
./setup.sh /caminho/do/seu/projeto

# 2. Configure
code .karma/opencode.json     # modelos, paths
code .karma/AGENTS.md         # estrutura do projeto, comandos, domínios
code .karma/.mettri/identidade.md  # persona

# 3. Use no opencode
# Adicione .karma/ ao workspace do opencode
```

## Estrutura

```
.karma/
├── AGENTS.md                    # Pipeline + constituição (ponto de entrada)
├── opencode.json                # Configuração de agentes e permissões
├── .mettri/
│   ├── identidade.md            # Persona do Karma + sabotagens globais
│   ├── claims.yaml              # Coordenação multi-domínio
│   ├── memory.md                # Aprendizados cross-sessão
│   ├── rituais.md               # Filosofia e rituais operacionais
│   ├── thresholds.yaml          # Parâmetros (WIP, timeouts, etc.)
│   ├── sabotagens/
│   │   └── _global.md           # 9 sabotagens universais
│   ├── template-SPEC.md              # Modelo de SPEC.md
│   ├── template-relatorio.md         # Modelo de relatório
│   └── tarefas/
│       ├── pendentes/{id}/      # Tarefas aguardando
│       ├── em-andamento/{id}/   # Tarefas em execução
│       └── concluidas/{id}/     # Tarefas finalizadas
├── .opencode/agents/
│   ├── tarefas.md               # Gestão de tarefas
│   ├── implementador.md         # Implementação + gate-runner
│   ├── avaliador.md             # Verificação adversarial
│   ├── sonhador.md              # Consolidação de memória + contexto
│   ├── testador.md              # E2E (Puppeteer + CDP)
│   └── plan.md                  # Modo planejamento
├── scripts/
│   ├── next-id/next-id.mjs      # Gerador de IDs sequenciais
│   ├── sync-html/sync-html.mjs  # Sincronizador do painel HTML
│   ├── merge-claims/            # Merge de claims.yaml
│   └── rename-session/          # Renomeia sessão opencode
└── README.md
```

## Pipeline

```
Fase 0: Portão Duro  (opencode carrega AGENTS.md)
Fase 1: Despertar    (carga de identidade + memória + contexto)
Fase 2: Despacho     (@tarefas prepara tarefa)
Fase 3: Agir         (@implementador → gate-runner)
Fase 4: Verificar    (@avaliador adversarial + @sonhador consolida)
Fase 5: Consolidar   (merge, PR, memória de longo prazo)
```

## Agentes

| Agente | Papel | Como invocar |
|--------|-------|-------------|
| **@tarefas** | Cria, gerencia e despacha tarefas | `Task({ agent: "tarefas", ... })` |
| **@implementador** | Lê briefing, implementa, roda gate | `Task({ agent: "implementador", ... })` |
| **@avaliador** | Verificação adversarial (read-only) | `Task({ agent: "avaliador", ... })` |
| **@sonhador** | Consolida memória pós-tarefa | `Task({ agent: "sonhador", ... })` |
| **@testador** | E2E com Puppeteer + CDP | `Task({ agent: "testador", ... })` |
| **@plan** | Modo planejamento read-only | via `/plan` |

## Personalização

Para adaptar ao seu projeto:

1. **Comandos** — edite `AGENTS.md` seção "Comandos" com seus npm/yarn scripts
2. **Domínios** — edite `claims.yaml` e o "Mapa de Domínios" no AGENTS.md
3. **Modelos** — edite `opencode.json` com seus modelos (ex: `claude-sonnet-4`, `deepseek-v4`)
4. **Persona** — edite `identidade.md` com o nome do seu agente e fundador
5. **Permissões** — edite `opencode.json` para alinhar paths do seu projeto

## Licença

MIT — use, modifique, compartilhe.
