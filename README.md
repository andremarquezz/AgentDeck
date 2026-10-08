# Codex Limits for Ulanzi D200H

Projeto pessoal do Jey para acompanhar os limites das duas contas Codex no Ulanzi D200H e no celular.

## O que existe aqui

No Ulanzi:

- JEY 5H
- JEY 7D
- AMERICANO 5H
- AMERICANO 7D

No celular:

- os mesmos 4 limites;
- percentual restante e reset;
- mesmas cores verde -> amarelo -> laranja -> vermelho;
- estado SYNC / STALE / LOGIN / OFFLINE;
- refresh manual;
- atualizacao visual automatica;
- identificacao da conta ativa;
- botoes USAR JEY e USAR AMERICANO.

O painel mobile usa o mesmo processo Node do plugin. Nao existe daemon AgentDeck separado.

## Contas

Cofres:

- JEY: %USERPROFILE%\.codex-jey
- AMERICANO: %USERPROFILE%\.codex-americano

Conta ativa usada pelo Codex:

- %USERPROFILE%\.codex\auth.json

O monitor consulta diretamente os dois cofres sem alterar login.

Quando voce toca em USAR JEY ou USAR AMERICANO no celular, somente o auth.json daquele cofre e copiado para %USERPROFILE%\.codex\auth.json.

Se o VS Code estiver aberto, ele e reiniciado para o Codex carregar a nova conta.
Se o VS Code estiver fechado, ele continua fechado.

## Instalar / atualizar

No PowerShell, dentro da pasta do projeto:

    git checkout feat/ulanzi-codex-account-usage
    git pull
    npm run install:ulanzi

Depois feche completamente o Ulanzi Studio, inclusive o icone da bandeja, e abra novamente.

No Ulanzi Studio aparecem quatro acoes separadas. Arraste cada uma para a tecla que quiser.

## Abrir no celular

O PC e o celular precisam estar na mesma rede local.

Depois de reiniciar o Ulanzi Studio, rode no PowerShell:

    Get-Content "$env:TEMP\jey-codex-d200h.log" -Tail 100 | Select-String "mobile url"

Vai aparecer algo parecido com:

    mobile url http://192.168.0.15:3333/?token=...

Abra essa URL no Safari do iPhone.

Depois use:

    Compartilhar -> Adicionar a Tela de Inicio

Assim o painel fica com comportamento de app no iPhone.

O token fica salvo localmente em:

    %USERPROFILE%\.jey-codex-mobile-token

A porta padrao e 3333. Para trocar a porta, defina JEY_MOBILE_PORT antes de iniciar o Ulanzi Studio.

## Atualizacao

- backend consulta JEY e AMERICANO a cada 30 segundos;
- o celular consulta o estado local a cada 15 segundos;
- tocar em qualquer gauge do Ulanzi faz refresh imediato;
- tocar no botao de refresh do celular faz refresh imediato;
- conta sem login mostra LOGIN;
- erro temporario mantem o ultimo valor bom e mostra STALE;
- SYNC aparece durante atualizacao manual.

## Seguranca local

O servidor escuta na rede local para permitir acesso pelo celular, mas exige um token aleatorio na URL.

Nao compartilhe a URL completa com o token fora dos seus dispositivos.

## Build

    npm run build

O plugin pronto fica em:

    dist/com.ulanzi.ulanzistudio.jeycodex.ulanziPlugin
