import { Inngest } from "inngest";

type Events = {
  "media/generate-image": { data: { mediaId: string } };
  "media/generate-video": { data: { mediaId: string } };
  "post/publish": { data: { postId: string } };
  "media/deleted": { data: { mediaId: string } };
  "post/deleted": { data: { postId: string } };
};

export const inngest = new Inngest({ id: "prodo", schemas: new Map() as any });

export type { Events };
