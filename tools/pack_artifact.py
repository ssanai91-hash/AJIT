#!/usr/bin/env python3
"""체험판 빌드(index.html)를 claude.ai 아티팩트 형식(문서 뼈대 태그 제거)으로 변환"""
import re, sys
src, out = sys.argv[1], sys.argv[2]
h = open(src, encoding='utf-8').read()
h = re.sub(r'<!doctype html>\s*', '', h, flags=re.I)
h = re.sub(r'</?(html|head|body)[^>]*>', '', h, flags=re.I)
h = re.sub(r'<meta charset[^>]*>\s*', '', h, flags=re.I)
h = re.sub(r'<meta name="viewport"[^>]*>\s*', '', h, flags=re.I)
open(out, 'w', encoding='utf-8').write(h.strip() + '\n')
print('title within 8KB:', '<title>' in h[:8192], '| size', len(h.encode()) // 1024, 'KB')
