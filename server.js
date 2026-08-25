import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { randomUUID } from "node:crypto";

loadEnv();

const port = Number(process.env.PORT ?? 3000);
const publicDir = join(process.cwd(), "public");
const MAX_REQUEST_BODY_BYTES = 10 * 1024;

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function readTextBody(request, maxBytes) {
  const chunks = [];
  let bytesReceived = 0;

  for await (const chunk of request) {
    bytesReceived += chunk.length;
    if (bytesReceived > maxBytes) {
      throw new HttpError(413, `Request body exceeds the ${maxBytes / 1024} KB limit.`);
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function loadEnv() {
  const envFile = join(process.cwd(), ".env");
  if (!existsSync(envFile)) return;

  // Minimal .env reader so this learning project has no npm dependencies.
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

function chooseReply(transcript) {
  const greeting = /\b(hi|hello|hey|greetings|good\s+(morning|afternoon|evening))\b/i;
  return greeting.test(transcript) ? "Groot" : "Grooooot";
}

async function synthesize(text) {
  const key = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voiceId || key.startsWith("your_") || voiceId.startsWith("your_")) {
    throw new Error("Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to .env first.");
  }

  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`);
  url.searchParams.set("output_format", "mp3_44100_128");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      Accept: "audio/mpeg"
    },
    body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" })
  });

  if (!response.ok) throw new Error(`ElevenLabs returned ${response.status}: ${await response.text()}`);
  return response.arrayBuffer();
}

const mimeTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/reply") {
    const requestId = randomUUID().slice(0, 8);
    const startedAt = performance.now();
    try {
      const raw = await readTextBody(request, MAX_REQUEST_BODY_BYTES);
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new HttpError(400, "Request body must be valid JSON.");
      }
      const { transcript = "" } = payload;
      if (typeof transcript !== "string" || !transcript.trim()) {
        throw new HttpError(400, "Say something first.");
      }
      const reply = chooseReply(transcript);
      console.info(`[${requestId}] transcript=${JSON.stringify(transcript)} reply=${JSON.stringify(reply)}`);
      const audio = await synthesize(reply);
      const elapsedMs = Math.round(performance.now() - startedAt);
      console.info(`[${requestId}] ElevenLabs success bytes=${audio.byteLength} duration_ms=${elapsedMs}`);
      response.writeHead(200, {
        "Content-Type": "audio/mpeg",
        "X-Groot-Reply": reply,
        "X-Request-Id": requestId
      });
      response.end(Buffer.from(audio));
    } catch (error) {
      const elapsedMs = Math.round(performance.now() - startedAt);
      console.error(`[${requestId}] failed duration_ms=${elapsedMs}`, error);
      response.writeHead(error.statusCode ?? 502, { "Content-Type": "application/json", "X-Request-Id": requestId });
      response.end(JSON.stringify({ requestId, error: error.message }));
    }
    return;
  }

  const route = request.url === "/" ? "/index.html" : request.url;
  const file = normalize(join(publicDir, route));
  if (!file.startsWith(publicDir) || !existsSync(file)) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": mimeTypes[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
}).listen(port, () => console.log(`Groot is listening at http://localhost:${port}`));
