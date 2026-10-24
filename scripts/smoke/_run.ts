import { userMessage } from "@/core/errors";
import type { Usage } from "@/providers/usage";

/** Runs one real vendor call and prints the result and its cost. */
export async function smoke(name: string, fn: () => Promise<{ result: unknown; usage?: Usage | Usage[] }>) {
  const started = Date.now();
  try {
    const { result, usage } = await fn();
    const list = usage ? (Array.isArray(usage) ? usage : [usage]) : [];
    const cost = list.reduce((sum, u) => sum + u.costUsd, 0);
    console.log(`PASS ${name} (${Date.now() - started} ms, ~$${cost.toFixed(4)})`);
    console.log(JSON.stringify(result, null, 2).slice(0, 1500));
  } catch (err) {
    console.error(`FAIL ${name}: ${userMessage(err)}`);
    process.exitCode = 1;
  }
}
