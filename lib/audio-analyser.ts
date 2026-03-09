/**
 * Analyser for live audio visualisation.
 * Ported from audio-orb.
 */
export class AudioAnalyser {
  private analyser: AnalyserNode;
  private bufferLength = 0;
  private dataArray: Uint8Array;

  constructor(node: AudioNode) {
    this.analyser = node.context.createAnalyser();
    this.analyser.fftSize = 32;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(new ArrayBuffer(this.bufferLength));
    node.connect(this.analyser);
  }

  update() {
    // TypeScript lib.dom.d.ts has a strict ArrayBuffer requirement; runtime accepts Uint8Array
    // @ts-expect-error - AnalyserNode.getByteFrequencyData accepts Uint8Array
    this.analyser.getByteFrequencyData(this.dataArray);
  }

  get data() {
    return this.dataArray;
  }
}
