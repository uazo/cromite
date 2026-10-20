"""Fake video site for test.js: python3 server.py <port> <embed port>."""
import http.server, os, re, sys, threading

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'site')
PORT, EMBED_PORT = int(sys.argv[1]), int(sys.argv[2])
CSP = ("default-src 'self'; media-src 'self'; script-src 'self'; style-src 'self'; "
       "img-src 'self' data:; frame-src http://127.0.0.1:%d" % EMBED_PORT)

CSS = """body { margin: 0; font-family: sans-serif; background: #eee; }
header { position: sticky; top: 0; background: #b00; color: #fff; padding: 12px; z-index: 5; }
.wrap { padding: 8px; }
.player-wrap { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000; transform: translateZ(0); }
.player-wrap video { width: 100%; height: 100%; }
.overlay-ad { position: absolute; inset: 0; z-index: 3; }
.site-controls { position: absolute; left: 0; right: 0; bottom: 0; height: 36px; background: rgba(255,0,0,.5); z-index: 4; }
.comments { padding: 12px; } .ad { height: 120px; background: #f0f; margin: 8px 0; }
.sticky { position: fixed; bottom: 0; left: 0; right: 0; height: 50px; background: #ff0; z-index: 9; }
iframe { width: 100%; height: 240px; border: 0; }
.bgvideo { width: 100%; height: 200px; object-fit: cover; }
"""

POPUNDER = """window.popups = 0;
document.addEventListener('click', () => { window.popups++; }, true);
document.querySelectorAll('.overlay-ad').forEach(el => el.addEventListener('click', () => { window.popups += 10; }));
"""

def page(title, body):
    return ('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">'
            '<title>%s</title><link rel="stylesheet" href="/site.css"></head><body>%s'
            '<script src="/popunder.js"></script></body></html>' % (title, body))

PAGES = {
    '/watch.html': page('Big Test Movie - Episode 1',
        '<header>VideoSite</header><div class="wrap"><div class="player-wrap">'
        '<video id="v" src="/clip.webm" preload="metadata" playsinline>'
        '<track kind="subtitles" src="/subs.vtt" srclang="en" label="English"></video>'
        '<div class="overlay-ad"></div><div class="site-controls"></div></div>'
        '<h2>Big Test Movie</h2><div class="ad"></div><div class="comments">Comments...</div></div>'
        '<div class="sticky">AD</div>'),
    '/iframe.html': page('Anime Episode 7',
        '<header>AnimeSite</header><div class="wrap"><iframe src="http://127.0.0.1:%d/embed.html" '
        'allowfullscreen allow="fullscreen; autoplay"></iframe><div class="ad"></div></div>' % EMBED_PORT),
    '/embed.html': page('Embedded player',
        '<div class="player-wrap"><video src="/portrait.webm" preload="metadata" playsinline></video>'
        '<div class="overlay-ad"></div></div>'),
    '/music.html': page('Podcast 42',
        '<header>Podcasts</header><div class="wrap"><audio src="/song.ogg" preload="auto"></audio>'
        '<p>Episode 42</p><div class="ad"></div></div>'),
    '/background.html': page('Landing page',
        '<header>Shop</header><video class="bgvideo" src="/portrait.webm" muted loop autoplay playsinline></video>'),
}

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def do_GET(self):
        p = self.path.split('?')[0]
        if p in PAGES:
            return self.send(PAGES[p].encode(), 'text/html')
        if p == '/site.css':
            return self.send(CSS.encode(), 'text/css')
        if p == '/popunder.js':
            return self.send(POPUNDER.encode(), 'application/javascript')
        f = os.path.join(SITE, p.lstrip('/'))
        if not os.path.isfile(f):
            self.send_response(404); self.end_headers(); return
        data = open(f, 'rb').read()
        ctype = {'.webm': 'video/webm', '.ogg': 'audio/ogg', '.vtt': 'text/vtt'}.get(os.path.splitext(f)[1], 'application/octet-stream')
        m = re.match(r'bytes=(\d+)-(\d*)', self.headers.get('Range', ''))
        if m:
            start = int(m.group(1)); end = int(m.group(2)) if m.group(2) else len(data) - 1
            self.send_response(206)
            self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, len(data)))
            body = data[start:end + 1]
        else:
            self.send_response(200)
            body = data
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass
    def send(self, body, ctype):
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Security-Policy', CSP)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

for port in (EMBED_PORT, PORT):
    server = http.server.ThreadingHTTPServer(('127.0.0.1', port), H)
    threading.Thread(target=server.serve_forever, daemon=(port == EMBED_PORT)).start()
