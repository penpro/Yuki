# -*- coding: utf-8 -*-
"""
Generates the static subpages that share chrome with index.html.

Run after editing PAGES/content below:   python build-pages.py

The writing page shows a short teaser for each Medium post and links out to
the full article. Her posts stay canonical on Medium, so there's no duplicate
content competing with the originals in search.
"""
import io, json, re, html

posts = json.load(io.open('.medium.json', encoding='utf-8'))
MEDIUM = 'https://medium.com/@wistyuki'
BOOK = 'https://yukisacredspace.square.site/s/appointments'
FB = 'https://www.facebook.com/wistyuki/'
KANJI = u'未来の私のために'
YUKI = u'Yūki'


def slug(t):
    s = re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')
    return re.sub(r'-+', '-', s)[:48]


def datestr(pub):
    m = re.search(r'(\d{1,2} \w{3} \d{4})', pub)
    return m.group(1) if m else ''


def teaser(paras, limit=300):
    """First paragraph, trimmed at a word boundary. A taste, not the article."""
    if not paras:
        return ''
    t = paras[0].strip()
    if len(t) <= limit:
        return t
    cut = t[:limit].rsplit(' ', 1)[0].rstrip(' ,.;:-')
    return cut + u'…'


SIGIL = u'''<svg class="sigil{cls}" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" class="sig-ring"/>
      <circle cx="24" cy="24" r="14.5" class="sig-ring sig-ring--in"/>
      <path d="M29.5 13.4a12 12 0 1 0 0 21.2 13.6 13.6 0 0 1 0-21.2Z" class="sig-moon"/>
      <circle cx="24" cy="1.9" r="1.9" class="sig-dot"/><circle cx="24" cy="46.1" r="1.5" class="sig-dot"/>
      <circle cx="1.9" cy="24" r="1.5" class="sig-dot"/><circle cx="46.1" cy="24" r="1.5" class="sig-dot"/>
    </svg>'''

HEAD = u'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#191317">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Metamorphous&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Shippori+Mincho+B1:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/styles.css">

<!-- Scroll reveals start at opacity:0 and are switched on by main.js. If JS
     never runs — blocked, failed to load, ancient browser — the entire page
     would otherwise stay invisible. Content must never depend on script. -->
<noscript><style>.reveal{{opacity:1!important;transform:none!important}}</style></noscript>
</head>
<body>

<canvas id="aura" aria-hidden="true"></canvas>
<div class="spine" aria-hidden="true"></div>
<div class="kanji" aria-hidden="true"><span lang="ja">KANJI</span></div>
<div class="grain" aria-hidden="true"></div>

<svg class="sprite" aria-hidden="true" focusable="false">
  <symbol id="spider-sym" viewBox="0 0 100 100">
    <g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M43 44 L26 29 L11 23"/><path d="M42 48 L20 43 L5 47"/>
      <path d="M42 53 L21 58 L7 72"/><path d="M44 58 L29 70 L21 90"/>
      <path d="M57 44 L74 29 L89 23"/><path d="M58 48 L80 43 L95 47"/>
      <path d="M58 53 L79 58 L93 72"/><path d="M56 58 L71 70 L79 90"/>
    </g>
    <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
      <path d="M47 57 L44 64"/><path d="M53 57 L56 64"/>
    </g>
    <ellipse cx="50" cy="23" rx="16" ry="20" fill="currentColor"/>
    <ellipse cx="50" cy="49" rx="10" ry="9" fill="currentColor"/>
  </symbol>
</svg>

<div class="spiders" aria-hidden="true">
  <span class="spider" style="--size:32px"><span class="spider__thread"></span><svg class="spider__body" viewBox="0 0 100 100"><use href="#spider-sym"/></svg></span>
  <span class="spider" style="--size:44px"><span class="spider__thread"></span><svg class="spider__body" viewBox="0 0 100 100"><use href="#spider-sym"/></svg></span>
  <span class="spider" style="--size:24px"><span class="spider__thread"></span><svg class="spider__body" viewBox="0 0 100 100"><use href="#spider-sym"/></svg></span>
</div>

<a class="skip" href="#main">skip to content</a>

<header class="nav" id="nav">
  <a class="nav__brand" href="index.html" aria-label="YUKI-APOS Sacred Space, home">
    SIGIL_SM
    <span class="nav__name">YUKI-APOS Sacred Space</span>
  </a>
  <button class="nav__toggle" id="navToggle" aria-expanded="false" aria-controls="navMenu">
    <span class="nav__bars" aria-hidden="true"></span><span class="sr">Menu</span>
  </button>
  <nav class="nav__menu" id="navMenu" aria-label="Primary">
    <a href="index.html#offerings">sessions</a>
    <a href="index.html#newlife">new life</a>
    <a href="about.html"{a_about}>about</a>
    <a href="writing.html"{a_writing}>writing</a>
    <a href="resources.html"{a_resources}>resources</a>
    <a class="btn btn--sm" href="BOOKURL" target="_blank" rel="noopener">book</a>
  </nav>
</header>

<main id="main">
'''

FOOT = u'''</main>

<footer class="foot">
  <div class="wrap foot__grid">
    <div>
      SIGIL_LG
      <p class="foot__name">YUKI-APOS Sacred Space</p>
      <p class="foot__by">Wisteria YUKI &middot; she/her</p>
    </div>
    <nav class="foot__links" aria-label="Footer">
      <a href="index.html#offerings">sessions</a>
      <a href="index.html#newlife">new life</a>
      <a href="about.html">about</a>
      <a href="writing.html">writing</a>
      <a href="resources.html">resources</a>
      <a href="FBURL" target="_blank" rel="noopener">facebook</a>
    </nav>
  </div>
  <p class="foot__fine">
    &copy; <span id="year">2026</span> YUKI-APOS Sacred Space. energy work is not medical care &mdash;
    please keep seeing your doctor and your therapist. \U0001f5a4
  </p>
</footer>

<div class="fab" id="fab" hidden>
  <a class="fab__btn fab__btn--gold" id="fabBook"
     href="BOOKURL" target="_blank" rel="noopener">book</a>
  <button class="fab__btn fab__btn--ghost" id="fabSignup" type="button">sign up</button>
</div>

<dialog class="modal" id="signupModal" aria-labelledby="modalTitle">
  <div class="modal__inner">
    <button class="modal__close" id="modalClose" type="button" aria-label="Close">&times;</button>
    <p class="eyebrow" id="modalKicker">free</p>
    <h2 class="modal__title" id="modalTitle">want the free guides?</h2>
    <p class="modal__sub" id="modalSub">
      breathing, meditation, and workbooks for when your head won't stop.
      plus a note when there's something new. one click to leave, whenever you like.
    </p>
    <form class="signup__form signup__form--modal" data-subscribe data-source="modal" novalidate>
      <div class="signup__trap" aria-hidden="true">
        <label>leave this empty <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
      </div>
      <label class="sr" for="modal-email">your email</label>
      <input class="signup__input" id="modal-email" type="email" name="email"
             placeholder="your email" autocomplete="email" required>
      <button class="btn btn--gold" type="submit">send them to me</button>
    </form>
    <p class="signup__msg" data-subscribe-msg role="status" hidden></p>
    <button class="modal__dismiss" id="modalDismiss" type="button">no thanks</button>
  </div>
</dialog>

<script src="assets/main.js"></script>
<script src="assets/subscribe.js"></script>
<script src="assets/cta.js"></script>
</body>
</html>
'''


def chrome(s):
    s = s.replace('SIGIL_SM', SIGIL.format(cls=''))
    s = s.replace('SIGIL_LG', SIGIL.format(cls=' sigil--lg'))
    s = s.replace('KANJI', KANJI).replace('BOOKURL', BOOK).replace('FBURL', FB)
    return s.replace('YUKI-APOS', YUKI + u"'s").replace('YUKI', YUKI)


def page(fn, title, desc, body, active=''):
    marks = dict((k, ' aria-current="page"' if k == active else '')
                 for k in ('about', 'writing', 'resources'))
    out = (chrome(HEAD).format(title=title, desc=desc, a_about=marks['about'],
                               a_writing=marks['writing'], a_resources=marks['resources'])
           + body + chrome(FOOT))
    io.open(fn, 'w', encoding='utf-8').write(out)
    print('wrote %-18s %6d bytes' % (fn, len(out.encode('utf-8'))))


# ── writing.html ──────────────────────────────────────────────────────
toc, blocks = [], []
for p in posts:
    s, d, t = slug(p['title']), datestr(p['pub']), html.escape(p['title'])
    toc.append(u'        <li><a href="#%s">%s<time>%s</time></a></li>' % (s, t, d))
    blocks.append(u'''      <article class="post reveal" id="%s">
        <h2 class="post__title">%s</h2>
        <p class="post__meta">%s &middot; on medium</p>
        <div class="post__body">
          <p>%s</p>
        </div>
        <div class="post__actions">
          <a class="btn btn--sm btn--gold" href="%s" target="_blank" rel="noopener">read more</a>
          <a class="btn btn--sm btn--ghost" href="%s" target="_blank" rel="noopener">read everything on medium</a>
        </div>
      </article>''' % (s, t, d, html.escape(teaser(p['paras'])), p['link'], MEDIUM))

page('writing.html', u"Writing — " + YUKI + u"'s Sacred Space",
     u'Essays on twin flames, collective consciousness, spiritual psychosis and grounding, by Wisteria ' + YUKI + u'.',
     u'''<section class="phead">
  <div class="wrap">
    <a class="backlink" href="index.html"><span aria-hidden="true">&larr;</span> back to the sacred space</a>
    <h1 class="phead__title">writing</h1>
    <p class="phead__sub">the thoughts that don't fit inside a session. tap a title to jump to it.</p>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="wrap">
    <ul class="toc reveal">
%s
    </ul>

    <div class="posts">
%s
    </div>

    <div class="center" style="margin-top:3.5rem">
      <a class="btn btn--ghost" href="%s" target="_blank" rel="noopener">read everything on medium</a>
    </div>
  </div>
</section>
''' % (u'\n'.join(toc), u'\n\n'.join(blocks), MEDIUM),
     active='writing')


# ── about.html ────────────────────────────────────────────────────────
page('about.html', u"About — " + YUKI + u"'s Sacred Space",
     u'Wisteria ' + YUKI + u' — spirit guide, reiki master, death doula. Training, certifications and how she works.',
     u'''<section class="phead">
  <div class="wrap">
    <a class="backlink" href="index.html"><span aria-hidden="true">&larr;</span> back to the sacred space</a>
    <h1 class="phead__title">about me</h1>
    <p class="phead__sub">spirit guide &middot; reiki master &middot; death doula</p>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="wrap">
    <div class="about reveal">

      <div class="placeholder">
        <span class="placeholder__tag">for Yūki to fill in</span>
        <p><strong style="color:var(--bone-2);font-weight:400">This whole page is yours.</strong>
           Everything below is a prompt, not copy. Replace each block with your own
           words &mdash; or delete the ones that don't apply. Nothing here is published
           about you that you didn't write.</p>
      </div>

      <h2>who i am</h2>
      <div class="placeholder">
        <span class="placeholder__tag">your story</span>
        <p>A few paragraphs in your own voice. Some things people usually want to know:</p>
        <ul>
          <li>how you found this work, and when</li>
          <li>what you were doing before</li>
          <li>what made you decide to do it for other people</li>
          <li>who you love working with most</li>
        </ul>
      </div>

      <h2>training &amp; certifications</h2>
      <div class="placeholder">
        <span class="placeholder__tag">credentials</span>
        <p>List each one on its own line &mdash; what it is, who it was through,
           and the year. For example:</p>
        <ul>
          <li>Reiki Level I / II / Master &mdash; lineage or teacher, year</li>
          <li>End-of-life doula training &mdash; organisation, year</li>
          <li>CBT or coaching training &mdash; programme, year</li>
          <li>Anything else: energy work, breathwork, grief support, bodywork</li>
        </ul>
        <p>If you have certificates you're happy to show, they can go here as images.</p>
      </div>

      <h2>how i work</h2>
      <div class="placeholder">
        <span class="placeholder__tag">your approach</span>
        <p>What someone should expect from you. What you will and won't do.
           What you believe about this work. This is the part that makes people
           decide whether you're the right person for them.</p>
      </div>

      <h2>what i don't do</h2>
      <div class="placeholder">
        <span class="placeholder__tag">boundaries</span>
        <p>Worth being direct about. Medical advice, diagnoses, promises about
           outcomes, contacting people who haven't consented &mdash; whatever your
           actual limits are. People trust practitioners who name them.</p>
      </div>

      <div class="note">
        <strong>A note on the wording:</strong> nothing on this page is written for you
        yet, on purpose. Claims about training and credentials should only ever be in
        your own words.
      </div>

      <div class="center" style="margin-top:3rem">
        <a class="btn btn--gold" href="''' + BOOK + '''" target="_blank" rel="noopener">book a session</a>
        <a class="btn btn--ghost" href="''' + FB + '''" target="_blank" rel="noopener">message me</a>
      </div>

    </div>
  </div>
</section>
''',
     active='about')

# ── resources.html ────────────────────────────────────────────────────
GUIDES = [
    ('breathing', u'breathing', u'breathe',
     u'Three ways to talk your nervous system down in under two minutes: box '
     u'breathing, the long exhale, and the double sigh.'),
    ('meditation', u'meditation', u'sit',
     u'Five minutes, no cushion, no clearing your mind. Including what to do when '
     u'your mind wanders — which it will, and which is the point.'),
    ('catastrophic-thinking', u'cbt workbook', u'the spiral',
     u'The long one. Catch the thought that’s running you, name its shape, test it '
     u'against the evidence, and write down a truer one.'),
    ('new-job', u'cbt workbook', u'new job nerves',
     u'For the week before you start, or the first week in. What exactly are you '
     u'afraid of, how likely is it, and what would a <em>fine</em> first week look like?'),
    ('breakup', u'cbt workbook', u'after a breakup',
     u'For the part where your brain won’t stop going over it. Separating fact from '
     u'story, and working out what you actually miss.'),
]

cards = []
for g_slug, kind, g_title, blurb in GUIDES:
    cards.append(u'''      <article class="rescard reveal">
        <span class="rescard__kind">%s</span>
        <h2 class="rescard__title">%s</h2>
        <p class="rescard__body">%s</p>
        <div class="rescard__foot">
          <a class="btn btn--sm btn--gold" href="guides/%s.html">open</a>
          <a class="btn btn--sm btn--ghost" href="guides/%s.html?print">printer friendly</a>
        </div>
      </article>''' % (kind, g_title, blurb, g_slug, g_slug))

page('resources.html', u"Free guides — " + YUKI + u"'s Sacred Space",
     u'Free printable workbooks: breathing, meditation, and CBT-style guides for '
     u'catastrophic thinking, new job nerves and breakups.',
     u'''<section class="phead">
  <div class="wrap">
    <a class="backlink" href="index.html"><span aria-hidden="true">&larr;</span> back to the sacred space</a>
    <h1 class="phead__title">free guides</h1>
    <p class="phead__sub">
      workbooks you can read on screen, or print out and write on.
      no email, no signup, no catch — take whatever helps.
    </p>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="wrap">
    <!-- The backend replaces everything between these two markers with the
         published rows from MySQL. The cards below are the seeded set and
         stay here on purpose: if node is down, nginx falls back to this file
         and visitors still get a working page instead of a 502. -->
    <div class="rescards">
<!--RESOURCE_CARDS_START-->
%s
<!--RESOURCE_CARDS_END-->
    </div>

    <div class="note reveal">
      <strong>Every guide comes two ways.</strong> <em>Open</em> gives you the pretty
      version to read on screen. <em>Printer friendly</em> gives you the same workbook
      in plain black and white with proper lines to write on — kind to your ink, and
      it saves to PDF cleanly. There’s a toggle inside each one, so you can switch
      whenever you like.
    </div>

    <div class="note reveal">
      <strong>These are worksheets, not therapy.</strong> They use ordinary CBT ideas —
      notice a thought, test it against the evidence, write a steadier one. They are not
      a substitute for a doctor or a therapist, and they aren’t a substitute for a
      session with me either. If a page opens up more than you expected, that’s worth
      bringing to a person.
    </div>

    <div class="signup__panel reveal" style="margin-top:clamp(3rem,6vw,4.5rem)">
      <p class="eyebrow">stay in touch</p>
      <h2 class="signup__title">tell me where to send the next one</h2>
      <p class="signup__sub">
        i add new guides when something keeps coming up in sessions.
        leave your email and you'll know when there's another.
      </p>
      <form class="signup__form" data-subscribe data-source="resources" novalidate>
        <div class="signup__trap" aria-hidden="true">
          <label>leave this empty <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
        </div>
        <label class="sr" for="res-email">your email</label>
        <input class="signup__input" id="res-email" type="email" name="email"
               placeholder="your email" autocomplete="email" required>
        <button class="btn btn--gold" type="submit">send me new guides</button>
      </form>
      <p class="signup__msg" data-subscribe-msg role="status" hidden></p>
    </div>

    <div class="center" style="margin-top:3.5rem">
      <a class="btn btn--gold" href="%s" target="_blank" rel="noopener">book a session</a>
      <a class="btn btn--ghost" href="%s" target="_blank" rel="noopener">message me</a>
    </div>
  </div>
</section>
''' % (u'\n\n'.join(cards), BOOK, FB),
     active='resources')


# ── brand.html ────────────────────────────────────────────────────────
PALETTE = [
    (u'ink', u'#191317', u'page background'),
    (u'card', u'#2A2126', u'raised panels'),
    (u'bone', u'#EFE6E0', u'headings, body text'),
    (u'bone soft', u'#9A8781', u'secondary text'),
    (u'gold', u'#D4A94A', u'primary accent'),
    (u'gold light', u'#F2D793', u'prices, highlights'),
    (u'plum', u'#8A4670', u'secondary accent'),
    (u'ember', u'#B04A4A', u'warnings only'),
    (u'edge', u'#0F0F0F', u'centring rules'),
]
sw = []
for name, hexv, use in PALETTE:
    sw.append(u'''      <div class="swatch">
        <div class="swatch__chip" style="background:%s"></div>
        <div class="swatch__meta">
          <span class="swatch__name">%s</span>
          <span class="swatch__hex">%s</span>
          <span class="swatch__hex">%s</span>
        </div>
      </div>''' % (hexv, name, hexv, use))

MARKS = [
    (u'mark-gold', u'gold', u'', u'the default. sits on the dark background.'),
    (u'mark-black', u'black', u' markcard__art--light', u'one colour. print, stamps, anything light.'),
    (u'mark-white', u'white', u' markcard__art--dark', u'one colour, reversed out of dark.'),
    (u'favicon', u'favicon', u'', u'browser tab, 32px and under.'),
]
mk = []
for f, name, cls, use in MARKS:
    mk.append(u'''      <div class="markcard">
        <div class="markcard__art%s"><img src="brand/%s.svg" alt="%s mark"></div>
        <p class="markcard__name">%s</p>
        <p class="rescard__body" style="font-size:.92rem">%s</p>
        <a class="btn btn--sm btn--ghost" href="brand/%s.svg" download>download svg</a>
      </div>''' % (cls, f, name, name, use, f))

page('brand.html', u"Brand — " + YUKI + u"'s Sacred Space",
     u'Logo files, colour palette and typefaces for ' + YUKI + u"'s Sacred Space.",
     u'''<section class="phead">
  <div class="wrap">
    <a class="backlink" href="index.html"><span aria-hidden="true">&larr;</span> back to the sacred space</a>
    <h1 class="phead__title">brand</h1>
    <p class="phead__sub">
      everything visual in one place, so anything made later still looks like it belongs.
    </p>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="wrap about">

    <h2>the mark</h2>
    <p>
      A ring, an inner ring, a crescent and four points. Pure vector with no font
      inside it, so it stays sharp at any size and can be embroidered, stamped or
      printed as readily as it renders on screen.
    </p>
    <div class="marks">
%s
    </div>

    <h2>colour</h2>
    <p>
      Warm near-black, antique gold, plum. Every text colour has been checked against
      the background — the faintest one still clears 5.4:1.
    </p>
    <div class="swatches">
%s
    </div>

    <h2>type</h2>
    <div class="specimen">
      <p class="specimen__label">display · metamorphous</p>
      <p class="specimen__demo" style="font-family:var(--display);font-size:clamp(1.8rem,5vw,2.8rem)">
        Yūki’s Sacred Space
      </p>
      <p class="specimen__meta">
        Headings, prices, the wordmark. This was already the face on her Square site,
        so the new site still reads as hers. Free on Google Fonts.
      </p>
    </div>
    <div class="specimen">
      <p class="specimen__label">body · cormorant garamond</p>
      <p class="specimen__demo" style="font-family:var(--body);font-size:1.4rem;font-style:italic">
        energy doesn’t care about distance, and neither do i.
      </p>
      <p class="specimen__meta">
        All running text. The light and italic weights do most of the work. Free on Google Fonts.
      </p>
    </div>
    <div class="specimen">
      <p class="specimen__label">japanese · shippori mincho b1</p>
      <p class="specimen__demo" lang="ja" style="font-family:'Shippori Mincho B1',serif;font-size:2.2rem">
        未来の私のために
      </p>
      <p class="specimen__meta">
        The watermark phrase — <em>mirai no watashi no tame ni</em>, “for my future self.”
        A mincho serif, so its brush-derived strokes sit naturally beside the Latin type.
        Free on Google Fonts.
      </p>
    </div>

    <h2>the printer-friendly rule</h2>
    <p>
      Everything printable has a black-and-white version, one button away. That version
      isn’t a downgrade: it uses real ruled lines, avoids heavy ink, and breaks across
      pages properly. Anything new that gets made should follow the same rule.
    </p>

    <div class="note">
      <strong>Where the files live.</strong> Marks are in <code>brand/</code>. Colours and
      typefaces are declared once at the top of <code>assets/styles.css</code> — change
      them there and the whole site follows.
    </div>

  </div>
</section>
''' % (u'\n\n'.join(mk), u'\n\n'.join(sw)))

print('done')
