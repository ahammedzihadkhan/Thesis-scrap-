/// <reference lib="webworker" />
// Runs the offline message writer off the main thread, so the page stays responsive while it writes.
import { env, pipeline } from '@huggingface/transformers';
import ortMjs from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';

// Everything comes from this app on 127.0.0.1: no model or runtime is fetched from the internet
// (without wasmPaths, Transformers.js would load the runtime from a CDN).
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/models/';
env.useBrowserCache = false;
env.useWasmCache = false;
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = { mjs: ortMjs, wasm: ortWasm };

type Generate = (input: string, options: Record<string, unknown>) => Promise<{ generated_text: string }[]>;
type Lang = 'en' | 'bn';
const MODEL: Record<Lang, string> = { en: 'kroypulse-writer', bn: 'kroypulse-writer-bn' };
const MAX_TOKENS: Record<Lang, number> = { en: 200, bn: 260 }; // Bangla messages are longer in tokens
const writers: Partial<Record<Lang, Promise<Generate>>> = {}; // each model is loaded the first time its language is used

self.onmessage = async (e: MessageEvent<{ id: number; input: string; sample: boolean; lang?: Lang }>) => {
  const { id, input, sample, lang = 'en' } = e.data;
  try {
    writers[lang] ??= pipeline('text2text-generation', MODEL[lang], { dtype: 'q8' }) as unknown as Promise<Generate>;
    const generate = await writers[lang]!;
    const t = performance.now();
    const options = sample ? { max_new_tokens: MAX_TOKENS[lang], do_sample: true, top_k: 40, temperature: 0.8 } : { max_new_tokens: MAX_TOKENS[lang] };
    const [out] = await generate(input, options);
    self.postMessage({ id, text: out.generated_text.trim(), ms: performance.now() - t });
  } catch (err) {
    delete writers[lang]; // try loading again next time
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
