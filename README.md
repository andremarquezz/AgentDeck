# Codex Limits for Ulanzi D200H

Projeto pessoal do Jey para exibir os limites das duas contas Codex diretamente no Ulanzi D200H.

## O que existe aqui

So quatro gauges:

- JEY 5H
- JEY 7D
- AMERICANO 5H
- AMERICANO 7D

Cada gauge mostra percentual restante, barra que diminui conforme o uso e tempo ate o reset.

Nao existe daemon AgentDeck, servidor separado, Claude, OpenCode, Android, Apple, ESP32 ou qualquer outra camada.

## Contas

- JEY: %USERPROFILE%\.codex
- AMERICANO: %USERPROFILE%\.codex-americano

## Instalar

No PowerShell, dentro da pasta do projeto:

    npm install
    npm run install:ulanzi

Depois feche completamente o Ulanzi Studio, inclusive o icone da bandeja, e abra novamente.

No Ulanzi Studio aparecem quatro acoes separadas. Arraste cada uma para a tecla que quiser.

## Configurar AMERICANO

    npm run login:americano

Isso executa o login usando CODEX_HOME=~/.codex-americano e nao altera o login JEY.

## Atualizacao

- automatica a cada 30 segundos;
- pressionar qualquer gauge atualiza as duas contas imediatamente;
- conta sem login mostra LOGIN;
- erro temporario mantem o ultimo valor bom e mostra STALE.

## Build

    npm run build

O plugin pronto fica em:

    dist/com.ulanzi.ulanzistudio.jeycodex.ulanziPlugin
