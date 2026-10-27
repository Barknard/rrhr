import { DRIVERS, DRIVER_KEYS } from '../drivers/drivers.js';
import { normalizeCode, CODE_LENGTH } from '../net/protocol.js';

// The front-end flow as a pure state machine: content gate -> title -> (options) -> driver select -> vehicle
// select -> combo (stats, abilities, loadout, GO TO RACE) -> VS -> race. input() and tick() mutate the state and return what the host should do about it:
// { sfx, say: [{trigger, vars}], speak, leave, setSetting: [key, value], start: {player, rivals},
//   online: 'host', join: code, saveName, pick, ready, startOnline, leaveOnline, cancelJoin }.
// Online: HOST ONLINE / JOIN ONLINE (after a one-time name) -> lobby. Picking a combo in the lobby runs the
// normal driver -> vehicle -> combo screens, and GO returns to the lobby READY. The host starts the race.
// The game has no audio (Eddie's call): sfx names are hooks for sound added later, and the announcer
// (say / speak) is shown as captions.
// Drawing lives in drawScreens.js; nothing here touches the DOM.

// The 14 roster keys. TODO(integration): switch to CAR_KEYS once the HD roster has landed everywhere.
export const VEHICLE_KEYS = ['grinder', 'widowmaker', 'boneshaker', 'hellwheel', 'skimmer', 'nullHalo', 'hogHitch',
  'stomper', 'gravedigger', 'rattler', 'lastRide', 'afterburner', 'demoDerrick', 'whirlybird'];

export const FORWARD_WEAPONS = ['arc', 'saw', 'harpoon'];
export const DROP_WEAPONS = ['mine', 'napalm'];
export const COMBO_ROWS = ['forward', 'drop', 'go'];

export const MENU = [
  { id: 'race', label: 'RACE' },
  { id: 'host', label: 'HOST ONLINE' },
  { id: 'join', label: 'JOIN ONLINE' },
  { id: 'season', label: 'SEASON', disabled: true },
  { id: 'options', label: 'OPTIONS' },
];

export const OPTIONS = [{ key: 'captions', label: 'ANNOUNCER CAPTIONS', toggle: true }, { key: 'back', label: 'BACK' }];

const GRID_COLS = 4, VS_TIME = 2.5, NAME_MAX = 10;
const wrap = (i, n) => ((i % n) + n) % n;

export function createScreens({ rng = Math.random, settings = { captions: true }, playerName = '' } = {}) {
  return {
    screen: 'gate', t: 0, rng, settings: { ...settings },
    playerName, nameInput: '', nameFor: null, joinCode: '', joinStatus: null, joinError: null, online: null, lobby: null,
    menuIdx: 0, optIdx: 0, flash: null,
    select: { step: 'driver', driverIdx: 0, vehicleIdx: 0, row: 'go' },
    loadout: { forward: 'arc', drop: 'mine' },
    player: null, vs: { rivals: [], timer: 0 },
  };
}

const sayVars = s => ({ name: DRIVERS[DRIVER_KEYS[s.select.driverIdx]].short });

function pickRivals(s) {
  const take = (pool, n) => { const p = [...pool], out = []; while (out.length < n) out.push(p.splice(Math.floor(s.rng() * p.length), 1)[0]); return out; };
  const vehicles = take(VEHICLE_KEYS.filter(k => k !== s.player.vehicle), 3);
  const drivers = take(DRIVER_KEYS.filter(k => k !== s.player.driver), 3);
  return vehicles.map((vehicle, i) => ({ vehicle, driver: drivers[i] }));
}

export function input(s, action) {
  const out = {};
  switch (s.screen) {
    case 'gate':
      if (action === 'ok') { s.screen = 'title'; Object.assign(out, { sfx: 'ui_select', speak: 'Roll! And! Rock! Hard! Racing!' }); }
      else if (action === 'back') out.leave = true;
      break;
    case 'title':
      if (action === 'up' || action === 'down') { s.menuIdx = wrap(s.menuIdx + (action === 'up' ? -1 : 1), MENU.length); out.sfx = 'ui_move'; }
      else if (action === 'ok') {
        const item = MENU[s.menuIdx];
        if (item.disabled) { out.sfx = 'ui_back'; s.flash = { text: `${item.label}: COMING SOON`, t: 1.5 }; }
        else if (item.id === 'race') { s.screen = 'select'; s.select.step = 'driver'; out.sfx = 'ui_select'; }
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
      if (['up', 'down', 'left', 'right'].includes(action)) { lb.idx = wrap(lb.idx + (action === 'up' || action === 'left' ? -1 : 1), lb.items.length); out.sfx = 'ui_move'; }
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
      if (action === 'up' || action === 'down') { s.optIdx = wrap(s.optIdx + (action === 'up' ? -1 : 1), OPTIONS.length); out.sfx = 'ui_move'; }
      else if (action === 'back' || (action === 'ok' && opt.key === 'back')) { s.screen = 'title'; out.sfx = 'ui_back'; }
      else if (opt.toggle && (action === 'ok' || action === 'left' || action === 'right')) {
        s.settings[opt.key] = !s.settings[opt.key]; out.setSetting = [opt.key, s.settings[opt.key]]; out.sfx = 'ui_select';
      }
      break;
    }
    case 'select': {
      const sel = s.select;
      if (sel.step === 'driver') {
        const row = Math.floor(sel.driverIdx / GRID_COLS), col = sel.driverIdx % GRID_COLS, rows = DRIVER_KEYS.length / GRID_COLS;
        if (action === 'left' || action === 'right') { sel.driverIdx = row * GRID_COLS + wrap(col + (action === 'left' ? -1 : 1), GRID_COLS); out.sfx = 'ui_move'; }
        else if (action === 'up' || action === 'down') { sel.driverIdx = wrap(row + (action === 'up' ? -1 : 1), rows) * GRID_COLS + col; out.sfx = 'ui_move'; }
        else if (action === 'ok') { sel.step = 'vehicle'; out.sfx = 'ui_select'; out.say = [{ trigger: `driver_${DRIVER_KEYS[sel.driverIdx]}`, vars: sayVars(s) }]; }
        else if (action === 'back') { s.screen = s.online ? 'lobby' : 'title'; out.sfx = 'ui_back'; }
      } else if (sel.step === 'vehicle') {
        if (action === 'left' || action === 'right') { sel.vehicleIdx = wrap(sel.vehicleIdx + (action === 'left' ? -1 : 1), VEHICLE_KEYS.length); out.sfx = 'ui_move'; }
        else if (action === 'back') { sel.step = 'driver'; out.sfx = 'ui_back'; }
        else if (action === 'ok') {
          const driver = DRIVER_KEYS[sel.driverIdx], vehicle = VEHICLE_KEYS[sel.vehicleIdx];
          sel.step = 'combo'; sel.row = 'go';
          out.sfx = 'ui_select';
          out.say = [{ trigger: `pick_${vehicle}`, vars: sayVars(s) }];
          if (DRIVERS[driver].fav === vehicle) out.say.push({ trigger: `fav_${driver}`, vars: sayVars(s) });
        }
      } else { // combo: review the pairing, pick the weapons, then GO TO RACE
        const r = COMBO_ROWS.indexOf(sel.row);
        if (action === 'up' || action === 'down') { sel.row = COMBO_ROWS[Math.max(0, Math.min(COMBO_ROWS.length - 1, r + (action === 'up' ? -1 : 1)))]; out.sfx = 'ui_move'; }
        else if ((action === 'left' || action === 'right') && sel.row !== 'go') {
          const list = sel.row === 'forward' ? FORWARD_WEAPONS : DROP_WEAPONS, d = action === 'left' ? -1 : 1;
          s.loadout[sel.row] = list[wrap(list.indexOf(s.loadout[sel.row]) + d, list.length)];
          out.sfx = 'ui_move';
        } else if (action === 'back') { sel.step = 'vehicle'; out.sfx = 'ui_back'; }
        else if (action === 'ok' && sel.row !== 'go') { sel.row = COMBO_ROWS[r + 1]; out.sfx = 'ui_move'; }
        else if (action === 'ok' && s.online) { // online: back to the lobby, picked and READY
          const pick = { driver: DRIVER_KEYS[sel.driverIdx], vehicle: VEHICLE_KEYS[sel.vehicleIdx], loadout: { ...s.loadout } };
          s.screen = 'lobby'; s.lobby.picked = true;
          Object.assign(out, { pick, ready: true, sfx: 'ui_select' });
        } else if (action === 'ok') {
          s.player = { driver: DRIVER_KEYS[sel.driverIdx], vehicle: VEHICLE_KEYS[sel.vehicleIdx], loadout: { ...s.loadout } };
          s.vs = { rivals: pickRivals(s), timer: 0 };
          s.screen = 'vs';
          out.sfx = 'ui_select';
        }
      }
      break;
    }
    case 'vs':
      if (action === 'ok') return tick(s, VS_TIME);
      break;
    default: break;
  }
  return out;
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
  if (s.flash && (s.flash.t -= dt) <= 0) s.flash = null;
  if (s.screen === 'vs' && (s.vs.timer += dt) >= VS_TIME) {
    s.screen = 'race';
    return { start: { player: s.player, rivals: s.vs.rivals } };
  }
  return {};
}
