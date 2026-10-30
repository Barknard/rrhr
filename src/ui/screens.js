import { createIntroState, skipIntro, stepIntro } from './introVideo.js';
import { DRIVER_KEYS } from '../drivers/drivers.js';
import { BOSS, driverDef } from '../series/bosses.js';
import { normalizeCode, CODE_LENGTH } from '../net/protocol.js';

// The front-end flow as a pure state machine: content gate -> title -> (options) -> CHOOSE YOUR DRIVER ->
// CHOOSE YOUR RIDE (vehicle, weapons, GO TO RACE / BACK) -> VS -> race. RACE and SERIES both pick this way; a
// series starts straight from GO (it picks its own rivals). input() and tick() mutate the state and return what the
// host should do about it:
// { sfx, say: [{trigger, vars}], speak, leave, setSetting: [key, value], start: {mode, player, rivals?},
//   online: 'host', join: code, saveName, pick, ready, startOnline, leaveOnline, cancelJoin,
//   seriesNext, seriesRetry, seriesQuit }.
// Online: HOST ONLINE / JOIN ONLINE (after a one-time name) -> lobby. Picking in the lobby runs the same two
// phases, and GO returns to the lobby READY. The host starts the race. The boss is never offered online.
// The front end plays the sfx (ids from docs/audio/sfx-list.md) and the music, and the announcer (say / speak) is
// shown as captions and, where Mel's clips exist, voiced. OPTIONS switches each of those on or off.
// Drawing lives in drawScreens.js; nothing here touches the DOM.

// The 14 roster keys. TODO(integration): switch to CAR_KEYS once the HD roster has landed everywhere.
export const VEHICLE_KEYS = ['grinder', 'widowmaker', 'boneshaker', 'hellwheel', 'skimmer', 'nullHalo', 'hogHitch',
  'stomper', 'gravedigger', 'rattler', 'lastRide', 'afterburner', 'demoDerrick', 'whirlybird'];

export const FORWARD_WEAPONS = ['arc', 'saw', 'harpoon'];
export const DROP_WEAPONS = ['mine', 'napalm'];
export const RIDE_ROWS = ['vehicle', 'forward', 'drop', 'go', 'back'];
export const SERIES_ITEMS = { standings: ['forward', 'drop', 'next', 'quit'], champion: ['done'], beaten: ['retry', 'quit'] };

export const MENU = [
  { id: 'race', label: 'RACE' },
  { id: 'series', label: 'SERIES' },
  { id: 'host', label: 'HOST ONLINE' },
  { id: 'join', label: 'JOIN ONLINE' },
  { id: 'options', label: 'OPTIONS' },
];

export const OPTIONS = [
  { key: 'music', label: 'MUSIC', toggle: true }, { key: 'sfx', label: 'SOUND EFFECTS', toggle: true },
  { key: 'voice', label: 'ANNOUNCER VOICE', toggle: true }, { key: 'captions', label: 'ANNOUNCER CAPTIONS', toggle: true },
  { key: 'back', label: 'BACK' },
];
export const DEFAULT_SETTINGS = { music: true, sfx: true, voice: true, captions: true };

const VS_TIME = 2.5, NAME_MAX = 10;
const wrap = (i, n) => ((i % n) + n) % n;
// A hover that lands on a different item ticks (mousemove fires constantly, so the same item stays quiet).
const hovered = (out, from, to) => { if (to !== from) out.sfx = 'ui_move'; return to; };

// The strips: the roster, plus King Cinder and the Slaghog once beaten (offline quick races only: the series finale
// already has its own King Cinder, so a series never offers him).
const bossOn = s => !!s.unlocks?.boss && !s.online && s.mode !== 'series';
export const driverList = s => (bossOn(s) ? [...DRIVER_KEYS, BOSS.driver] : DRIVER_KEYS);
export const vehicleList = s => (bossOn(s) ? [...VEHICLE_KEYS, BOSS.vehicle] : VEHICLE_KEYS);
export const pickedDriver = s => driverList(s)[s.select.driverIdx] ?? DRIVER_KEYS[0];
export const pickedVehicle = s => vehicleList(s)[s.select.vehicleIdx] ?? VEHICLE_KEYS[0];

export function createScreens({ rng = Math.random, settings = DEFAULT_SETTINGS, playerName = '', unlocks = { series2: false, boss: false } } = {}) {
  return {
    screen: 'gate', t: 0, rng, settings: { ...DEFAULT_SETTINGS, ...settings }, unlocks: { ...unlocks }, mode: 'race', series: null, seriesIdx: 0, touch: false,
    playerName, nameInput: '', nameFor: null, joinCode: '', joinStatus: null, joinError: null, online: null, lobby: null,
    menuIdx: 0, optIdx: 0, flash: null,
    select: { step: 'driver', driverIdx: 0, vehicleIdx: 0, row: 'vehicle' },
    loadout: { forward: 'arc', drop: 'mine' },
    player: null, vs: { rivals: [], timer: 0 },
  };
}

const TITLE_SPEAK = 'Roll! And! Rock! Hard! Racing!';
const sayVars = s => ({ name: driverDef(pickedDriver(s)).short });

function pickRivals(s) {
  const take = (pool, n) => { const p = [...pool], out = []; while (out.length < n) out.push(p.splice(Math.floor(s.rng() * p.length), 1)[0]); return out; };
  const vehicles = take(VEHICLE_KEYS.filter(k => k !== s.player.vehicle), 3);
  const drivers = take(DRIVER_KEYS.filter(k => k !== s.player.driver), 3);
  return vehicles.map((vehicle, i) => ({ vehicle, driver: drivers[i] }));
}

// action: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back', or 'select' (hover/click: arg is the item's index on
// this screen) and 'vehicle' (a click on the ride strip: arg is the vehicle's index).
export function input(s, action, arg = 0) {
  const out = {};
  switch (s.screen) {
    case 'gate':
      if (action === 'ok' && s.introReady) { s.screen = 'intro'; s.intro = createIntroState(); s.introEnded = false; Object.assign(out, { sfx: 'ui_select', introStart: true, gateAccept: true }); } // the front end starts the video inside this key or click
      else if (action === 'ok') { s.screen = 'title'; s.titleAt = s.t; Object.assign(out, { sfx: 'ui_select', speak: TITLE_SPEAK, gateAccept: true }); }
      else if (action === 'back') out.leave = true;
      break;
    case 'intro': // any confirm or back skips
      if (action === 'ok' || action === 'back') skipIntro(s.intro);
      break;
    case 'title':
      if (action === 'select') s.menuIdx = hovered(out, s.menuIdx, wrap(arg, MENU.length));
      else if (action === 'up' || action === 'down') { s.menuIdx = wrap(s.menuIdx + (action === 'up' ? -1 : 1), MENU.length); out.sfx = 'ui_move'; }
      else if (action === 'ok') {
        const item = MENU[s.menuIdx];
        if (item.disabled) { out.sfx = 'ui_back'; s.flash = { text: `${item.label}: COMING SOON`, t: 1.5 }; }
        else if (item.id === 'race' || item.id === 'series') {
          s.mode = item.id; s.screen = 'select'; s.select.step = 'driver'; out.sfx = 'ui_select';
          s.select.driverIdx = Math.min(s.select.driverIdx, driverList(s).length - 1); s.select.vehicleIdx = Math.min(s.select.vehicleIdx, vehicleList(s).length - 1); // the boss strips may have shrunk
        }
        else if (item.id === 'options') { s.screen = 'options'; s.optIdx = 0; out.sfx = 'ui_select'; }
        else if (!s.playerName) { s.screen = 'name'; s.nameFor = item.id; s.nameInput = ''; out.sfx = 'ui_select'; }
        else Object.assign(out, goOnline(s, item.id));
      }
      break;
    case 'name':
      if (action === 'back') { s.screen = 'title'; out.sfx = 'ui_back'; }
      else if (action === 'ok' && s.nameInput.trim()) {
        s.playerName = s.nameInput.trim();
        Object.assign(out, { saveName: s.playerName }, goOnline(s, s.nameFor));
      }
      break;
    case 'join':
      if (action === 'back') { out.cancelJoin = s.joinStatus === 'connecting'; s.joinStatus = null; s.screen = 'title'; out.sfx = 'ui_back'; }
      else if (action === 'ok' && s.joinStatus !== 'connecting') {
        const code = normalizeCode(s.joinCode);
        if (!code) { s.joinError = `ROOM CODES ARE ${CODE_LENGTH} LETTERS`; out.sfx = 'ui_back'; }
        else { s.joinStatus = 'connecting'; s.joinError = null; out.join = code; out.sfx = 'ui_select'; }
      }
      break;
    case 'lobby': {
      const lb = s.lobby, item = lb.items[lb.idx];
      if (action === 'select') lb.idx = hovered(out, lb.idx, wrap(arg, lb.items.length));
      else if (['up', 'down', 'left', 'right'].includes(action)) { lb.idx = wrap(lb.idx + (action === 'up' || action === 'left' ? -1 : 1), lb.items.length); out.sfx = 'ui_move'; }
      else if (action === 'back' || (action === 'ok' && item === 'leave')) { s.screen = 'title'; s.online = null; s.lobby = null; out.leaveOnline = true; out.sfx = 'ui_back'; }
      else if (action === 'ok' && item === 'pick') { s.screen = 'select'; s.select.step = 'driver'; out.sfx = 'ui_select'; }
      else if (action === 'ok' && item === 'start') {
        if (!lb.picked) { s.flash = { text: 'PICK YOUR COMBO FIRST', t: 1.5 }; out.sfx = 'ui_back'; }
        else { out.startOnline = true; out.sfx = 'ui_select'; }
      }
      break;
    }
    case 'options': {
      const opt = OPTIONS[s.optIdx];
      if (action === 'select') s.optIdx = hovered(out, s.optIdx, wrap(arg, OPTIONS.length));
      else if (action === 'up' || action === 'down') { s.optIdx = wrap(s.optIdx + (action === 'up' ? -1 : 1), OPTIONS.length); out.sfx = 'ui_move'; }
      else if (action === 'back' || (action === 'ok' && opt.key === 'back')) { s.screen = 'title'; out.sfx = 'ui_back'; }
      else if (opt.toggle && (action === 'ok' || action === 'left' || action === 'right')) {
        s.settings[opt.key] = !s.settings[opt.key]; out.setSetting = [opt.key, s.settings[opt.key]]; out.sfx = 'ui_select';
      }
      break;
    }
    case 'select': {
      const sel = s.select;
      if (action === 'select') { // hover or click on a strip portrait or a ride row
        if (sel.step === 'driver') sel.driverIdx = hovered(out, sel.driverIdx, wrap(arg, driverList(s).length)); else sel.row = hovered(out, sel.row, RIDE_ROWS[wrap(arg, RIDE_ROWS.length)]);
        break;
      }
      if (sel.step === 'driver') {
        const n = driverList(s).length;
        if (['left', 'right', 'up', 'down'].includes(action)) { sel.driverIdx = wrap(sel.driverIdx + (action === 'left' || action === 'up' ? -1 : 1), n); out.sfx = 'ui_move'; }
        else if (action === 'ok') { sel.step = 'ride'; sel.row = 'vehicle'; out.sfx = 'ui_select'; out.say = [{ trigger: `driver_${pickedDriver(s)}`, vars: sayVars(s) }]; }
        else if (action === 'back') { s.screen = s.online ? 'lobby' : 'title'; out.sfx = 'ui_back'; }
        break;
      }
      // ride: the vehicle, the weapons, then GO TO RACE (or BACK to the driver)
      const r = RIDE_ROWS.indexOf(sel.row);
      if (action === 'vehicle') { sel.vehicleIdx = wrap(arg, vehicleList(s).length); sel.row = 'vehicle'; out.sfx = 'ui_move'; }
      else if (action === 'up' || action === 'down') { sel.row = RIDE_ROWS[Math.max(0, Math.min(RIDE_ROWS.length - 1, r + (action === 'up' ? -1 : 1)))]; out.sfx = 'ui_move'; }
      else if (action === 'left' || action === 'right') {
        const d = action === 'left' ? -1 : 1;
        if (sel.row === 'vehicle') sel.vehicleIdx = wrap(sel.vehicleIdx + d, vehicleList(s).length);
        else if (sel.row === 'forward' || sel.row === 'drop') {
          const list = sel.row === 'forward' ? FORWARD_WEAPONS : DROP_WEAPONS;
          s.loadout[sel.row] = list[wrap(list.indexOf(s.loadout[sel.row]) + d, list.length)];
        } else sel.row = sel.row === 'go' ? 'back' : 'go';
        out.sfx = 'ui_move';
      } else if (action === 'back' || (action === 'ok' && sel.row === 'back')) { sel.step = 'driver'; out.sfx = 'ui_back'; }
      else if (action === 'ok' && sel.row === 'vehicle') { sel.row = 'go'; out.sfx = 'ui_select'; }
      else if (action === 'ok' && sel.row !== 'go') { sel.row = RIDE_ROWS[r + 1]; out.sfx = 'ui_move'; }
      else if (action === 'ok') {
        const driver = pickedDriver(s), vehicle = pickedVehicle(s), pick = { driver, vehicle, loadout: { ...s.loadout } };
        out.sfx = 'ui_select';
        out.say = [{ trigger: `pick_${vehicle}`, vars: sayVars(s) }];
        if (driverDef(driver).fav === vehicle) out.say.push({ trigger: `fav_${driver}`, vars: sayVars(s) });
        if (s.online) { s.screen = 'lobby'; s.lobby.picked = true; Object.assign(out, { pick, ready: true }); } // back to the lobby, READY
        else if (s.mode === 'series') { s.player = pick; out.start = { mode: 'series', player: pick }; } // the game takes over the screen
        else { s.player = pick; s.vs = { rivals: pickRivals(s), timer: 0 }; s.screen = 'vs'; }
      }
      break;
    }
    case 'standings': case 'champion': case 'beaten': {
      const items = SERIES_ITEMS[s.screen], item = items[s.seriesIdx];
      const weapon = item === 'forward' || item === 'drop';
      if (s.quitAsk) { // QUIT THE SERIES? YES / NO: only YES leaves
        const q = s.quitAsk;
        if (action === 'select') q.idx = hovered(out, q.idx, wrap(arg, 2));
        else if (['up', 'down', 'left', 'right'].includes(action)) { q.idx = 1 - q.idx; out.sfx = 'ui_move'; }
        else if (action === 'back' || (action === 'ok' && q.idx === 1)) { s.quitAsk = null; out.sfx = 'ui_back'; }
        else if (action === 'ok') { s.quitAsk = null; s.screen = 'title'; s.series = null; out.seriesQuit = true; out.sfx = 'ui_back'; }
        break;
      }
      if (action === 'back' && s.screen !== 'champion') { s.seriesIdx = items.indexOf('quit'); out.sfx = 'ui_move'; } // Esc or right-click only moves to QUIT
      else if (action === 'select') s.seriesIdx = hovered(out, s.seriesIdx, wrap(arg, items.length));
      else if (weapon && (action === 'left' || action === 'right' || action === 'ok')) { // change weapons before each race
        const list = item === 'forward' ? FORWARD_WEAPONS : DROP_WEAPONS;
        s.loadout[item] = list[wrap(list.indexOf(s.loadout[item]) + (action === 'left' ? -1 : 1), list.length)];
        out.sfx = 'ui_move';
      } else if (['up', 'down', 'left', 'right'].includes(action)) { s.seriesIdx = wrap(s.seriesIdx + (action === 'up' || action === 'left' ? -1 : 1), items.length); out.sfx = 'ui_move'; }
      else if (action === 'ok' && item === 'quit') { s.quitAsk = { idx: 1 }; out.sfx = 'ui_select'; } // NO is the safe default
      else if (action === 'back' || (action === 'ok' && item === 'done')) { s.screen = 'title'; s.series = null; out.seriesQuit = true; out.sfx = 'ui_back'; }
      else if (action === 'ok' && item === 'next') { out.seriesNext = true; out.sfx = 'ui_select'; } // the game takes over the screen
      else if (action === 'ok' && item === 'retry') { out.seriesRetry = true; out.sfx = 'ui_select'; }
      break;
    }
    case 'vs':
      if (action === 'ok') return tick(s, VS_TIME);
      break;
    default: break;
  }
  return out;
}

// The mouse (and taps): region is what the screen registered under the pointer, { a, i?, then? } with a = 'select',
// 'vehicle', 'ok', 'back', 'left' or 'right'. kind: 'move' (hover selects), 'click' (activates: the selection, then
// region.then ?? 'ok'; then: null only selects), or 'back' (right-click). locked: a transition is holding input.
export function pointer(s, region, kind, locked = false) {
  if (locked) return [];
  if (kind === 'back') return [input(s, 'back')];
  if (!region) return [];
  if (kind === 'move') return region.a === 'select' ? [input(s, 'select', region.i)] : [];
  if (region.a === 'key') return [pressKey(s, region.k)];
  if (region.a !== 'select' && region.a !== 'vehicle') return [input(s, region.a)];
  const outs = [input(s, region.a, region.i)];
  if (region.then !== null) outs.push(input(s, region.then ?? 'ok'));
  return outs;
}

// Between series races: the standings, then SERIES CHAMPION or KING CINDER WINS. view comes from the series flow.
export function enterSeriesScreen(s, screen, view) {
  s.screen = screen; s.series = view; s.quitAsk = null; s.seriesIdx = Math.max(0, SERIES_ITEMS[screen].indexOf('next')); // NEXT RACE first
  if (screen === 'champion') s.unlocks = { ...s.unlocks, ...Object.fromEntries((view.unlocked ?? []).map(k => [k, true])) };
}

// HOST ONLINE asks the game for a room (the game calls enterLobby once it has a code); JOIN goes to code entry.
function goOnline(s, which) {
  if (which === 'host') return { online: 'host', sfx: 'ui_select' };
  s.screen = 'join'; s.joinCode = s.keepJoinCode ?? ''; s.keepJoinCode = null; s.joinError = null; s.joinStatus = null; // keeps a #join link's code
  return { sfx: 'ui_select' };
}

// Typing on the name and join screens (the game routes printable keys here instead of the menu actions).
export function typeChar(s, ch) {
  const c = String(ch).toUpperCase();
  if (s.screen === 'name' && /^[A-Z0-9 ]$/.test(c) && s.nameInput.length < NAME_MAX && !(c === ' ' && !s.nameInput)) s.nameInput += c;
  else if (s.screen === 'join' && /^[A-Z]$/.test(c) && s.joinCode.length < CODE_LENGTH && s.joinStatus !== 'connecting') { s.joinCode += c; s.joinError = null; }
}

// A key on the tap keyboard (softKeyboard.js): a letter or digit, SPC, DEL, OK or BACK.
export function pressKey(s, k) {
  if (k === 'OK') return input(s, 'ok');
  if (k === 'BACK') return input(s, 'back');
  if (k === 'DEL') backspace(s); else typeChar(s, k === 'SPC' ? ' ' : k);
  return { sfx: 'ui_move' };
}

export function backspace(s) {
  if (s.screen === 'name') s.nameInput = s.nameInput.slice(0, -1);
  else if (s.screen === 'join' && s.joinStatus !== 'connecting') s.joinCode = s.joinCode.slice(0, -1);
}

const JOIN_ERRORS = {
  'no-host': 'NO RACE WITH THAT CODE. CHECK IT AND TRY AGAIN',
  offline: 'COULD NOT REACH THE INTERNET. CHECK YOUR INTERNET AND TRY AGAIN',
  timeout: 'COULD NOT CONNECT. CHECK THE CODE OR TRY AGAIN',
  full: 'THAT RACE IS FULL (4 PLAYERS)',
  busy: 'THEY ARE ALREADY RACING. JOIN WHEN THE RACE ENDS',
  unsupported: 'THIS BROWSER CANNOT PLAY ONLINE',
  version: 'YOU AND THE HOST HAVE DIFFERENT VERSIONS OF THE GAME. BOTH OF YOU RELOAD',
};
export function setJoinError(s, why) {
  s.joinStatus = null;
  s.joinError = JOIN_ERRORS[why] ?? JOIN_ERRORS.timeout;
}

export function enterLobby(s, { role, code }) {
  s.online = role; s.screen = 'lobby';
  s.lobby = { role, code, seats: [], items: role === 'host' ? ['pick', 'start', 'leave'] : ['pick', 'leave'], idx: 0, picked: false };
}

export function setLobbySeats(s, seats) { if (s.lobby) s.lobby.seats = seats; }

// The online race was started by the host: show the VS screen for these four, then race.
export function enterVs(s, player, rivals) {
  s.player = player; s.vs = { rivals, timer: 0 }; s.screen = 'vs';
}

export function tick(s, dt) {
  s.t += dt;
  if (s.screen === 'intro') {
    if (stepIntro(s.intro, dt, s.introEnded).phase === 'done') { s.screen = 'title'; s.titleAt = s.t; return { speak: TITLE_SPEAK, introStop: true }; }
    return {};
  }
  if (s.flash && (s.flash.t -= dt) <= 0) s.flash = null;
  if (s.screen === 'vs' && (s.vs.timer += dt) >= VS_TIME) {
    s.screen = 'race';
    return { start: { mode: 'race', player: s.player, rivals: s.vs.rivals } };
  }
  return {};
}
