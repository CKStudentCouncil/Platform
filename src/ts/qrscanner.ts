import { setZXingModuleOverrides } from 'vue-qrcode-reader';
import zxingReaderWasm from 'zxing-wasm/reader/zxing_reader.wasm?url';

/**
 * Hand `vue-qrcode-reader` its QR decoder from our own origin.
 *
 * The scanner decodes with a WebAssembly build of ZXing. Left alone, it
 * downloads that binary from `fastly.jsdelivr.net` at the moment the camera
 * opens, and a school network or a phone that cannot reach that CDN turns the
 * download into a `Load failed` that nothing here can see. The library then
 * swallows the cause and rejects every frame it tries to decode with
 * `NotSupportedError: Barcode detection service unavailable`, from inside its
 * own animation-frame loop: unhandled, once per attempt, with the camera still
 * running and nothing on screen to say the scanner is dead.
 *
 * `zxing-wasm` is a direct dependency, pinned to the exact version the
 * library's bundled glue code was built against (`1.1.3`): the glue and the
 * binary only work as a pair, so a bump has to follow `vue-qrcode-reader`'s
 * own, not Dependabot's.
 *
 * The binary is fetched here rather than left to the library so that a failure
 * is something the page can answer for: it is awaited before the camera starts,
 * and the bytes go to the decoder as `wasmBinary`, which stops it requesting
 * anything itself. `locateFile` is set as well so that no fallback path can
 * reach back to the CDN.
 *
 * Resolves once the decoder is configured; rejects when the binary could not be
 * fetched, in which case nothing was configured and a later call tries again.
 */
let loading: Promise<void> | null = null;

export function loadQrDecoder(): Promise<void> {
  loading ??= fetchDecoder().catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

async function fetchDecoder(): Promise<void> {
  const response = await fetch(zxingReaderWasm);
  if (!response.ok) {
    throw new Error(`The QR decoder could not be loaded (HTTP ${response.status}).`);
  }
  const wasmBinary = await response.arrayBuffer();
  setZXingModuleOverrides({
    wasmBinary,
    locateFile: (path, prefix) => (path.endsWith('.wasm') ? zxingReaderWasm : prefix + path),
  });
}
