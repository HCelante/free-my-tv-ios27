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
    var out = [], i, r, show, ep, at;
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
