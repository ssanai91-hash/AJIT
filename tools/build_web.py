#!/usr/bin/env python3
"""demo/ajit-bar.html(시연판 본문) → worker/public/index.html(실시간 온라인판)
같은 화면 코드를 쓰고, window.AJIT_ONLINE=true 로 가상 친구 대신 서버에 연결한다."""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / 'demo' / 'ajit-bar.html').read_text(encoding='utf-8')
out = ROOT / 'worker' / 'public'
out.mkdir(parents=True, exist_ok=True)

head = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>숭열이네 바 · 아지트</title>
<meta name="description" content="링크를 열고 친구들과 같은 바에서 채팅하고 건배해요.">
<meta property="og:type" content="website">
<meta property="og:title" content="숭열이네 바 · 아지트">
<meta property="og:description" content="초대 코드 없이 링크로 들어와 함께 한잔하며 얘기해요.">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b181d">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<link rel="icon" href="img/face3.webp">
<link rel="apple-touch-icon" href="img/face3.webp">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
<script>window.AJIT_ONLINE = true;</script>
</head>
<body>
"""
(out / 'index.html').write_text(head + src + '\n</body>\n</html>\n', encoding='utf-8')
# Developer-only visual check uses local simulated friends and its own storage
# keys. Opening this page never claims a real member or sends a chat message.
offline = (head + src + '\n</body>\n</html>\n').replace('window.AJIT_ONLINE = true', 'window.AJIT_ONLINE = false')
offline = offline.replace('ajit.me', 'ajit.visual-check.me').replace('ajit.token', 'ajit.visual-check.token')
(out / 'rig-play.html').write_text(offline, encoding='utf-8')
if (out / 'img').exists():
    shutil.rmtree(out / 'img')
shutil.copytree(ROOT / 'demo' / 'img', out / 'img')
for name in ['rig.js', 'rig-data.js', 'rig-check.html']:
    shutil.copyfile(ROOT / 'demo' / name, out / name)
print('built', out / 'index.html')
