import { serve } from "inngest/next";
import { inngest } from "@/jobs/client";
import { functions } from "@/jobs/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
