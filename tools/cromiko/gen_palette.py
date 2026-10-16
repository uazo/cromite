"""Rewrites Chromium's color_palette.xml with the CromIKO brand palette.

Used to produce the color_palette.xml part of build/patches/CromIKO-Theme.patch.
Re-run it on a fresh upstream file after a Chromium rebase, or after changing
the brand colors below:

  pip install materialyoucolor
  python3 gen_palette.py ~/chromium/src/ui/android/java/res/values/color_palette.xml

The file is edited in place.

Brand colors sampled from the CromIKO logo:
  periwinkle accent  #5C7CFC
  charcoal           #1E2024
  white              #FFFFFF
"""
import re
import sys

from materialyoucolor.hct import Hct
from materialyoucolor.palettes.tonal_palette import TonalPalette
from materialyoucolor.utils.color_utils import argb_from_rgb


def argb(hexstr):
    s = hexstr.lstrip('#')
    return argb_from_rgb(int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


def rgb(a):
    return ((a >> 16) & 0xFF, (a >> 8) & 0xFF, a & 0xFF)


def hexs(a):
    return '#%02X%02X%02X' % rgb(a)


BRAND_ACCENT = Hct.from_int(argb('5C7CFC'))
BRAND_CHARCOAL = '#1E2024'
CHARCOAL = Hct.from_int(argb(BRAND_CHARCOAL))

PALETTES = {
    'primary': TonalPalette.from_hue_and_chroma(BRAND_ACCENT.hue, BRAND_ACCENT.chroma),
    'secondary': TonalPalette.from_hue_and_chroma(BRAND_ACCENT.hue, 32),
    'neutral': TonalPalette.from_hue_and_chroma(CHARCOAL.hue, 4),
    'neutral_variant': TonalPalette.from_hue_and_chroma(CHARCOAL.hue, 8),
}
# Light surfaces sit between the charcoal and accent hues; dark surfaces
# follow the charcoal so that surface_container_dark is the logo charcoal.
SURFACE_LIGHT = TonalPalette.from_hue_and_chroma((CHARCOAL.hue + BRAND_ACCENT.hue) / 2, 6)
SURFACE_DARK = TonalPalette.from_hue_and_chroma(CHARCOAL.hue, CHARCOAL.chroma)

# Tertiary (green, also used as google_green_*) and error stay untouched so
# that success/error semantics keep their usual meaning.
UNTOUCHED = ('baseline_tertiary_', 'baseline_error_')


def tone_color(palette, tone):
    if palette == 'neutral' and tone == 10:
        # The logo charcoal is used verbatim (it is HCT tone ~12, exactly where
        # the upstream neutral_10 #1F1F1F sits).
        return BRAND_CHARCOAL
    return hexs(PALETTES[palette].tone(tone))


SURFACES = {
    'gm3_baseline_surface_tint_light': hexs(
        Hct.from_hct(BRAND_ACCENT.hue, 40, 58).to_int()),
    'gm3_baseline_surface_tint_dark': hexs(
        Hct.from_hct(BRAND_ACCENT.hue, 16, 89).to_int()),
    'gm3_baseline_surface_light': '#FFFFFF',
    'gm3_baseline_surface_container_low_light': hexs(SURFACE_LIGHT.tone(98)),
    'gm3_baseline_surface_container_light': hexs(SURFACE_LIGHT.tone(96)),
    'gm3_baseline_surface_container_high_light': hexs(SURFACE_LIGHT.tone(94)),
    'gm3_baseline_surface_container_highest_light': hexs(SURFACE_LIGHT.tone(90)),
    'gm3_baseline_surface_dim_light': hexs(SURFACE_LIGHT.tone(87)),
    'gm3_baseline_surface_dark': hexs(SURFACE_DARK.tone(6)),
    'gm3_baseline_surface_container_low_dark': hexs(SURFACE_DARK.tone(10)),
    'gm3_baseline_surface_container_dark': BRAND_CHARCOAL,
    'gm3_baseline_surface_container_high_dark': hexs(SURFACE_DARK.tone(17)),
    'gm3_baseline_surface_container_highest_dark': hexs(SURFACE_DARK.tone(22)),
    'gm3_baseline_surface_bright_dark': hexs(SURFACE_DARK.tone(24)),
}

LINE_RE = re.compile(r'^(\s*<color name=")([a-z0-9_]+)("[^>]*>)([^<]*)(</color>.*)$')
TONE_RE = re.compile(r'^baseline_(primary|secondary|neutral_variant|neutral)_(\d+)$')
ALPHA_RE = re.compile(r'^(baseline_[a-z_]+?_\d+)_alpha_(\d+)$')
BLEND_RE = re.compile(r'^(baseline_[a-z_]+?_\d+|baseline_[a-z0-9_]+?)_with_'
                      r'(neutral_variant_\d+|neutral_\d+|surface_tint_light|surface_tint_dark)'
                      r'_alpha_(\d+)$')


def blend(base_hex, over_hex, percent):
    b = rgb(argb(base_hex))
    o = rgb(argb(over_hex))
    a = percent / 100.0
    return '#%02X%02X%02X' % tuple(round(bc * (1 - a) + oc * a) for bc, oc in zip(b, o))


def main(path):
    lines = open(path, encoding='utf-8').read().split('\n')
    resolved = {}

    def lookup(name):
        if name in resolved:
            return resolved[name]
        if name in ('baseline_primary_100', 'baseline_neutral_100'):
            return '#FFFFFF'
        if name == 'baseline_neutral_0':
            return '#000000'
        raise KeyError(name)

    def compute(name, old):
        if name.startswith(UNTOUCHED) or old.startswith('@'):
            return None
        if name in SURFACES:
            return SURFACES[name]
        m = TONE_RE.match(name)
        if m:
            return tone_color(m.group(1), int(m.group(2)))
        m = BLEND_RE.match(name)
        if m:
            base, over, pct = m.group(1), m.group(2), int(m.group(3))
            if over.startswith('surface_tint'):
                over_hex = resolved['gm3_baseline_' + over]
            elif base.startswith('baseline_secondary_'):
                # Upstream's secondary_*_with_* values are actually produced by
                # overlaying secondary_10 (verified against the original hex
                # values), so keep that relationship rather than the name.
                over_hex = lookup('baseline_secondary_10')
            else:
                over_hex = lookup('baseline_' + over)
            return blend(lookup(base), over_hex, pct)
        m = ALPHA_RE.match(name)
        if m:
            alpha = old[1:3]
            assert len(old) == 9, (name, old)
            return '#' + alpha + lookup(m.group(1))[1:]
        return None

    # Two passes: plain tones and surfaces first, then derived colors that
    # reference them (e.g. *_with_surface_tint_* appears before the tint).
    for pass_no in (0, 1):
        for i, line in enumerate(lines):
            m = LINE_RE.match(line)
            if not m:
                continue
            name, old = m.group(2), m.group(4)
            derived = bool(ALPHA_RE.match(name) or BLEND_RE.match(name))
            if derived != bool(pass_no):
                continue
            new = compute(name, old)
            if new is None:
                continue
            resolved[name] = new
            lines[i] = m.group(1) + name + m.group(3) + new + m.group(5)

    open(path, 'w', encoding='utf-8').write('\n'.join(lines))


if __name__ == '__main__':
    main(sys.argv[1])
