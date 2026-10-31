export interface RenderJob {
  /** Storage keys or https URLs. Referenced in args as {input0}, {input1}… */
  inputs: string[];
  /** ffmpeg arguments, without "ffmpeg". {output} is the result file; {dir} the job's folder (worker only) */
  args: string[];
  /** Where the result is saved in our storage */
  outputKey: string;
  contentType?: string;
  /** Captions (.ass storage key) to burn in after the main run, for backends that can't put them in the filter graph */
  captionsKey?: string | null;
}

export interface RenderStatus {
  status: "queued" | "running" | "done" | "failed";
  outputKey?: string;
  error?: string;
}

export type Readiness = { ok: true } | { ok: false; reason: string };

/** A place that runs ffmpeg for us. Both save the result at job.outputKey in our storage. */
export interface RenderBackend {
  id: "worker" | "upload-post";
  /** Captions go inside the filter graph with the brand font (fontsdir={dir}). False: the backend burns them in a second pass with its own fonts */
  captionsInGraph: boolean;
  ready(): Promise<Readiness>;
  submit(job: RenderJob): Promise<string>;
  /** Remotion compositions (our worker only) */
  render?(template: string, props: Record<string, unknown>, outputKey: string): Promise<string>;
  /** `outputKey` is passed back because some backends need it to store the finished file */
  status(id: string, outputKey: string): Promise<RenderStatus>;
}
