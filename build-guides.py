# -*- coding: utf-8 -*-
"""
Builds the free workbook guides into guides/.

Every guide is one HTML file that renders two ways: the pretty screen version,
and a black-and-white printable workbook (toggle in the toolbar, and whenever
it's actually printed). See assets/workbook.css — the two skins share all
component rules and differ only in tokens.

Content blocks:
  ('p',     text)
  ('q',     ask, hint, n_lines)
  ('ticks', [items])
  ('scale', low_label, high_label)
  ('panel', title, [steps], [trailing paragraphs])
  ('swap',  from_label, to_label, n_lines)
"""
import io, os, html

OUT = 'guides'
BOOK = 'https://yukisacredspace.square.site/s/appointments'
FB = 'https://www.facebook.com/wistyuki/'

SIGIL = u'''<svg class="sigil" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" class="sig-ring"/>
      <circle cx="24" cy="24" r="14.5" class="sig-ring sig-ring--in"/>
      <path d="M29.5 13.4a12 12 0 1 0 0 21.2 13.6 13.6 0 0 1 0-21.2Z" class="sig-moon"/>
      <circle cx="24" cy="1.9" r="1.9" class="sig-dot"/><circle cx="24" cy="46.1" r="1.5" class="sig-dot"/>
      <circle cx="1.9" cy="24" r="1.5" class="sig-dot"/><circle cx="46.1" cy="24" r="1.5" class="sig-dot"/>
    </svg>'''

E = html.escape


def render(blocks):
    out = []
    for b in blocks:
        k = b[0]
        if k == 'p':
            out.append(u'        <p>%s</p>' % b[1])
        elif k == 'howto':
            out.append(u'      <div class="howto">%s</div>' % b[1])
        elif k == 'q':
            ask, hint, n = b[1], b[2], b[3]
            h = u'\n          <span class="q__hint">%s</span>' % hint if hint else ''
            li = u'\n'.join([u'            <li></li>'] * n)
            out.append(u'''        <div class="q">
          <span class="q__ask">%s</span>%s
          <ul class="lines" aria-hidden="true">
%s
          </ul>
        </div>''' % (ask, h, li))
        elif k == 'ticks':
            li = u'\n'.join(u'            <li>%s</li>' % i for i in b[1])
            out.append(u'        <ul class="ticks">\n%s\n        </ul>' % li)
        elif k == 'scale':
            cells = u''.join(u'<span>%d</span>' % i for i in range(11))
            out.append(u'''        <div class="scale">
          <div class="scale__row">%s</div>
          <div class="scale__ends"><span>%s</span><span>%s</span></div>
        </div>''' % (cells, b[1], b[2]))
        elif k == 'panel':
            steps = u'\n'.join(u'            <li>%s</li>' % s for s in b[2])
            tail = u'\n'.join(u'          <p>%s</p>' % p for p in (b[3] if len(b) > 3 else []))
            out.append(u'''        <div class="panel">
          <p class="panel__title">%s</p>
          <ol>
%s
          </ol>
%s
        </div>''' % (b[1], steps, tail))
        elif k == 'swap':
            li = u'\n'.join([u'              <li></li>'] * b[3])
            out.append(u'''        <div class="swap">
          <div class="swap__half">
            <span class="swap__label swap__label--from">%s</span>
            <ul class="lines" aria-hidden="true">
%s
            </ul>
          </div>
          <div class="swap__half">
            <span class="swap__label swap__label--to">%s</span>
            <ul class="lines" aria-hidden="true">
%s
            </ul>
          </div>
        </div>''' % (b[1], li, b[2], li))
    return u'\n'.join(out)


PAGE = u'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — a free workbook from Yūki's Sacred Space</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#191317">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Metamorphous&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/workbook.css">
</head>
<body>

<div class="wbbar">
  <a class="wbbtn" href="../resources.html">&larr; all guides</a>
  <div class="wbbar__links">
    <button class="wbbtn" id="bwToggle" aria-pressed="false">printer friendly</button>
    <button class="wbbtn" id="printBtn">print / save as pdf</button>
  </div>
</div>

<div class="sheet">

  <header class="wbhead">
    {sigil}
    <p class="wbhead__kicker">a free workbook</p>
    <h1 class="wbhead__title">{title}</h1>
    <p class="wbhead__sub">{sub}</p>
  </header>

{body}

  <div class="wbnote">
    <strong>Please read:</strong> this is a self-help worksheet, not therapy and not
    medical care. It won't fix everything and it isn't meant to. If you're struggling
    with your mental health, please talk to a doctor or a therapist — and keep doing
    that alongside anything you do with me.{crisis}
  </div>

  <p class="wbfoot">
    Yūki's Sacred Space · <a href="{book}">book a session</a> · <a href="{fb}">message me</a>
  </p>

</div>

<script src="../assets/workbook.js"></script>
<script src="../assets/stats.js"></script>
</body>
</html>
'''

CRISIS = (u' If you are thinking about hurting yourself, please don\'t use a worksheet '
          u'— contact a crisis line right now. In the US you can call or text '
          u'<strong>988</strong>. Elsewhere, your local emergency number.')


def step(n, title, blocks, brk=False):
    return u'''  <section class="step%s">
    <p class="step__n">%s</p>
    <h2 class="step__title">%s</h2>
%s
  </section>''' % (' step--break' if brk else '', n, title, render(blocks))


GUIDES = {}

# ══════════════════════════════════════════════ breathe
GUIDES['breathing'] = dict(
    title=u'breathe',
    sub=u'three ways to change your body’s mind in under two minutes.',
    desc=u'A free breathing workbook: box breathing, the long exhale, and the double sigh.',
    crisis='',
    body=u'\n\n'.join([
        u'  ' + render([('howto', u'You don’t have to believe in anything for this to work. '
                                 u'Breathing out for longer than you breathe in tells your nervous '
                                 u'system the danger has passed. That’s plumbing, not faith.')]).strip(),
        step('01', u'when to use it', [
            ('p', u'Reach for these <em>before</em> the thing, not only after it.'),
            ('ticks', [u'before a hard conversation', u'when your chest goes tight',
                       u'when you can’t get to sleep', u'right after something startles you',
                       u'when you notice you’ve been holding your breath']),
        ]),
        step('02', u'the square', [
            ('panel', u'box breathing · about one minute', [
                u'In through your nose — count 4.', u'Hold — count 4.',
                u'Out through your mouth — count 4.', u'Hold empty — count 4.',
                u'Round the square four times.'],
             [u'If four feels like too long, use three. Evenness matters more than the number.']),
        ]),
        step('03', u'the long way out', [
            ('panel', u'the long exhale · one minute', [
                u'In through your nose — count 4.',
                u'Out, slowly, through pursed lips — count 6, or 8 if you can.',
                u'Keep going for a minute.'],
             [u'This is the one that actually does the calming. If you remember nothing '
              u'else from this page: <strong>make the out-breath longer than the in-breath.</strong>']),
        ]),
        step('04', u'the double sigh', [
            ('panel', u'fastest one · about ten seconds', [
                u'Normal breath in through your nose.',
                u'On top of it, sip in a second, smaller breath.',
                u'Let it all go, slowly, out of your mouth.',
                u'Twice is usually enough.'],
             [u'Good for the ten seconds before you cry, or shout, or send the message '
              u'you shouldn’t send.']),
        ]),
        step('05', u'check', [
            ('q', u'How tense were you before?', '', 0),
            ('scale', u'not at all', u'as bad as it gets'),
            ('q', u'And after?', '', 0),
            ('scale', u'not at all', u'as bad as it gets'),
            ('q', u'Where in your body did you notice it first?', u'jaw, chest, shoulders, stomach, hands?', 2),
            ('q', u'Which of the three will you actually remember?', '', 2),
        ]),
    ]))

# ══════════════════════════════════════════════ sit
GUIDES['meditation'] = dict(
    title=u'sit',
    sub=u'five minutes. no cushion, no incense, no clearing your mind.',
    desc=u'A free five-minute meditation workbook. You cannot be bad at this.',
    crisis='',
    body=u'\n\n'.join([
        u'  ' + render([('howto', u'Meditation is not emptying your head. It’s noticing where your '
                                 u'head went, and coming back. The coming back <em>is</em> the practice. '
                                 u'Which means you cannot be bad at this — a wandering mind is the '
                                 u'exercise equipment, not the failure.')]).strip(),
        step('01', u'set it up', [
            ('ticks', [u'pick a time you’re already still — before sleep, after coffee',
                       u'set a timer for five minutes',
                       u'sit however is comfortable, feet on the floor',
                       u'eyes closed, or resting soft on one spot']),
        ]),
        step('02', u'the five minutes', [
            ('panel', u'do this', [
                u'Notice three things you can hear.',
                u'Find your breath. Don’t change it — just find it.',
                u'When you catch yourself thinking, say the word <em>thinking</em> in your head.',
                u'Come back to the breath.',
                u'Repeat until the timer goes.'],
             []),
        ]),
        step('03', u'when your mind wanders', [
            ('p', u'It will. Twenty times in five minutes is normal. That is not a sign it isn’t working.'),
            ('ticks', [u'it wandered — that isn’t failing',
                       u'you noticed — that’s the rep',
                       u'name it, come back',
                       u'don’t grade yourself on the way']),
        ]),
        step('04', u'a week of it', [
            ('q', u'One word for each day. That’s the whole tracker.',
             u'mon / tue / wed / thu / fri / sat / sun', 7),
        ]),
        step('05', u'check', [
            ('q', u'Where does your mind go most often?', '', 2),
            ('q', u'Is that thing asking for your attention somewhere else in your life?', '', 3),
        ]),
    ]))

# ══════════════════════════════════════════════ the spiral
GUIDES['catastrophic-thinking'] = dict(
    title=u'the spiral',
    sub=u'catching the thought that’s running you, and writing down a truer one.',
    desc=u'A free CBT-style workbook for catching catastrophic thinking and redirecting it.',
    crisis=CRISIS,
    body=u'\n\n'.join([
        u'  ' + render([('howto', u'This is the long one, and the one the others are built on. '
                                 u'Work it slowly. One spiral at a time — don’t try to solve '
                                 u'your whole life on one sheet.')]).strip(),
        step('01', u'catch it', [
            ('q', u'What happened?', u'just the facts — what a camera would have recorded.', 3),
            ('q', u'What did your brain say it meant?', '', 3),
            ('q', u'Where did you feel that in your body?', '', 2),
        ]),
        step('02', u'name the shape', [
            ('p', u'Almost every spiral is one of a few shapes. Tick any that fit. '
                  u'Naming it takes some of its power — it stops being <em>the truth</em> '
                  u'and starts being <em>a habit</em>.'),
            ('ticks', [u'<strong>fortune telling</strong> — I already know how this ends',
                       u'<strong>mind reading</strong> — I know what they think of me',
                       u'<strong>all or nothing</strong> — it’s perfect or it’s ruined',
                       u'<strong>catastrophising</strong> — the worst case is the likely case',
                       u'<strong>personalising</strong> — this is about me',
                       u'<strong>shoulds</strong> — I ought to be further along than this',
                       u'<strong>discounting</strong> — the good thing doesn’t count']),
        ]),
        step('03', u'test it', [
            ('q', u'What’s the worst you’re picturing?', '', 2),
            ('q', u'How likely is that, honestly?', '', 0),
            ('scale', u'never happening', u'certain'),
            ('q', u'What’s the evidence it will happen?', '', 2),
            ('q', u'What’s the evidence it won’t?', u'take longer on this one than the last one.', 4),
            ('q', u'What usually actually happens, in your experience?', '', 2),
        ], brk=True),
        step('04', u'and if it did happen', [
            ('p', u'Often the real fear isn’t that the thing will happen. '
                  u'It’s a quiet belief that you couldn’t survive it. Test that too.'),
            ('q', u'If it did happen, what’s the first thing you’d do?', '', 2),
            ('q', u'Who would you tell?', '', 1),
            ('q', u'How much would it matter in a week? A year? Five?', '', 2),
        ]),
        step('05', u'redirect', [
            ('p', u'Not a positive thought — a <em>truer</em> one. '
                  u'If you don’t believe the new sentence, it won’t hold. Aim for accurate.'),
            ('swap', u'the thought that was running me', u'what’s actually true, as best i can tell', 3),
            ('q', u'What would you say to a friend who told you the first one?',
             u'say that to yourself, in those words.', 3),
        ]),
        step('06', u'one small thing', [
            ('q', u'What’s one thing you can do in the next hour?',
             u'small enough that you’ll actually do it.', 2),
        ]),
    ]))

# ══════════════════════════════════════════════ new job
GUIDES['new-job'] = dict(
    title=u'new job nerves',
    sub=u'for the week before you start, or the first week in.',
    desc=u'A free CBT-style workbook for anxiety about starting a new job.',
    crisis=CRISIS,
    body=u'\n\n'.join([
        u'  ' + render([('howto', u'Nerves before a new job are not a warning. They’re what '
                                 u'caring about something feels like before you have any evidence '
                                 u'yet. This sheet gets you the evidence.')]).strip(),
        step('01', u'what’s the fear, exactly', [
            ('q', u'What are you actually afraid will happen?',
             u'“it’ll go badly” is too vague to argue with. be specific.', 3),
            ('ticks', [u'I’ll look stupid', u'I won’t be able to do the work',
                       u'they’ll realise they hired the wrong person',
                       u'I won’t fit in with them', u'I’ll be overwhelmed and show it',
                       u'I’ll fail where everyone can see']),
        ]),
        step('02', u'test it', [
            ('q', u'How likely is that, honestly?', '', 0),
            ('scale', u'never happening', u'certain'),
            ('q', u'They chose you out of everyone who applied. What did they see?', '', 2),
            ('q', u'Name three things you already know how to do.', '', 3),
            ('q', u'When did you last start something new and survive it?',
             u'you have done this before.', 2),
        ]),
        step('03', u'the first week is supposed to be hard', [
            ('p', u'Nobody expects you to know things you haven’t been told yet. '
                  u'Being new is a job description, not a performance.'),
            ('q', u'What would a <em>fine</em> first week look like?',
             u'not a great one. a fine one.', 3),
        ]),
        step('04', u'redirect', [
            ('swap', u'what my head says at 3am', u'what’s actually true', 3),
        ], brk=True),
        step('05', u'a plan small enough to hold', [
            ('q', u'One question you’ll ask on day one.', '', 1),
            ('q', u'One person you’ll introduce yourself to.', '', 1),
            ('q', u'One thing you’ll do at the end of each day to close it out.', '', 2),
            ('q', u'What will you tell yourself when it hits you mid-afternoon?', '', 2),
        ]),
    ]))

# ══════════════════════════════════════════════ breakup
GUIDES['breakup'] = dict(
    title=u'after a breakup',
    sub=u'for the part where your brain won’t stop going over it.',
    desc=u'A free CBT-style workbook for the loops and grief after a relationship ends.',
    crisis=CRISIS,
    body=u'\n\n'.join([
        u'  ' + render([('howto', u'Be gentle with this one. Do one step, put it down, '
                                 u'come back tomorrow. You don’t have to finish it today '
                                 u'and you don’t have to do it in order.')]).strip(),
        step('01', u'what your brain is saying', [
            ('q', u'What are you telling yourself about why it ended?', '', 3),
            ('q', u'Which parts of that are fact, and which are story?',
             u'a fact is something a camera could have recorded.', 3),
        ]),
        step('02', u'what you actually miss', [
            ('p', u'Grief attaches itself to several different things at once, and they '
                  u'feel like one enormous thing. Separating them makes each one smaller.'),
            ('ticks', [u'the person themselves', u'the routine',
                       u'being someone’s person', u'the future I’d already pictured',
                       u'not being alone', u'who I got to be around them']),
            ('q', u'Which of those is loudest today?', '', 2),
        ]),
        step('03', u'the edit', [
            ('p', u'Early grief rewrites history. It keeps every good day and quietly '
                  u'deletes the rest. This step is not about making them a villain — '
                  u'it’s about getting the record straight.'),
            ('q', u'What was genuinely hard about it?', '', 3),
            ('q', u'What did you put up with that you shouldn’t have had to?', '', 3),
            ('q', u'What will you want next time?', '', 3),
        ], brk=True),
        step('04', u'if the loop is running', [
            ('p', u'If your head keeps running the same three sentences, that’s a spiral, '
                  u'and there’s a longer workbook for it — '
                  u'<a href="catastrophic-thinking.html">the spiral</a>. '
                  u'For now, just write the loudest sentence and one truer one.'),
            ('swap', u'the sentence on repeat', u'something truer', 2),
        ]),
        step('05', u'this week only', [
            ('q', u'What do you need this week?', u'sleep, food, a walk, fewer notifications.', 2),
            ('q', u'Who can you text? Name two people.', '', 2),
            ('q', u'What’s yours again now that wasn’t?', '', 2),
            ('ticks', [u'eat something today', u'go outside once',
                       u'sleep at a normal time', u'put the phone down at night',
                       u'tell one person how you actually are']),
        ]),
    ]))


if not os.path.isdir(OUT):
    os.makedirs(OUT)

for slug, g in GUIDES.items():
    doc = PAGE.format(title=g['title'], sub=g['sub'], desc=g['desc'], body=g['body'],
                      sigil=SIGIL, crisis=g['crisis'], book=BOOK, fb=FB)
    p = os.path.join(OUT, slug + '.html')
    io.open(p, 'w', encoding='utf-8').write(doc)
    print('wrote %-42s %6d bytes' % (p, len(doc.encode('utf-8'))))
