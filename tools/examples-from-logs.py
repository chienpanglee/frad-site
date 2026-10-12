#!/usr/bin/env python3
"""Cut CLI replays out of frad e2e test logs into examples-cli.js (VOCABULARY.md "Examples").

Usage: tools/examples-from-logs.py --tree cli-tree.js --out examples-cli.js --root <dir> <log.test>...
(--root is the directory holding the logs; a log's source is tests/e2e/cli/<path under root>)

A log is the xtrace of a test (set -x). Every `frad_cli -c <words>` the test ran is a line
    + frad_cli -c cluster status            (or `++ timeout -k 5 120 frad_cli -c ...` from cli_form)
followed, after a few plumbing lines (out=, echo, tail, tee), by what the CLI printed as plain
lines up to the next xtrace line. cli_form keeps the whole output in its `+ out=$'...'` line
even when the log shows only the tail, so that line is preferred when it decodes.

The words map to the longest command path the tree knows; the rest are arguments. All runs
of one command become one example `cli-<path words joined by ->`: the words typed at the top
prompt (`h1> `), then the output; the command's own test log comes first. Only passing logs
(`+ STATUS=0`) are read, outputs hidden by the test (piped into grep -q) are skipped, a run that
prints a key or password is left out, and the leak gate refuses lab names and paths.
Dependency-free; run it with `python3 -I`.
"""
import argparse, json, os, re, sys, time

XTRACE = re.compile(r'^\++ ')
INVOKE = re.compile(r'^\++ (?:timeout(?: -k \d+)? \d+ )?frad_cli -c (.+)$')
PLUMBING = re.compile(r"^\+ (?:out=|echo \$'|echo '|tail -\d+$|tee )")
OUT_ANSI = re.compile(r"^\+ out=\$'(.*)'$")
OUT_PLAIN = re.compile(r"^\+ out='(.*)'$")
OUT_BARE = re.compile(r'^\+ out=(\S*)$')
STATUS = re.compile(r'^\+ STATUS=(\d+)$')
BUILD = re.compile(r'sys\.build\.commit = ([\w.-]+)')
LEAK = re.compile(r'/home/|chien-pang|rfvm|rfap|10\.32\.|frad[23]_|Workspace|frad_cli -c|su - admin')
SECRET = re.compile(r'secret_key|access_key|password:|passphrase', re.I)
ESC = {'n': '\n', 't': '\t', 'r': '\r', '\\': '\\', "'": "'", '"': '"', 'a': '\a', 'b': '\b',
       'f': '\f', 'v': '\v', 'e': '\x1b', 'E': '\x1b'}


def unansi(s):
    """Decode bash's $'...' quoting as xtrace prints it; None when a sequence is unknown."""
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c != '\\':
            out.append(c); i += 1; continue
        i += 1
        if i >= n: return None
        c = s[i]
        if c in ESC: out.append(ESC[c]); i += 1
        elif c == 'x':
            m = re.match(r'[0-9a-fA-F]{1,2}', s[i + 1:])
            if not m: return None
            out.append(chr(int(m.group(0), 16))); i += 1 + len(m.group(0))
        elif c in '01234567':
            m = re.match(r'[0-7]{1,3}', s[i:])
            out.append(chr(int(m.group(0), 8))); i += len(m.group(0))
        else: return None
    return ''.join(out)


def clean(lines):
    return [l.rstrip('\r').expandtabs(8).rstrip() for l in lines]


def runs(path):
    """Every (words, output lines) a passing log recorded, in order."""
    with open(path, encoding='utf-8', errors='replace') as f:
        lines = f.read().split('\n')
    status = [m.group(1) for m in map(STATUS.match, lines) if m]
    if not status or status[-1] != '0':
        return None, []
    build = next((m.group(1) for m in map(BUILD.search, lines) if m), '')
    found, i = [], 0
    while i < len(lines):
        m = INVOKE.match(lines[i])
        if not m:
            i += 1; continue
        words, full, i = m.group(1), None, i + 1
        while i < len(lines) and PLUMBING.match(lines[i]):
            l = lines[i]
            a, p, b = OUT_ANSI.match(l), OUT_PLAIN.match(l), OUT_BARE.match(l)
            if a: full = unansi(a.group(1))
            elif p: full = p.group(1).replace("'\\''", "'")
            elif b: full = b.group(1)
            i += 1
        plain = []
        while i < len(lines) and not XTRACE.match(lines[i]):
            plain.append(lines[i]); i += 1
        plain = clean(plain)
        while plain and not plain[-1]: plain.pop()
        out = plain
        if full is not None:
            dec = clean(full.split('\n'))
            while dec and not dec[-1]: dec.pop()
            if dec[-len(plain):] == plain or not plain:
                out = dec
        if out:
            found.append((words, out))
    return build, found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tree', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--prompt', default='h1> ')
    ap.add_argument('--root', required=True, help='the logs live under it, at tests/e2e/cli/<path>')
    ap.add_argument('--prefix', default='tests/e2e/cli')
    ap.add_argument('logs', nargs='+')
    a = ap.parse_args()
    with open(a.tree, encoding='utf-8') as f:
        tree = f.read()
    cmds = {}
    for c in json.loads('[' + ','.join(re.findall(r'\{"kind": .*?\}', tree)) + ']'):
        if c['kind'] != 'mode': cmds[c['path']] = c
    examples = {}
    for log in sorted(a.logs):
        build, found = runs(log)
        if build is None:
            print('skip (not passing):', log, file=sys.stderr); continue
        rel = os.path.relpath(log, a.root).replace(os.sep, '/')
        src = a.prefix + '/' + re.sub(r'\.test$', '', rel)
        date = time.strftime('%Y-%m-%d', time.localtime(os.path.getmtime(log)))
        for words, out in found:
            toks = words.split()
            path = next((' '.join(toks[:k]) for k in range(len(toks), 0, -1) if ' '.join(toks[:k]) in cmds), None)
            if not path:
                print('no command for:', words, '(' + src + ')', file=sys.stderr); continue
            if any(SECRET.search(l) for l in out):
                print('left out (prints a secret):', words, '(' + src + ')', file=sys.stderr); continue
            own = os.path.basename(src) == 'test_' + path.split()[-1]
            examples.setdefault(path, []).append((0 if own else 1, src, date, words, out, build))
    leaks, body = [], []
    for path in sorted(examples):
        lines, srcs, typed, build = [], [], set(), None
        for _, src, date, words, out, b in sorted(examples[path], key=lambda r: r[0]):
            if words in typed: continue
            typed.add(words)
            build = build or b
            if src not in [s for s, _ in srcs]: srcs.append((src, date))
            lines.append(a.prompt + words)
            lines.extend(out)
            for l in out:
                if LEAK.search(l): leaks.append((src, l))
        lines = lines[:160]
        src = srcs[0][0] + ('' if len(srcs) == 1 else ' and %d more' % (len(srcs) - 1))
        ident = 'cli-' + path.replace(' ', '-')
        body.append("'%s': { source: %s, date: %s, build: %s, lines: [\n%s\n] }" % (
            ident, json.dumps(src), json.dumps(srcs[0][1]), json.dumps(build),
            ',\n'.join(json.dumps(l, ensure_ascii=False) for l in lines)))
    if leaks:
        for src, l in leaks: print('LEAK', src + ':', l, file=sys.stderr)
        sys.exit('refusing to write: %d line(s) name the lab' % len(leaks))
    with open(a.out, 'w', encoding='utf-8') as f:
        f.write('/* Recorded CLI runs, cut from passing e2e test logs by tools/examples-from-logs.py on %s.\n'
                '   Generated: do not edit; the ids are cli-<command path with dashes>. */\n'
                'Object.assign(window.FRAD_EXAMPLES = window.FRAD_EXAMPLES || {}, {\n\n%s\n\n});\n'
                % (time.strftime('%Y-%m-%d'), ',\n\n'.join(body)))
    print('%d commands from %d logs -> %s' % (len(body), len(a.logs), a.out))


if __name__ == '__main__':
    main()
