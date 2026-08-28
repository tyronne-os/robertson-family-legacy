// Lazy-loaded, cached Kokoro TTS engine. Model downloads once per browser
// (cached by the browser/service worker layer transformers.js uses) and then
// generates narration audio fully client-side — no server calls.

let ttsPromise = null

export function loadTTS(onProgress) {
  if (!ttsPromise) {
    ttsPromise = import('kokoro-js').then(({ KokoroTTS, env }) => {
      // Hugging Face Spaces (and most static hosts) don't send the
      // Cross-Origin-Opener/Embedder-Policy headers required for
      // SharedArrayBuffer, so the multi-threaded WASM backend hangs
      // instead of failing. Forcing a single thread selects the
      // non-threaded WASM binary, which works everywhere.
      if (env?.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.numThreads = 1
      }
      return KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: onProgress,
      })
    })
  }
  return ttsPromise
}

export async function synthesize(text, voice = 'af_heart', onProgress) {
  const tts = await loadTTS(onProgress)
  const audio = await tts.generate(text, { voice })
  return URL.createObjectURL(audio.toBlob())
}
