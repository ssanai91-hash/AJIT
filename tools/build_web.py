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
if (out / 'img').exists():
    shutil.rmtree(out / 'img')
shutil.copytree(ROOT / 'demo' / 'img', out / 'img')
print('built', out / 'index.html')
