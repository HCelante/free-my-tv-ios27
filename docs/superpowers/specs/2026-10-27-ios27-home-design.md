# Home no visual iOS 27, com vistos recentemente e novidades

Data: 2026-10-27. Alvo: a home web (`web/`), que roda na Samsung (Tizen) e na LG (webOS). A TV de referência é uma
Samsung QN50Q60DAGXZD (2024). O app Android (`app/`) fica de fora.

Prévia aprovada: `preview-ios27.html` (na raiz do repositório; abrir por HTTP a partir da raiz, para achar
`web/icons` e a fonte).

## Objetivo

A home deve ficar o mais parecida possível com o iOS 27, nos modos claro e escuro, e ser antes de tudo bonita. As
abas passam a mostrar o que a pessoa assistiu e o que chegou nos apps dela, não só tendências.

## Visual

### Tema

- `theme=auto` continua: claro de dia, escuro do pôr do sol ao nascer do sol. Os dois modos usam o mesmo desenho; só
  as cores mudam.
- Claro: fundo `#F2F2F7`, texto `#000000`, secundário `rgba(60,60,67,0.62)`.
- Escuro: fundo `#000000`, texto `#FFFFFF`, secundário `rgba(235,235,245,0.62)`.

### Liquid Glass

Usado na barra de abas, nos botões redondos, no dock, nos botões secundários do destaque e nos painéis da gaveta.

- Desfoque real: `backdrop-filter: blur(44px) saturate(1.9)` (com o prefixo `-webkit-`).
- Tinta: claro `rgba(255,255,255,0.45)`, escuro `rgba(58,58,62,0.42)`.
- Anel de 1px: claro `rgba(219,219,219,0.9)`, escuro `rgba(166,166,166,0.42)` (o anel do kit iOS 27).
- Brilho nas bordas de cima e de baixo: uma borda de 1,5px com gradiente vertical (forte nas pontas, fraco no meio),
  feita com máscara.
- Sombra interna escura embaixo e sombra externa suave.
- Sem suporte a `backdrop-filter` (LG webOS 3 e 4): fica o gradiente de hoje, dentro de `@supports`. O código continua
  sem variáveis CSS, com sobrescritas em `.night`, como o `home.css` atual.

### Layout (palco de 1920 × 1080)

- Sai o título "For You" (`#title`).
- No topo, à esquerda: hora e clima. No centro: barra de abas flutuante em vidro (Explorar · Filmes · Séries), com uma
  pílula que desliza até a aba ativa. À direita: três botões redondos de vidro (TV ao vivo, HDMI, Ajustes).
- Destaque: o título em foco, com a imagem panorâmica dele ocupando a tela e se desfazendo no fundo à esquerda e
  embaixo. Mostra uma linha de contexto ("Visto há 35 min · HBO Max" ou "Adicionado em 24 out · Prime Video"), o
  nome, os dados (ano, gênero, duração, classificação), o progresso quando houver e os botões ("Continuar" ou
  "Assistir no …", mais "+" e "i").
- Título sem imagem panorâmica: o fundo é o pôster desfocado, e o pôster aparece nítido à direita.
- Uma fileira de cartões com 200px de altura: 16:9 para vistos (com o ícone do app, o nome, o episódio, há quanto tempo
  e uma barra de progresso de 4px) e 2:3 para novidades (com o ícone do app e a data de chegada). O foco aumenta o
  cartão 9% e acende a borda.
- O dock embaixo, em vidro, com os apps da prateleira na ordem do `shelf_apps`.
- O foco em um cartão troca o destaque, como no Apple TV.

### Curvas e ícones

- Ícones de app com canto contínuo (superelipse, n = 5) via `clip-path: path()`, gerado no JS para cada tamanho. Onde
  `clip-path: path()` não existir, vale `border-radius` de 22,4%.
- Raios: cartões 30px, botões e abas em pílula (metade da altura), dock 48px, destaque com pôster 34px.
- Símbolos (TV, HDMI, engrenagem, play, +, i) como SVG de traço, no peso do SF Symbols.

## Abas e dados

### Explorar: vistos recentemente

O que foi assistido, do mais novo ao mais antigo, de qualquer app.

Fontes, juntas e sem repetição:

1. **Trakt, histórico** (`GET /sync/history?limit=40`): filmes e episódios com a data em que foram vistos.
2. **Trakt, em andamento** (`GET /sync/playback`): o que ficou pela metade, com a porcentagem. É o que dá a barra de
   progresso.
3. **Histórico local** (`localStorage`, chave `fmtv.history`, até 50 itens): cada título aberto por um cartão do Free
   My TV, com o tipo, o id do TMDB, o app e a hora.

Regras:

- Uma série aparece uma vez, no episódio mais recente.
- A ordem é pela hora mais recente entre as fontes.
- O app do cartão: o do histórico local quando houver; senão, o primeiro app da prateleira que tem o título no Brasil
  (provedores do TMDB). Sem nenhum, o cartão fica sem ícone de app.
- Imagens, nomes em português e dados vêm do TMDB, com o cache que já existe.
- Sem nada visto ainda, a aba mostra as tendências de hoje, com o título "Em alta", para não ficar vazia.

Limite, que precisa aparecer na documentação: Netflix, Prime Video, HBO Max e Disney+ não enviam o que se assiste na
TV para o Trakt. O Trakt recebe o histórico de apps que mandam (Plex, Kodi, Stremio e outros), dos check-ins no app do
Trakt no celular e do que for marcado à mão. Para esses quatro apps, o Explorar depende principalmente do histórico
local, e o progresso só existe para o que vier do Trakt.

### Filmes: adicionados recentemente

Os filmes que chegaram por último nos apps da prateleira, do mais novo ao mais antigo.

1. **Watchmode** (`GET /v1/releases/`, últimos 30 dias, 1 crédito por chamada, cache de 12 horas): os lançamentos com
   `source_release_date`, `source_id` e `tmdb_id`.
2. Fica o que for filme (`tmdb_type = movie`) de um serviço da prateleira: Netflix 203, Prime Video 26, HBO Max 387,
   Disney+ 372.
3. Cada título passa pela checagem do TMDB que já existe: precisa estar nesse serviço no Brasil.
4. A data mostrada é a `source_release_date`.

Limite: no plano grátis, o `/releases` não filtra por país, e as datas são as dos EUA. A versão por país
(`/title-release-dates?regions=BR`) é paga. Produções originais (Netflix, Prime, Max, Disney+) estreiam no mundo todo no
mesmo dia. Nos títulos licenciados, a data no Brasil pode ser outra, e a checagem do TMDB tira o que não está aqui.

Sem chave do Watchmode, ou com falha: os lançamentos do TMDB nos serviços da prateleira, ordenados por data de
lançamento (`sort_by=primary_release_date.desc`), com o rótulo "Lançamentos" no lugar de "Adicionados recentemente".

### Séries: continuar assistindo, depois adicionadas

1. **Continuar assistindo**: as séries do Explorar, na mesma ordem.
2. **Adicionadas recentemente**: o mesmo caminho dos Filmes, com `tmdb_type = tv`, sem repetir o que já está em
   "Continuar assistindo".

### Os nomes

Explorar, Filmes e Séries já existem em `app/assets/i18n/pt.json` e aparecem com `language=pt` ou `auto` numa TV em
português. Rótulos novos ("Vistos recentemente", "Adicionados recentemente", "Continuar assistindo", "Adicionadas
recentemente", "Em alta", "Lançamentos", "Visto {when}", "Adicionado em {date}", "{n} min restantes") entram em inglês
no código e com tradução em `pt.json`, pelo `tools/translate.py`.

## Configuração

Novas chaves em `config.properties`:

- `trakt_client_id` e `trakt_client_secret`: de um app criado pela própria pessoa em trakt.tv/oauth/applications.
  São dela, como a chave do TMDB, e ficam fora do git.

`watchmode_key` já existe (hoje só no Android): passa a valer também na home web.

Nos Ajustes do Início:

- **Trakt**: "Conectar" mostra o código de 8 letras do login por dispositivo (`POST /oauth/device/code`) e o endereço
  trakt.tv/activate, e consulta `POST /oauth/device/token` no intervalo que o Trakt indicar, até o código expirar.
  Conectado, mostra a conta e "Desconectar". O token de acesso (7 dias) e o de renovação ficam no `localStorage`; a
  renovação é automática.
- **Chave do Watchmode**: digitada na TV, como a do TMDB, e conferida antes de salvar.

## Atualização

- Trakt: ao abrir a home e a cada 15 minutos com ela na tela; antes, `GET /sync/last_activities` diz se mudou algo.
- Watchmode: a cada 12 horas (cerca de 60 créditos por mês).
- O histórico local muda na hora em que um cartão é aberto.

## Erros

- Trakt fora do ar ou token recusado: vale o histórico local, e os Ajustes mostram o motivo.
- Watchmode sem créditos ou fora do ar: vale o caminho do TMDB, e os Ajustes mostram o motivo.
- Imagem que não carrega: o cartão fica com o fundo cinza e o nome.

## Riscos para conferir primeiro na TV

1. As chamadas ao Trakt e ao Watchmode a partir do app no Tizen (a política de acesso é `<access origin="*">`). Se o
   Trakt recusar a origem, cadastrar a origem do app nas origens JavaScript do app no Trakt.
2. O desempenho do `backdrop-filter` na Q60D com o destaque e o dock na tela. Se a navegação travar, baixar o
   desfoque para 24px antes de tirar o efeito.

## Verificação

- `python3 tizen/build.py --preview` e abrir `out/tizen/index.html` num navegador, nos dois modos e nas três abas.
- Instalar na TV com `python3 tizen/install.py 192.168.18.8` e navegar com o controle: abas, cartões, dock, gaveta,
  Ajustes, conexão com o Trakt.
- Abrir um título por um cartão e conferir que ele aparece primeiro no Explorar.

## Fora do escopo

- O app Android (`app/`).
- A proteção de tela.
- Ler o histórico de dentro da Netflix, do Prime Video, do HBO Max ou do Disney+: o Tizen não permite.
