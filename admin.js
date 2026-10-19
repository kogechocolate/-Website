(() => {
  'use strict';
  const csrf = document.querySelector('meta[name=csrf]').content;
  const $ = (id) => document.getElementById(id);
  const statusEl = $('status');
  let data = null, dirty = false, uid = 0;
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('');
  const h = (tag, props, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) { if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
    for (const k of kids.flat()) e.append(k);
    return e;
  };
  const say = (t, err) => { statusEl.textContent = t; statusEl.className = err ? 'err' : ''; };

  // ---- 入力中のヒント表示（保存はいつでもできます。読み取れないリンクは、表示されないだけです） ----
  const HELP = 'YouTube / niconico / SoundCloud / Spotify / Vimeo';
  function embedProvider(u) {
    const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
    const seg = u.pathname.split('/').filter(Boolean), q = (k) => u.searchParams.get(k) || '';
    if (u.protocol !== 'https:') return null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
      let id = '';
      if (host === 'youtu.be') id = seg[0] || ''; else if (seg[0] === 'watch') id = q('v'); else if (['shorts', 'embed', 'live', 'v'].includes(seg[0])) id = seg[1] || '';
      if (id && id !== 'videoseries' && /^[\w-]{11}$/.test(id)) return 'YouTube';
      return /^[\w-]{10,60}$/.test(q('list')) && ['playlist', 'watch', 'embed'].includes(seg[0]) ? 'YouTube' : null;
    }
    if (host === 'nicovideo.jp' || host === 'nico.ms') { const id = host === 'nico.ms' ? seg[0] : seg[0] === 'watch' ? seg[1] : ''; return id && /^(sm|nm|so)?\d{1,12}$/.test(id) ? 'niconico' : null; }
    if (host === 'soundcloud.com') return seg.length >= 1 && seg.length <= 3 && !['discover', 'stream', 'you', 'upload', 'search', 'charts', 'pages', 'settings', 'feed', 'messages', 'notifications'].includes(seg[0]) && seg.every((s) => /^[\w.-]{1,100}$/.test(s)) ? 'SoundCloud' : null;
    if (host === 'open.spotify.com') { if (/^intl-/.test(seg[0] || '')) seg.shift(); return ['track', 'album', 'playlist', 'episode', 'show', 'artist'].includes(seg[0]) && /^[A-Za-z0-9]{22}$/.test(seg[1] || '') ? 'Spotify' : null; }
    if (host === 'vimeo.com') return /^\d{1,12}$/.test(seg[0] || '') ? 'Vimeo' : null;
    return null;
  }
  function classify(raw) {
    let s = raw.trim();
    if (!s) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
    let u; try { u = new URL(s); } catch { return { kind: 'bad' }; }
    if (!/^https?:$/.test(u.protocol) || u.username || u.password || !u.hostname.includes('.')) return { kind: 'bad' };
    const p = embedProvider(u);
    if (p) return { kind: 'embed', label: p };
    const ext = ((u.pathname.match(/\.([a-z0-9]+)$/i) || [])[1] || '').toLowerCase();
    if (u.protocol === 'https:') {
      if (['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac'].includes(ext)) return { kind: 'file', label: '音声ファイル' };
      if (['mp4', 'webm', 'ogv'].includes(ext)) return { kind: 'file', label: '動画ファイル' };
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'].includes(ext)) return { kind: 'file', label: '画像' };
    }
    return { kind: 'link', label: u.hostname.replace(/^www\./, '') };
  }
  const linkCheck = (v) => {
    const c = classify(v);
    if (!c) return { text: `${HELP} などのリンクを貼ると、サイトの中で再生できます。ほかのリンクはカードで表示されます。空欄でもかまいません。` };
    if (c.kind === 'embed') return { ok: true, text: `✓ ${c.label} として、サイトの中で再生できる形で表示されます` };
    if (c.kind === 'file') return { ok: true, text: `✓ ${c.label}として表示されます` };
    if (c.kind === 'link') return { ok: true, text: `✓ リンクカード（${c.label}）として表示されます。このサイトは埋め込み表示に対応していません` };
    return { ok: false, text: '× URLとして読み取れません。保存はできますが、このページには表示されません' };
  };
  const lum = (hx) => { const n = parseInt(hx.slice(1), 16); const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const mix = (a, b, t) => { const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16); const ch = (s) => Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t); return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join(''); };
  const colorCheck = (v) => {
    if (!/^#[0-9a-f]{6}$/i.test(v)) return { text: '' };
    const ends = [mix(v, '#ffffff', 0.12), v];
    const best = Math.max(...['#ffffff', '#10243a'].map((ink) => Math.min(...ends.map((e) => ratio(ink, e)))));
    return best >= 4.5 ? { ok: true, text: '✓ タブの文字が読みやすい色です' } : { ok: false, text: '× この色だとタブの文字が読みにくくなります。もう少し濃い色か、薄い色にしてください。' };
  };

  // ---- 部品 ----
  function field(label, obj, key, o = {}) {
    const id = 'f' + (++uid);
    const input = o.multi ? h('textarea', { id, rows: o.rows || 2 }) : h('input', { id, type: o.type || 'text' });
    input.value = obj[key] || '';
    const note = h('small', { class: 'hint', 'aria-live': 'polite' });
    const refresh = () => { const r = o.check ? o.check(input.value) : { text: o.hint || '' }; note.textContent = r.text; note.className = 'hint' + (r.ok === true ? ' ok' : r.ok === false ? ' ng' : ''); };
    input.addEventListener('input', () => { obj[key] = input.value; refresh(); if (o.after) o.after(input.value); });
    refresh(); if (o.after) o.after(input.value);
    return h('div', { class: 'field' }, h('label', { for: id }, label), input, note);
  }
  const card = (title, ...kids) => h('fieldset', { class: 'card' }, h('legend', {}, title), ...kids);

  function list(arr, blank, build, label, o = {}) {
    const box = h('div');
    const draw = () => {
      box.replaceChildren();
      if (!arr.length) box.append(h('p', { class: 'empty-note' }, `${label}は、まだありません。`));
      arr.forEach((item, i) => {
        const swap = (j) => () => { [arr[i], arr[j]] = [arr[j], arr[i]]; dirty = true; draw(); };
        const bar = h('div', { class: 'rowbar' },
          h('button', { type: 'button', class: 'mini', onclick: swap(i - 1), ...(i === 0 ? { disabled: '' } : {}) }, '↑ 上へ'),
          h('button', { type: 'button', class: 'mini', onclick: swap(i + 1), ...(i === arr.length - 1 ? { disabled: '' } : {}) }, '↓ 下へ'),
          h('button', { type: 'button', class: 'mini danger', onclick: () => { if (confirm(o.confirmText ? o.confirmText(item) : `この${label}を削除しますか？`)) { arr.splice(i, 1); dirty = true; draw(); } } }, `この${label}を削除`));
        const el = h('div', { class: 'item' + (o.cls ? ' ' + o.cls : '') }, h('strong', {}, `${label} ${i + 1}`), ...build(item), bar);
        if (o.onItem) o.onItem(el, item);
        box.append(el);
      });
      box.append(h('button', { type: 'button', class: 'btn sub', onclick: () => { arr.push(blank()); dirty = true; draw(); } }, `${label}を追加`));
    };
    draw();
    return box;
  }

  function build() {
    $('editor').replaceChildren(
      card('サイト', field('サイト名', data, 'siteName'), field('短い説明', data, 'description', { multi: true })),
      card('タブ',
        list(data.tabs, () => ({ id: rid(), title: '', description: '', color: '#0b63c4', pages: [] }), (t) => [
          field('タブのタイトル', t, 'title'),
          field('短い説明', t, 'description', { multi: true }),
          field('色', t, 'color', { type: 'color', check: colorCheck }),
          h('h4', {}, 'このタブのページ'),
          list(t.pages, () => ({ id: rid(), title: '', description: '', url: '' }), (p) => [
            field('ページのタイトル', p, 'title'),
            field('短い説明', p, 'description', { multi: true }),
            field('リンク（動画・音楽など）', p, 'url', { check: linkCheck }),
          ], 'ページ'),
        ], 'タブ', { cls: 'tabitem', onItem: (el, t) => { el.style.setProperty('--c', /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#0b63c4'); },
          confirmText: (t) => `このタブと、中のページ${t.pages.length}件を削除しますか？` })));
  }

  async function api(method, path, body) {
    const res = await fetch(path, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: body ? JSON.stringify(body) : undefined });
    const out = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('ログインの有効期限が切れました。入力内容をコピーしてから、ページを再読み込みしてログインしてください。');
    if (!res.ok) throw new Error(out.error || '保存に失敗しました');
    return out;
  }
  $('editor').addEventListener('input', () => { dirty = true; });
  addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  $('save').addEventListener('click', async () => {
    say('保存中…');
    try { await api('PUT', '/admin/api/content', data); dirty = false; say('保存しました。'); } catch (e) { say(e.message, true); }
  });
  $('export').addEventListener('click', async () => {
    say('保存して書き出し中…');
    try {
      await api('PUT', '/admin/api/content', data); dirty = false;
      const r = await api('POST', '/admin/api/export');
      say('書き出しました。次のフォルダの中身（5ファイル）をGitHubにアップロードしてください： ' + r.dir);
    } catch (e) { say(e.message, true); }
  });
  $('logout').addEventListener('click', async () => { try { await api('POST', '/admin/logout'); } catch { /* 無視 */ } dirty = false; location.href = '/admin'; });
  api('GET', '/admin/api/content').then((d) => { data = d; build(); say(''); }).catch((e) => say(e.message, true));
})();
