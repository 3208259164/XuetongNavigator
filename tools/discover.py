#!/usr/bin/env python3
"""发现新站点：抓取参考站，和现有库比对，输出候选清单供人工审核。

用法：
    python3 tools/discover.py            # 输出候选到 /tmp/candidates.json 并打印
不自动写库，避免未经审核的内容上线。
"""
import json, re, html, os, sys
import urllib.request

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')

SOURCES = [
    ('硬核指南', 'https://yinghezhinan.com/'),
    ('网盘资源', 'https://wangpanziyuan.pages.dev/'),
]

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINKS = os.path.join(ROOT, 'data', 'links.json')


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9'})
    with urllib.request.urlopen(req, timeout=25) as r:
        raw = r.read()
        if r.headers.get('Content-Encoding') == 'gzip':
            import gzip
            raw = gzip.decompress(raw)
    return raw.decode('utf-8', 'ignore')


def clean(t):
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', t or '')).split())


def extract(s):
    """从页面提取 (名称, 链接)"""
    out = []
    # url-card 结构（OneNav）
    for blk in re.split(r'<div class="url-card', s)[1:]:
        a = re.search(r'<a\s+([^>]*)>', blk)
        if not a:
            continue
        attr = a.group(1)
        href = (re.search(r'href="([^"]*)"', attr) or [None, ''])[1]
        data_url = (re.search(r'data-url="([^"]*)"', attr) or [None, ''])[1]
        url = data_url if data_url.startswith('http') else href
        if not url.startswith('http'):
            continue
        name = clean((re.search(r'<strong>(.*?)</strong>', blk, re.S) or [None, ''])[1])
        if name:
            out.append((name, url))
    # 普通 a 标签兜底
    for m in re.finditer(r'<a\s+[^>]*href="(https?://[^"]+)"[^>]*>(.*?)</a>', s, re.S):
        u, t = m.group(1), clean(m.group(2))
        if t and len(t) < 40 and 'javascript' not in u:
            out.append((t, u))
    return out


def norm(u):
    u = re.sub(r'^https?://', '', u.strip(), flags=re.I)
    u = re.sub(r'^www\.', '', u, flags=re.I)
    return u.split('/')[0].lower()


def main():
    d = json.load(open(LINKS, encoding='utf-8'))
    known = {norm(x['url']) for x in d['links']}
    print(f'现有 {len(d["links"])} 条，覆盖 {len(known)} 个域名')

    cands = []
    for label, url in SOURCES:
        try:
            s = get(url)
        except Exception as e:
            print(f'  {label} 抓取失败：{e}')
            continue
        items = extract(s)
        new = []
        for name, u in items:
            k = norm(u)
            if k and k not in known:
                known.add(k)
                new.append({'name': name, 'url': u, 'from': label})
        cands += new
        print(f'  {label}：抓取 {len(items)} 条，新增候选 {len(new)} 条')

    out = os.path.join('/tmp', 'candidates.json')
    json.dump(cands, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'\n候选 {len(cands)} 条 -> {out}')
    for c in cands[:25]:
        print(f"  [{c['from']}] {c['name'][:24]:26s} {c['url'][:60]}")
    if len(cands) > 25:
        print(f'  ... 还有 {len(cands) - 25} 条')


if __name__ == '__main__':
    main()
