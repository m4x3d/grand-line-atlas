# Grand Line Atlas

An interactive pixel-art map of the world of One Piece. Move through the story on a timeline and see which characters are on which island at that point.

It contains spoilers up to the Elbaf arc.

## Run it

There is no build step and nothing to install. Serve the folder and open it in a browser:

```sh
python3 -m http.server
# then open http://localhost:8000
```

Opening `index.html` straight from disk does not work, because browsers block ES modules on `file://`.

## What it does

- **World map** with the four Blues, both Red Line crossings, the Calm Belts, Paradise and the New World. The map wraps around horizontally, so you can keep dragging past either Red Line.
- **Timeline** with 53 stops: 19 flashbacks from the Void Century onward, then the voyage from Romance Dawn to Elbaf, including the timeskip. Flashbacks are marked in sepia on the timeline and turn the whole map sepia.
- **Characters** stand on the island where the story last saw them at the selected stop. Click one for epithet, affiliation, Devil Fruit, where they are right now and every stop they appear in.
- **Islands** show a description, every stop that involves them and who is there now. The stops also appear as ticks above the timeline.
- **Search** finds characters and islands.
- The dotted line is Luffy's route so far. The Going Merry or Thousand Sunny waits at the crew's current island.

Controls: drag to pan, scroll to zoom, arrow keys to step through the timeline.

## How it is built

Plain JavaScript modules, no dependencies. All artwork is generated at runtime, so the repository holds no image or font files.

| File | Purpose |
|---|---|
| `islands.js` | Island table: position, palette, description |
| `cast0.js` to `cast3.js` | Character tables: look, appearances, locations, deaths |
| `data.js` | Timeline table, parsers and lookups such as "where is this character now" |
| `sprites.js` | Builds the sprite atlas: characters, ships and a pixel font |
| `decals.js` | Hand-painted Baratie and Zou |
| `shader.js`, `gpu.js` | WebGPU renderer. Sea, islands, route and clouds are one fragment shader |
| `gl.js` | WebGL2 fallback for browsers without a WebGPU adapter |
| `main.js`, `index.html` | Camera, timeline, search and the info panel |
| `check.mjs` | Consistency check for the data tables |

The terrain is rendered at half resolution and scaled up, with sprites drawn on top at full resolution. `gl.js` is a hand-kept GLSL copy of the WGSL shader in `shader.js`, so a visual change has to be made in both.

### Data format

Characters are one line each:

```
name|epithet|affiliation|devil fruit|look|arcs|optional note
```

`look` is a short code the sprite generator turns into a character (skin, hair, hat, clothes and extras such as a coat or a sword). `arcs` is a string with one letter or digit per timeline stop:

- `7ab+` appears in stops `7`, `a` and `b`, and joins the Straw Hats at `b`
- `g(banaro)` appears in stop `g`, but on Banaro Island instead of the island that stop plays on
- `l!` dies in stop `l`

The stop codes are listed in `CODES` in `data.js`. Capitals are flashbacks.

### Check

```sh
node check.mjs
```

It fails on unknown stops or islands, malformed look codes, appearances after death, overlapping islands and a few known facts about the crew at key points of the story.

## Accuracy

The data was written from memory and is not checked against a wiki, so expect mistakes, especially in the most recent arcs. Island positions follow the known geography where there is one. Where the story gives no location, the placement is a guess. Corrections are welcome.

## Disclaimer

This is an unofficial fan project. One Piece and its characters belong to Eiichiro Oda and Shueisha. The sprites and maps here are original generated pixel art and use no official artwork.
