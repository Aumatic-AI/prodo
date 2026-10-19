import { Inngest } from "inngest";

type Events = {
  "media/generate-image": { data: { mediaId: string } };
  "media/generate-video": { data: { mediaId: string } };
  "post/publish": { data: { postId: string } };
  "post/check-status": { data: { postId: string; checkAt: string } };
  "media/deleted": { data: { mediaId: string } };
};

export const inngest = new Inngest({ id: "prodo", schemas: new Map() as any });

export type { Events };
