import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { listPosts, createPost } from "@/core/posts";
import { inngest } from "@/jobs/client";

export const GET = apiHandler(async () => {
  const db = await createClient();
  const posts = await listPosts(db);
  return NextResponse.json(posts);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const db = await createClient();
  const body = await req.json();

  const post = await createPost(db, {
    media_id: body.media_id,
    status: body.publish_at ? "scheduled" : "draft",
    publish_at: body.publish_at || null,
    targets: body.targets,
  });

  if (!body.publish_at) {
    await inngest.send({
      name: "post/publish",
      data: { postId: post.id },
      id: post.id,
    });
    await (await createClient())
      .from("posts")
      .update({ status: "publishing" })
      .eq("id", post.id);
  }

  return NextResponse.json(post, { status: 201 });
});
