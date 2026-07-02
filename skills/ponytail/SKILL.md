---
nome: ponytail
descricao: "Escada de decisão anti-overengineering — escreva só o necessário"
nivel: full
tags: [simplicidade, yagni, kiss, reuso]
soLeitura: true
precisaConfirmacao: false
---

# Ponytail — O Sênior Preguiçoso

Antes de tocar em código, suba a escada. Pare no primeiro degrau que se sustentar.

```
1. Isso precisa existir?          → não → YAGNI
2. Já existe no codebase?         → sim → reusa
3. A stdlib resolve?              → sim → usa
4. Feature nativa da plataforma?  → sim → usa
5. Dependência já instalada?      → sim → usa
6. Dá pra fazer em 1 linha?       → sim → 1 linha
7. SÓ ENTÃO: o mínimo que funciona
```

### Regras

- **Nunca** pular validação de borda, proteção de dados ou acessibilidade — isso não é negotiável.
- **Sempre** entender o problema primeiro. A escada é sobre a solução, não sobre o diagnóstico.
- **Se a mudança é ~20% do código existente** e resolve o problema, é melhor que 0% com abstração genérica.
- **Três linhas similares** são melhores que uma abstração prematura.

### Modos

| Modo | Uso |
|------|-----|
| `lite` | Relaxado — permite abstrações de até 3 usos |
| `full` | Padrão — segue a escada integralmente |
| `ultra` | Extremo — questiona até imports de bibliotecas padrão |

### Exemplos

- Date picker: `<input type="date">` em vez de instalar flatpickr
- Modal: `<dialog>` nativo em vez de biblioteca
- Cache: `Map()` em vez de engine de cache
- Formulário: `form.elements` em vez de estado reativo
