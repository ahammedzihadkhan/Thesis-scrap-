// Downloads SmolLM2-360M-Instruct, a general small chat model, once into scripts/writer/out/models (outside public/,
// so it is not copied into the app). It is used only as the baseline in scripts/evalAiWriter.ts; the app's offline
// AI writer is built on this computer (see the README).
// Usage: npm run get-model
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MODEL = 'HuggingFaceTB/SmolLM2-360M-Instruct'; // Apache-2.0
const REVISION = 'a10cc1512eabd3dde888204e902eca88bddb4951'; // pinned, so every install gets the same model
const dest = path.join(path.resolve(import.meta.dirname, '..'), 'scripts', 'writer', 'out', 'models', MODEL);

for (const f of ['config.json', 'generation_config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'onnx/model_q4.onnx']) {
  const out = path.join(dest, f);
  if (existsSync(out)) { console.log('already here:', f); continue; }
  await mkdir(path.dirname(out), { recursive: true });
  const res = await fetch(`https://huggingface.co/${MODEL}/resolve/${REVISION}/${f}`);
  if (!res.ok) throw new Error(`Could not download ${f}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(out + '.part'));
  await rename(out + '.part', out); // a cut-off download never looks complete
  console.log('downloaded:', f);
}
