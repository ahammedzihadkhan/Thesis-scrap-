"""Export the fine-tuned writer to 8-bit ONNX for the browser (Transformers.js, dtype 'q8').

Run:  scripts/writer/.venv/Scripts/python scripts/writer/export.py [--model scripts/writer/out/model]
Out:  public/models/kroypulse-writer/{config.json, generation_config.json, tokenizer*.json,
      onnx/encoder_model_quantized.onnx, onnx/decoder_model_merged_quantized.onnx}
"""
import argparse
import shutil
from pathlib import Path

from onnxruntime.quantization import QuantType, quantize_dynamic
from optimum.exporters.onnx import main_export

HERE = Path(__file__).resolve().parent
DEST = HERE.parents[1] / "public" / "models" / "kroypulse-writer"
KEEP = ("config.json", "generation_config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=str(HERE / "out" / "model"))
    ap.add_argument("--dest", default=str(DEST))
    args = ap.parse_args()
    fp32, dest = HERE / "out" / "onnx_fp32", Path(args.dest)
    main_export(args.model, output=fp32, task="text2text-generation-with-past", device="cpu")
    (dest / "onnx").mkdir(parents=True, exist_ok=True)
    for name in ("encoder_model", "decoder_model_merged"):
        # Per-channel scales: with one scale per tensor the T5 encoder loses the facts (tested: 0 of 4 messages kept them).
        quantize_dynamic(fp32 / f"{name}.onnx", dest / "onnx" / f"{name}_quantized.onnx", weight_type=QuantType.QInt8,
                         per_channel=True, reduce_range=True, extra_options={"EnableSubgraph": True, "MatMulConstBOnly": True})
    for f in KEEP:
        shutil.copy(fp32 / f, dest / f)
    for f in sorted(dest.rglob("*")):
        if f.is_file():
            print(f"{f.relative_to(dest)}  {f.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
