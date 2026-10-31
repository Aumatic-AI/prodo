// Where every file lives, and its public link. Safe in the browser: no secrets here.
//
//   <business id>/brand/logo/<id>.png          the logo (+ <id>-on-light.png, <id>-on-dark.png)
//   <business id>/brand/photos/<id>.<ext>      products, people, place (what it is is in the database)
//   <business id>/brand/videos/<id>.<ext>      the client's own videos
//   <business id>/brand/references/<id>.<ext>  posts and ads the client likes
//   <business id>/media/<media id>/<file>      finished files of one media item (9x16.mp4, slide-01.png…)
//   work/<business id>/<media id>/<file>       in-between files (AI photos, voice, music, captions);
//                                              R2 deletes them after 90 days
//   tmp/<path>                                 job and test files; R2 deletes them after 7 days
//   shared/fonts/<font>-<weight>.ttf           one font cache for every business
//   shared/sfx/<name>.wav                      sound effects for videos
//
// Files are named by their database id. Files made before multi-tenant keep their old paths; the
// database rows say whose they are.

export type BrandFolder = "logo" | "photos" | "videos" | "references";

/** Top folders that belong to no single business */
export const SHARED_ROOTS = ["work", "tmp", "shared"];

function safe(businessId: string, part: string): string {
  if (!businessId) throw new Error("A storage key needs a business id");
  if (!part || part.includes("..") || part.includes("/")) throw new Error(`Not a valid file name: ${part}`);
  return part;
}

/** The folder one kind of brand file goes in, e.g. "<business id>/brand/photos/" */
export function brandFolder(businessId: string, folder: BrandFolder): string {
  return `${safe(businessId, businessId)}/brand/${folder}/`;
}

export function brandKey(businessId: string, folder: BrandFolder, id: string, ext: string): string {
  return `${brandFolder(businessId, folder)}${safe(businessId, id)}.${ext}`;
}

/** A recoloured version of the logo, next to it: "<id>-on-dark.png" */
export function logoVariantKey(businessId: string, logoKey: string, name: string): string {
  const id = (logoKey.split("/").pop() ?? "logo").replace(/\.\w+$/, "");
  return brandKey(businessId, "logo", `${id}-${name}`, "png");
}

/** A finished file of one media item */
export function mediaKey(businessId: string, mediaId: string, name: string): string {
  return `${safe(businessId, businessId)}/media/${safe(businessId, mediaId)}/${safe(businessId, name)}`;
}

/** An in-between file used to make one media item (deleted after 90 days) */
export function workKey(businessId: string, mediaId: string, name: string): string {
  return `work/${safe(businessId, businessId)}/${safe(businessId, mediaId)}/${safe(businessId, name)}`;
}

/** A job or test file (deleted after 7 days) */
export function tmpKey(path: string): string {
  if (!path || path.includes("..")) throw new Error(`Not a valid path: ${path}`);
  return `tmp/${path.replace(/^\/+/, "")}`;
}

export function fontKey(file: string): string {
  return `shared/fonts/${safe("shared", file)}`;
}

/** A sound effect every video can use (scripts/setup/sfx.ts puts them there) */
export function sfxKey(name: string): string {
  return `shared/sfx/${safe("shared", name)}.wav`;
}

/** "9:16" → "9x16" */
export const ratioName = (ratio: string) => ratio.replace(":", "x");

/**
 * Name of a finished file: "9x16.png", then "9x16-r1.png" for a redo. A redo gets a new name, so a
 * cached copy of the old file is never shown.
 */
export function finalName(base: string, round: number, ext: string): string {
  return `${base}${round > 0 ? `-r${round}` : ""}.${ext}`;
}

/** True when the key is in the business's own folder: the only keys a client may hand us for new rows. */
export function inBusinessFolder(businessId: string, key: string): boolean {
  return !!businessId && key.startsWith(`${businessId}/`) && !key.includes("..");
}

/** True for any file of the business: its own folder or its in-between files. */
export function ownedBy(businessId: string, key: string): boolean {
  return inBusinessFolder(businessId, key) || (!!businessId && key.startsWith(`work/${businessId}/`) && !key.includes(".."));
}

/**
 * The file's public link (Cloudflare R2's public address). The only place a key becomes a URL;
 * never store the result.
 */
export function publicUrl(key: string): string {
  const base = (process.env.NEXT_PUBLIC_MEDIA_URL ?? "").replace(/\/$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_MEDIA_URL is not set");
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}
