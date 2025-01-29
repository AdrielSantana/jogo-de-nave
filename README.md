# Jogo de Naves Espaciais Multiplayer

## Arquitetura

O jogo utiliza uma arquitetura cliente-servidor autoritativa, onde:

- Servidor processa toda a lógica do jogo a 120 FPS
- Cliente atua apenas como renderizador e entrada de comandos
- Toda validação e processamento de regras ocorre no servidor
- Cliente recebe estados do jogo e interpola para visualização suave

## Requisitos Técnicos

### Servidor

- Implementar servidor WebSocket para comunicação em tempo real
- Loop de jogo rodando a 120 FPS fixos
- Gerenciar conexões de múltiplos jogadores
- Processar toda a lógica de jogo, física e colisões
- Validar e autorizar todas as ações dos jogadores
- Broadcast do estado do jogo para todos os clientes
- Sistema de rollback para correção de estados

### Cliente

- Interface 3D utilizando Three.js ou similar
- Renderização das naves e cenário espacial
- Sistema de câmera em terceira pessoa
- Interface para mostrar status do jogador
- Sistema de predição de movimento local
- Interpolação de estados recebidos do servidor
- Envio apenas de comandos de input para o servidor

### Networking

- Baixa latência na comunicação cliente-servidor
- Sistema de interpolação para movimento suave
- Sincronização de estado entre jogadores
- Tratamento de desconexões
- Sistema de reconciliação cliente-servidor
- Buffer de estados para interpolação

## Requisitos Funcionais

### Movimentação das Naves (Processada no Servidor)

- Sistema de aceleração progressiva (0 a velocidade máxima)
- Sistema de desaceleração/frenagem
- Rotação nos três eixos (pitch, yaw, roll)
- Inércia realista no espaço
- Controles responsivos

### Física (Processada no Servidor)

- Sistema de colisão entre naves
- Dano baseado na velocidade do impacto
- Física newtoniana simplificada
- Sistema de hitbox preciso

### Gameplay (Processado no Servidor)

- Suporte para 2+ jogadores simultâneos
- Sistema de spawn de jogadores
- Sistema de vida/dano
- Condições de vitória/derrota
- Sistema de respawn após destruição

### Interface (Cliente)

- Menu principal
- Lobby para jogadores
- HUD durante o jogo
- Placar de pontuação
- Indicadores de outros jogadores
- Indicador de latência

## Tecnologias Sugeridas

- Backend: Node.js + WebSocket
- Frontend: Three.js + HTML5
- Física: Cannon.js ou similar

## Como Rodar Localmente

1. Instalar dependências
2. Iniciar servidor (120 FPS)
3. Conectar clientes via navegador
4. Porta padrão: 3000

## Próximos Passos

- [ ] Configurar ambiente de desenvolvimento
- [ ] Implementar servidor básico com loop de 120 FPS
- [ ] Implementar sistema de estados e reconciliação
- [ ] Criar cena 3D básica
- [ ] Adicionar primeira nave controlável
- [ ] Implementar física básica no servidor
- [ ] Adicionar suporte multiplayer
- [ ] Refinar controles e gameplay
