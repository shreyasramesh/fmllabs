/**
 * AudioWorklet processor that forwards raw PCM samples to the main thread.
 * Used for ElevenLabs Scribe realtime speech-to-text.
 */
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs, _outputs, _parameters) {
    const input = inputs[0];
    if (input?.length > 0) {
      const channel = input[0];
      if (channel?.length > 0) {
        this.port.postMessage({ samples: channel });
      }
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
