export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36 Edg/109.0.1518.49";

export const appleMusicSongRegex = /^https?:\/\/music\.apple\.com\/.+?\/(song|album)\/.+?(\/.+?\?i=|\/)([0-9]+)$/;
export const appleMusicAlbumRegex = /^https?:\/\/music\.apple\.com\/.+?\/album\/.+\/([0-9]+)$/;
export const appleMusicPlaylistRegex = /^https?:\/\/music\.apple\.com\/.+?\/playlist\/.+\/pl\.(u-|pm-)?[a-zA-Z0-9]+$/;

export const isUrl = (url: string): boolean => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

export const parseAppleMusicUrl = (url: string) => {
    const match = url.match(/\/(\d+|\w+)(?:\?.*)?$/);
    return { id: match?.[1] || "" };
};