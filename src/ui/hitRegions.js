// Clickable rectangles in canvas pixels. Screens add them as they draw; the topmost (last added) wins.
export function createHitRegions() {
  let list = [];
  return {
    clear() { list = []; },
    add(x, y, w, h, action) { list.push({ x, y, w, h, action }); },
    at(px, py) {
      for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i];
        if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return r.action;
      }
      return null;
    },
  };
}

// Client (CSS) coordinates to canvas pixels, given the canvas' bounding rect and its logical size.
export function toCanvas(clientX, clientY, rect, viewW, viewH) {
  return {
    x: (clientX - rect.left) * (viewW / rect.width),
    y: (clientY - rect.top) * (viewH / rect.height),
  };
}
