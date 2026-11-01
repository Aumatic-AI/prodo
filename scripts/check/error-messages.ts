// Offline checks of the error messages: every failure says who failed, what they were doing and
// their own reason, with keys and account ids taken out. Vendor replies are faked; nothing leaves this computer.
// Run: npm run smoke scripts/check/error-messages.ts
import assert from "node:assert/strict";

let passed = 0;
const check = async (name: string, fn: () => void | Promise<void>) => {
  try {
    await fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

/** What the next fetch answers: a reply, or a thrown network error */
let reply: () => Response | Promise<Response> = () => new Response("{}");
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

/** The AppError a call throws */
async function failure(call: () => Promise<unknown>): Promise<{ message: string; type: string; retryable: boolean; retryAfterMs?: number }> {
  try {
    await call();
  } catch (err) {
    return err as never;
  }
  throw new Error("expected an error, got none");
}

async function main() {
  // Fake keys, so the adapters run here without the real ones; fetch is faked before any adapter loads
  for (const name of ["OPENAI_API_KEY", "FIRECRAWL_API_KEY", "SCRAPECREATORS_API_KEY", "TWELVELABS_API_KEY", "ELEVENLABS_API_KEY", "KIE_API_KEY", "ZERNIO_API_KEY", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
    process.env[name] ||= "test-key";
  }
  process.env.R2_ENDPOINT ||= "https://account.r2.cloudflarestorage.com";
  globalThis.fetch = (async () => reply()) as typeof fetch;
  console.warn = () => {};

  const { cleanReason, vendorDetail, networkReason, statusText } = await import("@/core/error-text");
  const { userMessage, AppError } = await import("@/core/errors");
  const { statusError, jsonOrThrow, request } = await import("@/providers/http");
  const { failureMessage } = await import("@/jobs/to-inngest-error");
  const openai = await import("@/providers/ai/openai");
  const firecrawl = await import("@/providers/crawl/firecrawl");
  const scrapecreators = await import("@/providers/social/scrapecreators");
  const twelvelabs = await import("@/providers/video-understanding/twelvelabs");
  const elevenlabs = await import("@/providers/ai/elevenlabs");
  const kie = await import("@/providers/ai/kie");
  const zernio = await import("@/providers/publishing/zernio");
  const r2 = await import("@/providers/storage/r2");
  const { z } = await import("zod");

  await check("cleanReason: keys, tokens and account ids never show; HTML pages give their title; long text is cut", () => {
    const said = cleanReason("Incorrect API key sk-proj-AbCdEf1234567890xyz for org-AbCdEf123456789012 in proj_2ggmgVeHU1Lo3T, Bearer abc.def.ghi123 at https://x.com/a?key=secret&b=1");
    assert.ok(!/sk-proj-AbC|org-AbC|proj_2gg|abc\.def|secret/.test(said), said);
    assert.match(said, /\[key\].*\[account\].*\[project\].*Bearer \[key\].*key=\[hidden\]&b=1/);
    assert.equal(cleanReason("<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head><body>…</body></html>"), "502 Bad Gateway");
    assert.equal(cleanReason("x".repeat(400), 50).length, 50);
  });

  await check("vendorDetail: every error shape the vendors use", () => {
    assert.equal(vendorDetail({ error: { message: "No credits", code: "credit_balance_exhausted" } }), "No credits [credit_balance_exhausted]");
    assert.equal(vendorDetail({ success: false, error: "Scrape timed out" }), "Scrape timed out");
    assert.equal(vendorDetail({ code: "video_file_broken", message: "The video file is broken" }), "The video file is broken [video_file_broken]");
    assert.equal(vendorDetail({ detail: [{ loc: ["body", "url"], msg: "field required" }] }), "body.url: field required");
    assert.equal(vendorDetail({ detail: { status: "quota_exceeded", message: "Quota exceeded" } }), "Quota exceeded [quota_exceeded]");
    assert.equal(vendorDetail({ errors: [{ message: "a" }, { message: "b" }] }), "a; b");
    assert.equal(vendorDetail(undefined, "<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>"), "Access Denied [AccessDenied]");
    assert.equal(vendorDetail(undefined, "plain text reason"), "plain text reason");
  });

  await check("statusError: each status says who, what they were doing, the status and their words; types and retries fit", () => {
    const e401 = statusError("Firecrawl", 401, "Invalid token", undefined, "reading a.com");
    assert.equal(e401.message, 'Firecrawl (reading a.com) rejected our API key (401 Unauthorized): "Invalid token".');
    assert.deepEqual([e401.type, e401.retryable], ["NOT_CONFIGURED", false]);
    assert.equal(statusError("ScrapeCreators", 402, "Out of credits").type, "OUT_OF_CREDIT");
    const e429 = statusError("Zernio", 429, undefined, 12);
    assert.deepEqual([e429.message, e429.retryable, e429.retryAfterMs], ["Zernio says too many requests (429 Too Many Requests).", true, 12_000]);
    assert.deepEqual([statusError("X", 504).type, statusError("X", 503).type, statusError("X", 404).type, statusError("X", 422).type], ["TIMEOUT", "PROVIDER_DOWN", "INVALID_INPUT", "INVALID_INPUT"]);
    assert.equal(statusText(418), "418");
  });

  await check("jsonOrThrow: the vendor's reason from the body; a 2xx that isn't JSON is an error too", async () => {
    const bad = await failure(() => jsonOrThrow("Twelve Labs", json({ code: "video_resolution_too_low", message: "Resolution too low" }, 400), undefined, "watching a.com/v.mp4"));
    assert.equal(bad.message, 'Twelve Labs (watching a.com/v.mp4) didn\'t accept the request (400 Bad Request): "Resolution too low [video_resolution_too_low]".');
    const html = await failure(() => jsonOrThrow("Firecrawl", new Response("<html><title>Just a moment</title></html>", { status: 200 })));
    assert.match(html.message, /Firecrawl sent a reply that isn't JSON: "Just a moment"/);
  });

  await check("request: network failures and timeouts say exactly what happened; a wrong address isn't retried", async () => {
    reply = () => {
      throw new TypeError("fetch failed", { cause: Object.assign(new Error("getaddrinfo ENOTFOUND nope.example"), { code: "ENOTFOUND" }) });
    };
    const dns = await failure(() => request("The website", "https://nope.example/about"));
    assert.equal(dns.message, "Couldn't reach The website (nope.example/about): the address doesn't exist (DNS lookup found nothing) (ENOTFOUND).");
    assert.equal(dns.retryable, false);
    reply = () => {
      throw new TypeError("fetch failed", { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) });
    };
    assert.equal((await failure(() => request("Firecrawl", "https://api.firecrawl.dev/v2/scrape"))).retryable, true);
    reply = () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    };
    const slow = await failure(() => request("Firecrawl", "https://api.firecrawl.dev/v2/scrape", {}, 30_000));
    assert.deepEqual([slow.message, slow.type], ["Firecrawl didn't answer within 30 seconds (api.firecrawl.dev/v2/scrape).", "TIMEOUT"]);
    assert.equal(networkReason(new TypeError("fetch failed", { cause: { code: "EWHATEVER", message: "odd failure" } })), "odd failure (EWHATEVER)");
  });

  await check("userMessage: database errors with their code in plain words; code bugs, zod and anything else exactly", () => {
    assert.equal(
      userMessage({ message: 'duplicate key value violates unique constraint "x_pkey"', code: "23505", details: "Key (id)=(1) already exists.", hint: null }),
      'Database error: a row like this already exists (23505): "duplicate key value violates unique constraint "x_pkey" · Key (id)=(1) already exists.".'
    );
    assert.match(userMessage({ message: 'column "style" does not exist', code: "42703", details: null, hint: null }), /a migration hasn't been applied/);
    assert.match(userMessage({ message: "TypeError: fetch failed", code: "", details: "ECONNRESET", hint: "" }), /^Couldn't reach the database: "ECONNRESET"/);
    assert.match(userMessage({ message: "AbortError", code: "", details: "", hint: "Request was aborted (timeout or manual cancellation)" }), /^The database didn't answer in time/);
    assert.match(userMessage({ message: "Could not find the table 'public.x' in the schema cache", code: "PGRST205", details: null, hint: null }), /doesn't know this table \(a migration hasn't been applied\) \(PGRST205\)/);
    assert.match(userMessage({ message: "terminating connection", code: "08006", details: null, hint: null }), /^Database error: the connection to the database failed \(08006\)/);
    assert.equal(userMessage(new TypeError("Cannot read properties of undefined (reading 'map')")), "Internal error (TypeError): Cannot read properties of undefined (reading 'map').");
    const zodError = z.object({ name: z.string() }).safeParse({ name: 3 });
    assert.match(userMessage(!zodError.success ? zodError.error : null), /^Unexpected data at "name": Expected string, received number/);
    assert.equal(userMessage(new AppError("Ours, as written.", "UNKNOWN", true)), "Ours, as written.");
    assert.equal(userMessage("plain"), "plain");
    assert.equal(userMessage({ weird: 1 }), 'Unexpected error: {"weird":1}.');
  });

  await check("failureMessage: Inngest and hosting failures in plain words with their own text", () => {
    assert.match(failureMessage({ message: "Task timed out after 300.02 seconds" }), /^Our server stopped the step: it ran longer than the hosting time limit allows/);
    assert.match(failureMessage({ message: "Timed out waiting for invoked function to complete" }), /didn't finish in time/);
    assert.match(failureMessage({ name: "Server returned a fatal error", message: "Your server returned HTTP 504 before the SDK responded." }), /^Our server stopped the step: it ran longer than the hosting time limit allows/);
    assert.match(failureMessage({ name: "output_too_large", message: "Your function's response body exceeds the maximum size limit" }), /^A step's result was too big/);
    assert.match(failureMessage({ message: "Unable to reach SDK URL" }), /^Inngest couldn't reach our server \("Unable to reach SDK URL"\)\.$/);
    assert.equal(failureMessage({ name: "Error", message: "" }), "It stopped without a message (Error).");
    assert.equal(failureMessage({ message: 'OpenAI is out of credit (429 Too Many Requests): "x".' }), 'OpenAI is out of credit (429 Too Many Requests): "x".');
  });

  // OpenAI's real replies (as of 2026-11), through the adapter
  const limit = (message: string, headers: Record<string, string> = {}) => json({ error: { message, type: "tokens", code: "rate_limit_exceeded" } }, 429, headers);
  await check("OpenAI: out of credit (credit_balance_exhausted) is OUT_OF_CREDIT, with OpenAI's words, not 'busy'", async () => {
    reply = () => json({ error: { message: "You have no credits remaining. Add credits to continue using the API.", type: "insufficient_quota", param: null, code: "credit_balance_exhausted" } }, 429);
    const e = await failure(() => openai.embed(["hi"]));
    assert.equal(e.message, 'OpenAI is out of credit (429 Too Many Requests, credit_balance_exhausted): "You have no credits remaining. Add credits to continue using the API.".');
    assert.deepEqual([e.type, e.retryable], ["OUT_OF_CREDIT", false]);
  });

  await check("OpenAI: a daily limit or a too-large request stops; a per-minute limit retries after OpenAI's wait plus a spread", async () => {
    reply = () => limit("Rate limit reached for text-embedding-3-small in organization org-AbCdEf123456789012 on requests per day (RPD): Limit 2000, Used 2000.");
    const daily = await failure(() => openai.embed(["hi"]));
    assert.match(daily.message, /^OpenAI's daily limit for this account is used up \(429 Too Many Requests, rate_limit_exceeded\): "Rate limit reached .* \[account\] on requests per day/);
    assert.equal(daily.retryable, false);
    reply = () => limit("Request too large for gpt-x on tokens per min (TPM): Limit 30000, Requested 45000.");
    assert.equal((await failure(() => openai.embed(["hi"]))).retryable, false);
    reply = () => limit("Rate limit reached on tokens per min (TPM). Please try again in 1m30s.");
    const minute = await failure(() => openai.embed(["hi"]));
    assert.ok(minute.retryable && minute.retryAfterMs! >= 90_000 && minute.retryAfterMs! <= 110_000, String(minute.retryAfterMs));
    reply = () => limit("Rate limit reached on requests per min (RPM).", { "retry-after-ms": "1200" });
    const soon = await failure(() => openai.embed(["hi"]));
    assert.ok(soon.retryAfterMs! >= 5_000 && soon.retryAfterMs! <= 25_000, String(soon.retryAfterMs));
  });

  await check("OpenAI: wrong key, unknown model, its own outage and a dropped connection, each exact", async () => {
    reply = () => json({ error: { message: "Incorrect API key provided: sk-proj-AbCdEf1234567890xyz.", type: "invalid_request_error", code: "invalid_api_key" } }, 401);
    assert.equal((await failure(() => openai.embed(["hi"]))).message, 'OpenAI rejected our API key (401 Unauthorized, invalid_api_key): "Incorrect API key provided: [key].".');
    reply = () => json({ error: { message: "The model `gpt-x` does not exist", type: "invalid_request_error", code: "model_not_found" } }, 404);
    assert.match((await failure(() => openai.text("hi"))).message, /^OpenAI doesn't have this model, or this account isn't allowed to use it \(404 Not Found, model_not_found\)/);
    reply = () => json({ error: { message: "The server had an error", type: "server_error" } }, 500);
    assert.equal((await failure(() => openai.text("hi"))).retryable, true);
    reply = () => {
      throw new TypeError("fetch failed", { cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }) });
    };
    assert.equal((await failure(() => openai.text("hi"))).message, "Couldn't reach OpenAI: the connection was dropped (ECONNRESET).");
  });

  const answer = (content: string | null, extra: Record<string, unknown> = {}) =>
    json({ id: "c", object: "chat.completion", created: 0, model: "m", choices: [{ index: 0, message: { role: "assistant", content, refusal: null, ...extra }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
  await check("OpenAI: spend limits stop, an overload waits as asked, a verification wall says so", async () => {
    reply = () => json({ error: { message: "You exceeded your project spend limit.", type: "insufficient_quota", code: "project_spend_limit_exceeded" } }, 429);
    const spend = await failure(() => openai.text("x"));
    assert.ok(spend.message.startsWith("The OpenAI project's spend limit is reached (429 Too Many Requests, project_spend_limit_exceeded)"), spend.message);
    assert.deepEqual([spend.type, spend.retryable], ["OUT_OF_CREDIT", false]);
    reply = () => json({ error: { message: "The server is overloaded.", type: "service_unavailable_error", code: "server_is_overloaded" } }, 503, { "retry-after": "10" });
    const busy = await failure(() => openai.text("x"));
    assert.ok(busy.retryable && busy.retryAfterMs! >= 10_000 && busy.retryAfterMs! <= 30_000, String(busy.retryAfterMs));
    reply = () => json({ error: { message: "Your organization must be verified to use the model `gpt-x`.", type: "invalid_request_error", code: null } }, 400);
    assert.match((await failure(() => openai.text("x"))).message, /^OpenAI needs the organization verified before it can use this model \(400 Bad Request\)/);
  });

  await check("OpenAI replies: wrong shape, not JSON, cut off and refused, each said exactly", async () => {
    const schema = z.object({ items: z.array(z.object({ price: z.number() })) });
    reply = () => answer('{"items":[{"price":"12"}]}');
    assert.equal((await failure(() => openai.structured(schema, "x"))).message, 'OpenAI\'s reply didn\'t have the expected shape at "items.0.price": Expected number, received string.');
    reply = () => answer("Sure! Here you go");
    assert.match((await failure(() => openai.structured(schema, "x"))).message, /^OpenAI's reply wasn't valid JSON: "Sure! Here you go"/);
    reply = () => {
      const res = { id: "c", object: "chat.completion", created: 0, model: "m", choices: [{ index: 0, message: { role: "assistant", content: '{"items":[', refusal: null }, finish_reason: "length" }], usage: { prompt_tokens: 1, completion_tokens: 4096 } };
      return json(res);
    };
    assert.match((await failure(() => openai.text("x"))).message, /cut off: it reached the length limit \(4096 tokens\)/);
    reply = () => answer(null, { refusal: "I can't help with that." });
    const refused = await failure(() => openai.text("x"));
    assert.deepEqual([refused.message, refused.type], ['OpenAI declined to answer: "I can\'t help with that.".', "CONTENT_BLOCKED"]);
  });

  await check("Firecrawl: a page that answers 404 isn't passed on as content; Firecrawl's own failure keeps its words", async () => {
    reply = () => json({ success: true, data: { markdown: "Page not found", metadata: { statusCode: 404, sourceURL: "https://www.a.com/old" } } });
    const gone = await failure(() => firecrawl.scrape("https://www.a.com/old"));
    assert.deepEqual([gone.message, gone.retryable], ["a.com/old answered 404 Not Found when Firecrawl read it.", false]);
    reply = () => json({ success: false, error: "Insufficient credits to perform this request." }, 402);
    const credit = await failure(() => firecrawl.scrape("https://a.com"));
    assert.deepEqual(
      [credit.message, credit.type],
      ['Firecrawl (reading a.com): it\'s out of credit (402 Payment Required, insufficient_credits): "Insufficient credits to perform this request.".', "OUT_OF_CREDIT"]
    );
    reply = () => json({ success: false, error: "We apologize for the inconvenience but we do not support this site." }, 403);
    const blocked = await failure(() => firecrawl.scrape("https://a.com"));
    assert.deepEqual([blocked.message.startsWith("Firecrawl (reading a.com): it doesn't read this website (Firecrawl blocks it) (403 Forbidden, UNSUPPORTED_SITE)"), blocked.retryable], [true, false]);
    reply = () => json({ success: false, code: "SCRAPE_TIMEOUT", error: "The scrape operation timed out." }, 408);
    const slow = await failure(() => firecrawl.scrape("https://a.com"));
    assert.deepEqual([slow.type, slow.retryable], ["TIMEOUT", true]);
    reply = () => json({ success: false, code: "SCRAPE_DNS_RESOLUTION_ERROR", error: "DNS resolution failed for hostname a.com" });
    assert.equal((await failure(() => firecrawl.scrape("https://a.com"))).message, 'Firecrawl (reading a.com): the website\'s address doesn\'t exist (DNS lookup failed) (SCRAPE_DNS_RESOLUTION_ERROR): "DNS resolution failed for hostname a.com".');
  });

  await check("Kie: every body code in plain words with its msg; failed tasks say why and whether a retry helps", async () => {
    reply = () => json({ code: 402, msg: "Credits insufficient", data: null });
    const credit = await failure(() => kie.createImageTask("a dress"));
    assert.deepEqual([credit.message.startsWith("Kie.ai (starting "), credit.message.endsWith(': it\'s out of credit (code 402): "Credits insufficient".'), credit.type], [true, true, "OUT_OF_CREDIT"]);
    reply = () => json({ code: 500, msg: "This field is required: prompt", data: null });
    assert.equal((await failure(() => kie.createImageTask(""))).type, "INVALID_INPUT");
    reply = () => new Response("<html><title>502 Bad Gateway</title></html>", { status: 502 });
    assert.match((await failure(() => kie.createImageTask("a dress"))).message, /sent a reply we couldn't read \(502 Bad Gateway\): "502 Bad Gateway"/);
    const flagged = kie.taskError({ state: "fail", resultJson: "", failCode: "400", failMsg: "Your prompt was flagged by Website as violating content policies." });
    assert.equal(flagged.type, "CONTENT_BLOCKED");
    const rejected = kie.taskError({ state: "fail", resultJson: "", failCode: "400", failMsg: "Image size exceeds maximum of 26214400 bytes" }, "picture");
    assert.deepEqual([rejected.message, rejected.retryable], ['Kie.ai couldn\'t make the picture: "Image size exceeds maximum of 26214400 bytes" (failCode 400).', false]);
    assert.equal(kie.taskError({ state: "fail", resultJson: "", failCode: "500", failMsg: "Internal Error - Timeout" }).retryable, true);
  });

  await check("Zernio: documented codes, the platform's own words, and the 409 duplicate without a code", async () => {
    reply = () => json({ error: "Account disconnected", code: "ACCOUNT_DISCONNECTED", platformError: { error_user_msg: "The session was invalidated." } }, 403);
    const gone = await failure(() => zernio.zernioCall("/posts", { method: "POST" }));
    assert.equal(gone.message, 'Zernio (/posts): the social account is disconnected; reconnect it in Settings → Connected accounts (403 Forbidden, ACCOUNT_DISCONNECTED): "Account disconnected · The session was invalidated.".');
    assert.equal(gone.type, "ACCOUNT_DISCONNECTED");
    reply = () => json({ error: "Duplicate content", details: { existingPostId: "p1" } }, 409);
    assert.match((await failure(() => zernio.zernioCall("/posts", { method: "POST" }))).message, /the same post went to this account in the last 24 hours \(post p1\)/);
    reply = () => json({ error: "Rate limit exceeded", details: { retryAfterSeconds: 20 } }, 429, { "retry-after": "20" });
    assert.equal((await failure(() => zernio.zernioCall("/accounts"))).retryAfterMs, 20_000);
  });

  await check("R2 storage: S3 codes in plain words; a delete that answers 200 still reports each file it couldn't delete", async () => {
    const xml = (code: string, message: string) => `<?xml version="1.0"?><Error><Code>${code}</Code><Message>${message}</Message></Error>`;
    reply = () => new Response(xml("SignatureDoesNotMatch", "The request signature we calculated does not match"), { status: 403 });
    const signed = await failure(() => r2.upload("b/media/m/9x16.png", Buffer.from("x"), "image/png"));
    assert.ok(signed.message.startsWith("File storage (saving b/media/m/9x16.png): the request's signature didn't match"), signed.message);
    reply = () => new Response(xml("InternalError", "We encountered an internal error"), { status: 500 });
    assert.equal((await failure(() => r2.upload("k", Buffer.from("x"), "image/png"))).retryable, true);
    reply = () => new Response(`<DeleteResult><Error><Key>a/b.png</Key><Code>AccessDenied</Code><Message>Access Denied</Message></Error></DeleteResult>`, { status: 200 });
    assert.equal((await failure(() => r2.deleteFiles(["a/b.png", "a/c.png"]))).message, "File storage couldn't delete 1 of 2 files; the first, a/b.png: Access Denied (AccessDenied).");
  });

  await check("ScrapeCreators: what was asked for, and its reason, also when a 200 says it failed", async () => {
    reply = () => json({ success: false, message: "Instagram is rate limiting us, try again" });
    const failed = await failure(() => scrapecreators.profile("instagram", "royalgypsy3"));
    assert.equal(failed.message, 'ScrapeCreators (instagram profile, royalgypsy3) reported a failure: "Instagram is rate limiting us, try again".');
    reply = () => json({ success: false, error: "forbidden", errorStatus: 403, message: "Profile is age restricted" }, 403);
    const aged = await failure(() => scrapecreators.profile("instagram", "royalgypsy3"));
    assert.equal(aged.message, 'ScrapeCreators (instagram profile, royalgypsy3): the profile or post is age-restricted, so it can\'t be read (403 Forbidden, forbidden): "Profile is age restricted".');
    reply = () => json({ success: false, message: "Shoot, IG is blocking us. Try again and it should work." }, 500);
    assert.equal((await failure(() => scrapecreators.profile("instagram", "royalgypsy3"))).retryable, true);
    // The older endpoints' "not found" placeholder inside a 200 is no data, not a profile
    reply = () => json({ success: true, error: "not_found", errorStatus: 404, message: "Account doesn't exist", credits_charged: 1 });
    assert.equal((await scrapecreators.profile("instagram", "royalgypsy3")).data, null);
    reply = () => json({ message: "Not enough credits" }, 402);
    assert.match((await failure(() => scrapecreators.googleSearch("royal gypsy kaftans"))).message, /^ScrapeCreators \(google search, royal gypsy kaftans\) is out of credit \(402 Payment Required\): "Not enough credits"/);
  });

  await check("Twelve Labs: documented codes in plain words with its own message; a cut-off or unreadable answer says so", async () => {
    reply = () => json({ code: "video_duration_too_short", message: "The video is shorter than 4 seconds." }, 400);
    const short = await failure(() => twelvelabs.analyze("https://cdn.a.com/v.mp4", "x"));
    assert.equal(short.message, 'Twelve Labs (watching cdn.a.com/v.mp4): the video is too short to watch (400 Bad Request, video_duration_too_short): "The video is shorter than 4 seconds.".');
    assert.deepEqual([short.type, short.retryable], ["INVALID_INPUT", false]);
    reply = () => json({ code: "workload_allowance_exhausted", message: "Allowance used." }, 422);
    assert.equal((await failure(() => twelvelabs.analyze("https://cdn.a.com/v.mp4", "x"))).type, "OUT_OF_CREDIT");
    reply = () => json({ code: "too_many_requests", message: "Try again later" }, 429, { "retry-after": "40" });
    assert.equal((await failure(() => twelvelabs.analyze("https://cdn.a.com/v.mp4", "x"))).retryAfterMs, 40_000);
    reply = () => json({ id: "a", data: '{"moments":[', finish_reason: "length" });
    assert.match((await failure(() => twelvelabs.analyze("https://cdn.a.com/v.mp4", "x"))).message, /the answer was cut off at the length limit/);
    reply = () => json({ id: "a", data: "not json at all", finish_reason: "stop" });
    assert.match((await failure(() => twelvelabs.analyze("https://cdn.a.com/v.mp4", "x"))).message, /answered, but not in valid JSON: "not json at all"/);
  });

  await check("ElevenLabs: new (detail.code) and old (detail.status) replies, 422 lists, and a music suggestion", async () => {
    reply = () => json({ detail: { type: "payment_required", code: "insufficient_credits", message: "Not enough credits.", status: "insufficient_credits" } }, 402);
    const credit = await failure(() => elevenlabs.generateSpeech("Hello"));
    assert.deepEqual([credit.message, credit.type], ['ElevenLabs: it\'s out of credit (402 Payment Required, insufficient_credits): "Not enough credits.".', "OUT_OF_CREDIT"]);
    reply = () => json({ detail: { status: "voice_not_found", message: "A voice with that ID was not found." } }, 404);
    assert.match((await failure(() => elevenlabs.generateSpeech("Hello"))).message, /^ElevenLabs: the voice isn't available any more; pick another voice \(404 Not Found, voice_not_found\)/);
    reply = () => json({ detail: [{ loc: ["body", "text"], msg: "field required", type: "value_error.missing" }] }, 422);
    assert.match((await failure(() => elevenlabs.generateSpeech("Hello"))).message, /didn't accept the request \(422 Unprocessable Content\): "body\.text: field required"/);
    reply = () => json({ detail: { status: "bad_prompt", message: "Prompt names an artist.", data: { prompt_suggestion: "An upbeat pop track" } } }, 400);
    assert.match((await failure(() => elevenlabs.generateMusic("like Taylor Swift", 20))).message, /rejected the music description .* It suggests: "An upbeat pop track"\.$/);
  });
}

main().then(() => console.log(`\n${passed} checks passed${process.exitCode ? ", some FAILED" : ""}`));
