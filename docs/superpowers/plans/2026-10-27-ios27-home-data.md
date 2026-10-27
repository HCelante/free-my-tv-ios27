# Home iOS 27 (parte 2: os dados) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** As abas passam a mostrar o que a pessoa assistiu e o que chegou nos apps dela: Explorar = vistos
recentemente (Trakt + histórico local); Filmes = adicionados recentemente (Watchmode, com fallback TMDB); Séries =
continuar assistindo e depois adicionadas. Inclui conexão Trakt e chave Watchmode nos Ajustes.

**Architecture:** O visual (parte 1) já deixou o destaque e a fileira de cartões. Esta parte troca a fonte dos cartões.
`web/history.js` guarda o que a pessoa abre pelo Free My TV. `web/trakt.js` faz o login por dispositivo e lê
histórico/progresso. `web/data.js` passa a expor `recent()`, `added('movie'|'tv')` e `continueShows()`, usando
Watchmode `/v1/releases/` (cache 12 h) com checagem TMDB no Brasil, e TMDB por data quando não houver chave. O
`home.js` pinta as seções e grava no histórico ao abrir um título.

**Tech Stack:** ES5, `XMLHttpRequest` (como em `data.js`), `localStorage`, Trakt OAuth device flow, Watchmode REST,
TMDB. Config via `tools/webapp.py` → `config.js`.

Spec: `docs/superpowers/specs/2026-10-27-ios27-home-design.md`. Parte 1 (visual):
`docs/superpowers/plans/2026-10-27-ios27-home-visual.md` — terminar a parte 1 antes desta.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `config.example.properties` | Documenta `trakt_client_id`, `trakt_client_secret`, `watchmode_key` (já existe). |
| `tools/webapp.py` | Lê as chaves novas para o `CONFIG` do `config.js`. |
| `web/history.js` (novo) | Histórico local: `record`, `list`, até 50 itens em `fmtv.history`. |
| `web/trakt.js` (novo) | Device OAuth, tokens, `history()`, `playback()`, `refresh()`. |
| `web/data.js` | `recent()`, `added(kind)`, `continueShows()`, fetch Watchmode + fallback TMDB. |
| `web/home.js` | Seções por aba, `showHero` com contexto/progresso, gravar histórico ao ativar, Ajustes Trakt/Watchmode. |
| `web/index.html` | Inclui `history.js` e `trakt.js` antes de `data.js`. |
| `app/assets/i18n/en.json` + `pt.json` | Strings novas; depois `python3 tools/translate.py`. |
| `CLAUDE.md` / README (trecho curto) | Limite do Trakt nos apps grandes; Watchmode grátis = datas EUA. |

Regras: ES5 em `web/*.js`; sem Promise/fetch/arrow; chaves nunca no git; `tools/check.sh web` depois de cada tarefa.

---

### Tarefa 1: Config — Trakt e Watchmode no build web

**Files:**
- Modify: `config.example.properties`
- Modify: `tools/webapp.py`
- Modify: `config.properties` (local, fora do git — só se o usuário já tiver as chaves)

- [ ] **Passo 1: Documentar no exemplo**

No `config.example.properties`, depois do bloco `watchmode_key`, acrescentar:

```properties
# Optional: your Trakt API app (https://trakt.tv/oauth/applications). Redirect URI: urn:ietf:wg:oauth:2.0:oob
# JavaScript (CORS) origins: leave empty for a TV app, or add the preview's origin while testing in a browser.
# Device login happens on the TV (Home Settings → Trakt). Keep both private.
trakt_client_id=
trakt_client_secret=
```

E ajustar o comentário de `watchmode_key` para dizer que a home web também usa a chave (lançamentos nos serviços).

- [ ] **Passo 2: `tools/webapp.py`**

Em `GENERIC`, acrescentar `'watchmodeKey': '', 'traktClientId': '', 'traktClientSecret': ''`.

No dicionário retornado por `load_config` (o que mapeia `tmdb_key` → `tmdbKey`), acrescentar:

```python
        'watchmodeKey': values.get('watchmode_key', ''),
        'traktClientId': values.get('trakt_client_id', ''),
        'traktClientSecret': values.get('trakt_client_secret', ''),
```

- [ ] **Passo 3: Conferir o `config.js` gerado**

Run: `python3 tizen/build.py --preview && python3 -c "import re; t=open('out/tizen/config.js').read(); print('watchmodeKey' in t, 'traktClientId' in t)"`
Expected: `True True`

- [ ] **Passo 4: Commit**

```bash
git add config.example.properties tools/webapp.py
git commit -m "Config: Trakt and Watchmode keys for the web home"
```

---

### Tarefa 2: Histórico local (`web/history.js`)

**Files:**
- Create: `web/history.js`
- Modify: `web/index.html` (script antes de `data.js`)

- [ ] **Passo 1: Criar o módulo**

```js
/*
 * What the person opened from Free My TV's cards, kept in localStorage (fmtv.history), up to 50.
 * Trakt can't see Netflix/Prime/Max/Disney on the TV; this is what fills Explore for those apps.
 */
var History = (function () {
  'use strict';
  var KEY = 'fmtv.history', MAX = 50;

  function load() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY));
      return a && a.length ? a : [];
    } catch (e) { return []; }
  }

  function save(a) {
    try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {}
  }

  /** Record a card the person opened. kind: "movie"|"tv", id: TMDB id, app: Free My TV service key or "". */
  function record(kind, id, app) {
    if (!kind || !id) return;
    var a = load(), i, out = [];
    for (i = 0; i < a.length; i++) {
      if (!(a[i].kind === kind && a[i].id === id)) out.push(a[i]);
    }
    out.unshift({kind: kind, id: id, app: app || '', at: Date.now()});
    if (out.length > MAX) out = out.slice(0, MAX);
    save(out);
  }

  /** Newest first. Each item: {kind, id, app, at}. */
  function list() { return load(); }

  function clear() { save([]); }

  return {record: record, list: list, clear: clear};
})();
```

- [ ] **Passo 2: Incluir no `index.html`**

Depois de `<script src="zones.js"></script>`, antes de `data.js`:

```html
<script src="history.js"></script>
```

- [ ] **Passo 3: Teste rápido no console da prévia**

```js
History.clear(); History.record('movie', 693134, 'max'); History.list()[0]
```

Expected: `{kind: "movie", id: 693134, app: "max", at: <number>}`.

- [ ] **Passo 4: Commit**

```bash
git add web/history.js web/index.html
git commit -m "History: remember titles opened from Free My TV cards"
```

---

### Tarefa 3: Cliente Trakt (`web/trakt.js`)

**Files:**
- Create: `web/trakt.js`
- Modify: `web/index.html`
- Modify: `web/data.js` (`Prefs`: getters para tokens se preferir guardar só no Trakt module — tokens ficam em `fmtv.trakt`)

- [ ] **Passo 1: Módulo com device OAuth e sync**

```js
/*
 * Trakt.tv device login and sync (history + playback). Needs CONFIG.traktClientId / traktClientSecret.
 * Netflix/Prime/Max/Disney on the TV do not report to Trakt; see the design spec.
 */
var Trakt = (function () {
  'use strict';
  var STORE = 'fmtv.trakt', API = 'https://api.trakt.tv';
  var pollTimer = 0, listeners = [];

  function cfg() {
    return {
      id: (window.CONFIG && CONFIG.traktClientId) || '',
      secret: (window.CONFIG && CONFIG.traktClientSecret) || ''
    };
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; }
  }
  function save(o) {
    try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) {}
  }

  function headers(token) {
    var c = cfg(), h = {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': c.id
    };
    if (token) h.Authorization = 'Bearer ' + token;
    return h;
  }

  function req(method, path, body, token, done) {
    var x = new XMLHttpRequest(), over = false;
    x.open(method, API + path, true);
    x.timeout = 12000;
    var h = headers(token), k;
    for (k in h) if (h.hasOwnProperty(k)) x.setRequestHeader(k, h[k]);
    x.onreadystatechange = function () {
      if (x.readyState !== 4 || over) return;
      over = true;
      if (x.status === 204) { done(null, null); return; }
      var json = null;
      try { json = x.responseText ? JSON.parse(x.responseText) : null; } catch (e) { done(e); return; }
      if (x.status < 200 || x.status >= 300) {
        done(new Error(x.status === 401 ? 'Trakt rejected the token' : 'HTTP ' + x.status));
        return;
      }
      done(null, json);
    };
    x.ontimeout = x.onerror = function () { if (!over) { over = true; done(new Error('no connection')); } };
    x.send(body ? JSON.stringify(body) : null);
  }

  function changed() { for (var i = 0; i < listeners.length; i++) listeners[i](); }

  function connected() { return !!(load().access); }

  function account() { return load().user || ''; }

  function error() { return load().error || ''; }

  /** Start device login. done(err, {userCode, verificationUrl, expiresIn}). */
  function beginLogin(done) {
    var c = cfg();
    if (!c.id || !c.secret) { done(new Error('Trakt is not configured')); return; }
    req('POST', '/oauth/device/code', {client_id: c.id}, null, function (err, res) {
      if (err) { done(err); return; }
      clearInterval(pollTimer);
      var expires = Date.now() + (res.expires_in || 600) * 1000;
      pollTimer = setInterval(function () {
        if (Date.now() > expires) {
          clearInterval(pollTimer);
          var s = load(); s.error = 'code expired'; save(s); changed();
          return;
        }
        req('POST', '/oauth/device/token', {
          code: res.device_code, client_id: c.id, client_secret: c.secret
        }, null, function (e2, tok) {
          if (e2 || !tok || !tok.access_token) return;   // 400 while pending
          clearInterval(pollTimer);
          var st = load();
          st.access = tok.access_token;
          st.refresh = tok.refresh_token;
          st.error = '';
          save(st);
          req('GET', '/users/settings', null, st.access, function (e3, u) {
            st = load();
            st.user = (u && u.user && (u.user.username || u.user.name)) || 'Trakt';
            save(st);
            changed();
          });
        });
      }, Math.max(5, res.interval || 5) * 1000);
      done(null, {
        userCode: res.user_code,
        verificationUrl: res.verification_url || 'https://trakt.tv/activate',
        expiresIn: res.expires_in || 600
      });
    });
  }

  function cancelLogin() { clearInterval(pollTimer); }

  function logout() {
    cancelLogin();
    save({});
    changed();
  }

  function withToken(done) {
    var st = load();
    if (!st.access) { done(new Error('not connected')); return; }
    done(null, st.access);
  }

  function refreshToken(done) {
    var st = load(), c = cfg();
    if (!st.refresh) { done(new Error('not connected')); return; }
    req('POST', '/oauth/token', {
      refresh_token: st.refresh, client_id: c.id, client_secret: c.secret,
      redirect_uri: 'urn:ietf:wg:oauth:2.0:oob', grant_type: 'refresh_token'
    }, null, function (err, tok) {
      if (err || !tok || !tok.access_token) {
        st.error = (err && err.message) || 'refresh failed';
        st.access = '';
        save(st);
        changed();
        done(err || new Error('refresh failed'));
        return;
      }
      st.access = tok.access_token;
      if (tok.refresh_token) st.refresh = tok.refresh_token;
      st.error = '';
      save(st);
      done(null, st.access);
    });
  }

  function authed(path, done) {
    withToken(function (err, token) {
      if (err) { done(err); return; }
      req('GET', path, null, token, function (e2, res) {
        if (e2 && /rejected the token/.test(e2.message)) {
          refreshToken(function (e3, t2) {
            if (e3) { done(e3); return; }
            req('GET', path, null, t2, done);
          });
          return;
        }
        done(e2, res);
      });
    });
  }

  /** Map Trakt history/playback rows to {kind,id,app,at,progress,episode}. */
  function mapHistory(rows) {
    var out = [], i, r, m, show, ep, at, kind, id;
    for (i = 0; rows && i < rows.length; i++) {
      r = rows[i];
      at = Date.parse(r.watched_at || r.paused_at || '') || 0;
      if (r.type === 'movie' && r.movie && r.movie.ids) {
        out.push({kind: 'movie', id: r.movie.ids.tmdb, app: '', at: at, progress: r.progress || 0, episode: ''});
      } else if ((r.type === 'episode' || r.episode) && r.show && r.show.ids) {
        show = r.show; ep = r.episode || {};
        out.push({
          kind: 'tv', id: show.ids.tmdb, app: '', at: at,
          progress: r.progress || 0,
          episode: ep.season && ep.number ? ('T' + ep.season + ' · E' + ep.number) : ''
        });
      }
    }
    return out;
  }

  var cache = {history: [], playback: [], at: 0, activities: ''};

  function refresh(done) {
    if (!connected()) { if (done) done(null); return; }
    authed('/sync/last_activities', function (err, act) {
      var stamp = act ? JSON.stringify(act) : '';
      if (!err && stamp && stamp === cache.activities && cache.at && Date.now() - cache.at < 15 * 60000) {
        if (done) done(null);
        return;
      }
      authed('/sync/history?limit=40', function (e1, hist) {
        authed('/sync/playback', function (e2, play) {
          if (e1) {
            var st = load(); st.error = e1.message; save(st);
          }
          cache.history = mapHistory(hist || []);
          cache.playback = mapHistory(play || []);
          cache.at = Date.now();
          if (!e1) cache.activities = stamp;
          changed();
          if (done) done(e1 || e2 || null);
        });
      });
    });
  }

  function history() { return cache.history.slice(); }
  function playback() { return cache.playback.slice(); }

  return {
    onChange: function (fn) { listeners.push(fn); },
    configured: function () { return !!(cfg().id && cfg().secret); },
    connected: connected,
    account: account,
    error: error,
    beginLogin: beginLogin,
    cancelLogin: cancelLogin,
    logout: logout,
    refresh: refresh,
    history: history,
    playback: playback
  };
})();
```

- [ ] **Passo 2: Script no `index.html`**

Depois de `history.js`:

```html
<script src="trakt.js"></script>
```

- [ ] **Passo 3: Commit**

```bash
git add web/trakt.js web/index.html
git commit -m "Trakt: device login and sync for recently watched"
```

---

### Tarefa 4: Watchmode releases + `Data.recent` / `Data.added`

**Files:**
- Modify: `web/data.js`
- Modify: `web/data.js` Prefs (watchmode key on TV, como TMDB)

- [ ] **Passo 1: Prefs para Watchmode**

Perto de `tmdbKey`, acrescentar:

```js
    watchmodeKey: function () { return String(pick('watchmodeKey', CONFIG.watchmodeKey || '')).trim(); },
    watchmodeKeyOnTV: function () { return v.watchmodeKey !== undefined; },
```

- [ ] **Passo 2: IDs Watchmode dos serviços da prateleira**

Perto da tabela de serviços TMDB, acrescentar o mapa (só os que a spec lista):

```js
  // Watchmode source_id → Free My TV service key (same keys as usable()).
  var WATCHMODE_SOURCES = {203: 'netflix', 26: 'prime', 387: 'max', 372: 'disney'};
```

- [ ] **Passo 3: Fetch `/v1/releases/` com cache 12 h**

Implementar `refreshAdded()`:

1. Se não houver `Prefs.watchmodeKey()`, chamar `fetchAddedTmdb(done)` (discover movie/tv com
   `sort_by=primary_release_date.desc` / `first_air_date.desc`, `with_watch_providers` dos apps usáveis, 30 dias).
2. Senão, `get('https://api.watchmode.com/v1/releases/?limit=250&start_date=' + day(-30), {'X-API-Key': key}, ...)`.
3. Filtrar `tmdb_type` movie/tv, `source_id` em `WATCHMODE_SOURCES`, `usable(service)`.
4. Para cada candidato, `details()` (já existente) para confirmar o app no Brasil; guardar
   `{id, kind, title, backdrop, poster, meta, app, addedAt: source_release_date, detailed: true}`.
5. Cache em `localStorage` `fmtv.added` com `at`.
6. Em falha (HTTP/créditos), `fetchAddedTmdb` e marcar `addedFallback = true` (rótulo "Lançamentos").

- [ ] **Passo 4: Mesclar recentes**

```js
  /** Explore: watched recently, newest first. One row per show. */
  function recent() {
    var byKey = {}, i, x, k, list, src;
    function add(item) {
      if (!item || !item.id) return;
      k = item.kind + ':' + item.id;
      if (!byKey[k] || item.at > byKey[k].at) byKey[k] = item;
    }
    list = History.list();
    for (i = 0; i < list.length; i++) add(list[i]);
    if (window.Trakt) {
      src = Trakt.history().concat(Trakt.playback());
      for (i = 0; i < src.length; i++) add(src[i]);
    }
    list = [];
    for (k in byKey) if (byKey.hasOwnProperty(k)) list.push(byKey[k]);
    list.sort(function (a, b) { return b.at - a.at; });
    return list;
  }

  function continueShows() {
    return recent().filter(function (x) { return x.kind === 'tv'; });
  }

  function added(kind) {
    // from cache filled by refreshAdded; filter kind; exclude ids in continueShows when kind==='tv'
  }
```

Enriquecer cada item com metadados TMDB (`title`, `backdrop`, `poster`, `meta`, `app`) reutilizando `details` /
cache de picks quando possível. Expor no return de `Data`: `recent`, `added`, `continueShows`, `addedIsFallback`,
`watchmodeChanged` (como `keyChanged`).

- [ ] **Passo 5: Refresh periódico**

Em `Data.refresh` / boot: `Trakt.refresh()` se conectado; `refreshAdded()`; a cada 15 min com a home visível chamar
`Trakt.refresh` de novo (o próprio Trakt já corta por `last_activities`).

- [ ] **Passo 6: `tools/check.sh web` + commit**

```bash
tools/check.sh web
git add web/data.js
git commit -m "Data: recently watched and newly added titles for the tabs"
```

---

### Tarefa 5: Home — seções das abas e gravação no histórico

**Files:**
- Modify: `web/home.js` (`renderCards` / layout das seções, `activate` ao abrir título, `showHero`)
- Modify: `web/home.css` (cartão 2:3, barra de progresso 4px, linha de contexto do hero — se a parte 1 ainda não tiver)
- Modify: `app/assets/i18n/en.json`, `pt.json`

- [ ] **Passo 1: Strings**

Em inglês (chave = texto no código):

- `Recently watched`
- `Recently added`
- `Continue watching`
- `Trending`
- `New releases`
- `Watched {when}`
- `Added {date}`
- `{n} min left`
- `Trakt`
- `Connect`
- `Disconnect`
- `Not connected`
- `Watchmode key`
- `Open trakt.tv/activate and enter:`

Rodar: `python3 tools/translate.py` e preencher `pt.json` (à mão ou `--fill --lang pt`).

- [ ] **Passo 2: `renderCards` por aba**

- tab 0: seções `[{label: tr('Recently watched'), items: Data.recent()}]`; se vazio,
  `[{label: tr('Trending'), items: Data.picks(null)}]` (os picks de hoje).
- tab 1: `[{label: Data.addedIsFallback() ? tr('New releases') : tr('Recently added'), items: Data.added('movie')}]`
- tab 2: duas seções — Continue watching (`Data.continueShows()`) e Recently added (`Data.added('tv')` sem ids da primeira).

Cartões 16:9 para vistos, 2:3 para adicionados. Foco atualiza o hero.

- [ ] **Passo 3: Ao ativar um cartão**

Antes de abrir o app:

```js
History.record(pick.kind, pick.id, pick.app || '');
if (window.Trakt) Trakt.refresh();   // optional; local list already updated
```

- [ ] **Passo 4: Hero**

Linha de contexto: `trf('Watched {when}', …)` ou `trf('Added {date}', …)` + nome do app. Barra de progresso se
`progress > 0 && progress < 100`. Botão ▶ com o nome do app (já na parte 1).

- [ ] **Passo 5: Commit**

```bash
git add web/home.js web/home.css app/assets/i18n/en.json app/assets/i18n/pt.json
git commit -m "Home: Explore, Movies and Shows show watched and newly added titles"
```

---

### Tarefa 6: Ajustes — Trakt e Watchmode

**Files:**
- Modify: `web/home.js` (`settingRows`, sheets de Trakt e Watchmode, espelhando o fluxo da chave TMDB)

- [ ] **Passo 1: Linhas nos Ajustes**

Depois da linha da chave TMDB:

```js
    if (Trakt.configured()) {
      rows.push({
        label: tr('Trakt'),
        value: Trakt.connected() ? Trakt.account() : (Trakt.error() || tr('Not connected')),
        opens: true,
        trakt: true
      });
    }
    rows.push({
      label: tr('Watchmode key'),
      value: Prefs.watchmodeKey().length >= 4 ? '•••• ' + Prefs.watchmodeKey().slice(-4) : tr('Not set'),
      opens: true,
      watchmode: true
    });
```

- [ ] **Passo 2: Sheet Trakt**

- Desconectado: botão Connect → `Trakt.beginLogin` → mostrar `userCode` e `verificationUrl`; Back cancela
  (`cancelLogin`).
- Conectado: mostra conta + Disconnect → `Trakt.logout()` + `Data` refresh.

- [ ] **Passo 3: Sheet Watchmode**

Igual ao TMDB: digitar chave, validar com `GET /v1/status/` ou `/v1/sources/?limit=1` com o header `X-API-Key`,
salvar em `Prefs.set('watchmodeKey', key)`, `Data.watchmodeChanged()`.

- [ ] **Passo 4: Commit**

```bash
git add web/home.js
git commit -m "Settings: connect Trakt and enter a Watchmode key on the TV"
```

---

### Tarefa 7: Verificar na TV

- [ ] **Passo 1:** `tools/check.sh web && python3 tizen/build.py --preview` — abas com seções; sem Trakt/Watchmode,
  Explorar mostra Em alta / Filmes mostra Lançamentos TMDB.
- [ ] **Passo 2:** Com chaves no `config.properties` (nunca commitadas), conectar Trakt na TV; abrir um cartão; ele
  sobe no Explorar.
- [ ] **Passo 3:** Com Watchmode, Filmes/Séries mostram "Adicionados recentemente" com datas.
- [ ] **Passo 4:** Anotar no README curto o limite dos apps grandes vs Trakt (se ainda não estiver).

```bash
git add README.md CLAUDE.md   # só se houver trecho novo
git commit -m "Docs: Trakt and Watchmode limits on Samsung and LG"
```

---

## Cobertura da spec

| Spec | Tarefa |
|---|---|
| Explorar = vistos (Trakt + local) | 2, 3, 4, 5 |
| Filmes = Watchmode + fallback TMDB | 4, 5 |
| Séries = continuar + adicionadas | 4, 5 |
| `trakt_*` / `watchmode_key` no config | 1 |
| Ajustes Trakt + Watchmode | 6 |
| Limites documentados | 7 |
| Visual / glass / dock | parte 1 (outro plano) |

## Diferenças conscientes vs spec

- Tokens Trakt em `fmtv.trakt` (módulo próprio), não misturados com `Prefs` genérico — mesma persistência
  (`localStorage`).
- Validação Watchmode via `/v1/status/` ou request leve; se a API mudar, ajustar um único lugar em `data.js`.
- YouTube na prateleira não entra no mapa Watchmode (spec só lista Netflix/Prime/Max/Disney+ para releases).
