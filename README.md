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

## Guided and batch editing (0.4.2)

Constructor edits can include connected dimensions in Sequential containers.
Preview shows the proposed downstream changes and explains where automatic
suggestions stop. **Batch edit without JSON** lets you select multiple modules,
parameters and typed values, then validate and commit them as one revision.
Changing a draft invalidates its preview; commit submits exactly the previewed
proposal. Advanced structural actions remain available through JSON.

Try the new offline recurrent demos with `p2i demo rnn --edit`, `p2i demo lstm
--edit` or `p2i demo gru --edit`. To change recurrent hidden width, add rows for
`recurrent.hidden_size` and `head.in_features` before previewing. Their tuple
outputs remain visible in runtime inspection and checkpoints reopen independently.

`python tests/browser_runner.py --model lstm --scripts guided` checks the
no-JSON batch, failed partial edit, preview invalidation, commit, checkpoint
restore and backward validation. `--model mlp --scripts guided` and `--model
cnn --scripts guided` exercise connected dimension suggestions.

## Bounded evidence transport (0.4.3)

The viewer reads `/api/model/manifest`, then `/api/evidence/{kind}` pages with
at most 500 records and three concurrent requests. Loading progress is visible
and unmount cancels outstanding requests. Every page carries one snapshot ID;
a retrace/import during loading returns HTTP 409 so observations cannot mix.
Supported collections are modules, operations, tensors, module_edges,
data_edges and calls. `/api/model` remains available for existing clients.

The backend still retains the observed IR in memory, and the viewer eventually
assembles its graph in memory. Paging bounds individual responses and provides
cancelable loading; it is not an out-of-core model tracing implementation.

The connected-edit option now covers supported ResNet/BERT/ViT architecture
rules as well as Sequential containers. Their proposed changes remain visible
in Preview before Commit.
