# Pin-up import slot

Drop HD art for the landing-page pin-up here and the game uses it instead of the painted girl. It applies the
same motion: the bounce (her chest trails each hop), the shimmy, and the tease and finger-wag moments.

## Switch it on

1. Put the image in this folder: a PNG, WebP or GIF with a transparent background, using a plain file name
   (letters, digits, `-` or `_`).
2. In `pinup.json`, set `"image"` to that file name, for example `"image": "pinup.png"`.
3. Reload the game. To go back to the painted girl, set `"image": null`.

## What the image should look like

- One character, facing the viewer, framed **head to mid-thigh**. The bottom of the image sits on the bottom
  edge of the screen.
- She is drawn **328 px tall** on a 640×360 screen, scaled from whatever size you supply. Any height works, but
  328, 656 or 984 px tall keeps pixel art crisp at an exact 1×, 2× or 3×.
- Keep her centred, with some empty space at the sides: the shimmy slides rows a few pixels left and right.
- She must stay clothed and non-explicit. She's on the content-warning page, and the tease never opens.

## Settings in `pinup.json`

| key | meaning | default |
|---|---|---|
| `image` | the main still; `null` keeps the painted girl | `null` |
| `poses` | optional stills for moments in the loop: `tease` (hand on the clasp), `snap` (snapping it shut), `wag` (wagging a finger, winking). Missing ones use the main image; without a `tease` image she fidgets instead. | `{}` |
| `chest` | the band of her height, from top to bottom as fractions 0–1, that trails her hops and jiggles in the shimmy | `[0.32, 0.56]` |
| `pixelated` | `true` for pixel art (sharp scaling), `false` for painted art (smooth scaling) | `true` |

Example:

```json
{
  "image": "pinup.png",
  "poses": { "tease": "pinup-tease.png", "wag": "pinup-wink.png" },
  "chest": [0.30, 0.55],
  "pixelated": true
}
```
