import { serve } from "inngest/next";
import { inngest } from "@/jobs/client";
import { functions } from "@/jobs/functions";

// A step that waits for the language model can take minutes; Vercel's default stops a function sooner
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
