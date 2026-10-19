import { generateImage } from "./generate-image";
import { generateVideo } from "./generate-video";
import { publishPost } from "./publish-post";
import { checkPostStatus } from "./check-post-status";

export const functions = [generateImage, generateVideo, publishPost, checkPostStatus];
