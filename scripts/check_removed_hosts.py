#!/usr/bin/env python3
"""Regression check (SS1102-GAMES-SUBDOMAIN-REFS, 2026-11-02): Butts Studios has no subdomains. Nothing in this repo may
name a removed *.buttsstudios.com host or link a legacy buttsstudios.com/*.html page (they 404; the site has clean paths).
Usage: python3 scripts/check_removed_hosts.py [DIR]   exit 1 on any hit. Stdlib only."""
import os, re, sys
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOSTS = ['glb', 'cards', 'puzzle', 'games', 'portal', 'store', 'novels', 'film', 'animation', 'clients']
PAT = re.compile(r'\b(?:(?:%s)\.buttsstudios\.com|butts-studios\.com|buttsstudios\.com/[a-z-]+\.html)\b' % '|'.join(HOSTS), re.I)
EXTS = ('.html', '.htm', '.xml', '.txt', '.json', '.js', '.mjs', '.ts', '.tsx', '.css', '.md')
SKIP = ('.git', 'node_modules', '.next', '__pycache__')
hits = []
for root, dirs, files in os.walk(ROOT):
    dirs[:] = [d for d in dirs if d not in SKIP]
    for f in files:
        if f.endswith(EXTS) and f != 'package-lock.json':
            p = os.path.join(root, f)
            for i, line in enumerate(open(p, encoding='utf-8', errors='replace'), 1):
                for m in PAT.finditer(line):
                    hits.append('%s:%d: %s' % (os.path.relpath(p, ROOT), i, m.group(0)))
for h in hits:
    print('FAIL', h)
print('removed-host check: %d hit(s)' % len(hits))
sys.exit(1 if hits else 0)
