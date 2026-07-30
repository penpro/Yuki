# Yūki's Sacred Space — new site

Static site. No dependencies, no server code, nothing to install to view it.
Open `index.html` in any browser and it works.

```
index.html            home — sessions, the new life package, reiki, contact
about.html            her bio and certifications (all placeholder prompts)
writing.html          her Medium posts, with links out to the full articles
resources.html        index of the free guides
brand.html            the brand sheet: marks, colour, type
guides/*.html         five printable workbooks
brand/*.svg           logo files in every colourway
assets/styles.css     site styling — colours and fonts are declared at the top
assets/workbook.css   guide styling: pretty + printer-friendly skins
assets/main.js        nav, scroll reveals, spiders, kanji drift
```

### Regenerating pages

Most pages are written out by three small Python scripts, so shared chrome (nav,
footer, background layers) only exists in one place. Edit the script, re-run it:

```bash
python build-pages.py
```

`build-pages.py` builds about / writing / resources / brand.
`build-guides.py` builds the five workbooks. `build-brand.py` writes the SVG marks.
`index.html` is hand-written and is **not** generated — edit it directly.

If she'd rather never touch Python, that's fine: the generated `.html` files are
ordinary and can be edited by hand from then on. Just don't re-run the script
afterwards or it will overwrite those edits.

## Run it locally

```bash
python -m http.server 4173
```

Then open <http://localhost:4173>. (Double-clicking `index.html` also works — the
local server is only needed if you want it to behave exactly like production.)

---

## What this site does and doesn't do

**It does not handle booking or money.** Square still does all of that. Every
"book" button opens her existing Square appointments page in a new tab, so the
calendar, payments, gift cards, and confirmation emails keep working exactly as
they do today. Nothing about her Square setup has to change.

This site is the front door Square wasn't giving her.

---

## Things to change before it goes live

### 0. Prices on this site no longer match Square — fix this first

Every price here has been tripled: $45 / $90 / $135 / $210 for reiki, $90 / $180
for calls. **Square still has the old $15 / $30 / $45 / $70 / $30 / $60.**

Until she updates the prices in her Square dashboard, the site advertises one
number and charges another at checkout. That's the single thing that must be
done before this goes live — it's worse than launching late. The prices live in
the `card__price` spans in `index.html` if they need to move again.

### 0b. The "new life" package has no Square product yet

A three-month container: twice a week, an hour each, 24 sessions, **$3,600**.

Its button goes to Facebook Messenger rather than a booking link, which is the
right call for a commitment that size — she'll want a conversation first. If she
later wants to take payment or deposits directly, she can create a Square product
or invoice and swap the `href` on that button.

The arithmetic: 24 sessions at her walk-up $210 rate would be $5,040. At $3,600
that's **$150 a session — a saving of $1,440, about 29% off.** That's a real bulk
discount that still values her time properly: enough to reward the commitment,
not so much that it undercuts single sessions. If she wants to move it, keep the
per-session number round — $3,600 / $3,840 / $4,080 all divide cleanly by 24.

### 1. Photos — the biggest gap
There isn't a single image of her, her space, or her work. The current site has
none either, so there was nothing to pull from. The design works without them,
but a real portrait in the "what actually happens" section would do more for
bookings than anything else here.

### 2. The "what actually happens" copy is mine, not hers
The section under `id="reiki"` in `index.html` — starting "reiki is energy
work." — I wrote in her voice based on how she writes elsewhere. **She should
rewrite it or approve it.** It's the one block on the page making claims about
her practice that didn't come from her.

Same for the three pillar lines (spirit guide / reiki master / death doula) and
the "first time?" steps — those are my inference of her process, not documented
fact. The step "i work through your window of time from wherever i am" in
particular assumes how she runs a distance session. Confirm it.

Everything else — all six service descriptions, prices, durations, the
"alternative scheduling, payment, or trade options" line — is her exact wording,
preserved.

### 2b. The writing page links out rather than mirroring

`writing.html` shows each Medium post's real title, date and opening as a teaser,
then a **read more** button to the full article on Medium and a **read everything
on medium** button to her profile. Clicking a title in the index jumps to that
post's block on the page.

I deliberately didn't copy the full articles across. Two reasons, both practical:
her posts stay canonical on Medium, so the two copies don't compete with each
other in search results and split her traffic; and she keeps whatever reach and
followers Medium gives her instead of quietly abandoning it. The teasers are
built from the RSS feed, so if she publishes a new post, re-running the fetch
picks it up automatically.

If she'd rather host the writing here outright, that's her call to make and it's
a small change — but do it properly: move the posts over, add a canonical link on
the Medium versions pointing here, or delete them there. Having both live at full
length is the one option worth avoiding.

To refresh after she publishes something new:

```bash
curl -sL "https://medium.com/feed/@wistyuki" -o medium-feed.xml
```

### 3. Testimonials
There are none anywhere, so there's no section for them. If she has even three
messages from happy clients (with permission to quote), that's worth adding.

### 4. Per-service booking links
All book buttons currently point at the appointments list, not directly at the
specific service. Square's booking buttons are JavaScript-driven with no plain
URLs to copy, so deep links couldn't be extracted from the page. She can get
them from her Square dashboard — each service has its own booking URL. Swap them
into the `href` on each card's book button and the flow gets one click shorter.

### 5. Two small edits I already made
- Fixed a typo in the "deep clean" description: *dieties* → **deities**.
- The blog section lists her six Medium post titles but links to her profile
  rather than each post, because Medium post URLs weren't retrievable. Real
  per-post links can be pasted in if she wants them.

---

## The free guides

Five printable workbooks in `guides/`, indexed on `resources.html`:

| file | what it is |
|---|---|
| `breathing.html` | box breathing, the long exhale, the double sigh |
| `meditation.html` | five minutes, and what to do when the mind wanders |
| `catastrophic-thinking.html` | the long CBT one — catch, name, test, redirect |
| `new-job.html` | nerves before or during a new job |
| `breakup.html` | the loops and grief after a relationship ends |

**Every one renders two ways from a single file.** The screen version is the
branded dark one; *printer friendly* switches to black-and-white with real ruled
lines to write on. There's a toggle in each guide, the resources page links
straight to the B&W view with `?print`, and printing always uses it regardless.
That's done with CSS custom properties — `assets/workbook.css` has one set of
component rules and two token blocks, so the two versions can't drift apart.

The questions are deliberately short — averaging six to nine words — because
that's how CBT worksheets actually work. A question you can answer in one line
gets answered; a paragraph-long prompt gets skipped.

Content is written from ordinary, widely-taught CBT technique: noticing a
thought, naming the distortion, testing it against evidence, writing a steadier
replacement. Nothing is copied from any published workbook.

**Every guide carries a disclaimer** that it isn't therapy or medical care. The
three that touch real distress — the spiral, new job, breakup — also carry a
crisis line (988 in the US). Please keep both if the guides get edited. Free
mental-health material from a non-clinician needs them, and it protects her too.

## Brand assets

`brand.html` is the one-page brand sheet: every logo variant with a download
link, the colour palette with hex values and what each is for, and type
specimens for all three faces.

The mark ships as `brand/mark-gold.svg` (the default), plus solid black and
white cuts for print and embroidery, a heavier small-size cut, and a favicon.
All pure vector with no font dependency, so they stay sharp at any size.

There is no wordmark SVG on purpose. "Yūki's Sacred Space" is Metamorphous set
live in HTML — turning it into a file would mean converting the letters to
outlines in a vector editor, which is worth doing only if she ever needs it for
signage or merch.

## Deploying (all free)

**Easiest:** drag the `D:\Yuki` folder onto <https://app.netlify.com/drop>.
Live in about ten seconds, gets a free URL, no account strictly required.

**Also good:** Cloudflare Pages or GitHub Pages. All three serve static files
free and handle HTTPS automatically.

**Custom domain:** if she buys `yukisacredspace.com` (or similar), point it at
whichever host above. Keep the Square site exactly where it is — the new site
just links to it. Nothing breaks.

---

## Design notes

- **Fonts:** Metamorphous for display, Cormorant Garamond for body, Shippori
  Mincho B1 for the Japanese. Metamorphous is what her Square site already used,
  so the new site still reads as *hers*.
- **Palette:** warm near-black `#191317`, antique gold `#D4A94A`, plum `#8A4670`.
  Built out from the mauve-brown her Square theme already used. Body text sits at
  5.4:1 contrast or better against the background.
- **Accessibility:** skip link, visible focus rings, labelled screen-reader text
  on every book button (so they don't all just announce "book"), full
  `prefers-reduced-motion` support, and a print stylesheet.

### The background layers

Five fixed layers stack behind the page, back to front: the aura canvas, the
centring spine, the kanji, the spiders, then a film grain. All are
`pointer-events: none` and sit below every piece of real content.

**The spine** is a narrow centring line down the middle — 93px on a laptop, 64px
on a phone. The fill sits just under the page background (luminance 17.6 against
the background's 20.6) and is translucent, so the aura still bleeds through
rather than leaving a dead flat band. Both edges are hard 1px rules in `#0F0F0F`,
opaque so they stay crisp against the varying fill. The kanji column is wider
than the line and deliberately overflows it on both sides. Width and colours are
on `.spine` in `styles.css`.

**The kanji — 未来の私のために** reads *mirai no watashi no tame ni*: **"for my
future self."** It runs top-to-bottom via `writing-mode: vertical-rl`, ghosted at
about 5% opacity. It's marked `aria-hidden` so screen readers don't announce
untranslated Japanese at someone — it's a watermark, not content.

The column is deliberately taller than the screen (about 1.6× on a laptop), so
it's anchored to the top rather than centred and runs off the bottom. As you
scroll the page it travels by exactly its own overflow: 未 sits flush at the top
of the screen when you land, and に sits flush at the bottom by the time you
reach the footer, so the whole phrase reads through once per visit.

To change the phrase, edit the one `<span lang="ja">` in `index.html`. To resize
it, change `font-size` on `.kanji span` — the scroll travel is derived from the
height, so it stays correct at any size. To change how visible it is, change
`opacity` on `.kanji span`; there's a separate, slightly fainter value in the
`620px` media query, because the strokes are proportionally much heavier on a
phone.

**The spiders** each pick a spot along the top of the screen, descend slowly,
hang for a few seconds, then climb back up out of view before waiting and going
again. Depth is random between 340px and 85% of the screen height, so they spread
down the page rather than clustering at the top. Position is weighted to the
outer thirds — the middle third comes up only about 10% of the time, to keep them
off the text. The silk pays out of the abdomen, which is why they hang head-down.
Three of them, one hidden on phones. Typically two are on screen at once.

Their colour is `--spider` in `styles.css`, set to the exact midpoint between the
body text and the background so they stay legible without competing with
anything.

**Speed is `DROP_SPEED` / `RISE_SPEED` in `assets/main.js`, in pixels per
millisecond — lower is slower.** Durations are *derived* from these and the
distance travelled, deliberately: if you set duration directly and also randomise
the depth, the two cancel out and the apparent speed never changes no matter what
numbers you pick. Change these constants to retime the spiders; change `depth` to
change how far they go, without affecting how fast they look.

Both respect reduced-motion: the aura switches off, the spiders stop cycling and
one hangs still, and the kanji stops drifting.

Verified at 375px and 1310px wide: no horizontal overflow, no overlapping or
clipped text at either scroll extreme, all tap targets at least 40px tall, no
console errors, and the Japanese face confirmed rendering rather than silently
falling back to a system serif.
