# Groot Voice Loop

The smallest useful voice-agent architecture:

```text
microphone → browser speech recognition → Node rule → ElevenLabs TTS → speakers
```

It has no framework or runtime dependency. The browser transcribes speech, the server decides whether it is a greeting, and ElevenLabs converts the resulting Groot text into audio. Your API key stays on the server.

## Run it

1. Create an ElevenLabs API key and choose a voice ID in the [ElevenLabs dashboard](https://elevenlabs.io/app/home).
2. Copy `.env.example` to `.env`, then fill in both values.
3. Run `npm start` and open `http://localhost:3000` in Chrome or Edge.
4. Hold the button, speak, and release it.

## What to learn from each module

| Module | Responsibility | Why it is separate |
| --- | --- | --- |
| `public/app.js` | microphone, transcript, playback | Browser-only capabilities stay at the edge. |
| `server.js:chooseReply` | agent decision | You can later replace this one function with an LLM. |
| `server.js:synthesize` | ElevenLabs request | TTS credentials and provider details are isolated. |

## Intent rule

Greetings (`hi`, `hello`, `hey`, `greetings`, or a good-morning/evening phrase) produce `Groot`; all other speech produces `Grooooot`.

## Learning gaps to address next

1. **Speech recognition is browser-provided**, not ElevenLabs STT; it is convenient for learning but varies by browser and may use a cloud provider.
2. **Turn-taking** is manual (hold/release), not voice-activity detection.
3. **Latency** is non-streaming: transcription finishes, then TTS is generated, then playback starts.
4. **Conversation state** does not yet exist; a real agent needs history, interruption handling, and clear data boundaries.
5. **Reliability/security** needs input limits, authentication, rate limiting, retries, observability, and a managed secret before deployment.

For real-time production voice, ElevenLabs’ Speech Engine can handle STT, turn-taking, interruptions, and TTS while your server owns the response logic. This small project makes each piece visible first. See [Speech Engine overview](https://elevenlabs.io/docs/overview/capabilities/speech-engine) and [ElevenLabs TTS quickstart](https://elevenlabs.io/docs/eleven-api/quickstart).
