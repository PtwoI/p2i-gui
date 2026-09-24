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
