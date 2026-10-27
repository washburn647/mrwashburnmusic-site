"""Mr. Washburn Music logo: MWM monograms (round 2) and a W of three upside
down eighth notes (round 3), in earthy greens.

Monograms are drawn as round-capped strokes (y-down, cap height H). The
wordmark under them is Fredoka SemiBold (OFL) converted to outlines, so the
SVGs need no font.
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

FONT = TTFont(sys.argv[1])
OUT = sys.argv[2]
GS, CMAP = FONT.getGlyphSet(), FONT.getBestCmap()

FOREST, MOSS, SAGE, CREAM, WHEAT = "#2F4A3A", "#5E7D4F", "#9DB58C", "#F6F1E4", "#D9B26F"
H, SW = 600, 104


def poly(pts, color, sw=SW, extra=""):
    d = "M" + " L".join(f"{x:.0f} {y:.0f}" for x, y in pts)
    return (f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}" '
            f'stroke-linecap="round" stroke-linejoin="round"{extra}/>')


def ligature(u=92):
    """M, W and M share their stems, so the three letters run as one line.
    The stems and the M's belong to forest green, the W's strokes to moss."""
    B, T, m, w = H, 0, H * 0.62, H * 0.40
    m1 = [(0, B), (0, T), (2 * u, m), (4 * u, T), (4 * u, B)]
    wv = [(4 * u, B), (6 * u, w), (8 * u, B)]
    m2 = [(8 * u, B), (8 * u, T), (10 * u, m), (12 * u, T), (12 * u, B)]
    return poly(wv, MOSS) + poly(m1, FOREST) + poly(m2, FOREST), 12 * u


def interlock():
    """An M over a W: the W drops below so its middle peak threads through
    the M's V, woven over-under."""
    off = 250
    M = [(0, H), (0, 0), (300, H * 0.62), (600, 0), (600, H)]
    W = [(-170, off - 60), (90, H + off), (300, off + H * 0.22), (510, H + off), (770, off - 60)]
    gap = SW + 40
    s = poly(W, MOSS)
    s += poly(M, CREAM, gap) + poly(M, FOREST)
    # The W's inner strokes pass back over the M's V.
    for seg in (W[1:3], W[2:4]):
        s += poly(seg, CREAM, gap) + poly(seg, MOSS)
    return f'<g transform="translate(170 0)">{s}</g>', 940


def staff_badge():
    """MWM side by side sitting on a five-line staff inside a round badge."""
    R = 560
    s = f'<circle cx="{R}" cy="{R}" r="{R}" fill="{FOREST}"/>'
    s += f'<circle cx="{R}" cy="{R}" r="{R - 34}" fill="none" stroke="{WHEAT}" stroke-width="14"/>'
    for i in range(5):
        y = R - 210 + i * 105
        s += f'<line x1="120" y1="{y}" x2="{2 * R - 120}" y2="{y}" stroke="{SAGE}" stroke-width="7" opacity=".6"/>'
    sc, w = 0.52, 0
    letters = [("M", CREAM), ("W", WHEAT), ("M", CREAM)]
    widths = 460
    total = 3 * widths * sc + 2 * 40
    x = R - total / 2
    for ch, col in letters:
        if ch == "M":
            pts = [(0, H), (0, 0), (230, H * 0.64), (460, 0), (460, H)]
        else:
            pts = [(0, 0), (110, H), (230, H * 0.36), (350, H), (460, 0)]
        s += f'<g transform="translate({x:.0f} {R - H * sc / 2:.0f}) scale({sc})">{poly(pts, col, 130)}</g>'
        x += widths * sc + 40
    return s, 2 * R


NOTE_RX, NOTE_RY, STEM, BEAM = 100, 70, 60, 104


def stem_x(cx):
    """A downward stem leaves from the head's left side, as in engraving."""
    return cx - NOTE_RX + STEM / 2 + 6


def head(cx, cy, color):
    return (f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="{NOTE_RX}" ry="{NOTE_RY}" fill="{color}" '
            f'transform="rotate(-22 {cx:.0f} {cy:.0f})"/>')


def meet(p, d, q, e):
    """Where the line through p along d crosses the line through q along e."""
    t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / (d[0] * e[1] - d[1] * e[0])
    return p[0] + t * d[0], p[1] + t * d[1]


def note_w(slant=0, peak=0.42, color=FOREST):
    """Three beamed eighth notes turned upside down, heads on top, so the
    stems and the bent beam draw a W. slant > 0 leans the outer stems in.
    The outer stems and the beam are one outline, so the stems end flush with
    the beam's lower edge. Returns the mark, its width and its height."""
    head_y, gap, base = 70, 330, H + 60
    xs = [NOTE_RX + i * gap for i in range(3)]
    top_y = head_y + 10
    mid = (stem_x(xs[1]), H * peak + 60)
    out = []
    for side, cx in ((-1, xs[0]), (1, xs[2])):
        top = (stem_x(cx), top_y)
        tip = (top[0] - side * slant, base)
        d = (tip[0] - top[0], tip[1] - top[1])
        n = (d[1], -d[0])
        k = side * STEM / 2 / (n[0] ** 2 + n[1] ** 2) ** 0.5
        outer = (top[0] + k * n[0], top[1] + k * n[1])
        inner = (top[0] - k * n[0], top[1] - k * n[1])
        e = (mid[0] - tip[0], mid[1] - tip[1])
        lo = meet(outer, d, tip, e)
        # The inner stem edge stops at the beam's upper edge.
        hi_in = meet(inner, d, (tip[0], tip[1] - BEAM), e)
        out.append((outer, inner, lo, hi_in))
    (lo_o, lo_i, lo_b, lo_h), (ro_o, ro_i, ro_b, ro_h) = out
    pts = [lo_i, lo_o, lo_b, mid, ro_b, ro_o, ro_i, ro_h,
           (mid[0], mid[1] - BEAM), lo_h]
    d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"
    s = f'<path d="{d}" fill="{color}"/>'
    s += (f'<line x1="{mid[0]:.0f}" y1="{top_y}" x2="{mid[0]:.0f}" y2="{mid[1] - BEAM / 2:.0f}" '
          f'stroke="{color}" stroke-width="{STEM}"/>')
    s += "".join(head(cx, head_y, color) for cx in xs)
    return s, xs[2] + NOTE_RX, base


def note_badge(**kw):
    """The note W in cream on the round forest badge of option C."""
    R = 560
    mark, mw, mh = note_w(color=CREAM, **kw)
    sc = 620 / mw
    s = f'<circle cx="{R}" cy="{R}" r="{R}" fill="{FOREST}"/>'
    s += f'<circle cx="{R}" cy="{R}" r="{R - 34}" fill="none" stroke="{WHEAT}" stroke-width="14"/>'
    s += f'<g transform="translate({R - mw * sc / 2:.0f} {R - mh * sc / 2:.0f}) scale({sc:.3f})">{mark}</g>'
    return s, 2 * R


def text_path(text, color, tracking=8):
    out, x = [], 0
    for ch in text:
        if ch == " ":
            x += 250
            continue
        name = CMAP[ord(ch)]
        pen = SVGPathPen(GS)
        GS[name].draw(pen)
        out.append(f'<path transform="translate({x} 0)" d="{pen.getCommands()}" fill="{color}"/>')
        x += GS[name].width + tracking
    return "".join(out), x - tracking


def lockup(mark, mark_w, mark_h, name, words=True, pad=80):
    """Monogram centred above the wordmark."""
    parts, height = [], mark_h
    width = mark_w
    if words:
        txt, tw = text_path("Mr. Washburn Music", FOREST)
        tscale = min(1.0, (mark_w * 1.5) / tw)
        tw_s = tw * tscale
        width = max(mark_w, tw_s)
        ty = mark_h + 150 + 700 * tscale
        parts.append(f'<g transform="translate({(width - tw_s) / 2:.0f} {ty:.0f}) scale({tscale:.3f} {-tscale:.3f})">{txt}</g>')
        height = ty + 220 * tscale
    parts.insert(0, f'<g transform="translate({(width - mark_w) / 2:.0f} 0)">{mark}</g>')
    vw, vh = width + 2 * pad + SW, height + 2 * pad + SW
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw:.0f} {vh:.0f}" role="img" '
           f'aria-label="Mr. Washburn Music"><title>Mr. Washburn Music</title>'
           f'<g transform="translate({pad + SW / 2:.0f} {pad + SW / 2:.0f})">{"".join(parts)}</g></svg>')
    open(f"{OUT}/{name}.svg", "w").write(svg)


def icon(mark, mark_w, mark_h, name, bg=CREAM, size=1000):
    sc = 640 / max(mark_w, mark_h)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" role="img" aria-label="Mr. Washburn Music">'
           f'<rect width="{size}" height="{size}" rx="220" fill="{bg}"/>'
           f'<g transform="translate({(size - mark_w * sc) / 2:.0f} {(size - mark_h * sc) / 2:.0f}) scale({sc:.3f})">{mark}</g></svg>')
    open(f"{OUT}/{name}.svg", "w").write(svg)


if __name__ == "__main__":
    lig, lw = ligature()
    lockup(lig, lw, H, "option-a-ligature")
    icon(lig, lw, H, "option-a-icon")
    inter, iw = interlock()
    lockup(inter, iw, H + 250, "option-b-interlock")
    icon(inter, iw, H + 250, "option-b-icon")
    badge, bw = staff_badge()
    lockup(badge, bw, bw, "option-c-badge")
    icon(badge, bw, bw, "option-c-icon", bg="none")
    slanted = {"slant": 70, "peak": 0.58}
    for name, kw in (("option-d-notes", {}), ("option-e-notes-slant", slanted)):
        notes, nw, nh = note_w(**kw)
        lockup(notes, nw, nh, name)
        icon(notes, nw, nh, name + "-icon")
    nb, nbw = note_badge(**slanted)
    lockup(nb, nbw, nbw, "option-f-notes-badge")
    icon(nb, nbw, nbw, "option-f-notes-badge-icon", bg="none")
    print("ok")
