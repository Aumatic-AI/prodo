import { ai } from "@/providers/ai/registry";
import { smoke } from "./_run";

// Makes one small image (~$0.04) and waits up to 2 minutes for it
await smoke("kie image", async () => {
  const { data: taskId, usage } = await ai.image.create("A single red apple on a white table, studio light", "1:1", [], "1K");
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const status = await ai.image.status(taskId);
    if (status.state === "fail") throw ai.task.error(status);
    if (status.state === "success") return { result: { taskId, url: ai.task.resultUrl(status) }, usage };
  }
  return { result: { taskId, state: "still generating after 2 min" }, usage };
});

// Kie answers 200 with an error code; this must come back as a plain error
await smoke("kie bad input (expected FAIL with a plain message)", async () => {
  const { data } = await ai.image.create("", "1:1");
  return { result: data };
});
