import { QueryResolver } from "discord-player";
import { parse, HTMLElement } from "node-html-parser";
import { UA } from "./helper";

export type AppleMusicTrack = {
    id: string;
    title: string;
    artist: string;
    thumbnail: string;
    duration: string;
    url: string;
};

export type AppleMusicCollection = {
    id?: string;
    title: string;
    description?: string;
    artwork: string;
    tracks: AppleMusicTrack[];
    url?: string;
    artist?: string;
};

function getHTML(link: string): Promise<HTMLElement | null> {
    return fetch(link, {
        headers: {
            "User-Agent": UA,
        },
    })
        .then((r) => r.text())
        .then(
            (txt) => parse(txt),
            () => null,
        );
}

function makeImage({
    height,
    url,
    width,
    ext = "jpg",
}: {
  url: string;
  width: number;
  height: number;
  ext?: string;
}) {
    return url
        .replace("{w}", `${width}`)
        .replace("{h}", `${height}`)
        .replace("{f}", ext);
}

function parseDuration(d: string) {
    const r = (name: string, unit: string) =>
        `((?<${name}>-?\\d*[\\.,]?\\d+)${unit})?`;
    const regex = new RegExp(
        [
            "(?<negative>-)?P",
            r("years", "Y"),
            r("months", "M"),
            r("weeks", "W"),
            r("days", "D"),
            "(T",
            r("hours", "H"),
            r("minutes", "M"),
            r("seconds", "S"),
            ")?", // end optional time
        ].join(""),
    );
    const test = regex.exec(d);
    if (!test || !test.groups) return "0:00";

    const dur = [
        test.groups.years,
        test.groups.months,
        test.groups.weeks,
        test.groups.days,
        test.groups.hours,
        test.groups.minutes,
        test.groups.seconds,
    ];

    return (
        dur
            .filter((item, i, a) => !!item || i > a.length - 2)
            .map((m, i) => {
                if (!m) m = "0";
                return i < 1 ? m : m.padStart(2, "0");
            })
            .join(":") || "0:00"
    );
}

/**
 * Represents the Apple Music API client
 */
export class AppleMusic {
    public constructor() {
        return AppleMusic;
    }

    /**
   * Search for tracks on Apple Music
   * @param query - The search query
   * @returns An array of track objects matching the search query
   */
    public static async search(query: string): Promise<AppleMusicTrack[] | []> {
        try {
            const url = `https://music.apple.com/us/search?term=${encodeURIComponent(
                query,
            )}`;
            const node = await getHTML(url);
            if (!node) return [];

            const rawData = node.getElementById("serialized-server-data");
            if (!rawData) return [];

            const data = JSON.parse(rawData.innerText)[0].data.sections;
            const tracks = data.find((s: { itemKind: string }) => s.itemKind === "trackLockup")?.items;
            if (!tracks) return [];

            return tracks.map((track: {
                contentDescriptor: { identifiers: { storeAdamID: string }; url: string };
                duration?: string;
                title: string;
                artwork?: { dictionary?: { url: string; height: number; width: number } };
                subtitleLinks?: { title: string }[];
            }) => ({
                id: track.contentDescriptor.identifiers.storeAdamID,
                duration: track.duration || "0:00",
                title: track.title,
                url: track.contentDescriptor.url,
                thumbnail: track?.artwork?.dictionary
                    ? makeImage({
                        url: track.artwork.dictionary.url,
                        height: track.artwork.dictionary.height,
                        width: track.artwork.dictionary.width,
                    })
                    : "https://music.apple.com/assets/favicon/favicon-180.png",
                artist: track.subtitleLinks?.[0]?.title ?? "Unknown Artist",
            }));
        } catch (e) {
            return [];
        }
    }

    /**
   * Gets information about a song from its Apple Music URL
   * @param link - The Apple Music song URL
   * @returns The song information object or null if not found
   */
    public static async getSongInfo(link: string): Promise<AppleMusicTrack | null> {
        const url = new URL(link);
        let id, name;
    
        if (url.pathname.includes("/album/")) {
            id = url.searchParams.get("i");
            name = url.pathname.split("album/")[1]?.split("/")[0];
        } else if (url.pathname.includes("/song/")) {
            const parts = url.pathname.split("/song/")[1]?.split("/");
            name = parts?.[0];
            id = parts?.[1];
        }

        const songURL = `https://music.apple.com/us/song/${name}/${id}`;

        if (!id || !name) return null;

        const res = await getHTML(songURL);
        if (!res) return null;

        try {
            const metaTags = res.getElementsByTagName("meta");
            if (!metaTags.length) return null;

            const title =
            metaTags
                .find((r) => r.getAttribute("name") === "apple:title")
                ?.getAttribute("content") ||
            res.querySelector("title")?.innerText ||
            name;

            const contentId =
            metaTags
                .find((r) => r.getAttribute("name") === "apple:content_id")
                ?.getAttribute("content") || id;
            const durationRaw = metaTags
                .find((r) => r.getAttribute("property") === "music:song:duration")
                ?.getAttribute("content");

            const song = {
                id: contentId,
                duration: durationRaw
                    ? parseDuration(durationRaw)
                    : metaTags
                        .find((m) => m.getAttribute("name") === "apple:description")
                        ?.textContent.split("Duration: ")?.[1]
                        .split("\"")?.[0] || "0:00",
                title: title || "Unknown Title",
                url: songURL,
                thumbnail:
                metaTags
                    .find((r) =>
                        ["og:image:secure_url", "og:image"].includes(
                            r.getAttribute("property")!,
                        ),
                    )
                    ?.getAttribute("content") ||
                "https://music.apple.com/assets/favicon/favicon-180.png",
                artist:(() => {
                    const metaMusician = res.querySelector("meta[property='music:musician']");
                    if (metaMusician) {
                        const artistUrl = metaMusician.getAttribute("content");
                        const match = artistUrl ? artistUrl.match(/\/artist\/([^/]+)/) : null;
                        if (match && match[1]) {
                            return match[1]
                                .split("-")
                                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                                .join(" ");
                        }
                    }
                    return res.querySelector(".song-subtitles__artists>a")?.textContent?.trim() || "Apple Music";
                })(),
            };

            return song;
        } catch (err) {
            return null;
        }
    }

    /**
   * Gets information about a playlist from its Apple Music URL
   * @param link - The Apple Music playlist URL
   * @returns The playlist information object or null if not found
   */
    public static async getPlaylistInfo(link: string): Promise<AppleMusicCollection | null> {
        const root = await getHTML(link);
        if (!root) return null;

        const titleElement = root.querySelector("meta[property=\"og:title\"]");
        const title = titleElement ? titleElement.getAttribute("content") : "Unknown Title";

        const descriptionElement = root.querySelector("meta[property=\"og:description\"]");
        const description = descriptionElement ? descriptionElement.getAttribute("content") : "No Description";

        const artworkElement = root.querySelector("meta[property=\"og:image\"]");
        const artwork = artworkElement ? artworkElement.getAttribute("content") : "";

        const tracks: AppleMusicTrack[] = [];
        const jsonLdElement = root.querySelector("script#schema\\:music-playlist");

        let artistNames = [];
        const serializedScript = root.querySelector("script#serialized-server-data");
        if (serializedScript) {
            try {
                const jsonData = JSON.parse(serializedScript.text);
                artistNames = jsonData[0].data.sections
                    .find((section: { id: string }) => section.id.includes("track-list"))
                    .items.filter((item: { id: string }) => item.id.includes("track-lockup"))
                    .map((i: { artistName: string }) => i.artistName);
            } catch (error) {
                //
            }
        }

        if (jsonLdElement) {
            const jsonLd = JSON.parse(jsonLdElement.text);

            if (jsonLd && jsonLd.track) {
                jsonLd.track.forEach((track: { name?: string; byArtist?: { name?: string }; duration?: string; url?: string }, index: number) => {
                    const artist = artistNames[index] || track.byArtist?.name || "Unknown Artist";
                    tracks.push({
                        id: track.url!.split("/").pop() || "",
                        title: track.name || "Unknown Title",
                        artist: artist,
                        duration: parseDuration(track.duration || "PT0S"),
                        url: track.url || "",
                        thumbnail: "https://music.apple.com/assets/favicon/favicon-180.png", // Default thumbnail
                    });
                });
            }
        }

        return {
            title: title || "Unknown Album",
            description,
            artwork: artwork || "https://music.apple.com/assets/favicon/favicon-180.png",
            tracks,
            url: link,
        };
    }

    /**
   * Gets information about an album from its Apple Music URL
   * @param link - The Apple Music album URL
   * @returns The album information object or null if not found
   */
    public static async getAlbumInfo(link: string): Promise<AppleMusicCollection | null> {
        const root = await getHTML(link.split("?")[0]);
        if (!root) return null;

        try {
            const titleElement = root.querySelector("meta[name=\"apple:title\"]");
            const title = titleElement ? titleElement.getAttribute("content") : "Unknown Album";

            const artworkElement = root.querySelector("meta[property=\"og:image\"]");
            const thumbnail = artworkElement ? artworkElement.getAttribute("content") : "https://music.apple.com/assets/favicon/favicon-180.png";

            const tracks: AppleMusicTrack[] = [];
            const jsonLdElement = root.querySelector("script#schema\\:music-album");
            let artistName = "Unknown Artist";

            if (jsonLdElement) {
                const jsonLd = JSON.parse(jsonLdElement.text);
                artistName = jsonLd.byArtist[0].name; 
        
                if (jsonLd && jsonLd.tracks) {
                    jsonLd.tracks.forEach((track: { url: string; duration?: string; name?: string }) => {
                        tracks.push({
                            id: track.url.split("/").pop() || "",
                            duration: parseDuration(track.duration || "PT0S"),
                            title: track.name || "Unknown Title",
                            url: track.url || "",
                            thumbnail: thumbnail || "https://music.apple.com/assets/favicon/favicon-180.png",
                            artist: artistName,
                        });
                    });
                }
            }

            return {
                id: root.querySelector("meta[name=\"apple:content_id\"]")?.getAttribute("content") || "",
                title: title || "Unknown Album",
                artwork: thumbnail || "https://music.apple.com/assets/favicon/favicon-180.png",
                artist: artistName,
                url: link,
                tracks,
                description: title,
            };
        } catch (err) {
            return null;
        }
    }
}