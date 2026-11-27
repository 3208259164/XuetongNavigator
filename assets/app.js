/* 资源导航 前端逻辑 */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var FAV_KEY = 'nav_fav_v1';
  var THEME_KEY = 'nav_theme_v1';
  var BATCH = 60;

  var state = { cat: 'all', sub: '', q: '', view: 'all', shown: 0, tags: [] };
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

  /* ---------- 详情浮层 ---------- */
  function byId(id) {
    for (var i = 0; i < DATA.length; i++) if (DATA[i].id === id) return DATA[i];
    return null;
  }

  function openSheet(id) {
    var it = byId(id);
    if (!it) return;
    var initial = (it.name || '?').trim().charAt(0).toUpperCase();
    var hue = 0;
    for (var k = 0; k < it.name.length; k++) hue = (hue * 31 + it.name.charCodeAt(k)) % 360;
    var ico = it.icon
      ? '<img src="' + esc(it.icon) + '" alt="" onerror="this.parentNode.textContent=\'' + esc(initial) + '\'">'
      : '<span style="color:hsl(' + hue + ',62%,52%)">' + esc(initial) + '</span>';
    var rel = DATA.filter(function (x) { return x.cat === it.cat && x.id !== it.id; }).slice(0, 4);
    var relHTML = rel.map(function (x) {
      return '<a class="rel-item" href="s/' + x.id + '.html" data-id="' + x.id + '">' +
        '<span class="rel-n">' + esc(x.name) + '</span></a>';
    }).join('');

    var el = $('#sheet');
    el.innerHTML =
      '<div class="sheet-in">' +
      '<div class="sheet-head">' +
      '<span class="ico-box lg">' + ico + '</span>' +
      '<div class="sheet-title"><h3>' + esc(it.name) + '</h3>' +
      '<div class="sheet-sub">' + esc(it.cat) + (it.sub ? ' · ' + esc(it.sub) : '') + '</div></div>' +
      '<button class="sheet-x" type="button" aria-label="关闭">&#10005;</button>' +
      '</div>' +
      '<p class="sheet-desc">' + esc(it.desc || '暂无描述') + '</p>' +
      '<div class="sheet-tags">' +
      '<span class="pill">' + esc(it.cat) + '</span>' +
      (it.sub ? '<span class="pill">' + esc(it.sub) + '</span>' : '') +
      (it.risk || []).map(function (r) { return '<span class="pill warn">' + esc(r) + '</span>'; }).join('') +
      '</div>' +
      '<a class="sheet-cta" href="' + esc(it.url) + '" target="_blank" rel="noopener nofollow">访问网站 &#8599;</a>' +
      '<div class="sheet-actions">' +
      '<button class="sheet-fav' + (favs.has(it.id) ? ' on' : '') + '" data-fav="' + it.id + '" type="button">' +
      (favs.has(it.id) ? '★ 已收藏' : '☆ 收藏') + '</button>' +
      '<a class="sheet-detail" href="s/' + it.id + '.html">完整页面</a>' +
      '</div>' +
      (relHTML ? '<div class="sheet-rel"><div class="sheet-rel-t">同类站点</div><div class="rel-list">' + relHTML + '</div></div>' : '') +
      '</div>';
    el.classList.add('on');
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    var el = $('#sheet');
    el.classList.remove('on');
    el.innerHTML = '';
    document.body.style.overflow = '';
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

  function matchTags(it) {
    if (!state.tags.length) return true;
    var t = it.tags || [];
    return state.tags.every(function (x) { return t.indexOf(x) > -1; });
  }

  // 同义词组：组内任意词可互相命中
  var SYN_GROUPS = [
    ['网盘', '云盘', '磁盘', '夸克', '阿里云盘', '百度网盘', '迅雷'],
    ['电影', '影视', '影院', '追剧', '电视剧', '看片'],
    ['书籍', '电子书', '图书', '读书', '阅读', '书库'],
    ['工具', '软件', '工具箱', '在线工具', '应用'],
    ['AI', '人工智能', '大模型', 'GPT', '智能'],
    ['音乐', '歌曲', '听歌', '无损', '音频'],
    ['动漫', '番剧', '二次元', '漫画', '追番'],
    ['图片', '壁纸', '图库', '素材', '图标'],
    ['教程', '学习', '课程', '文档', '公开课'],
    ['搜索', '磁力', '引擎', '索引', '聚合'],
    ['游戏', '单机', '手游', '小游戏'],
    ['开源', 'github', 'gitee', '代码', '社区'],
    ['学术', '论文', '期刊', '文献', '科研'],
    ['翻译', '词典', '外语', '语言']
  ];

  function expandTerms(q) {
    var out = [q];
    for (var i = 0; i < SYN_GROUPS.length; i++) {
      var g = SYN_GROUPS[i];
      var hit = g.some(function (w) { return q.indexOf(w.toLowerCase()) > -1 || w.toLowerCase().indexOf(q) > -1; });
      if (hit) {
        out = out.concat(g.map(function (w) { return w.toLowerCase(); }));
      }
    }
    return out.filter(function (v, i, a) { return a.indexOf(v) === i; });
  }

  function scoreOf(it, q) {
    var terms = expandTerms(q);
    var best = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      var s = 0;
      if ((it.name || '').toLowerCase().indexOf(t) > -1) s += 30;
      if ((it.tags || []).join(' ').toLowerCase().indexOf(t) > -1) s += 20;
      if ((it.py || '').indexOf(t) > -1 || (it.pyi || '').indexOf(t) > -1) s += 15;
      if ((it.desc || '').toLowerCase().indexOf(t) > -1) s += 10;
      if ((it.cat || '').toLowerCase().indexOf(t) > -1) s += 6;
      if ((it.sub || '').toLowerCase().indexOf(t) > -1) s += 4;
      if (s > best) best = s;
    }
    return best;
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var out = DATA.filter(function (it) {
      if (state.view === 'fav') {
        if (!favs.has(it.id)) return false;
      } else if (q) {
        // 全站搜索时不受分类限制，但标签筛选仍然生效
      } else {
        if (state.cat !== 'all' && it.cat !== state.cat) return false;
        if (state.sub && it.sub !== state.sub) return false;
      }
      if (!matchTags(it)) return false;
      if (q && scoreOf(it, q) === 0) return false;
      return true;
    });
    if (q) {
      out.sort(function (a, b) {
        var d = scoreOf(b, q) - scoreOf(a, q);
        if (d) return d;
        return (b.weight || 0) - (a.weight || 0);
      });
    }
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
    return '<a class="card" href="s/' + it.id + '.html" data-id="' + it.id + '" ' +
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
      renderTagBar();
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
      renderTagBar();
      $('#stat').textContent = '收录 ' + DATA.length + ' 个站点，按分类整理';
    }

    if (!list.length) {
      grid.innerHTML = emptyHTML(state.q.trim());
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

  var COMMON_TAGS = ['免费', '中文', '开源', '需代理', '需登录', '需付费'];

  function renderTagBar() {
    var bar = $('#tagBar');
    if (!bar) return;
    if (state.view === 'fav' || state.q.trim()) { bar.innerHTML = ''; return; }
    var pool = DATA.filter(function (it) {
      if (state.cat !== 'all' && it.cat !== state.cat) return false;
      return true;
    });
    var cnt = {};
    pool.forEach(function (it) { (it.tags || []).forEach(function (t) { cnt[t] = (cnt[t] || 0) + 1; }); });
    var tags = COMMON_TAGS.filter(function (t) { return cnt[t] >= 3; });
    if (!tags.length) { bar.innerHTML = ''; return; }
    bar.innerHTML = tags.map(function (t) {
      var on = state.tags.indexOf(t) > -1;
      return '<button class="tag' + (on ? ' on' : '') + '" data-tag="' + t + '" type="button">' +
        t + '<i>' + cnt[t] + '</i></button>';
    }).join('');
  }

  function emptyHTML(q) {
    var html = '<div class="empty" style="grid-column:1/-1">';
    html += '<strong>' + (q ? '没有找到与「' + esc(q) + '」相关的站点' : '这里还没有内容') + '</strong>';
    html += '<p class="empty-sub">换个词试试，或者从下面的分类继续找</p>';

    // 相关分类：词命中分类名/子类名，否则给条目最多的分类
    var rel = CATS.filter(function (c) {
      if (!q) return false;
      if (c.name.toLowerCase().indexOf(q) > -1) return true;
      return (c.subs || []).some(function (sb) { return sb.name.toLowerCase().indexOf(q) > -1; });
    });
    if (!rel.length) rel = CATS.slice().sort(function (a, b) { return b.count - a.count; }).slice(0, 6);
    rel = rel.slice(0, 6);
    if (rel.length) {
      html += '<div class="empty-block"><div class="empty-t">相关分类</div><div class="empty-row">';
      rel.forEach(function (c) {
        html += '<button class="empty-chip" data-cat="' + esc(c.name) + '" type="button">' + esc(c.name) +
          '<i>' + c.count + '</i></button>';
      });
      html += '</div></div>';
    }

    // 热门标签
    var tagCnt = {};
    DATA.forEach(function (it) { (it.tags || []).forEach(function (t) { tagCnt[t] = (tagCnt[t] || 0) + 1; }); });
    var hotTags = Object.keys(tagCnt).sort(function (a, b) { return tagCnt[b] - tagCnt[a]; }).slice(0, 5);
    if (hotTags.length) {
      html += '<div class="empty-block"><div class="empty-t">按属性找</div><div class="empty-row">';
      hotTags.forEach(function (t) {
        html += '<button class="empty-chip" data-tag="' + esc(t) + '" type="button">' + esc(t) +
          '<i>' + tagCnt[t] + '</i></button>';
      });
      html += '</div></div>';
    }

    // 外部搜索
    if (q) {
      var engines = [
        ['Google', 'https://www.google.com/search?q='],
        ['Bing', 'https://www.bing.com/search?q='],
        ['秘塔 AI', 'https://metaso.cn/?q=']
      ];
      html += '<div class="empty-block"><div class="empty-t">站内没有，去外面搜</div><div class="empty-row">';
      engines.forEach(function (e) {
        html += '<a class="empty-out" href="' + e[1] + encodeURIComponent(q) + '" target="_blank" rel="noopener">' +
          esc(e[0]) + ' &#8599;</a>';
      });
      html += '</div></div>';
    }

    html += '</div>';
    return html;
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
    state.tags = [];
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

  /* ---------- 搜索历史 ---------- */
  var HIS_KEY = 'nav_his_v1';
  function loadHis() {
    try { return JSON.parse(localStorage.getItem(HIS_KEY) || '[]'); } catch (e) { return []; }
  }
  function addHis(q) {
    q = (q || '').trim();
    if (q.length < 1) return;
    var a = loadHis().filter(function (x) { return x !== q; });
    a.unshift(q);
    try { localStorage.setItem(HIS_KEY, JSON.stringify(a.slice(0, 8))); } catch (e) {}
  }
  function clearHis() {
    try { localStorage.removeItem(HIS_KEY); } catch (e) {}
    renderHis();
  }
  function renderHis() {
    var his = loadHis();
    var grid = $('#grid');
    if (!his.length) { grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><strong>还没有搜索记录</strong><p class="empty-sub">输入关键词试试，搜过的词会记在这里</p></div>'; return; }
    var h = '<div class="his-wrap"><div class="his-t">最近搜索<button type="button" id="hisClear">清空</button></div><div class="his-row">';
    his.forEach(function (w) {
      h += '<button class="his-item" data-w="' + esc(w) + '" type="button">' + esc(w) + '</button>';
    });
    h += '</div></div>';
    grid.innerHTML = h;
    state.shown = 0;
  }

  /* ---------- 数据版本与简介懒加载 ---------- */
  var DATA_VER = '20261127a';
  var _descLoaded = false, _descLoading = false;
  function ensureDesc() {
    if (_descLoaded || _descLoading) return;
    _descLoading = true;
    fetch('data/links-desc.json?v=' + DATA_VER, { cache: 'default' })
      .then(function (r) { return r.json(); })
      .then(function (m) {
        for (var i = 0; i < DATA.length; i++) {
          var it = DATA[i];
          if (!it.desc && m[it.id]) { it.desc = m[it.id]; }
        }
        _descLoaded = true; _descLoading = false;
        buildIndex();
        if (state.q) render(true);
      }).catch(function () { _descLoading = false; });
  }

  /* ---------- 搜索 ---------- */
  var timer = null;
  function onSearch() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      state.q = $('#q').value;
      if (state.q) { state.tags = []; addHis(state.q); }
      $('#clearBtn').hidden = !state.q;
      state.view = state.view === 'fav' ? 'all' : state.view;
      render(true);
      if (state.q) { setMnav('search'); ensureDesc(); }
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
      var hi = t.closest ? t.closest('.his-item') : null;
      if (hi) {
        var w = hi.getAttribute('data-w');
        $('#q').value = w;
        state.q = w; state.tags = [];
        $('#clearBtn').hidden = false;
        render(true);
        return;
      }
      if (t.id === 'hisClear') { clearHis(); return; }
      var ec = t.closest ? t.closest('.empty-chip') : null;
      if (ec) {
        var ccat = ec.getAttribute('data-cat');
        var ctag = ec.getAttribute('data-tag');
        if (ccat) { go(ccat); return; }
        if (ctag) {
          state.q = ''; $('#q').value = ''; $('#clearBtn').hidden = true;
          state.tags = [ctag]; state.cat = 'all'; state.view = 'all';
          renderCats(); render(true); return;
        }
      }
      var tg = t.closest ? t.closest('.tag') : null;
      if (tg) {
        var tv = tg.getAttribute('data-tag');
        var i = state.tags.indexOf(tv);
        if (i > -1) state.tags.splice(i, 1); else state.tags.push(tv);
        render(true);
        return;
      }
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
      if (t.closest && t.closest('.sheet-x')) { closeSheet(); return; }
      if (t.id === 'sheet') { closeSheet(); return; }
      var relItem = t.closest ? t.closest('.rel-item') : null;
      if (relItem) { e.preventDefault(); openSheet(relItem.getAttribute('data-id')); return; }
      var sfav = t.closest ? t.closest('.sheet-fav') : null;
      if (sfav) {
        toggleFav(sfav.getAttribute('data-fav'), sfav);
        var isOn = favs.has(sfav.getAttribute('data-fav'));
        sfav.classList.toggle('on', isOn);
        sfav.textContent = isOn ? '★ 已收藏' : '☆ 收藏';
        return;
      }
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
    q.addEventListener('focus', function () {
      if (!q.value.trim() && state.view !== 'fav') renderHis();
    });
    q.addEventListener('blur', function () {
      setTimeout(function () {
        if (!q.value.trim() && !state.q.trim() && state.shown === 0) render(true);
      }, 180);
    });
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
      fetch('data/links-lite.json?v=' + DATA_VER, { cache: 'default' }).then(function (r) { return r.json(); }),
      fetch('data/cats.json?v=' + DATA_VER, { cache: 'default' }).then(function (r) { return r.json(); })
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
