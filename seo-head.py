# -*- coding: utf-8 -*-
"""
Injects the shared SEO / icon / social head block into every page.

Run after build-pages.py and build-guides.py:   python seo-head.py

Why this exists as its own pass rather than living in the templates: index.html
is hand-written and the guides use a different template, so the block would
otherwise have to be maintained in three places and would inevitably drift.

The canonical URL is the important part. The site answers on three hostnames
(yukis.space, www.yukis.space, yukispace.duckdns.org) with identical content.
Without a canonical, search engines treat those as three competing copies and
split the ranking signals between them. Every page declares the yukis.space
form as the real one.
"""
import io, os, re, glob

SITE = 'https://yukis.space'
OG_ALT = ("Yuki's Sacred Space - distance reiki, spirit guidance and death "
          "doula work, sent anywhere")

MARKER_START = '<!-- SEO:START -->'
MARKER_END = '<!-- SEO:END -->'


def block(path, title, description):
    """path is the public URL path, e.g. '/about' or '/guides/breathing.html'."""
    url = SITE + path
    return u'''{start}
<link rel="canonical" href="{url}">

<link rel="icon" href="/brand/favicon.ico" sizes="any">
<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">

<meta property="og:url" content="{url}">
<meta property="og:image" content="{site}/brand/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{alt}">
<meta name="twitter:image" content="{site}/brand/og-image.png">
{end}'''.format(start=MARKER_START, end=MARKER_END, url=url, site=SITE, alt=OG_ALT)


# path on disk -> public URL path
PAGES = {
    'index.html': '/',
    'about.html': '/about',
    'writing.html': '/writing',
    'resources.html': '/resources',
    'brand.html': '/brand',
}
for g in sorted(glob.glob('guides/*.html')):
    PAGES[g.replace('\\', '/')] = '/' + g.replace('\\', '/')


def inject(fn, url_path):
    s = io.open(fn, encoding='utf-8').read()

    # replace an existing block so the script is safe to re-run
    if MARKER_START in s:
        s = re.sub(re.escape(MARKER_START) + r'.*?' + re.escape(MARKER_END),
                   block(url_path, None, None), s, flags=re.S)
    else:
        # goes immediately before </head>
        s = s.replace('</head>', block(url_path, None, None) + '\n</head>', 1)

    io.open(fn, 'w', encoding='utf-8').write(s)
    return url_path


for fn, url_path in sorted(PAGES.items()):
    if os.path.exists(fn):
        print('  %-30s -> %s' % (fn, inject(fn, url_path)))


# ── sitemap ───────────────────────────────────────────────────────────────
# Only public pages. The admin is excluded here and disallowed in robots.txt.
import datetime
today = datetime.date.today().isoformat()

PRIORITY = {'/': '1.0', '/about': '0.9', '/resources': '0.8',
            '/writing': '0.7', '/brand': '0.3'}

urls = []
for fn, p in sorted(PAGES.items(), key=lambda kv: kv[1]):
    if not os.path.exists(fn):
        continue
    pri = PRIORITY.get(p, '0.6')
    urls.append(u'  <url>\n'
                u'    <loc>%s%s</loc>\n'
                u'    <lastmod>%s</lastmod>\n'
                u'    <priority>%s</priority>\n'
                u'  </url>' % (SITE, p, today, pri))

sitemap = (u'<?xml version="1.0" encoding="UTF-8"?>\n'
           u'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + u'\n'.join(urls) + u'\n</urlset>\n')
io.open('sitemap.xml', 'w', encoding='utf-8').write(sitemap)
print('\n  sitemap.xml with %d urls' % len(urls))
