import { buildTrack } from '../../track/buildTrack.js';
import { TRACKS } from '../../track/tracks.js';
import { bakeWorld } from './bakeWorld.js';

// Bakes a track's world off the main thread, so the menus keep animating while it happens.
// In: { track: key }. Out: the world without its toLayer (withToLayer restores it), buffers transferred.
self.onmessage = ({ data }) => {
  const { toLayer, ...world } = bakeWorld(buildTrack(TRACKS[data.track]));
  self.postMessage(world, [world.base.buffer, world.hot.buffer, world.kind.buffer, world.heat.buffer]);
};
