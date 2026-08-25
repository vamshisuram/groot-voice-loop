const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const button = document.querySelector("#talk-button");
const status = document.querySelector("#status");
const transcriptElement = document.querySelector("#transcript");
const replyElement = document.querySelector("#reply");
let audioContext;

async function unlockAudio() {
  audioContext ??= new AudioContext();
  if (audioContext.state === "suspended") await audioContext.resume();
}

async function playSpeech(audioBytes) {
  await unlockAudio();
  const buffer = await audioContext.decodeAudioData(audioBytes);
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start();
  return new Promise((resolve) => { source.onended = resolve; });
}

if (!SpeechRecognition) {
  button.disabled = true;
  status.textContent = "Speech recognition is not available here. Use Chrome or Edge.";
} else {
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;

  button.addEventListener("pointerdown", () => {
    unlockAudio().catch((error) => console.error("[voice] could not unlock audio", error));
    recognition.start();
    button.textContent = "Listening… release to stop";
    status.textContent = "Listening";
  });
  button.addEventListener("pointerup", () => recognition.stop());
  button.addEventListener("pointercancel", () => recognition.stop());

  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    transcriptElement.textContent = transcript;
    status.textContent = "Groot is thinking…";
    console.info("[voice] transcript received", { transcript });
    try {
      const response = await fetch("/api/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript })
      });
      console.info("[voice] reply response", {
        status: response.status,
        requestId: response.headers.get("X-Request-Id"),
        contentType: response.headers.get("Content-Type")
      });
      if (!response.ok) {
        const details = await response.json();
        throw new Error(`[${details.requestId ?? "unknown"}] ${details.error}`);
      }
      const reply = response.headers.get("X-Groot-Reply");
      replyElement.textContent = reply;
      const audioBytes = await response.arrayBuffer();
      console.info("[voice] decoding audio", { reply, bytes: audioBytes.byteLength });
      playSpeech(audioBytes)
        .then(() => console.info("[voice] playback finished", { reply }))
        .catch((error) => {
          console.error("[voice] audio playback failed", error);
          status.textContent = "Audio playback failed; see the browser console.";
        });
      console.info("[voice] playback started", { reply });
      status.textContent = "Ready.";
    } catch (error) {
      console.error("[voice] voice loop failed", error);
      status.textContent = error.message;
    }
  };
  recognition.onerror = (event) => { status.textContent = `Microphone error: ${event.error}`; };
  recognition.onend = () => { button.textContent = "Hold to talk"; };
}
