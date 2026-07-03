# Arquitetura do Karma

```mermaid
graph TB
    subgraph "Fase 0-2: Preparação"
        AGENTS[AGENTS.md<br/>Constituição] --> CLAIMS[claims.yaml<br/>Coordenação multi-agente]
        CLAIMS --> TRF[Triagem<br/>@gerir analisa candidatas]
        TRF --> SPEC[SPEC.md<br/>Contrato da tarefa<br/>modo: normal/estrito/relaxado/off]
        SPEC --> ZEN[ZenSpec referenciada<br/>Contrato moral]
    end

    subgraph "Fase 3: Agir (@construir)"
        FLUXO["Fluxo do @construir<br/>9 passos"]
        PASSO1["1. Recebe spec_path"]
        PASSO2["2. Lê ZenSpec"]
        PASSO3["3. ⭐ Sobe escada Ponytail<br/>7 degraus (YAGNI→reuso→stdlib→plataforma→dep→1 linha→mínimo)"]
        PASSO4["4. Implementa"]
        PASSO5["5. Gate-runner"]
        PASSO6["6. Trail.md"]
        PASSO7["7. Commit"]
        PASSO8["8. Dashboard"]
        PASSO9["9. Push"]

        FLUXO --> PASSO1 --> PASSO2 --> PASSO3 --> PASSO4 --> PASSO5 --> PASSO6 --> PASSO7 --> PASSO8 --> PASSO9

        subgraph "Gate sequence"
            CM[check-mocks<br/>Anti vi.mock/jest.mock]
            CC[check-cleanup<br/>Dados pessoais, tokens,<br/>arquivos indevidos]
            LINT[eslint]
            TC[tsc --noEmit]
            BUILD[esbuild]
            TEST[vitest --coverage]
            CM --> CC --> LINT --> TC --> BUILD --> TEST
        end
        PASSO5 --> CM

        subgraph "Ponytail (Escada de Decisão)"
            D1["1. Isso precisa existir?"]
            D2["2. Já existe no codebase?"]
            D3["3. A stdlib resolve?"]
            D4["4. A plataforma/runtime resolve?"]
            D5["5. Dependência já instalada?"]
            D6["6. Dá pra fazer em 1 linha?"]
            D7["7. SÓ ENTÃO: mínimo que funciona"]
            D1 -->|"não → YAGNI"| END[👍 Pare]
            D1 -->|"sim"| D2
            D2 -->|"sim → reusa"| END2[👍 Reuse]
            D2 -->|"não"| D3
            D3 -->|"sim → use direto"| END3[👍 Stdlib]
            D3 -->|"não"| D4
            D4 -->|"sim → nativo"| END4[👍 Nativo]
            D4 -->|"não"| D5
            D5 -->|"sim → use"| END5[👍 Dep]
            D5 -->|"não"| D6
            D6 -->|"sim → 1 linha"| END6[👍 1 linha]
            D6 -->|"não"| D7
        end
        PASSO3 --> D1

        subgraph "Modos (controlam rigor)"
            MODE_N["normal<br/>Padrão — degraus 1-7 obrigatórios"]
            MODE_E["estrito<br/>Questionar até stdlib"]
            MODE_R["relaxado<br/>Degraus 1-2 obrigatórios<br/>3-7 sugestões"]
            MODE_O["off<br/>Escada desligada"]
        end
        SPEC -->|"modo:"| MODE_N
        SPEC -->|"modo:"| MODE_E
        SPEC -->|"modo:"| MODE_R
        SPEC -->|"modo:"| MODE_O
    end

    subgraph "Auto-cura"
        N1["N1: Transiente<br/>Retry backoff<br/>10s × 2^(n-1)"]
        N2["N2: Determinístico<br/>Corrige e re-roda<br/>até 3 tentativas"]
        N3["N3: Conceitual<br/>Handoff @avaliar<br/>aborta ou split"]
        N4["N4: Sistêmico<br/>NEEDS_HUMAN_INTERVENTION<br/>WhatsApp"]
        N1 --> N2 --> N3 --> N4
    end

    subgraph "Fase 4: Verificar (@avaliar)"
        AV["@avaliar<br/>Leitura adversarial"]
        AV_DIFF[git diff vs SPEC]
        AV_SAB[sabotagens/{dominio}.md]
        AV_PASS["Veredito: PASS ✅"]
        AV_FAIL["Veredito: FAIL 🔴"]
        AV --> AV_DIFF --> AV_SAB
        AV_SAB --> AV_PASS
        AV_SAB --> AV_FAIL
        AV_FAIL -->|"máx 3 ciclos"| FLUXO
    end

    subgraph "Fase 5: Consolidar"
        PRE_CC["Pré-consolidação<br/>check-cleanup --full"]
        PRE_CC_CK["□ check-cleanup --full passou?"]
        PRE_CC_BR["□ git branch -a → só main + ativos?"]
        PRE_CC_TMP["□ tmp/ vazio ou gitignorado?"]
        PRE_CC_GI["□ .gitignore cobre: *.log, tmp/, *.heapsnapshot?"]
        PRE_CC_CL["□ claims.yaml sem locks stale?"]
        PRE_CC_PUSH["□ git push → remote sincronizado?"]
        PRE_CC --> PRE_CC_CK --> PRE_CC_BR --> PRE_CC_TMP --> PRE_CC_GI --> PRE_CC_CL --> PRE_CC_PUSH

        GERIR["@gerir<br/>Consolidação"]
        MERGE["Merge (PR ou squash)"]
        DELETE["Delete branch"]
        LEARN["@aprender<br/>Trail → memory.md"]
        GERIR --> MERGE --> DELETE --> LEARN
    end

    subgraph "Sabotagens Globais (10)"
        S1["1. Overengineering 🎯<br/>Escada Ponytail"]
        S2["2. Paralisia por pré-requisito"]
        S3["3. Genericidade prematura"]
        S4["4. Postergação"]
        S5["5. Fuga para o código"]
        S6["6. Perfeccionismo UI"]
        S7["7. Síndrome da spec perfeita"]
        S8["8. Escala imaginária"]
        S9["9. Fazer tudo sozinho"]
        S10["10. Mock Syndrome"]
    end

    SPEC -->|"sabotagens herdadas"| S1
    AV_SAB --> S1
```

## Estrutura de Diretórios

```
.karma/
├── AGENTS.md                    ← Constituição + pipeline completo
├── .opencode/agents/            ← 6 agentes (construir, avaliar, gerir, aprender, planejar, testar)
│   ├── construir.md             ← + Escada de Decisão (Ponytail)
│   └── avaliar.md               ← Verificação adversarial
├── .mettri/                     ← Estado do Karma
│   ├── claims.yaml              ← Locks multi-agente
│   ├── memoria.md                ← Aprendizados cross-sessão
│   ├── rituais.md               ← Ritual de encerramento (6 checkboxes)
│   ├── sabotagens/_global.md    ← 10 sabotagens + escada Ponytail
│   ├── template-SPEC.md         ← Contrato (modo, cleanup_flags, etc.)
│   ├── thresholds.yaml          ← Métricas
│   ├── trail/                   ← Heartbeats de sessão
│   └── tarefas/                 ← SPECs por estado (pendentes, concluídas, canceladas)
├── scripts/
│   ├── check-cleanup/           ← Gate: varre dados pessoais, tokens, branches órfãos
│   ├── check-mocks/             ← Gate: anti-mock determinístico
│   ├── sync-html/               ← Dashboard de progresso
│   ├── merge-claims/            ← Consolidação de claims
│   ├── next-id/                 ← Próximo T-ID
│   ├── pulse/                   ← Health check
│   └── rename-session/          ← Renomear sessão ativa
└── skills/                      ← Skills carregáveis (retomar, etc.)
```

## Pipeline Resumido

```
ZenSpec → SPEC.md → @gerir → @construir → @avaliar → @gerir → @aprender
                        │           │          │         │          │
                    Triagem      Implementa  Verifica  Consolida  Memória
                                 + escada    adversarial
                                 + gate
```

