import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { loadProgress } from "@/core/onboarding/progress";
import { RESEARCH_AGENTS, startRefresh } from "@/core/onboarding/research";
import { inngest } from "@/jobs/client";

// "Refresh brand": runs the whole research again and writes a new Bible draft
export const POST = apiHandler(async () => {
  const db = await createClient();
  const { lastActivityAt } = await loadProgress(db);
  const research = await startRefresh(db, lastActivityAt);
  await inngest.send({ name: "onboarding/started", id: research.attempt, data: { runId: research.id, attempt: research.attempt, agents: [...RESEARCH_AGENTS] } });
  return NextResponse.json(await loadProgress(db));
});
