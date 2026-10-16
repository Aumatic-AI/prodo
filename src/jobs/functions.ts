import { generateImage } from "./generate-image";
import { generateVideo } from "./generate-video";
import { publishPost } from "./publish-post";

export const functions = [generateImage, generateVideo, publishPost];
