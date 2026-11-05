"""Turn thesis_pipeline.py (percent format) into Extended_RFM_Thesis.ipynb and execute it.

Usage (from this folder):  python build_notebook.py          # build + run
                           python build_notebook.py --no-run # build only
"""
import re
import sys
from pathlib import Path

import nbformat
from nbclient import NotebookClient

here = Path(__file__).resolve().parent
src = (here / "thesis_pipeline.py").read_text(encoding="utf-8")
cells = []
for block in re.split(r"^# %%", src, flags=re.M)[1:]:
    head, _, body = block.partition("\n")
    if head.strip() == "[markdown]":
        cells.append(nbformat.v4.new_markdown_cell("\n".join(l[2:] if l.startswith("# ") else l.lstrip("#") for l in body.strip().splitlines())))
    else:
        cells.append(nbformat.v4.new_code_cell(body.strip()))

nb = nbformat.v4.new_notebook(cells=cells, metadata={"kernelspec": {"name": "python3", "display_name": "Python 3", "language": "python"}})
# Inline figures in Jupyter (the script itself runs headless).
nb.cells.insert(1, nbformat.v4.new_code_cell("%matplotlib inline"))
out = here / "Extended_RFM_Thesis.ipynb"
if "--no-run" not in sys.argv:
    NotebookClient(nb, timeout=1800, kernel_name="python3", resources={"metadata": {"path": str(here)}}).execute()
nbformat.write(nb, out)
print("wrote", out)
