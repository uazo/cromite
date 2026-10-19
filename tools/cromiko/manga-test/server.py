"""Fake manga site for test.js: python3 server.py <port>."""
import http.server, os, re, sys, time

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'site')
CSP = ("default-src 'self'; img-src 'self' data:; style-src 'self'; "
       "script-src 'self'; frame-src 'none'")

def page(ch, async_images, wrapped=False):
    prev = f'<a class="btn prev_page" href="ch-{ch - 1}.html">&lsaquo; Prev</a>' if ch > 1 else \
        '<a class="btn prev_page disabled" href="#">&lsaquo; Prev</a>'
    nxt = f'<a class="btn next_page" href="ch-{ch + 1}.html"><span class="ico">&rsaquo;</span> Next</a>' if ch < 5 else \
        '<a class="btn next_page disabled" href="#">Next</a>'
    nav = f'<div class="nav-links">{prev} {nxt}</div>'
    imgs = '' if async_images else ''.join(
        f'<div class="page-break"><img class="wp-manga-chapter-img lazy" '
        f'src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" '
        f'data-src="/img/c{ch}p{i}.svg" alt=""><div class="protect"></div>'
        f'<div class="page-num">{i}</div></div>'
        for i in range(1, 13 if ch == 5 else 9))
    if wrapped:
        # Only the address of the image, in a wrapper: the site adds the image later.
        imgs = ''.join(f'<div class="page" data-src="/img/c{ch}p{i}.svg"></div>' for i in range(1, 7))
    # Chapter 4 has the Open Graph tags of many sites, with the series cover.
    og = ('<meta property="og:title" content="Read Series Chapter 4 Online - Manga Site">'
          '<meta property="og:image" content="/cover.svg">') if ch == 4 else ''
    return f'''<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chapter {ch}</title>{og}<link rel="stylesheet" href="/site.css"></head>
<body data-ch="{ch}"><header class="site-header"><img class="logo" src="/logo.svg" alt="logo"> Manga Site
<nav class="menu"><a href="/">Home</a> <a href="/list">List</a></nav></header>
<div class="wrap"><div class="main"><h1>Series - Chapter {ch}</h1>{nav}
<div class="entry-content"><div class="reading-content{' tall' if ch == 5 else ''}" data-async="{1 if async_images else 0}" data-ch="{ch}">{imgs}</div></div>
{nav}<section class="comments"><h3>Comments</h3>
<div class="comment"><img class="avatar" src="/avatar.svg" alt=""> nice chapter</div>
<div class="comment"><img class="avatar" src="/avatar.svg" alt=""> thanks!</div></section></div>
<aside class="sidebar"><img class="banner" src="/banner.svg" alt=""></aside></div>
<div class="sticky-ad"><img src="/ad.svg" alt="ad"></div>
<script src="/lazy.js"></script><script src="/popunder.js"></script></body></html>'''

def svg(w, h, label, color):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{color}"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>
<rect width="{w}" height="{h}" fill="url(#g)"/><text x="{w/2}" y="{h/2}" font-size="{max(12, w // 10)}" text-anchor="middle" fill="#222" font-family="sans-serif">{label}</text>
<rect x="4" y="4" width="{w-8}" height="{h-8}" fill="none" stroke="#222" stroke-width="4"/></svg>'''

COLORS = ['#f6b26b', '#93c47d', '#6fa8dc', '#c27ba0', '#ffd966', '#76a5af', '#e06666', '#8e7cc3']

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def send(self, body, ctype, delay=0):
        if delay:
            time.sleep(delay)
        body = body.encode() if isinstance(body, str) else body
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Security-Policy', CSP)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_GET(self):
        p = self.path.split('?')[0]
        m = re.match(r'/ch-(\d+)\.html$', p)
        if m:
            ch = int(m.group(1))
            return self.send(page(ch, async_images=(ch == 3)), 'text/html')
        m = re.match(r'/wrap-(\d+)\.html$', p)
        if m:
            return self.send(page(int(m.group(1)), async_images=False, wrapped=True), 'text/html')
        m = re.match(r'/img/c(\d+)p(\d+)\.svg$', p)
        if m:
            ch, pg = int(m.group(1)), int(m.group(2))
            return self.send(svg(800, 2000, f'Ch {ch} - Page {pg}', COLORS[pg % 8]), 'image/svg+xml', delay=0.15)
        if p == '/list.json':
            ch = int(self.headers.get('X-Ch', '3'))
            return self.send('[' + ','.join(f'"/img/c{ch}p{i}.svg"' for i in range(1, 7)) + ']', 'application/json', delay=0.5)
        if p == '/home.html':
            return self.send('<!doctype html><html><body><h1>Home</h1><img class="logo" src="/logo.svg">'
                             '<div class="reading-content"></div></body></html>', 'text/html')
        static = {'/cover.svg': svg(300, 420, 'COVER', '#5c7cfc'), '/logo.svg': svg(120, 40, 'LOGO', '#444'), '/avatar.svg': svg(40, 40, ':)', '#999'),
                  '/banner.svg': svg(300, 250, 'BANNER', '#f00'), '/ad.svg': svg(320, 50, 'AD', '#f0f')}
        if p in static:
            return self.send(static[p], 'image/svg+xml')
        f = os.path.join(SITE, p.lstrip('/'))
        if os.path.isfile(f):
            ctype = 'text/css' if f.endswith('.css') else 'application/javascript'
            return self.send(open(f, 'rb').read(), ctype)
        self.send_response(404); self.end_headers()

http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
