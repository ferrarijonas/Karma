# Trail — Conexão ouvinte→AgentLoop + Inspector Popup

**UUID:** session-001
**Data:** Wed Jun 03 2026

## Heartbeat

- Conectei o ouvinte ao AgentLoop: quando o ouvinte extrai uma intenção (diferente de 'outro'), dispara `window.__mettriHarness.loop.processarMensagem(chatId, text)`
- Criei `inspector-popup.ts` — popup flutuante multi-abas com timeline em tempo real
- Adicionei emissão de `TOOL_CALL` e `TOOL_RESULT` no agent-loop.ts
- Inicializei `harnessModule.init(eventBus)` no `panel.ts::initializePluginSystem()` antes do PanelShell

## Aprendizados

- EventBus.on() retorna `void`, não `() => void` — precisei criar wrapper `onDisposable<T>()` para poder limpar listeners
- `document.addEventListener` no TypeScript strict espera `(e: Event) => void`, não `(e: MouseEvent)` — precisei cast dentro do handler
- `window as Record<string, unknown>` não compila — precisa `window as unknown as Record<string, unknown>`

## Estado atual

- **Inspector:** aparece automaticamente no canto inferior direito ao carregar o Mettri, escuta todos os eventos agent:*, mostra timeline por aba
- **AgentLoop:** ainda mockado (Math.random), mas agora recebe mensagens do ouvinte quando há intenção
- **Para testar manualmente:** abrir WhatsApp Web → conversar com cliente → ouvinte extrai intenção → AgentLoop dispara → inspector mostra eventos
- Ou testar via console: `window.__mettriHarness.loop.processarMensagem('test@c.us', 'quero pão')`

## Armadilhas

- Se o ouvinte retornar `{}` (sem intenção), o AgentLoop não é chamado — normal, é o comportamento esperado
- AgentLoop é mock — vai chamar tools aleatórias. Não responde de verdade ainda
