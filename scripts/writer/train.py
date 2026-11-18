"""Fine-tune google/flan-t5-small (77M parameters, Apache-2.0) to write a promotional message from customer facts.
The Bangla writer uses the same script on a shrunken google/mt5-small (prune_vocab.py): --init, --tokenizer, --data, --out.

Runs on an NVIDIA graphics card when PyTorch can use one, otherwise on the CPU (--device auto, the default);
--device cpu or --device gpu forces one. Adafactor keeps optimizer memory small (about 2 GB in total at batch 16).
Run:  scripts/writer/.venv/Scripts/python scripts/writer/train.py --steps 1000
Out:  scripts/writer/out/model (latest), scripts/writer/out/ckpt-<step>, scripts/writer/out/train_log.txt
"""
import argparse
import json
import random
import time
from pathlib import Path

import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from transformers.optimization import Adafactor

HERE = Path(__file__).resolve().parent
DATA, OUT = HERE / "out" / "data", HERE / "out"
BASE = "google/flan-t5-small"


def load(name, data=DATA):
    with open(Path(data) / f"{name}.jsonl", encoding="utf-8") as fh:
        return [json.loads(line) for line in fh]


def batches(rows, tok, size, rng, max_in, max_out):
    """Length-bucketed batches: sort within chunks of 50 batches so little padding is computed."""
    rows = rows[:]
    rng.shuffle(rows)
    chunk = size * 50
    out = []
    for i in range(0, len(rows), chunk):
        part = sorted(rows[i:i + chunk], key=lambda r: len(r["input"]) + len(r["target"]))
        out += [part[j:j + size] for j in range(0, len(part), size)]
    rng.shuffle(out)
    for b in out:
        x = tok([r["input"] for r in b], max_length=max_in, truncation=True, padding=True, return_tensors="pt")
        y = tok([r["target"] for r in b], max_length=max_out, truncation=True, padding=True, return_tensors="pt").input_ids
        y[y == tok.pad_token_id] = -100
        yield x, y


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", type=int, default=1000)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--eval-every", type=int, default=250)
    ap.add_argument("--init", default=BASE, help="start from this model (a folder continues an earlier run)")
    ap.add_argument("--offset", type=int, default=0, help="steps already trained when continuing: used in logs and checkpoint names")
    ap.add_argument("--checkpointing", action="store_true",
                    help="recompute activations instead of keeping them: slower steps, but no swapping on an 8 GB laptop")
    ap.add_argument("--threads", type=int, default=4, help="CPU threads; fewer keeps the computer cooler but trains slower")
    ap.add_argument("--rest", type=int, default=0, help="seconds to pause after every 25 steps so the computer can cool down")
    ap.add_argument("--data", default=str(DATA), help="folder with train/val .jsonl (out/data_bn for the Bangla writer)")
    ap.add_argument("--out", default=str(OUT), help="folder for model, checkpoints and the log")
    ap.add_argument("--tokenizer", default=BASE, help="tokenizer to use (the shrunken mT5 folder for the Bangla writer)")
    ap.add_argument("--device", choices=["auto", "gpu", "cpu"], default="auto",
                    help="auto: the graphics card if PyTorch can use it, otherwise the CPU")
    args = ap.parse_args()
    has_gpu = torch.cuda.is_available()
    if args.device == "gpu" and not has_gpu:
        raise SystemExit("No usable NVIDIA graphics card: PyTorch here is a CPU build, or the driver is too old for it. "
                         "Use --device cpu, or see the GPU note in scripts/writer/requirements.txt.")
    dev = torch.device("cuda" if has_gpu and args.device != "cpu" else "cpu")
    if hasattr(__import__("ctypes"), "windll"):  # Windows: no sleep while training runs (ends with the process)
        __import__("ctypes").windll.kernel32.SetThreadExecutionState(0x80000001)
    torch.manual_seed(0)
    torch.set_num_threads(args.threads)
    rng = random.Random(0)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    tok = AutoTokenizer.from_pretrained(args.tokenizer)
    model = AutoModelForSeq2SeqLM.from_pretrained(args.init).to(dev)
    if args.checkpointing:
        model.gradient_checkpointing_enable()
    train, val = load("train", args.data), load("val", args.data)

    lens_in = sorted(len(tok(r["input"]).input_ids) for r in train)
    lens_out = sorted(len(tok(r["target"]).input_ids) for r in train)
    pct = lambda a, q: a[min(len(a) - 1, int(q * len(a)))]
    max_in, max_out = pct(lens_in, 1.0) + 8, pct(lens_out, 1.0) + 8
    log_file = open(out_dir / "train_log.txt", "a", encoding="utf-8")

    def log(msg):
        line = f"[{time.strftime('%H:%M:%S')}] {msg}"
        print(line, flush=True)
        log_file.write(line + "\n")
        log_file.flush()

    log(f"device: {torch.cuda.get_device_name(0) if dev.type == 'cuda' else 'CPU'}"
        + ("" if dev.type == "cuda" or args.device == "cpu" else " (no graphics card that PyTorch can use was found)"))
    log(f"start {args} | train {len(train)} val {len(val)} | tokens in p50 {pct(lens_in, .5)} max {lens_in[-1]}, "
        f"out p50 {pct(lens_out, .5)} max {lens_out[-1]}")
    opt = Adafactor(model.parameters(), lr=args.lr, scale_parameter=False, relative_step=False, warmup_init=False)
    warm = 30
    sched = torch.optim.lr_scheduler.LambdaLR(
        opt, lambda s: min(1.0, (s + 1) / warm) * max(0.05, 1 - s / args.steps))

    def val_loss():
        model.eval()
        total, n = 0.0, 0
        with torch.no_grad():
            for x, y in batches(val, tok, 32, random.Random(1), max_in, max_out):
                total += model(**x.to(dev), labels=y.to(dev)).loss.item() * len(y)
                n += len(y)
        model.train()
        return total / n

    def samples():
        model.eval()
        with torch.no_grad():
            for r in val[:3]:
                x = tok(r["input"], return_tensors="pt").to(dev)
                out = model.generate(**x, max_new_tokens=max_out, num_beams=1, do_sample=False)
                log(f"  IN : {r['input']}\n  OUT: {tok.decode(out[0], skip_special_tokens=True)}")
        model.train()

    model.train()
    step, t0, run = 0, time.time(), 0.0
    while step < args.steps:
        for x, y in batches(train, tok, args.batch, rng, max_in, max_out):
            loss = model(**x.to(dev), labels=y.to(dev), use_cache=False).loss  # no key/value cache in training: less memory
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            sched.step()
            opt.zero_grad()
            step += 1
            run += loss.item()
            done = step + args.offset
            if step % 25 == 0:
                rate = (time.time() - t0) / step
                log(f"step {done}/{args.steps + args.offset} loss {run / 25:.4f} | {rate:.1f} s/step, ETA {(args.steps - step) * rate / 60:.0f} min")
                run = 0.0
                if args.rest and step < args.steps:
                    time.sleep(args.rest)  # cool-down pause (counted in the s/step rate)
            if step % args.eval_every == 0 or step == args.steps:
                log(f"step {done} val loss {val_loss():.4f}")
                samples()
                for d in (out_dir / f"ckpt-{done}", out_dir / "model"):
                    model.save_pretrained(d)
                    tok.save_pretrained(d)
                log(f"saved ckpt-{done}")
            if step >= args.steps:
                break
    log(f"done in {(time.time() - t0) / 60:.0f} min")


if __name__ == "__main__":
    main()
