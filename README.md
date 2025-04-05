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

## Supported features

| Feature | Supported |
| --- | --- |
| Single tracks | ✅ |
| Playlists | ✅ |
| Search | ✅ |
| Direct streaming | ❌ |
| Can be used as a bridge | ❌ |
| Can bridge to ... | ✅ |
| Autoplay | ❌ |

## Options

| Option | Type | Default | Required | Description |
| --- | --- | --- | --- | --- |
| createStream(ext: AppleMusicExtractor, url: string) => Promise<Readable \| string>; | function | null | No | A function that returns a Readable stream or a string URL to the stream. |