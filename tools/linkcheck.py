#!/usr/bin/env python3
"""死链巡检（CI 版）：只把 404/410 两次确认的判为失效，其余归为拦截或环境异常。
运行环境为 GitHub Actions（海外出口），国内站可能因网络原因不可达，因此判定从严。
"""
import json, os, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')
UA_M = ('Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 '
        '(KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINKS = os.path.join(ROOT, 'data', 'links.json')
OUT = os.path.join(ROOT, 'data', 'health.json')


def hit(url, ua=UA, referer=None):
    h = {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Upgrade-Insecure-Requests': '1',
    }
    if referer:
        h['Referer'] = referer
    try:
        r = requests.get(url, headers=h, timeout=(8, 18), allow_redirects=True, stream=True)
        code = r.status_code
        r.close()
        return code
    except requests.exceptions.Timeout:
        return 'TIMEOUT'
    except Exception as e:
        return type(e).__name__


def check(rec):
    url = rec['url']
    code = hit(url)
    kind = 'ok'
    if isinstance(code, int):
        if 200 <= code < 400:
            kind = 'ok'
        elif code in (401, 403, 405, 429, 451, 503):
            kind = 'blocked'
        elif code in (404, 410):
            # 二次确认：换 UA + 带 Referer
            time.sleep(2)
            code2 = hit(url, UA_M, 'https://www.baidu.com/')
            if isinstance(code2, str) or 200 <= code2 < 400:
                kind = 'ok'
            else:
                kind = 'dead'
        elif 500 <= code < 600:
            kind = 'server_error'
        else:
            kind = 'other'
    elif code in ('Timeout',):
        kind = 'env'
    else:
        kind = 'env'
    return {'id': rec['id'], 'name': rec['name'], 'url': url, 'result': kind, 'http': code}


def main():
    d = json.load(open(LINKS, encoding='utf-8'))
    links = d['links']
    limit = int(os.environ.get('LIMIT', '0'))
    todo = links[:limit] if limit else links
    print(f'巡检 {len(todo)} 条', flush=True)

    res = []
    with ThreadPoolExecutor(max_workers=12) as ex:
        fut = {ex.submit(check, x): x for x in todo}
        n = 0
        for f in as_completed(fut):
            res.append(f.result())
            n += 1
            if n % 200 == 0:
                print(f'  {n}/{len(todo)}', flush=True)

    from collections import Counter
    c = Counter(r['result'] for r in res)
    dead = [r for r in res if r['result'] == 'dead']

    report = {
        'checked_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'env': 'github-actions-overseas',
        'checked': len(res),
        'summary': dict(c),
        'dead': dead,
        'items': res,
    }
    json.dump(report, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    print('\n分布:', dict(c))
    print(f'确认失效 {len(dead)} 条')
    for r in dead[:30]:
        print(f"  {r['name'][:24]:26s} {r['http']}  {r['url'][:60]}")

    # 输出给后续步骤
    env_file = os.environ.get('GITHUB_ENV')
    if env_file:
        with open(env_file, 'a', encoding='utf-8') as f:
            f.write(f'DEAD_COUNT={len(dead)}\n')
    body = '\n'.join(f"- {r['name']} ({r['http']}) {r['url']}" for r in dead[:50])
    if env_file and dead:
        with open(env_file, 'a', encoding='utf-8') as f:
            f.write('DEAD_LIST<<EOF\n' + body + '\nEOF\n')


if __name__ == '__main__':
    main()
