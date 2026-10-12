#!/usr/bin/env python3
"""Draw the FRAD logo: a spare tire with an F on the rim, yellow and black.

Writes logo/frad-mark.svg, logo/frad-mark-dark.svg, logo/frad-logo.svg, logo/frad-logo-dark.svg,
logo/frad-logo-stacked.svg, favicon.svg, and swaps the inline mark in index.html and cli.html.
With --social it also renders logo/frad-social.png (1200x630) through headless Chrome.
Dependency-free; run it from the repo root with `python3 -I tools/make-logo.py`.
"""
import os, re, subprocess, sys, tempfile

YELLOW, BLACK = '#ffd400', '#0b0b0b'


def mark(x=0, y=0, s=1.0):
    """The tire: black with a yellow tread, a yellow rim, the F cut in black. 100x100 box."""
    return ('<g transform="translate(%g %g) scale(%g)">'
            '<circle cx="50" cy="50" r="47.5" fill="none" stroke="%s" stroke-width="2"/>'
            '<circle cx="50" cy="50" r="46" fill="%s"/>'
            '<circle cx="50" cy="50" r="40.5" fill="none" stroke="%s" stroke-width="5.5" stroke-dasharray="4.4 6.2" transform="rotate(-90 50 50)"/>'
            '<circle cx="50" cy="50" r="31" fill="%s"/>'
            '<circle cx="50" cy="50" r="31" fill="none" stroke="%s" stroke-width="1.6"/>'
            '<path d="M37.5 31V69M37.5 31H65M37.5 49.5H59.5" fill="none" stroke="%s" stroke-width="11" stroke-linecap="butt" stroke-linejoin="miter"/>'
            '</g>' % (x, y, s, YELLOW, BLACK, YELLOW, YELLOW, BLACK, BLACK))


# F R A D as strokes (no font): the letter paths of the earlier lockup, 60 tall, 214 wide.
LETTERS = ['M0 0V60M0 0H40M0 30H31', 'M62 60V0H86A15 15 0 0 1 86 30H62M84 30L104 60',
           'M128 60L151 0L174 60M137 37H165', 'M198 0V60H214A30 30 0 0 0 214 0Z']


def word(x, y, color):
    return '<g transform="translate(%g %g)">%s</g>' % (x, y, ''.join(
        '<path d="%s" fill="none" stroke="%s" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>' % (d, color)
        for d in LETTERS))


def svg(w, h, body, label):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" role="img" aria-label="%s">'
            '<title>%s</title>%s</svg>\n' % (w, h, w, h, label, label, body))


def write(path, text):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print('wrote', path)


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)
    write('logo/frad-mark.svg', svg(100, 100, mark(), 'FRAD mark'))
    write('logo/frad-mark-dark.svg', svg(100, 100, mark(), 'FRAD mark'))
    write('favicon.svg', svg(100, 100, mark(), 'FRAD'))
    write('logo/frad-logo.svg', svg(386, 112, mark(6, 6) + word(124, 26, BLACK), 'FRAD'))
    write('logo/frad-logo-dark.svg', svg(386, 112, mark(6, 6) + word(124, 26, YELLOW), 'FRAD'))
    write('logo/frad-logo-stacked.svg', svg(250, 200, mark(75, 0) + word(18, 128, BLACK), 'FRAD'))
    inline = ('<svg class="mark-svg" viewBox="0 0 100 100" width="28" height="28" aria-hidden="true">'
              + mark() + '</svg>')
    for page in ('index.html', 'cli.html'):
        with open(page, encoding='utf-8') as f:
            s = f.read()
        s2 = re.sub(r'<svg class="mark-svg".*?</svg>', inline, s, count=1, flags=re.S)
        if s2 == s:
            sys.exit(page + ': no inline mark found')
        write(page, s2)
    if '--social' in sys.argv:
        html = ('<!doctype html><meta charset="utf-8"><body style="margin:0;width:1200px;height:630px;'
                'background:%s;display:flex;align-items:center;justify-content:center">'
                '%s</body>' % (BLACK, svg(386, 112, mark(6, 6) + word(124, 26, YELLOW), 'FRAD')
                                .replace('width="386" height="112"', 'width="772" height="224"')))
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'social.html')
            write(p, html)
            out = os.path.abspath('logo/frad-social.png')
            subprocess.run(['google-chrome', '--headless=new', '--no-sandbox', '--hide-scrollbars',
                            '--window-size=1200,630', '--screenshot=' + out, 'file://' + p],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print('wrote', out)


if __name__ == '__main__':
    main()
