// Colour helpers. Model colours are 0xRRGGBB; pixel buffers are Uint32 ABGR (canvas byte order).
const ch = (c, s) => (c >> s) & 255;

export const shade = (c, f) =>
  (Math.min(255, Math.round(ch(c, 16) * f)) << 16) | (Math.min(255, Math.round(ch(c, 8) * f)) << 8) | Math.min(255, Math.round(ch(c, 0) * f));

export const mix = (a, b, t) => {
  const m = s => Math.round(ch(a, s) * (1 - t) + ch(b, s) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
};

export const abgr = c => (0xff000000 | (ch(c, 0) << 16) | (c & 0xff00) | ch(c, 16)) >>> 0;
export const rgbOf = v => (ch(v, 0) << 16) | (v & 0xff00) | ch(v, 16);
