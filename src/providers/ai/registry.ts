export type AiTask = "text" | "image" | "video" | "voice";

export interface AiProvider {
  generate(params: { prompt: string; options?: Record<string, any> }): Promise<any>;
}

const providers: Record<AiTask, string> = {
  text: "openai",
  image: "kie",
  video: "kie",
  voice: "elevenlabs",
};

export function providerFor(task: AiTask): string {
  return providers[task];
}
