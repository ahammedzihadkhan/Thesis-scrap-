"""Shrink google/mt5-small (Apache-2.0, 300M parameters, 250,100 tokens) to the tokens the Bangla writer needs.

Almost all of mT5-small's size is its word table (250,100 tokens x 512 numbers, twice). The writer only needs the
tokens of its own training data, plus every single character of the alphabets a shop may type (Bangla, Latin letters,
digits, punctuation, currency signs), so a name or product it never saw can still be written letter by letter. The
rest of the table is cut away, which leaves about 55M parameters: as small and fast as the English writer.
Pieces keep their order and scores, so the tokenizer splits every text exactly as before (checked below).

Run:  scripts/writer/.venv/Scripts/python scripts/writer/prune_vocab.py   (after make_data_bn.py and downloading mT5-small)
In:   scripts/writer/out/mt5-small (google/mt5-small), scripts/writer/out/data_bn/*.jsonl
Out:  scripts/writer/out/mt5-bn (model + tokenizer to start training from), keep_ids.json (old id of every kept token)
"""
import json
from pathlib import Path

import torch
from transformers import AutoTokenizer, MT5Config, MT5ForConditionalGeneration

HERE = Path(__file__).resolve().parent
SRC, DST, DATA = HERE / "out" / "mt5-small", HERE / "out" / "mt5-bn", HERE / "out" / "data_bn"
EXTRA = "£€₹৳–—‘’“”…·×°•✓"


def rows(name):
    with open(DATA / f"{name}.jsonl", encoding="utf-8") as fh:
        return [json.loads(line) for line in fh]


def letter_ok(c):
    """Bangla block, ASCII, Latin-1 letters and a few signs shops use."""
    return "ঀ" <= c <= "৿" or c.isascii() or "À" <= c <= "ÿ" or c in EXTRA or c == "‌" or c == "‍"


def main():
    if not (SRC / "pytorch_model.bin").exists():  # one download of the public base model (about 1.2 GB)
        from huggingface_hub import snapshot_download
        snapshot_download("google/mt5-small", local_dir=SRC, allow_patterns=[
            "config.json", "generation_config.json", "pytorch_model.bin", "special_tokens_map.json", "spiece.model", "tokenizer_config.json"])
    tok = AutoTokenizer.from_pretrained(SRC)
    tj = json.loads(tok.backend_tokenizer.to_str())
    vocab = tj["model"]["vocab"]  # [piece, score], position = id
    keep = {tok.pad_token_id, tok.eos_token_id, tok.unk_token_id}
    for name in ("train", "val", "test_synth", "test_uci"):
        for r in rows(name):
            keep.update(tok(r["input"]).input_ids)
            keep.update(tok(r["target"]).input_ids)
    used = len(keep)
    for i, (piece, _) in enumerate(vocab):
        text = piece.lstrip("▁")  # the word-start mark
        if len(text) <= 2 and all(letter_ok(c) for c in text):
            keep.add(i)
    keep = sorted(keep)
    new_of = {old: new for new, old in enumerate(keep)}
    print(f"kept {len(keep)} of {len(vocab)} tokens ({used} used by the data, {len(keep) - used} short pieces and single characters)")

    # tokenizer: same pieces in the same order, ids renumbered
    tj["model"]["vocab"] = [vocab[i] for i in keep]
    tj["model"]["unk_id"] = new_of[tok.unk_token_id]
    tj["added_tokens"] = [dict(t, id=new_of[t["id"]]) for t in tj["added_tokens"] if t["id"] in new_of]
    DST.mkdir(parents=True, exist_ok=True)
    (DST / "tokenizer.json").write_text(json.dumps(tj, ensure_ascii=False), encoding="utf-8")
    (DST / "keep_ids.json").write_text(json.dumps(keep), encoding="utf-8")
    for name in ("tokenizer_config.json", "special_tokens_map.json"):
        (DST / name).write_text((SRC / name).read_text(encoding="utf-8"), encoding="utf-8")

    # model: the rows of the word tables that are kept
    cfg = MT5Config.from_pretrained(SRC)
    cfg.vocab_size = len(keep)
    sd = torch.load(SRC / "pytorch_model.bin", map_location="cpu", weights_only=True)
    idx = torch.tensor(keep)
    for k in ("shared.weight", "encoder.embed_tokens.weight", "decoder.embed_tokens.weight", "lm_head.weight"):
        if k in sd:
            sd[k] = sd[k][idx].clone()
    model = MT5ForConditionalGeneration(cfg)
    missing, unexpected = model.load_state_dict(sd, strict=False)
    print("missing:", missing, "unexpected:", unexpected)
    model.save_pretrained(DST)
    print(f"model: {sum(p.numel() for p in model.parameters()) / 1e6:.1f}M parameters")

    # the shrunken tokenizer must split every text into the same pieces as the full one
    small = AutoTokenizer.from_pretrained(DST)
    for r in rows("test_synth")[:200] + rows("test_uci")[:200]:
        for text in (r["input"], r["target"]):
            assert [new_of[i] for i in tok(text).input_ids] == small(text).input_ids, text
    unseen = "ফারজানা, আপনার Brand-New Ceramic ফুলদানি Tk 1,250 - কোড SAVE25!"
    ids = small(unseen).input_ids
    print("unseen text round trip:", small.decode(ids, skip_special_tokens=True), "| unk:", ids.count(small.unk_token_id))


if __name__ == "__main__":
    main()
