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
  
  // Kokoro has a practical limit around 1500-2000 chars per generate() call.
  // Split long text into chunks to avoid synthesis failures on full chapters.
  const MAX_CHUNK_LENGTH = 1500
  const chunks = []
  let currentChunk = ''
  
  const paragraphs = text.split('\n\n')
  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 2 > MAX_CHUNK_LENGTH && currentChunk.length > 0) {
      chunks.push(currentChunk)
      currentChunk = para
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + para : para
    }
  }
  if (currentChunk) chunks.push(currentChunk)
  
  // Generate audio for each chunk, then concatenate
  const audioChunks = []
  let totalProcessed = 0
  const totalLength = text.length
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    try {
      const audio = await tts.generate(chunk, { voice })
      audioChunks.push(audio)
      totalProcessed += chunk.length
      if (onProgress) {
        onProgress({ status: 'progress', loaded: totalProcessed, total: totalLength })
      }
    } catch (err) {
      console.error(`Failed to synthesize chunk ${i}:`, err)
      throw err
    }
  }
  
  // Concatenate all audio blobs
  if (audioChunks.length === 0) throw new Error('No audio generated')
  if (audioChunks.length === 1) return URL.createObjectURL(audioChunks[0].toBlob())
  
  // For multiple chunks, concatenate the audio data
  const totalSamples = audioChunks.reduce((sum, a) => sum + a.data.length, 0)
  const sampleRate = audioChunks[0].sample_rate
  const concatenated = new Float32Array(totalSamples)
  
  let offset = 0
  for (const audio of audioChunks) {
    concatenated.set(audio.data, offset)
    offset += audio.data.length
  }
  
  // Create a merged audio object
  const merged = {
    data: concatenated,
    sample_rate: sampleRate,
    toBlob() {
      const WAV_HEADER_SIZE = 44
      const buffer = new ArrayBuffer(WAV_HEADER_SIZE + concatenated.length * 2)
      const view = new DataView(buffer)
      
      // WAV header
      const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i))
      }
      writeString(0, 'RIFF')
      view.setUint32(4, 36 + concatenated.length * 2, true)
      writeString(8, 'WAVE')
      writeString(12, 'fmt ')
      view.setUint32(16, 16, true)
      view.setUint16(20, 1, true) // PCM
      view.setUint16(22, 1, true) // mono
      view.setUint32(24, sampleRate, true)
      view.setUint32(28, sampleRate * 2, true)
      view.setUint16(32, 2, true)
      view.setUint16(34, 16, true)
      writeString(36, 'data')
      view.setUint32(40, concatenated.length * 2, true)
      
      // PCM data
      let offset2 = WAV_HEADER_SIZE
      for (let i = 0; i < concatenated.length; i++) {
        const s = Math.max(-1, Math.min(1, concatenated[i]))
        view.setInt16(offset2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
        offset2 += 2
      }
      
      return new Blob([buffer], { type: 'audio/wav' })
    }
  }
  
  return URL.createObjectURL(merged.toBlob())
}
