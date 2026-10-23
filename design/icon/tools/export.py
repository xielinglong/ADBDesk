# -*- coding: utf-8 -*-
"""导出成品：光栅组 + .ico + .icns。

依赖 tools/render.mjs 已生成 _out/icon-<size>.png
"""
import os
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, '_out')
PNG = os.path.join(ROOT, 'png')
os.makedirs(PNG, exist_ok=True)

SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256, 512, 1024]


def read(size):
    with open(os.path.join(OUT, f'icon-{size}.png'), 'rb') as f:
        return f.read()


def build_ico(sizes, dst):
    """ICONDIR + 每个条目内嵌 PNG（Vista 起支持）。"""
    blobs = [read(s) for s in sizes]
    header = struct.pack('<HHH', 0, 1, len(sizes))
    offset = 6 + 16 * len(sizes)
    entries, body = b'', b''
    for s, blob in zip(sizes, blobs):
        dim = 0 if s >= 256 else s
        entries += struct.pack('<BBBBHHII', dim, dim, 0, 0, 1, 32, len(blob), offset)
        body += blob
        offset += len(blob)
    data = header + entries + body
    with open(dst, 'wb') as f:
        f.write(data)
    return len(data)


def build_icns(sizes, dst):
    """icns 容器：每个 PNG 一个 chunk，按 4 字节对齐。"""
    codes = {16: b'icp4', 32: b'icp5', 64: b'icp6', 128: b'ic07',
             256: b'ic08', 512: b'ic09', 1024: b'ic10'}
    chunks = b''
    for s in sizes:
        blob = read(s)
        payload = codes[s] + struct.pack('>I', len(blob) + 8) + blob
        if len(payload) % 4:
            payload += b'\x00' * (4 - len(payload) % 4)
        chunks += payload
    data = b'icns' + struct.pack('>I', len(chunks) + 8) + chunks
    with open(dst, 'wb') as f:
        f.write(data)
    return len(data)


if __name__ == '__main__':
    total = 0
    for s in SIZES:
        blob = read(s)
        with open(os.path.join(PNG, f'icon-{s}.png'), 'wb') as f:
            f.write(blob)
        total += len(blob)
    ico = build_ico([16, 20, 24, 32, 40, 48, 64, 128, 256], os.path.join(ROOT, 'icon.ico'))
    icns = build_icns([16, 32, 64, 128, 256, 512, 1024], os.path.join(ROOT, 'icon.icns'))
    print(f'png × {len(SIZES)}  {total / 1024:.0f} KB')
    print(f'icon.ico  {ico / 1024:.0f} KB')
    print(f'icon.icns {icns / 1024:.0f} KB')
