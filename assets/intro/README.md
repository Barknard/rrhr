# Intro video slot

Drop your video here. The file name is set in `intro.json` (`"video"`, currently `intro.mp4`). Where it plays is set by `placement`.

**These videos are local-only:** `assets/intro/*.mp4` is gitignored and never committed or published.

**The one exception is `intro-public.mp4`**, named in `intro.json` as `"fallback"`. It's a 3.5 s censored loop, and it's committed. It uses frames 122–148 of the intro, played forward and back twice, with one slow breath warped over the top (the upper body lifts, the chest swells). It has a fixed mosaic over the nipples, applied before the breath so it moves with her, and the bottoms stay on. The game tries `video` first and falls back to it when that file is missing. So this machine plays the full local video, and the public site, which never has it, plays the censored loop.

- Use an H.264 MP4 (a `.webm` also works if you name it in `intro.json`). Keep it under about 20 MB so the website stays quick.
- `placement`: `"gate"` (the default) plays the video muted and looping on the 18+ gate, on the left side, as soon as it loads. Until it plays, or if both files are missing, that side stays empty. If `sound` is true the click that accepts the gate unmutes it, and accepting goes straight to the title. `"afterGate"` plays it full-screen after the gate, before the title.
- `blend`: `"screen"` makes black see-through, so a video on a black background glows over the game's lava backdrop. `"normal"` draws it as it is.
- `sound`: `true` plays the video's audio, `false` mutes it. If the browser refuses sound, it plays muted.
- `oncePerSession`: `true` plays it once per browser tab session; `false` plays it every time the game opens. It only counts once the video has really started, so a wrong file name doesn't use it up. Ignored for `"gate"`, which always shows the video.
- To turn the intro off, set `"video": null`.
- With `"afterGate"`: Enter, Esc, Space, a click or a tap skips it. If the file is missing or won't play, the game goes straight to the title.
