import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";

export interface SaveImageResult {
  uri: string;
  assetId?: string;
}

async function ensurePermission(): Promise<void> {
  const current = await MediaLibrary.getPermissionsAsync();
  if (current.granted) return;
  const next = await MediaLibrary.requestPermissionsAsync();
  if (!next.granted) {
    throw new Error("Permission to save to your photos was denied");
  }
}

function guessExtension(url: string, fallback = "jpg"): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.(jpg|jpeg|png|webp)$/);
    if (match) return match[1];
  } catch {
    // Ignore parse errors; fall through.
  }
  return fallback;
}

export async function saveRemoteImageToLibrary(
  url: string,
  albumName = "IRIS",
): Promise<SaveImageResult> {
  await ensurePermission();

  const ext = guessExtension(url);
  const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
  const target = `${cacheDir}iris-snapshot-${Date.now()}.${ext}`;

  const download = await FileSystem.downloadAsync(url, target);
  if (download.status !== 200) {
    throw new Error(`Download failed (${download.status})`);
  }

  const asset = await MediaLibrary.createAssetAsync(download.uri);

  try {
    const album = await MediaLibrary.getAlbumAsync(albumName);
    if (album) {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    } else {
      await MediaLibrary.createAlbumAsync(albumName, asset, false);
    }
  } catch {
    // Album placement is best-effort; the asset is already in the camera roll.
  }

  return { uri: asset.uri, assetId: asset.id };
}
