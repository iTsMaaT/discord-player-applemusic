import {
    ExtractorInfo,
    ExtractorSearchContext,
    ExtractorStreamable,
    Playlist,
    Track,
    Util,
    BaseExtractor,
} from "discord-player";
import { AppleMusic, AppleMusicCollection, AppleMusicTrack } from "./internal/AppleMusicAPI";
import { Readable } from "stream";
import { 
    appleMusicSongRegex, 
    appleMusicPlaylistRegex, 
    appleMusicAlbumRegex,
    isUrl,
    parseAppleMusicUrl, 
} from "./internal/helper";

export type StreamFN = (url: string, track: Track) => Promise<Readable | string>;

export interface AppleMusicExtractorInit {
    createStream?: (ext: AppleMusicExtractor, url: string, track: Track) => Promise<Readable | string>;
}

export class AppleMusicExtractor extends BaseExtractor<AppleMusicExtractorInit> {
    public static identifier = "com.discord-player.applemusicextractor" as const;
    private _stream!: StreamFN;

    public async activate(): Promise<void> {
        this.protocols = ["amsearch", "applemusic"];
        const fn = this.options.createStream;
        if (typeof fn === "function") 
            this._stream = (q: string, t: Track) => fn(this, q, t);
        
    }

    public async deactivate() {
        this.protocols = [];
    }

    public async validate(query: string): Promise<boolean> {
        return !isUrl(query) || 
            [appleMusicAlbumRegex, appleMusicPlaylistRegex, appleMusicSongRegex].some(regex => regex.test(query));
    }

    private buildTrack(trackInfo: AppleMusicTrack, context: ExtractorSearchContext, playlist?: Playlist): Track {
        const track = new Track(this.context.player, {
            author: trackInfo.artist,
            description: trackInfo.title,
            duration: trackInfo.duration,
            thumbnail: trackInfo.thumbnail,
            title: trackInfo.title,
            url: trackInfo.url,
            views: 0,
            source: "apple_music",
            requestedBy: context.requestedBy,
            metadata: {
                source: trackInfo,
                bridge: null,
            },
            requestMetadata: async () => ({
                source: trackInfo,
                bridge: null,
            }),
            playlist,
        });

        track.extractor = this;
        return track;
    }

    private buildPlaylist(data: AppleMusicCollection, context: ExtractorSearchContext, type: "album" | "playlist"): Playlist {
        const playlist = new Playlist(this.context.player, {
            author: {
                name: type === "album" ? data.artist! : data.description!,
                url: "",
            },
            description: data.description || data.title,
            id: data.id || "",
            source: "apple_music",
            thumbnail: data.artwork,
            title: data.title,
            tracks: [],
            type,
            url: data.url || "",
            rawPlaylist: data,
        });

        playlist.tracks = data.tracks.map((track: AppleMusicTrack) => this.buildTrack(track, context, playlist));
        return playlist;
    }

    public async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        if (appleMusicSongRegex.test(query)) {
            const info = await AppleMusic.getSongInfo(query);
            console.log(info);
            if (!info) return this.createResponse();
            return this.createResponse(null, [this.buildTrack(info, context)]);
        }

        if (appleMusicAlbumRegex.test(query)) {
            const info = await AppleMusic.getAlbumInfo(query);
            if (!info) return this.createResponse();
            const playlist = this.buildPlaylist(info, context, "album");
            return this.createResponse(playlist, playlist.tracks);
        }

        if (appleMusicPlaylistRegex.test(query)) {
            const info = await AppleMusic.getPlaylistInfo(query);
            if (!info) return this.createResponse();
            const playlist = this.buildPlaylist(info, context, "playlist");
            return this.createResponse(playlist, playlist.tracks);
        }

        // Search
        const data = await AppleMusic.search(query);
        if (!data?.length) return this.createResponse();
        return this.createResponse(null, data.map(track => this.buildTrack(track, context)));
    }

    public async stream(info: Track): Promise<ExtractorStreamable> {
        if (this._stream) {
            const stream = await this._stream(info.url, info);
            if (typeof stream === "string") return stream;
            return stream;
        }

        const result = await this.context.requestBridge(info, this);
        if (!result?.result) throw new Error("Could not bridge this track");
        return result.result;
    }
}