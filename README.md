# p2i-gui

React/TypeScript explorer and local FastAPI bridge for the observed P2I IR.
This package contains the existing Explore, Computation, Runtime, Edit and
Skill Library views. The UI shows actual tensor and operation evidence.

## Local development

Install `p2i-core` first, then `python -m pip install -e '.[test]'` in this
checkout. In `frontend/`, run `npm ci && npm run build`; the build is copied to
`src/p2i_gui/static` and served by `p2i_gui.serve(ir)` or `p2i.serve(ir)`.
For frontend development run `npm run dev`, with the API at port 8000.

```python
import p2i
from p2i_gui import serve
ir = p2i.trace(model, example_inputs=(x,))
serve(ir)
```

The built frontend assets are included in the Python distribution. A user
installing an already-built wheel does not need Node.js. The Python backend
delegates all analysis, architecture edits and skill logic to `p2i-core`.

## Save and reopen an edited model

With a live `Harness`, the Edit tab includes **Download checkpoint** and
**Open checkpoint**. A `.p2i` checkpoint contains the current architecture and
weights, plus example inputs when enabled. It restores only after the model
can be reconstructed and traced; a failed import keeps the active session.
Opening a checkpoint starts a new history at its saved revision.

```python
harness = p2i.Harness(model, example_inputs=(x,))
serve(harness)
# In another process after downloading a checkpoint:
harness = p2i.Harness.load("model-r1.p2i")
serve(harness)
```

Standard modules and bundled demos reopen independently. Custom forwards need
`Harness.load(path, model=YourModel(...))` or registered adapters. The browser
can reuse the active session's original model as a template. Without saved
examples, load the model in Python and start a Harness with new inputs.
Uploads are limited to 256 MiB; larger checkpoints can be loaded from Python.

The complete Python/CLI/SDK flow is documented in
[core's walkthrough](https://github.com/PtwoI/p2i-core/blob/main/docs/model-roundtrip.md).

## Verify

```bash
python -m pytest -q
cd frontend
npm ci
npm run build
npm run test:unit
npx playwright install chromium
cd ..
python tests/browser_runner.py --model transformer
python tests/browser_runner.py --model mlp
python tests/browser_runner.py --model cnn
```

Each browser flow starts a fresh real backend. The default suite checks
exploration/editing, checkpoint download/upload, and runtime/tensor views.
