# Trilha — T-018 (Lock de arquivo no claims.yaml + script merge-claims)

inicio: 2026-05-11T22:57:00Z
termino: 2026-05-11T23:00:00Z
veredito: PASS

---

### Checkpoint 2026-05-11T22:57:00Z
heartbeat: 2026-05-11T22:57:00Z — gate: GREEN — tentativa: 1

### Ações
- Criado `.karma/scripts/merge-claims/merge-claims.mjs` — script com lock de diretório para manipular claims.yaml
- Criado `.karma/scripts/merge-claims/SPEC.md` — documentação do script
- Implementadas 4 operações: ocupar, liberar, heartbeat, listar
- Lock pattern copiado do next-id.mjs (mkdirSync mutex atômico + stale recovery + backoff)
- Node version check (>= 18) incluído
- js-yaml para parse/dump (aceita perda de comentários, documentado no SPEC.md)

### Resultado
- node --check: ✓
- node merge-claims.mjs listar: ✓ (JSON com dominios)
- node merge-claims.mjs ocupar CATALOGO T-018 uuid-test-1: ✓ (claim registrado)
- node merge-claims.mjs ocupar CATALOGO T-999 uuid-test-2: ✓ (exit 1, "dominio ocupado")
- node merge-claims.mjs heartbeat CATALOGO uuid-test-1: ✓ (heartbeat atualizado)
- node merge-claims.mjs heartbeat CATALOGO uuid-wrong: ✓ (exit 1, "lock uuid não confere")
- node merge-claims.mjs liberar CATALOGO uuid-test-1 "Teste": ✓ (historico adicionado, campos extras preservados)
- node merge-claims.mjs liberar CATALOGO uuid-test-2: ✓ (exit 1, "lock uuid não confere")
- node merge-claims.mjs ocupar CADASTRO T-018-test uuid-abc: ✓
- node merge-claims.mjs liberar CADASTRO uuid-abc: ✓ (sem titulo → null no historico)
- node merge-claims.mjs ocupar DOMINIO_INEXISTENTE T-999 uuid-test: ✓ (exit 1, dominio não encontrado)
- node merge-claims.mjs comando_invalido: ✓ (exit 1, comando desconhecido)
- force_push_on_branch:false preservado em MARKETING: ✓
- heartbeat preservado após liberar: ✓

### Aprendizados
- O claims.yaml tem `version: "2.0"` com aspas duplas; js-yaml dump mudou para aspas simples — válido YAML mas diff cosmético.
- CATALOGO e CADASTRO ficaram com heartbeat preservado após liberar (side effect dos testes) — comportamento correto conforme spec.
- Script Node.js puro não passa pelo gate npm (lint/typecheck/construir) — gate é `node --check` + testes manuais.

### Armadilhas
- **Overengineering (sabotagem #1):** Resisti à tentação de adicionar validação Zod, configuração externa, ou CLI framework. O script resolve o problema com switch-case simples e Node.js puro.
- **Esperar spec perfeita (#8):** A decisão de aceitar perda de comentários (vs regex cirúrgico) foi pragmática. Implementei rápido, documentei a limitação, posso migrar depois.
- **Gitignore:** `.karma/` está no `.gitignore` do projeto. Os arquivos criados não são commitáveis — é esperado, o script é ferramenta local do harness.

### Notas Finais
- Commit não realizado: `.karma/` está em `.gitignore` (linha 43). Os arquivos do harness são locais.
- Função `writeClaims` com js-yaml dump muda aspas duplas para simples e perde comentários — comportamento documentado no SPEC.md.
