// Debug tools (the window.rrhr handle and the ?fast speed-up) exist on localhost, or anywhere with ?debug.
export const debugEnabled = (hostname, search) => hostname === 'localhost' || new URLSearchParams(search).has('debug');
// ?fast runs races 4x for play-testing a series; only honoured where debug is on.
export const fastFactor = (hostname, search) => (debugEnabled(hostname, search) && new URLSearchParams(search).has('fast') ? 4 : 1);
