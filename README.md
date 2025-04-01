# Apple Music Extractor (metadata only)

This is a reworked applemusic extractor inspired from the original one at @discord-player/extractors.

## Installation

```bash
npm install discord-player-applemusic
```

## Usage

```js
const { Player } = require("discord-player");

const { AppleMusicExtractor } = require("discord-player-applemusic");
// Or
import { AppleMusicExtractor } from "discord-player-applemusic";

const player = new Player(client, {});

await player.extractors.register(AppleMusicExtractor, { /* options */ });
```

## Options

| Option | Type | Default | Required | Description |
| --- | --- | --- | --- | --- |
| createStream(ext: AppleMusicExtractor, url: string) => Promise<Readable \| string>; | function | null | No | A function that returns a Readable stream or a string URL to the stream. |

> Notice: playlists will always return the tracks author as Unknown Artist, if you know of a fix, please open an issue or a PR.