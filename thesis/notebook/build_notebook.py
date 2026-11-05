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
# In Google Colab only the .ipynb is opened, so fetch the project first; does nothing anywhere else.
COLAB_CELL = '''# Google Colab: get the project code and data folder first (skipped when run locally).
import os, subprocess, sys
if "google.colab" in sys.modules and not os.path.isdir("../data"):
    if not os.path.isdir("/content/kroypulse"):
        subprocess.run(["git", "clone", "-q", "--depth", "1", "https://github.com/ahammedzihadkhan/Thesis-scrap-.git", "/content/kroypulse"], check=True)
    os.chdir("/content/kroypulse/thesis/notebook")
print("working folder:", os.getcwd())'''
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
nb.cells.insert(1, nbformat.v4.new_code_cell(COLAB_CELL))
out = here / "Extended_RFM_Thesis.ipynb"
if "--no-run" not in sys.argv:
    NotebookClient(nb, timeout=1800, kernel_name="python3", resources={"metadata": {"path": str(here)}}).execute()
nbformat.write(nb, out)
print("wrote", out)
