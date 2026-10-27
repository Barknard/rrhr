// 9x9 pixel icons for the weapons, nitro and the bomb, shared by the combo screen and the race HUD so
// what you pick is what you see in the race. Each row is 9 characters: '.' empty, letters index the palette.
const ICONS = {
  arc: { pal: { a: '#e9fdff', b: '#29e3ff', c: '#1f6fb0' }, rows: [
    '....bbb..', '...bab...', '..bab....', '.bbaabb..', '..bbaab..', '....bab..', '...bab...', '..bab....', '..bb.....'] },
  saw: { pal: { a: '#ffffff', b: '#c9cfd9', c: '#5b5f69' }, rows: [
    '..a.b.a..', '.abbbbba.', '.bbcccbb.', 'abccccbba', '.bcc.ccb.', 'abccccbba', '.bbcccbb.', '.abbbbba.', '..a.b.a..'] },
  harpoon: { pal: { a: '#e8e8e8', b: '#9aa0ad', c: '#c9b48a' }, rows: [
    '......aa.', '.....aaa.', '....baaa.', '...bbaa..', '..cbb.a..', '.cc......', 'cc.......', 'c........', '.........'] },
  mine: { pal: { a: '#ff3b5c', b: '#1d1d22', c: '#b14dff', d: '#5a5f6a' }, rows: [
    '....a....', '...dad...', '.cbbbbbc.', 'cbbdbdbbc', 'cbdbbbdbc', 'cbbdbdbbc', '.cbbbbbc.', '..ccccc..', '.........'] },
  napalm: { pal: { a: '#fff3a0', b: '#ffb21e', c: '#ff3d00', d: '#8a1e0c' }, rows: [
    '....c....', '...cc....', '...cbc.c.', '..cbbcc..', '.cbbabcc.', '.cbaaabc.', 'ccbaaabcc', 'dcbbbbbcd', '.ddddddd.'] },
  nitro: { pal: { a: '#ffffff', b: '#29e3ff', c: '#1f6fb0', d: '#ffb21e' }, rows: [
    '...aaa...', '..bbbbb..', '..bacbb..', '..bacbb..', '..bacbb..', '..bbbbb..', '..ccccc..', '...ddd...', '....d....'] },
  bomb: { pal: { a: '#ffe14a', b: '#111111', c: '#3a3a44', d: '#ff3b5c' }, rows: [
    '......a.d', '.....b...', '...bbbb..', '..bbbbbb.', '.bbcbbbbb', '.bcbbbbbb', '.bbbbbbbb', '..bbbbbb.', '...bbbb..'] },
};

export const ICON_SIZE = 9;

export function drawIcon(ctx, key, x, y, scale = 1) {
  const icon = ICONS[key];
  if (!icon) return;
  x = Math.round(x); y = Math.round(y);
  icon.rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const col = icon.pal[row[c]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
    }
  });
}

// What each weapon does, in a line short enough for the combo screen.
export const WEAPON_INFO = {
  arc: 'LIGHTNING THAT CHAINS TO NEARBY CARS',
  saw: 'A BLADE THAT RICOCHETS OFF WALLS',
  harpoon: 'HOOKS THE CAR AHEAD, REELS YOU IN, SPINS THEM',
  mine: 'DROPPED: PULLS CARS IN, THEN BLOWS',
  napalm: 'DROPPED: A TRAIL OF FIRE BEHIND YOU',
};
