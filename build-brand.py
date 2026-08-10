# -*- coding: utf-8 -*-
"""
Writes the brand mark out as standalone SVG files in brand/.

The mark is pure vector with no font dependency, so these files render
identically anywhere. The wordmark is Metamorphous set live in HTML — see
brand.html for why there's no wordmark SVG here.
"""
import io, os

OUT = 'brand'
if not os.path.isdir(OUT):
    os.makedirs(OUT)

MARK = u'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="{px}" height="{px}" role="img" aria-label="Yuki's Sacred Space mark">
  <title>Yūki's Sacred Space</title>
  <circle cx="24" cy="24" r="21" fill="none" stroke="{ring}" stroke-width="1" opacity="{ro}"/>
  <circle cx="24" cy="24" r="14.5" fill="none" stroke="{ring}" stroke-width="1" opacity="{ri}"/>
  <path d="M29.5 13.4a12 12 0 1 0 0 21.2 13.6 13.6 0 0 1 0-21.2Z" fill="{fill}" opacity="{mo}"/>
  <circle cx="24" cy="1.9" r="1.9" fill="{fill}" opacity="{do}"/>
  <circle cx="24" cy="46.1" r="1.5" fill="{fill}" opacity="{do}"/>
  <circle cx="1.9" cy="24" r="1.5" fill="{fill}" opacity="{do}"/>
  <circle cx="46.1" cy="24" r="1.5" fill="{fill}" opacity="{do}"/>
</svg>
'''

VARIANTS = {
    # on-brand, as used across the site
    'mark-gold':  dict(ring='#D4A94A', fill='#D4A94A', ro='.75', ri='.32', mo='.9', do='.6', px=256),
    # solid one-colour cuts for print, stamps, embroidery, favicons
    'mark-black': dict(ring='#000000', fill='#000000', ro='1', ri='1', mo='1', do='1', px=256),
    'mark-white': dict(ring='#FFFFFF', fill='#FFFFFF', ro='1', ri='1', mo='1', do='1', px=256),
    # small-size cut: heavier, no faint strokes that vanish under 32px
    'mark-black-small': dict(ring='#000000', fill='#000000', ro='1', ri='1', mo='1', do='1', px=64),
}

for name, v in VARIANTS.items():
    p = os.path.join(OUT, name + '.svg')
    io.open(p, 'w', encoding='utf-8').write(MARK.format(**v))
    print('wrote %-34s' % p)

# favicon.svg is NOT generated here. The full mark's 1px rings vanish below
# ~32px, which is exactly where a favicon lives, so it uses a deliberately
# bolder cut kept as a hand-authored file. See brand/favicon.svg, and derive
# the .ico / .png sizes from it rather than from mark-gold.svg.
