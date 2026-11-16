# -*- coding: utf-8 -*-
"""生成商机管家的 PWA 图标（蓝色渐变背景 + 白色漏斗图案）。"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
os.makedirs(OUT, exist_ok=True)


def funnel_icon(size, padding, rounded, path):
    S = 4  # 超采样倍数（抗锯齿）
    W = size * S
    pad = int(W * padding)
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 垂直渐变背景：浅蓝 -> 深蓝
    top = (59, 130, 246)
    bottom = (30, 64, 175)
    for y in range(W):
        t = y / (W - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (W, y)], fill=c + (255,))

    if rounded:
        r = int(W * 0.22)
        mask = Image.new('L', (W, W), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, W - 1], radius=r, fill=255)
        img.putalpha(mask)

    # 白色漏斗（上宽下窄的梯形）
    y0 = int(W * 0.24)
    y1 = int(W * 0.84)
    half_top = (W - 2 * pad) * 0.36
    half_bot = half_top * 0.30
    x0t, x1t = W / 2 - half_top, W / 2 + half_top
    x0b, x1b = W / 2 - half_bot, W / 2 + half_bot
    d.polygon([(x0t, y0), (x1t, y0), (x1b, y1), (x0b, y1)], fill=(255, 255, 255, 255))

    # 漏斗内部的三条分隔线（代表商机阶段）
    for fy in (0.42, 0.58, 0.74):
        y = y0 + (y1 - y0) * fy
        t = (y - y0) / (y1 - y0)
        xl = x0t + (x0b - x0t) * t
        xr = x1t + (x1b - x1t) * t
        d.line([(xl, y), (xr, y)], fill=(30, 64, 175, 255), width=int(W * 0.035))

    # 漏斗出口处的小白点（"成交"）
    r0 = int(W * 0.030)
    cy = int(W * 0.905)
    d.ellipse([W / 2 - r0, cy - r0, W / 2 + r0, cy + r0], fill=(255, 255, 255, 255))

    img = img.resize((size, size), Image.LANCZOS)
    img.save(path, 'PNG')
    print('generated:', path)


if __name__ == '__main__':
    funnel_icon(192, 0.16, True,  os.path.join(OUT, 'icon-192.png'))
    funnel_icon(512, 0.16, True,  os.path.join(OUT, 'icon-512.png'))
    funnel_icon(512, 0.30, False, os.path.join(OUT, 'icon-512-maskable.png'))
    print('done')
