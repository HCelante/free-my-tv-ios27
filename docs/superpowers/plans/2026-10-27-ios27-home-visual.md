# Home no visual iOS 27 (parte 1: o visual) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A home web (`web/`) com o visual Liquid Glass do iOS 27 nos modos claro e escuro: topo com hora, clima, abas
em cápsula de vidro e botões redondos; destaque com a arte do título em foco; fileira de cartões 16:9; dock de vidro com
ícones em superelipse; desfoque real onde a TV aguenta.

**Architecture:** Tudo fica em `web/index.html`, `web/home.js` e `web/home.css`, mais um arquivo novo, `web/glass.css`,
só com as regras de `backdrop-filter`. O `home.js` carrega esse arquivo apenas quando `CSS.supports` confirma o
desfoque e a TV não é `lite`; nas outras TVs ficam os gradientes foscos do `home.css`. Os dados continuam os de hoje
(`Data.picks`): trocar o conteúdo das abas é a parte 2.

**Tech Stack:** ES5 puro, CSS sem variáveis nem grid, Tizen (`tizen/build.py`, `tizen/install.py`), verificação com
`tools/check.sh web` e a prévia em `out/tizen/` num navegador.

Spec: `docs/superpowers/specs/2026-10-27-ios27-home-design.md`. Prévia aprovada: `preview-ios27.html`.

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `web/glass.css` (novo) | Desfoque, tinta, anel e brilho de borda do Liquid Glass. Só é carregado onde há `backdrop-filter`. |
| `tools/check.sh` | Deixa `backdrop-filter` passar só em `web/glass.css`, e ainda barra variáveis e grid nele. |
| `web/index.html` | Sai `#title`; entram `#status`, `#hero` e `#art` (dentro de `#sky`). |
| `web/home.js` | `loadGlass()`, `art()`, `renderStatus()`, `showHero()`, `squircle()`; `renderTop`, `renderCards`, `layoutCards`, `renderShelf` e `updateFocus` reescritos em parte. |
| `web/home.css` | Cores do fundo, topo, destaque, cartões e dock. |

Regras do projeto que valem em todas as tarefas (CLAUDE.md e `tools/check.sh`):

- `web/*.js` em ES5: sem `let`, `const`, arrow functions, `.includes(`, `.find(`, `Object.assign(`, `Promise`, `fetch(`,
  `Math.sign` e afins.
- CSS sem `--variáveis`, `var(`, grid e (fora do `glass.css`) `backdrop-filter`. Modo escuro por sobrescritas `.night`.
- Só `transform` e `opacity` animam.
- Nunca fazer commit de `config.properties`, `*.keystore` ou chaves.

---

### Tarefa 0: Preparar a prévia

Sem chave do TMDB a home fica no modo `no-key` (só relógio), e não dá para ver o destaque nem os cartões.

**Files:**
- Modify: `config.properties` (fora do git; nunca fazer commit)

- [ ] **Passo 1: Chave do TMDB**

O usuário cria uma chave grátis em https://www.themoviedb.org/settings/api ("API Key", não o token de leitura) e cola
no `config.properties`, na linha `tmdb_key=`. Ninguém escreve a chave no chat.

- [ ] **Passo 2: Conferir que o arquivo continua fora do git**

Run: `git status --short config.properties`
Expected: nenhuma saída (o arquivo está no `.gitignore`).

- [ ] **Passo 3: Servidor da prévia**

Run (em segundo plano, a partir da raiz do repositório): `python3 -m http.server 8765 --bind 127.0.0.1`
A prévia de cada tarefa abre em `http://127.0.0.1:8765/out/tizen/index.html`, depois de `python3 tizen/build.py --preview`.

---

### Tarefa 1: Desfoque real em `web/glass.css`

**Files:**
- Create: `web/glass.css`
- Modify: `web/home.js` (helpers, perto de `sym()`, e o bloco de início no fim do arquivo)
- Modify: `tools/check.sh` (a checagem de CSS)

- [ ] **Passo 1: Ver a checagem pegando `backdrop-filter` hoje**

Run:

```bash
printf '.x { backdrop-filter: blur(1px); }\n' > web/zz-test.css; tools/check.sh web; echo "exit=$?"; rm -f web/zz-test.css
```

Expected: `web/zz-test.css:1:.x { backdrop-filter: blur(1px); }`, depois `web/ uses CSS older TVs don't have (above).`
e `exit=1`.

- [ ] **Passo 2: Exceção no `tools/check.sh`**

Trocar o bloco que começa em `# Nor do they have CSS custom properties` por:

```bash
  # Nor do they have CSS custom properties, grid or backdrop-filter (home.css says why). glass.css is the one file
  # with backdrop-filter: home.js loads it only on TVs that have it and aren't lite. Variables and grid stay out of it.
  css="$(ls web/*.css | grep -v '^web/glass\.css$')"
  if grep -nE '(^|[{;])[[:space:]]*(--[a-zA-Z-]+[[:space:]]*:|[a-z-]+[[:space:]]*:[^;{}]*var\(|display[[:space:]]*:[[:space:]]*(inline-)?grid([^a-z-]|$)|grid-[a-z-]+[[:space:]]*:|(-webkit-)?backdrop-filter[[:space:]]*:)' $css; then
    echo "web/ uses CSS older TVs don't have (above)." >&2
    exit 1
  fi
  if [ -f web/glass.css ] && grep -nE '(^|[{;])[[:space:]]*(--[a-zA-Z-]+[[:space:]]*:|[a-z-]+[[:space:]]*:[^;{}]*var\(|display[[:space:]]*:[[:space:]]*(inline-)?grid([^a-z-]|$)|grid-[a-z-]+[[:space:]]*:)' web/glass.css; then
    echo "web/glass.css uses CSS variables or grid (above)." >&2
    exit 1
  fi
```

- [ ] **Passo 3: Criar `web/glass.css`**

```css
/*
 * Liquid Glass, as on iOS 27: the real blur behind the tabs, the round buttons, the dock and the drawer's glass, with a
 * tint, a 1px ring and a lit rim. home.js loads this file only where the TV has backdrop-filter and isn't lite; every
 * other TV keeps home.css's frosted gradients. No CSS variables or grid here either (tools/check.sh).
 */
#tabs, .round, #platter, .glass {
  -webkit-backdrop-filter: blur(44px) saturate(1.9);
  backdrop-filter: blur(44px) saturate(1.9);
  background: rgba(255, 255, 255, 0.45);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.14), 0 0 0 1px rgba(219, 219, 219, 0.9), inset 0 -24px 36px -30px rgba(0, 0, 0, 0.06);
}
.night #tabs, .night .round, .night #platter, .night .glass {
  background: rgba(58, 58, 62, 0.42);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(166, 166, 166, 0.42), inset 0 -24px 36px -30px rgba(0, 0, 0, 0.5);
}

/* The lit rim: a 1.5px border, bright at the top and the bottom, cut out of a gradient by a mask. */
#tabs::before, .round::before, #platter::before, .glass::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  padding: 1.5px;
  border-radius: inherit;
  background: linear-gradient(rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.12) 35%, rgba(255, 255, 255, 0.04) 65%, rgba(255, 255, 255, 0.6));
  -webkit-mask: linear-gradient(#000, #000) content-box, linear-gradient(#000, #000);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
.night #tabs::before, .night .round::before, .night #platter::before, .night .glass::before {
  background: linear-gradient(rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.06) 35%, rgba(255, 255, 255, 0.02) 65%, rgba(255, 255, 255, 0.28));
}

/* Focused, a button is solid white, as before (these come after the glass rules above, so they have to be here too). */
.round.focus, .night .round.focus { background: #FFF; box-shadow: 0 14px 30px rgba(0, 0, 0, 0.24); }
.key.focus, .night .key.focus { background: #F5F5F7; box-shadow: 0 16px 34px rgba(0, 0, 0, 0.42); }
```

- [ ] **Passo 4: Carregar o arquivo no `home.js`**

Logo depois da função `sym()` (perto da linha 29), acrescentar:

```js
  /** Liquid Glass's blur (glass.css) where the TV has backdrop-filter and isn't lite; elsewhere home.css's frost. */
  function loadGlass() {
    var ok = false;
    try {
      ok = !!(window.CSS && CSS.supports && (CSS.supports('backdrop-filter', 'blur(1px)')
          || CSS.supports('-webkit-backdrop-filter', 'blur(1px)')));
    } catch (e) {}
    if (!ok || /(^| )lite( |$)/.test(document.documentElement.className)) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'glass.css';
    document.getElementsByTagName('head')[0].appendChild(link);
  }
```

No bloco de início, no fim do arquivo, trocar:

```js
  fit();
  renderTop();
```

por:

```js
  fit();
  loadGlass();
  renderTop();
```

- [ ] **Passo 5: Rodar a checagem**

Run: `tools/check.sh web`
Expected: termina com `All checks passed.`

- [ ] **Passo 6: Conferir que a exceção vale só para o `glass.css`**

Run: o mesmo comando do Passo 1.
Expected: de novo `exit=1` com `web/zz-test.css:1:`.

- [ ] **Passo 7: Ver na prévia**

Run: `python3 tizen/build.py --preview`
Abrir `http://127.0.0.1:8765/out/tizen/index.html` e avaliar no console (ou `Runtime.evaluate`):

```js
[!!document.querySelector('link[href="glass.css"]'), getComputedStyle(document.getElementById('platter')).backdropFilter]
```

Expected: `[true, "blur(44px) saturate(1.9)"]`.

- [ ] **Passo 8: Commit**

```bash
git add web/glass.css web/home.js tools/check.sh
git commit -m "Home: real blur behind the glass, only on TVs that have it"
```

---

### Tarefa 2: Fundo com a arte do título

O fundo ganha a cor do iOS 27 (`#F2F2F7` de dia, preto à noite) e uma camada `#art` com a imagem panorâmica do título,
que se desfaz para baixo e para a esquerda.

**Files:**
- Modify: `web/index.html` (dentro de `#sky`)
- Modify: `web/home.css` (bloco `MARK: - Background`)
- Modify: `web/home.js` (perto de `backdrop()`, e em `renderCards()`)

- [ ] **Passo 1: Camada `#art` no `index.html`**

Trocar:

```html
    <div class="veil"></div>
    <div class="lift"></div>
```

por:

```html
    <div class="veil"></div>
    <div id="art"><div class="pic"></div><div class="pic"></div><div class="scrim"></div></div>
    <div class="lift"></div>
```

A `.lift` continua por cima, para clarear a arte junto com o resto quando a gaveta abre.

- [ ] **Passo 2: Cores do fundo no `home.css`**

Trocar `background: #F5F5F7;` em `html, body` por `background: #F2F2F7;`.

No bloco `MARK: - Background`, trocar estas quatro linhas:

```css
#sky { background: #EBEBEF; }
#sky .day { background: -webkit-linear-gradient(top, #F5F5F7, #E2E2E7); background: linear-gradient(#F5F5F7, #E2E2E7); }
#sky .night { background: -webkit-linear-gradient(top, #1C1C1E, #0B0B0D); background: linear-gradient(#1C1C1E, #0B0B0D); opacity: 0; }
```

```css
.night #sky .veil { background: rgba(11, 11, 13, 0.78); }
```

por:

```css
#sky { background: #F2F2F7; }
#sky .day { background: -webkit-linear-gradient(top, #F2F2F7, #E5E5EA); background: linear-gradient(#F2F2F7, #E5E5EA); }
#sky .night { background: -webkit-linear-gradient(top, #111113, #000); background: linear-gradient(#111113, #000); opacity: 0; }
```

```css
.night #sky .veil { background: rgba(0, 0, 0, 0.8); }
```

E trocar, na linha de `#sky .veil`, `rgba(245, 245, 247, 0.74)` por `rgba(242, 242, 247, 0.74)`.

Logo depois de `.night.drawer-open #sky .lift { opacity: 0.42; }`, acrescentar:

```css
/* The focused pick's photo, the width of the screen, fading into the sky below and to the left (two layers cross-fade). */
#art { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; -webkit-transition: opacity 0.4s; transition: opacity 0.4s; }
#art .pic {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  background-size: cover;
  background-position: center top;
  opacity: 0;
  -webkit-mask-image: -webkit-linear-gradient(top, #000 46%, rgba(0, 0, 0, 0) 80%);
  -webkit-mask-image: linear-gradient(#000 46%, rgba(0, 0, 0, 0) 80%);
  mask-image: linear-gradient(#000 46%, rgba(0, 0, 0, 0) 80%);
  -webkit-transition: opacity 0.6s;
  transition: opacity 0.6s;
}
#art .pic.on { opacity: 1; }
#art .scrim {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  background: -webkit-linear-gradient(top, rgba(242, 242, 247, 0.5), rgba(242, 242, 247, 0) 24%), -webkit-linear-gradient(left, rgba(242, 242, 247, 0.96), rgba(242, 242, 247, 0.78) 32%, rgba(242, 242, 247, 0) 64%);
  background: linear-gradient(rgba(242, 242, 247, 0.5), rgba(242, 242, 247, 0) 24%), linear-gradient(90deg, rgba(242, 242, 247, 0.96), rgba(242, 242, 247, 0.78) 32%, rgba(242, 242, 247, 0) 64%);
}
.night #art .scrim {
  background: -webkit-linear-gradient(top, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0) 24%), -webkit-linear-gradient(left, rgba(0, 0, 0, 0.92), rgba(0, 0, 0, 0.7) 32%, rgba(0, 0, 0, 0) 64%);
  background: linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0) 24%), linear-gradient(90deg, rgba(0, 0, 0, 0.92), rgba(0, 0, 0, 0.7) 32%, rgba(0, 0, 0, 0) 64%);
}
.no-picks #art { opacity: 0; }
```

- [ ] **Passo 3: `art()` no `home.js`**

Logo depois da função `backdrop(url)`, acrescentar:

```js
  var artUrl = null, artFront = 0;

  /** The focused pick's photo behind the hero: the next layer fades in once its image has loaded (opacity only). */
  function art(url) {
    if (url === artUrl) return;
    artUrl = url;
    var pics = $('art').querySelectorAll('.pic');
    if (!url) {
      setClass(pics[0], 'on', false);
      setClass(pics[1], 'on', false);
      return;
    }
    var img = new Image();
    img.onload = function () {
      if (artUrl !== url) return;
      var next = 1 - artFront;
      pics[next].style.backgroundImage = 'url(' + url + ')';
      setClass(pics[next], 'on', true);
      setClass(pics[artFront], 'on', false);
      artFront = next;
    };
    img.src = url;
  }
```

Em `renderCards()`, logo depois da linha `backdrop(list.length ? Data.image(list[0].backdrop, 'w300') : '');`,
acrescentar (provisório; a Tarefa 4 move para o destaque):

```js
    art(list.length ? Data.image(list[0].backdrop, 'w1280') : '');
```

- [ ] **Passo 4: Checagem e prévia**

Run: `tools/check.sh web && python3 tizen/build.py --preview`
Expected: `All checks passed.`; na prévia, a foto do primeiro título aparece no alto, à direita, e some para a esquerda
e para baixo. Com `document.body.className = 'night'` no console, o mesmo no escuro.

- [ ] **Passo 5: Commit**

```bash
git add web/index.html web/home.css web/home.js
git commit -m "Home: the iOS 27 sky, with the pick's photo fading into it"
```

---

### Tarefa 3: Topo sem título, com hora, clima, abas em cápsula e botões redondos

**Files:**
- Modify: `web/index.html` (dentro de `#top`)
- Modify: `web/home.js` (`updateFocus`, `renderTop`, `tickClock`, `Data.onChange`, `renderShelf`)
- Modify: `web/home.css` (blocos `MARK: - Title and tabs` e `.round`)

- [ ] **Passo 1: `index.html`**

Trocar `<h1 id="title"></h1>` por:

```html
      <div id="status"><span class="time"></span><span class="wx"></span></div>
```

- [ ] **Passo 2: `renderTop()`**

Trocar a função inteira por:

```js
  function renderTop() {
    var tabs = $('tabs');
    tabs.innerHTML = '';
    el('div', 'lens', tabs);
    var names = [tr('Explore'), tr('Movies'), tr('Shows')];
    for (var i = 0; i < 3; i++) {
      var t = el('button', 'tab', tabs, names[i]);
      hover(t, Z.TOP, i);
    }
    var buttons = $('buttons');
    buttons.innerHTML = '';
    var defs = [['live_tv', tr('light|Live TV')], ['hdmi', tr('HDMI Inputs')], ['settings', tr('light|Settings')]];
    for (var b = 0; b < 3; b++) {
      var r = el('button', 'round' + (b === 2 ? ' last' : ''), buttons);
      r.style.left = (1568 + 92 * b) + 'px';
      sym(defs[b][0], r);
      el('div', 'tip', r, defs[b][1]);
      hover(r, Z.TOP, 3 + b);
    }
    // Inter comes after the first layout: the tabs widen then, and the lens has to follow.
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateFocus); } catch (e) {}
  }
```

E trocar o comentário `// MARK: - Top: title, tabs, buttons, quotes` por `// MARK: - Top: time and weather, tabs, buttons, quotes`.

- [ ] **Passo 3: Abas e lente em `updateFocus()`**

Trocar:

```js
    list = $('tabs').children;
    for (i = 0; i < list.length; i++) {
      setClass(list[i], 'on', i === st.tab);
      setClass(list[i], 'focus', st.zone === Z.TOP && st.top === i);
    }
```

por:

```js
    list = $('tabs').querySelectorAll('.tab');
    for (i = 0; i < list.length; i++) setClass(list[i], 'on', i === st.tab);
    // The lens slides under the tab on show (a transform); it turns white while the tabs have focus.
    var lens = $('tabs').firstChild, on = list[st.tab];
    if (lens && on) {
      lens.style.width = on.offsetWidth + 'px';
      lens.style.webkitTransform = lens.style.transform = 'translateX(' + on.offsetLeft + 'px)';
    }
    setClass($('tabs'), 'focus', st.zone === Z.TOP && st.top < 3);
```

- [ ] **Passo 4: Hora e clima no topo**

Logo depois de `renderClock()`, acrescentar:

```js
  /** The time and the weather now at the top left, as on an iPhone's status bar. */
  function renderStatus() {
    var s = $('status'), w = Data.weather, wx = s.lastChild;
    s.firstChild.textContent = formatDate('format|h:mm', Date.now());
    wx.innerHTML = '';
    if (!w) return;
    sym(Data.symbol(w.code, w.isDay), wx);
    wx.appendChild(document.createTextNode(Data.degrees(w.temp)));
  }
```

Em `tickClock()`, trocar `renderClock();` por `renderClock();` seguido de `renderStatus();` na linha de baixo.

Em `Data.onChange(function () { ... })`, acrescentar `renderStatus();` depois de `renderQuotes();`.

- [ ] **Passo 5: Cotações não seguem mais a largura da prateleira**

Em `renderShelf()`, apagar a linha:

```js
    $('quotes').style.right = (1920 - left - width) + 'px';
```

- [ ] **Passo 6: CSS do topo**

No `home.css`, apagar o bloco `#title { ... }` inteiro, o bloco `#tabs` e todas as regras `.tab`, `.tab.on`,
`.tab.focus`, `.night #title, .night .tab.on`, `.night .tab` e `.night .tab.focus` (do comentário
`/* MARK: - Title and tabs */` até antes de `/* Crypto quotes ...`). No lugar, colocar:

```css
/* MARK: - Top: the time and the weather at the left, the tabs in a glass capsule in the middle, buttons at the right. */

#status {
  position: absolute;
  left: 96px;
  top: 60px;
  height: 48px;
  font-size: 30px;
  font-weight: 600;
  line-height: 48px;
  color: #000;
  white-space: nowrap;
  -webkit-font-feature-settings: 'tnum';
  font-feature-settings: 'tnum';
}
#status .wx { margin-left: 22px; font-weight: 500; color: rgba(60, 60, 67, 0.62); }
#status .sym { width: 30px; height: 30px; vertical-align: -6px; margin-right: 8px; }
.night #status { color: #FFF; }
.night #status .wx { color: rgba(235, 235, 245, 0.62); }
.no-picks #status { visibility: hidden; }

#tabs {
  position: absolute;
  left: 960px;
  top: 44px;
  height: 64px;
  padding: 8px;
  border-radius: 40px;
  white-space: nowrap;
  -webkit-transform: translateX(-50%);
  transform: translateX(-50%);
  background: -webkit-linear-gradient(top, rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.64));
  background: linear-gradient(rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.64));
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.12), inset 0 1.5px 0 rgba(255, 255, 255, 0.95), inset 0 0 0 1px rgba(255, 255, 255, 0.55);
}
#tabs .lens {
  position: absolute;
  left: 0;
  top: 8px;
  height: 64px;
  border-radius: 32px;
  background: rgba(0, 0, 0, 0.07);
  -webkit-transition: -webkit-transform 0.34s cubic-bezier(0.3, 1.25, 0.5, 1);
  transition: transform 0.34s cubic-bezier(0.3, 1.25, 0.5, 1);
}
#tabs.focus .lens { background: #FFF; box-shadow: 0 8px 22px rgba(0, 0, 0, 0.18); }
.tab {
  position: relative;
  display: inline-block;
  height: 64px;
  padding: 0 36px;
  font-size: 28px;
  font-weight: 600;
  line-height: 64px;
  color: rgba(60, 60, 67, 0.62);
  -webkit-transition: color 0.17s;
  transition: color 0.17s;
}
.tab.on { color: #000; }
.night #tabs {
  background: -webkit-linear-gradient(top, rgba(44, 44, 48, 0.82), rgba(22, 22, 24, 0.68));
  background: linear-gradient(rgba(44, 44, 48, 0.82), rgba(22, 22, 24, 0.68));
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.4), inset 0 1.5px 0 rgba(255, 255, 255, 0.14), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}
.night #tabs .lens { background: rgba(255, 255, 255, 0.16); }
.night #tabs.focus .lens { background: #FFF; }
.night .tab { color: rgba(235, 235, 245, 0.62); }
.night .tab.on { color: #FFF; }
#tabs.focus .tab.on, .night #tabs.focus .tab.on { color: #000; }
```

Mais abaixo, trocar `.no-key #title, .no-key #tabs { visibility: hidden; }` por `.no-key #tabs { visibility: hidden; }`.

No bloco `#quotes`, trocar `right: 80px;` e `top: 178px;` por `right: 96px;` e `top: 150px;`.

- [ ] **Passo 7: Botões redondos maiores**

No bloco `.round`, trocar `top: 69px;`, `width: 68px;`, `height: 68px;` e `border-radius: 34px;` por `top: 48px;`,
`width: 72px;`, `height: 72px;` e `border-radius: 36px;`. Trocar a linha `.round .sym { ... }` por:

```css
.round .sym { position: absolute; left: 21px; top: 21px; width: 30px; height: 30px; }
```

E, em `.round .tip`, trocar `top: 88px;` por `top: 92px;`.

- [ ] **Passo 8: Sobrou alguma referência a `#title`?**

Run: `rg -n "'title'\)|#title" web/`
Expected: nenhuma saída.

- [ ] **Passo 9: Checagem e prévia**

Run: `tools/check.sh web && python3 tizen/build.py --preview`
Expected: `All checks passed.` Na prévia, sem "For You"; hora e clima à esquerda; a cápsula no centro. Com
`FreeMyTV.move(0, -1)` até o foco chegar às abas e `FreeMyTV.move(1, 0)`, a lente desliza de Explorar para Filmes e
fica branca. Avaliar:

```js
document.querySelector('#tabs .lens').style.transform
```

Expected: `translateX(<número>px)`, mudando de valor a cada aba.

- [ ] **Passo 10: Commit**

```bash
git add web/index.html web/home.js web/home.css
git commit -m "Home: the time and weather on top, tabs in a glass capsule with a sliding lens"
```

---

### Tarefa 4: Destaque e fileira de cartões 16:9

O cartão em foco (ou o último focado, quando o foco está em outro lugar) vira o destaque: a arte dele ocupa o fundo,
com o nome, os dados e um botão com o app onde abre. A fileira embaixo tem cartões de 356 × 200.

**Files:**
- Modify: `web/index.html` (dentro de `#top`)
- Modify: `web/home.js` (`renderCards`, `layoutCards`, `showHero` novo, `squircle` novo)
- Modify: `web/home.css` (bloco `MARK: - Picks`)

- [ ] **Passo 1: `index.html`**

Trocar `<div id="cards"></div>` por:

```html
      <div id="hero"><div class="name"></div><div class="meta"></div><div class="play"></div></div>
      <div id="cards"></div>
```

- [ ] **Passo 2: Contorno de superelipse (vale para o dock na Tarefa 5)**

Logo depois de `wordFit()`, acrescentar:

```js
  /**
   * An app icon's outline, as on iOS: a superellipse (n = 5), as a clip-path for a square of `size` px. Empty where the
   * TV doesn't take path() in clip-path: the CSS's rounded corners stay.
   */
  function squircle(size) {
    function sgn(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }
    var n = 5, r = size / 2, d = '';
    for (var i = 0; i < 96; i++) {
      var a = i / 96 * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a);
      d += (i ? ' L' : 'M') + (r + r * sgn(c) * Math.pow(Math.abs(c), 2 / n)).toFixed(2) + ' '
          + (r + r * sgn(s) * Math.pow(Math.abs(s), 2 / n)).toFixed(2);
    }
    var path = "path('" + d + " Z')";
    try { if (window.CSS && CSS.supports && CSS.supports('clip-path', path)) return path; } catch (e) {}
    return '';
  }

  function clip(node, path) {
    if (path) node.style.webkitClipPath = node.style.clipPath = path;
  }
```

- [ ] **Passo 3: `renderCards()`**

Trocar o laço `for (var c = 0; c < list.length; c++) { ... }` inteiro (do `var p = list[c]` até `hover(card, Z.CARDS, c);`) por:

```js
    for (var c = 0; c < list.length; c++) {
      var p = list[c], card = el('div', 'card', holder), app = Data.appFor(p.app);
      el('div', 'img', card).style.backgroundImage = 'url(' + Data.image(p.backdrop, 'w780') + ')';
      var info = el('div', 'info', card);
      if (app) {
        var badge = el('div', 'badge', info);
        clip(badge, BADGE_CLIP);
        face(app, badge, 18);
      }
      var text = el('div', 'text', info);
      el('div', 'title', text, p.title);
      if (p.service) el('div', 'sub', text, p.service);
      hover(card, Z.CARDS, c);
    }
```

Logo antes desse laço, depois de `holder.innerHTML = '';`, acrescentar `hero = null;` (a lista mudou: o destaque
redesenha).

Apagar as duas linhas de fundo que ficaram em `renderCards()` (o destaque cuida delas agora):

```js
    backdrop(list.length ? Data.image(list[0].backdrop, 'w300') : '');
    art(list.length ? Data.image(list[0].backdrop, 'w1280') : '');
```

E trocar o comentário `// as on Android: no title or tabs that could never show anything` por
`// as on Android: no tabs that could never show anything`.

- [ ] **Passo 4: `layoutCards()` e `showHero()`**

Trocar o comentário `/** The card with focus ... (older TVs). */` e a função `layoutCards()` inteira por:

```js
  var CARD_W = 356, CARD_STEP = 384, ROW_W = 1728, BADGE = 48, BADGE_CLIP = squircle(BADGE);

  /**
   * The row scrolls a card at a time to keep the focused one in view (the holder slides: a transform, which older TVs
   * animate), and the hero shows that card, also while focus is elsewhere.
   */
  function layoutCards() {
    var holder = $('cards'), nodes = holder.children, scroll = Math.max(0, st.card * CARD_STEP + CARD_W - ROW_W);
    for (var i = 0; i < nodes.length; i++) nodes[i].style.left = (i * CARD_STEP) + 'px';
    holder.style.webkitTransform = holder.style.transform = 'translateX(' + (-scroll) + 'px)';
    showHero(cards[st.card]);
  }

  var hero = null;

  /** The pick, large: its photo behind, its name, what it is, and the app it opens in. */
  function showHero(p) {
    if (p === hero) return;
    hero = p;
    art(p ? Data.image(p.backdrop, 'w1280') : '');
    backdrop(p ? Data.image(p.backdrop, 'w300') : '');
    if (!p) return;
    var h = $('hero'), name = h.children[0], play = h.children[2];
    name.textContent = p.title;
    name.style.fontSize = (p.title.length > 30 ? 64 : p.title.length > 18 ? 80 : 96) + 'px';
    h.children[1].textContent = p.meta || '';
    play.innerHTML = '';
    play.style.display = p.service ? '' : 'none';
    sym('play', play);
    el('span', '', play, p.service || '');
    setClass(h, 'fresh', false);
    void h.offsetWidth;   // restarts the animation
    setClass(h, 'fresh', true);
  }
```

`BADGE_CLIP = squircle(BADGE)` usa `squircle`, que é declaração de função (içada), então pode vir antes no arquivo.

- [ ] **Passo 5: CSS do destaque e dos cartões**

No `home.css`, apagar do comentário `/* MARK: - Picks: ...` até `.night .card .meta { ... }` (inclusive), e colocar no
lugar:

```css
/* MARK: - Hero and picks: the focused pick large over its photo; below, a row of 16:9 cards that grow 9% focused. */

#hero { position: absolute; left: 96px; bottom: 420px; width: 1000px; }
#hero .name {
  max-height: 2.1em;
  overflow: hidden;
  font-size: 96px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.02;
  color: #000;
}
#hero .meta { margin-top: 18px; font-size: 28px; font-weight: 500; white-space: nowrap; color: rgba(60, 60, 67, 0.62); }
#hero .play {
  display: inline-block;
  margin-top: 34px;
  height: 72px;
  padding: 0 40px 0 30px;
  border-radius: 36px;
  background: #000;
  color: #FFF;
  font-size: 28px;
  font-weight: 600;
  line-height: 72px;
  white-space: nowrap;
}
#hero .play .sym { width: 34px; height: 34px; vertical-align: -8px; margin-right: 10px; }
.night #hero .name { color: #FFF; }
.night #hero .meta { color: rgba(235, 235, 245, 0.62); }
.night #hero .play { background: #FFF; color: #000; }
.no-picks #hero { display: none; }
@-webkit-keyframes hero-in { from { opacity: 0; -webkit-transform: translateY(14px); } to { opacity: 1; -webkit-transform: none; } }
@keyframes hero-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
#hero.fresh { -webkit-animation: hero-in 0.4s cubic-bezier(0.2, 0.9, 0.3, 1); animation: hero-in 0.4s cubic-bezier(0.2, 0.9, 0.3, 1); }
.lite #hero.fresh { -webkit-animation: none; animation: none; }

#cards {
  position: absolute;
  left: 96px;
  top: 694px;
  -webkit-transition: -webkit-transform 0.32s cubic-bezier(0.2, 0.9, 0.3, 1);
  transition: transform 0.32s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.card {
  position: absolute;
  top: 0;
  width: 356px;
  height: 200px;
  border-radius: 30px;
  overflow: hidden;
  background: #D1D1D6;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
  -webkit-transition: -webkit-transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.15), box-shadow 0.22s;
  transition: transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.15), box-shadow 0.22s;
}
.card .img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; background-size: cover; background-position: center; }
.card .info {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100px;
  background: -webkit-linear-gradient(top, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.72));
  background: linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.72));
}
.card .badge { position: absolute; left: 18px; bottom: 18px; width: 48px; height: 48px; border-radius: 11px; overflow: hidden; color: #FFF; }
.card .badge img { position: absolute; left: 50%; top: 50%; max-width: 80%; max-height: 60%; -webkit-transform: translate(-50%, -50%); transform: translate(-50%, -50%); }
.card .badge img.logo { width: 80%; height: 46%; max-width: none; max-height: none; object-fit: contain; }
.card .badge .word { position: absolute; left: 3px; right: 3px; top: 50%; margin-top: -11px; height: 22px; line-height: 22px; text-align: center; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card .text { position: absolute; left: 80px; right: 18px; bottom: 17px; color: #FFF; }
.card .title { font-size: 24px; font-weight: 700; line-height: 30px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card .sub { font-size: 19px; font-weight: 500; line-height: 24px; color: rgba(255, 255, 255, 0.72); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  border-radius: 30px;
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.9);
  opacity: 0;
  -webkit-transition: opacity 0.17s;
  transition: opacity 0.17s;
}
.card.focus { -webkit-transform: scale(1.09); transform: scale(1.09); box-shadow: 0 26px 50px rgba(0, 0, 0, 0.34); z-index: 2; }
.card.focus::after { opacity: 1; }
.night .card { background: #2C2C2E; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5); }
.night .card.focus { box-shadow: 0 26px 50px rgba(0, 0, 0, 0.7); }
```

- [ ] **Passo 6: Checagem e prévia**

Run: `tools/check.sh web && python3 tizen/build.py --preview`
Expected: `All checks passed.` Na prévia, com `FreeMyTV.move(0, -1)` até o foco chegar aos cartões e
`FreeMyTV.move(1, 0)` algumas vezes: o destaque troca de título com a animação, a arte do fundo cruza para a do novo
título e a fileira rola quando o foco passa do quinto cartão. Avaliar:

```js
[document.querySelectorAll('#cards .card').length, document.querySelector('#hero .name').textContent, document.querySelectorAll('#art .pic.on').length]
```

Expected: `[<número de títulos>, "<nome do título em foco>", 1]`. Repetir nas abas Filmes e Séries e no escuro.

- [ ] **Passo 7: Commit**

```bash
git add web/index.html web/home.js web/home.css
git commit -m "Home: the focused pick as a hero over its photo, and a row of 16:9 cards"
```

---

### Tarefa 5: Dock de vidro com ícones em superelipse

**Files:**
- Modify: `web/home.js` (`renderShelf`)
- Modify: `web/home.css` (`#platter`, `.tile`)

- [ ] **Passo 1: `renderShelf()`**

Trocar a função inteira por:

```js
  var ICON = 100, ICON_GAP = 32, DOCK_PAD = 16, DOCK_TOP = 924, ICON_CLIP = squircle(ICON);

  function renderShelf() {
    var n = Math.min(shelf.length, SHELF_VISIBLE);
    // Square icons, as on an iPhone's dock, in a glass bar that keeps its bottom edge.
    var width = n * ICON + Math.max(0, n - 1) * ICON_GAP, left = (1920 - width) / 2;
    var platter = $('platter');
    platter.style.display = n ? '' : 'none';
    platter.style.left = (left - DOCK_PAD) + 'px';
    platter.style.width = (width + 2 * DOCK_PAD) + 'px';
    platter.style.top = DOCK_TOP + 'px';
    platter.style.height = (ICON + 2 * DOCK_PAD) + 'px';
    var tiles = $('tiles');
    tiles.innerHTML = '';
    tileStep = ICON + ICON_GAP;
    tileLeft = left;
    shelfFirst = Math.max(0, Math.min(shelfFirst, shelf.length - n));
    for (var i = 0; i < shelf.length; i++) {
      var t = el('div', 'tile', tiles), f = el('div', 'face', t);
      t.style.top = (DOCK_TOP + DOCK_PAD) + 'px';
      t.style.width = t.style.height = ICON + 'px';
      clip(f, ICON_CLIP);
      face(shelf[i], f, wordFit(shelf[i].title, ICON, 22));
      hover(t, Z.SHELF, i);
    }
    // More apps than fit: a small arrow just outside the glass on each side that has more.
    platter.innerHTML = '';
    for (var a = 0; a < 2; a++) {
      var arrow = sym('chevron_right', platter);
      arrow.className += a ? ' more' : ' more back';
      arrow.style.left = (a ? width + 2 * DOCK_PAD + 12 : -29) + 'px';
      arrow.style.top = (DOCK_PAD + ICON / 2 - 8.5) + 'px';
    }
    st.shelf = Math.min(st.shelf, Math.max(0, shelf.length - 1));
    placeTiles();
  }
```

O `face()` pinta a caixa que recebe e o `fitLogo()` mede o pai da imagem: as duas passam a ser a `.face`, que tem o
mesmo tamanho do ícone.

- [ ] **Passo 2: CSS do dock**

No bloco `#platter`, trocar `border-radius: 62px;` por `border-radius: 44px;`.

No bloco `.tile`, trocar `top: 854px;`, `height: 126px;` e `border-radius: 22px;` por `top: 940px;`, `height: 100px;`
e `border-radius: 23px;`. Logo depois do bloco `.tile { ... }`, acrescentar:

```css
/* The icon itself: rounded corners here, the superellipse where the TV takes clip-path: path() (home.js). */
.tile .face { position: absolute; left: 0; top: 0; width: 100%; height: 100%; border-radius: 23px; overflow: hidden; }
```

Trocar `.tile img.logo { width: 70%; height: 50%; ... }` por:

```css
.tile img.logo { width: 76%; height: 42%; max-width: none; max-height: none; object-fit: contain; }
```

No bloco `.tile .word`, trocar `font-size: 30px;` por `font-size: 22px;`, `margin-top: -20px;` por `margin-top: -15px;`,
`height: 40px;` por `height: 30px;` e `line-height: 40px;` por `line-height: 30px;`.

- [ ] **Passo 3: Checagem e prévia**

Run: `tools/check.sh web && python3 tizen/build.py --preview`
Expected: `All checks passed.` Na prévia, o dock é uma barra de vidro com ícones quadrados de canto contínuo, na ordem
do `shelf_apps`. Avaliar:

```js
[document.querySelectorAll('#tiles .tile').length, getComputedStyle(document.querySelector('#tiles .face')).clipPath.slice(0, 5)]
```

Expected: `[<apps da prateleira>, "path("]`. Andar no dock com `FreeMyTV.move(1, 0)`: o ícone em foco cresce 20% e
sobe; `FreeMyTV.move(0, 1)` abre a gaveta, com as teclas e os painéis em vidro.

- [ ] **Passo 4: Commit**

```bash
git add web/home.js web/home.css
git commit -m "Home: a glass dock with iOS-shaped app icons"
```

---

### Tarefa 6: Na TV (QN50Q60DAGXZD, 192.168.18.8)

**Files:** nenhum, a não ser que o desempenho peça o Passo 4.

- [ ] **Passo 1: Gerar e assinar o pacote**

O usuário roda no terminal dele (a senha do certificado é dele e não passa pelo chat):

```bash
python3 tizen/build.py --sign <perfil do certificado Samsung>
```

Expected: `FreeMyTV-tizen.wgt` na raiz. Sem perfil de certificado criado ainda, parar aqui e combinar com o usuário.

- [ ] **Passo 2: Instalar**

Run: `python3 tizen/install.py 192.168.18.8`
Expected: a instalação termina sem erro e o Free My TV abre na TV. Se der "Could not connect to the SDB Daemon",
conferir o Developer Mode com o IP do PC 192.168.18.13 e reiniciar a TV.

- [ ] **Passo 3: Conferir na TV**

- Sem "For You"; hora e clima no topo; lente deslizando entre Explorar, Filmes e Séries.
- Destaque trocando junto com o foco nos cartões; dock com os seis apps na ordem certa.
- Desfoque real atrás das abas, dos botões e do dock (a arte aparece borrada através do vidro).
- Modo claro de dia e escuro à noite.
- Navegação fluida: segurar → no dock e nos cartões sem travadas.

- [ ] **Passo 4: Se travar**

Em `web/glass.css`, trocar as duas ocorrências de `blur(44px) saturate(1.9)` por `blur(24px) saturate(1.6)`, gerar,
instalar e testar de novo. Se ainda travar, tirar `#platter` da primeira regra e da regra `.night` do `glass.css` (o
dock fica com o vidro fosco do `home.css`). Commit:

```bash
git add web/glass.css
git commit -m "Home: a lighter blur, for the Q60D"
```

---

## Fora deste plano (vai para a parte 2, a dos dados)

- O conteúdo novo das abas: vistos recentemente (Trakt e histórico local) no Explorar; novidades do Watchmode em Filmes
  e Séries; os títulos de seção ("Em alta", "Lançamentos") e as traduções novas.
- No destaque: a linha de contexto ("Visto há 35 min · HBO Max"), a barra de progresso, os botões "+" e "i", e o
  destaque com pôster para títulos sem imagem panorâmica.
- Cartões 2:3 para novidades e a barra de progresso de 4 px nos cartões de vistos.
- Ajustes da home: conectar o Trakt e a chave do Watchmode.

Diferenças em relação à spec, decididas aqui:

- O desfoque fica em `web/glass.css`, carregado pelo JS, e não em `@supports` dentro do `home.css`: o
  `tools/check.sh` barra `backdrop-filter` em qualquer lugar do `home.css`, até dentro de `@supports`.
- Os símbolos (TV, HDMI, engrenagem, play) continuam os PNG do Material Symbols que o app já tem; trocar por traços no
  peso do SF Symbols fica para depois, se o resultado na TV pedir.
- O botão do destaque mostra o nome do app (▶ Netflix), sem texto novo para traduzir.
