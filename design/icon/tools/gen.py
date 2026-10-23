# -*- coding: utf-8 -*-
"""ADB Desk 应用图标生成器。

概念：图标外壳本身就是「设备的屏幕」，内部只有终端提示符 `>_`。
不画具体机身，因此对手机 / 平板 / 车机 / TV 同样成立。

输出：icon.svg（主稿）、alt-inverse.svg（配色反向，供比对）
运行： python gen.py
"""
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)

CX = CY = 512
TILE_A = 428       # 超椭圆半径（四周留 84px 安全边）
N = 5.0            # 超椭圆指数，接近 Apple squircle 观感

ACCENT = '#2B49F5'


def squircle(cx, cy, a, n=N, steps=180):
    pts = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        ct, st = math.cos(t), math.sin(t)
        x = cx + a * math.copysign(abs(ct) ** (2 / n), ct)
        y = cy + a * math.copysign(abs(st) ** (2 / n), st)
        pts.append((x, y))
    return 'M' + ' L'.join(f'{x:.2f} {y:.2f}' for x, y in pts) + ' Z'


# ------------------------------------------------------------------ 几何
# 折线 = 提示符，竖条 = 终端里的插入光标。两者光学居中对齐（中心均为 512）
STROKE = 104
CHEV_X = 380              # 折线转折点；外沿 328，与光标右沿 696 关于 512 对称
CHEV_DX = 140
TOP_Y, MID_Y, BOT_Y = 344, 512, 680
CUR_X, CUR_W, CUR_H = 600, 96, 252
CUR_R = 30


def glyph(chev, cursor):
    return f'''<path d="M{CHEV_X} {TOP_Y} L{CHEV_X + CHEV_DX} {MID_Y} L{CHEV_X} {BOT_Y}"
          fill="none" stroke="{chev}" stroke-width="{STROKE}"
          stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="{CUR_X}" y="{MID_Y + 12 - CUR_H / 2}" width="{CUR_W}" height="{CUR_H}"
          rx="{CUR_R}" fill="{cursor}"/>'''


DEFS = f'''  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0.55" y2="1">
      <stop offset="0" stop-color="#2B3343"/>
      <stop offset="0.5" stop-color="#161A23"/>
      <stop offset="1" stop-color="#0A0C11"/>
    </linearGradient>
    <radialGradient id="sheen" cx="0.22" cy="0.1" r="0.85">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.15"/>
      <stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0.03"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow" cx="0.5" cy="1.05" r="0.78">
      <stop offset="0" stop-color="#3555FF" stop-opacity="0.30"/>
      <stop offset="0.55" stop-color="#3555FF" stop-opacity="0.07"/>
      <stop offset="1" stop-color="#3555FF" stop-opacity="0"/>
    </radialGradient>
    <filter id="lift" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
    <clipPath id="tileClip"><path d="{squircle(CX, CY, TILE_A)}"/></clipPath>
  </defs>'''


def tile(layers):
    a2 = TILE_A - 1.6
    return f'''  <g>
    <g clip-path="url(#tileClip)">
      <rect x="84" y="84" width="856" height="856" fill="url(#tile)"/>
      <rect x="84" y="84" width="856" height="856" fill="url(#sheen)"/>
      <rect x="84" y="84" width="856" height="856" fill="url(#glow)"/>
      {layers}
    </g>
    <path d="{squircle(CX, CY, a2)}" fill="none" stroke="#FFFFFF" stroke-opacity="0.13" stroke-width="3"/>
  </g>'''


def svg(layers):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="ADB Desk">
{DEFS}
{tile(layers)}
</svg>
'''


if __name__ == '__main__':
    with open(os.path.join(OUT, 'icon.svg'), 'w', encoding='utf-8') as f:
        f.write(svg(glyph('#FFFFFF', ACCENT)))
    print('wrote icon.svg')
