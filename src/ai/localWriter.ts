/**
 * Offline message writer: a small fine-tuned model (scripts/writer) that runs in a Web Worker on this computer's CPU.
 * Every draft goes through the fact check; when no draft passes, callers keep the shop's normal template.
 */
import { checkMessage, layoutMessage } from './aiWording';
import { factsToInput, type WriterFacts } from './messageFacts';

export const WRITER_URL = '/models/kroypulse-writer/config.json';

export interface Written {
  text: string;
  personal: boolean; // uses the name and a product the customer bought
  ms: number; // model time for the accepted draft
}

let worker: Worker | null = null;
let nextId = 0;
let queue: Promise<unknown> = Promise.resolve();
const waiting = new Map<number, (r: { text?: string; error?: string; ms?: number }) => void>();

function generate(input: string, sample: boolean): Promise<{ text: string; ms: number }> {
  if (!worker) {
    worker = new Worker(new URL('./writerWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      waiting.get(e.data.id)?.(e.data);
      waiting.delete(e.data.id);
    };
  }
  const id = nextId++;
  const run = () =>
    new Promise<{ text: string; ms: number }>((resolve, reject) => {
      waiting.set(id, (r) => (r.error ? reject(new Error(r.error)) : resolve({ text: r.text ?? '', ms: r.ms ?? 0 })));
      worker!.postMessage({ id, input, sample });
    });
  const result = queue.then(run, run); // one request at a time
  queue = result.catch(() => undefined);
  return result;
}

/** True when the trained model is in public/models (it is built locally, see the README). */
export async function writerInstalled(): Promise<boolean> {
  try {
    return (await fetch(WRITER_URL, { method: 'HEAD', cache: 'no-store' })).ok;
  } catch {
    return false;
  }
}

/**
 * Up to `tries` drafts: sampled ones first for variety, the model's most likely wording last.
 * Returns the first draft that passes the fact check and is personal, else the first that passes, else null.
 */
export async function writeMessage(facts: WriterFacts, tries = 3): Promise<Written | null> {
  const input = factsToInput(facts);
  let fallback: Written | null = null;
  for (let i = 0; i < tries; i++) {
    const { text, ms } = await generate(input, i < tries - 1);
    const check = checkMessage(facts, text);
    if (!check.ok) continue;
    const written = { text: layoutMessage(text), personal: check.personal, ms };
    if (check.personal) return written;
    fallback ??= written;
  }
  return fallback;
}
