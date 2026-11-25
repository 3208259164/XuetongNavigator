/* 资源导航 前端逻辑 */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var FAV_KEY = 'nav_fav_v1';
  var THEME_KEY = 'nav_theme_v1';
  var BATCH = 60;

  var state = { cat: 'all', sub: '', q: '', view: 'all', shown: 0 };
  var DATA = [];
  var CATS = [];
  var favs = new Set();
  var list = [];
  var io = null;

  /* ---------- 主题 ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0e1116' : '#f6f7f9');
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }
  function initTheme() {
    var t = null;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(t);
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  }

  /* ---------- 收藏 ---------- */
  function loadFav() {
    try { favs = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch (e) { favs = new Set(); }
    $('#favCount').textContent = favs.size;
  }
  function saveFav() {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(favs))); } catch (e) {}
    $('#favCount').textContent = favs.size;
  }
  function toggleFav(id, el) {
    if (favs.has(id)) favs.delete(id); else favs.add(id);
    saveFav();
    if (el) el.classList.toggle('on', favs.has(id));
    if (state.view === 'fav') { state.shown = 0; render(true); }
  }

  /* ---------- 侧栏 ---------- */
  var CAT_ICON = {
    '推荐': '★', '马列经典': '◆', '图书馆与文献': '▤', '安全与开源': '◈',
    '在线工具': '⚙', '素材设计': '◇', '影视': '▶', '学习资料': '✎',
    '电子书': '▤', '音乐音频': '♪', '网盘资源': '▣', '游戏': '◆',
    '软件应用': '⬒', '动漫漫画': '✦', '资源搜索': '⌕', '社区资讯': '☰', '其他': '·'
  };

  function renderCats() {
    var wrap = $('#catList');
    var html = '<button class="cat-item' + (state.view === 'all' && state.cat === 'all' ? ' on' : '') + '" data-cat="all" type="button">' +
      '<span class="ci">⌂</span><span class="cn">全部收录</span><span class="cc">' + DATA.length + '</span></button>';
    CATS.forEach(function (c) {
      if (!c.count) return;
      html += '<button class="cat-item' + (state.view === 'all' && state.cat === c.name ? ' on' : '') + '" data-cat="' + esc(c.name) + '" type="button">' +
        '<span class="ci">' + (CAT_ICON[c.name] || '·') + '</span>' +
        '<span class="cn">' + esc(c.name) + '</span>' +
        '<span class="cc">' + c.count + '</span></button>';
    });
    wrap.innerHTML = html;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  /* ---------- 取数 ---------- */
  function match(it, q) {
    if (!q) return true;
    if (it._s.indexOf(q) > -1) return true;
    return false;
  }

  function buildIndex() {
    DATA.forEach(function (it) {
      it._s = [it.name, it.desc, it.py, it.pyi, it.url, it.cat, it.sub]
        .filter(Boolean).join(' ').toLowerCase();
    });
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    // 有搜索词时全站搜索，不受当前分类限制
    if (q) {
      var base = state.view === 'fav' ? DATA.filter(function (it) { return favs.has(it.id); }) : DATA;
      return base.filter(function (it) { return it._s.indexOf(q) > -1; });
    }
    var out = DATA.filter(function (it) {
      if (state.view === 'fav') return favs.has(it.id);
      if (state.cat !== 'all' && it.cat !== state.cat) return false;
      if (state.sub && it.sub !== state.sub) return false;
      return true;
    });
    return out;
  }

  /* ---------- 渲染 ---------- */
  function cardHTML(it, i) {
    var initial = (it.name || '?').trim().charAt(0).toUpperCase();
    var hue = 0;
    for (var k = 0; k < it.name.length; k++) hue = (hue * 31 + it.name.charCodeAt(k)) % 360;
    var ico = it.icon
      ? '<img src="' + esc(it.icon) + '" alt="" loading="lazy" onerror="this.parentNode.textContent=\'' + esc(initial) + '\';this.parentNode.style.color=\'hsl(' + hue + ',62%,52%)\'">'
      : '<span style="color:hsl(' + hue + ',62%,52%)">' + esc(initial) + '</span>';
    var ds = it.desc
      ? '<div class="ds">' + esc(it.desc) + '</div>'
      : '<div class="ds none">' + esc(it.cat + (it.sub ? ' · ' + it.sub : '')) + '</div>';
    return '<a class="card" href="' + esc(it.url) + '" target="_blank" rel="noopener nofollow" ' +
      'style="animation-delay:' + Math.min(i * 8, 160) + 'ms" title="' + esc(it.name) + '">' +
      '<span class="ico-box">' + ico + '</span>' +
      '<span class="meta"><span class="nm">' + esc(it.name) + '</span>' + ds + '</span>' +
      '<button class="star' + (favs.has(it.id) ? ' on' : '') + '" data-fav="' + it.id + '" type="button" aria-label="收藏">★</button>' +
      '</a>';
  }

  function render(reset) {
    var grid = $('#grid');
    if (reset) { grid.innerHTML = ''; state.shown = 0; }
    list = filtered();

    // 面包屑与子类
    var crumb = $('#crumb');
    if (state.view === 'fav') {
      crumb.innerHTML = '<h2>我的收藏</h2><span class="cnt">' + list.length + ' 个</span>';
      $('#subTabs').innerHTML = '';
      $('#stat').textContent = '';
    } else if (state.q.trim()) {
      crumb.innerHTML = '<h2>搜索结果</h2><span class="cnt">' + list.length + ' 个</span>';
      $('#subTabs').innerHTML = '';
      $('#stat').textContent = '关键词：' + state.q.trim();
    } else {
      var cname = state.cat === 'all' ? '全部收录' : state.cat;
      document.title = state.cat === 'all' ? '资源导航 | 精选网站与工具收录' : cname + ' | 资源导航';
      crumb.innerHTML = '<h2>' + esc(cname) + '</h2><span class="cnt">' + list.length + ' 个站点</span>';
      renderSubs();
      $('#stat').textContent = '收录 ' + DATA.length + ' 个站点，按分类整理';
    }

    if (!list.length) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><strong>没有找到匹配的站点</strong>换个关键词，或者切到其他分类看看</div>';
      if (io) io.disconnect();
      return;
    }
    // 搜索结果跨分类时按分类分组展示
    if (state.q.trim() && list.length <= 150) {
      renderGrouped();
      if (io) io.disconnect();
      return;
    }
    appendChunk();
    observeMore();
  }

  function renderSubs() {
    var bar = $('#subTabs');
    if (state.cat === 'all') { bar.innerHTML = ''; return; }
    var cat = CATS.filter(function (c) { return c.name === state.cat; })[0];
    if (!cat || !cat.subs) { bar.innerHTML = ''; return; }
    var html = '<button class="chip' + (state.sub === '' ? ' on' : '') + '" data-sub="" type="button">全部</button>';
    cat.subs.forEach(function (s) {
      if (!s.name) return;
      html += '<button class="chip' + (state.sub === s.name ? ' on' : '') + '" data-sub="' + esc(s.name) + '" type="button">' +
        esc(s.name) + ' ' + s.count + '</button>';
    });
    bar.innerHTML = html;
  }

  function renderGrouped() {
    var grid = $('#grid');
    var order = [], map = {};
    list.forEach(function (it) {
      if (!map[it.cat]) { map[it.cat] = []; order.push(it.cat); }
      map[it.cat].push(it);
    });
    var html = '';
    order.forEach(function (c) {
      html += '<div class="grp"><span class="grp-t">' + esc(c) + '</span><span class="grp-n">' + map[c].length + '</span></div>';
      map[c].forEach(function (it, i) { html += cardHTML(it, i); });
    });
    grid.innerHTML = html;
  }

  function appendChunk() {
    var grid = $('#grid');
    var end = Math.min(state.shown + BATCH, list.length);
    var buf = '';
    for (var i = state.shown; i < end; i++) buf += cardHTML(list[i], i - state.shown);
    grid.insertAdjacentHTML('beforeend', buf);
    state.shown = end;
  }

  function observeMore() {
    if (io) io.disconnect();
    var sentinel = $('#sentinel');
    if (state.shown >= list.length) return;
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && state.shown < list.length) {
          appendChunk();
          if (state.shown >= list.length && io) io.disconnect();
        }
      });
    }, { rootMargin: '600px' });
    io.observe(sentinel);
  }

  /* ---------- 地址栏 ---------- */
  function setHash(h) {
    try { history.replaceState(null, '', h ? '#/' + h : location.pathname + location.search); } catch (e) {}
  }
  function readHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    if (!h) return null;
    if (h.indexOf('cat/') === 0) return { cat: decodeURIComponent(h.slice(4)) };
    if (h === 'fav') return { fav: true };
    return null;
  }

  /* ---------- 导航 ---------- */
  function go(cat, opts) {
    opts = opts || {};
    state.cat = cat;
    state.sub = '';
    state.view = 'all';
    state.q = opts.keepQ ? state.q : '';
    $('#q').value = state.q;
    $('#clearBtn').hidden = !state.q;
    setMnav(cat === 'all' ? 'all' : 'cats');
    setHash(cat === 'all' ? '' : 'cat/' + encodeURIComponent(cat));
    renderCats();
    render(true);
    closeDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goFav() {
    state.view = 'fav';
    state.cat = 'all';
    state.sub = '';
    state.q = '';
    $('#q').value = '';
    $('#clearBtn').hidden = true;
    setMnav('fav');
    setHash('fav');
    renderCats();
    render(true);
    closeDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setMnav(k) {
    Array.prototype.forEach.call(document.querySelectorAll('#mnav button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-nav') === k);
    });
  }

  /* ---------- 抽屉 ---------- */
  function openDrawer() { $('#sidebar').classList.add('open'); $('#scrim').classList.add('on'); }
  function closeDrawer() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('on'); }

  /* ---------- 搜索 ---------- */
  var timer = null;
  function onSearch() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      state.q = $('#q').value;
      $('#clearBtn').hidden = !state.q;
      state.view = state.view === 'fav' ? 'all' : state.view;
      render(true);
      if (state.q) setMnav('search');
    }, 120);
  }

  /* ---------- 事件 ---------- */
  function bind() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      var star = t.closest ? t.closest('.star') : null;
      if (star) {
        e.preventDefault();
        e.stopPropagation();
        toggleFav(star.getAttribute('data-fav'), star);
        return;
      }
      var ci = t.closest ? t.closest('.cat-item') : null;
      if (ci) { go(ci.getAttribute('data-cat')); return; }
      var chip = t.closest ? t.closest('.chip') : null;
      if (chip) {
        state.sub = chip.getAttribute('data-sub');
        render(true);
        return;
      }
      var mb = t.closest ? t.closest('#menuBtn') : null;
      if (mb) { openDrawer(); return; }
      if (t.id === 'scrim') { closeDrawer(); return; }
      if (t.closest && t.closest('#themeBtn, #themeBtn2')) { toggleTheme(); return; }
      if (t.closest && t.closest('#favBtn')) { goFav(); return; }
      if (t.id === 'clearBtn') { $('#q').value = ''; state.q = ''; $('#clearBtn').hidden = true; render(true); return; }
      var nav = t.closest ? t.closest('#mnav button') : null;
      if (nav) {
        var k = nav.getAttribute('data-nav');
        if (k === 'all') go('all');
        else if (k === 'cats') { go('all'); openDrawer(); }
        else if (k === 'search') { $('#q').focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        else if (k === 'fav') goFav();
      }
    });
    var q = $('#q');
    q.addEventListener('input', onSearch);
    q.addEventListener('keydown', function (e) { if (e.key === 'Escape') { q.value = ''; state.q = ''; render(true); } });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); q.focus(); }
    });
    window.addEventListener('hashchange', function () {
      var h = readHash();
      if (h && h.fav) { goFav(); }
      else if (h && h.cat) { go(h.cat); }
      else { go('all'); }
    });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    initTheme();
    loadFav();
    bind();
    var grid = $('#grid');
    var sk = '';
    for (var i = 0; i < 8; i++) sk += '<div class="sk"></div>';
    grid.innerHTML = sk;

    Promise.all([
      fetch('data/links.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }),
      fetch('data/cats.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
    ]).then(function (res) {
      DATA = res[0].links || [];
      CATS = res[1].cats || [];
      $('#upd').textContent = res[0].updated || '—';
      buildIndex();
      var init = readHash();
      if (init && init.fav) { state.view = 'fav'; }
      else if (init && init.cat && CATS.some(function (c) { return c.name === init.cat; })) {
        state.cat = init.cat; state.view = 'all';
      }
      renderCats();
      render(true);
    }).catch(function (err) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><strong>数据加载失败</strong>请刷新页面重试</div>';
      console.error(err);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
