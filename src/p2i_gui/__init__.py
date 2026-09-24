"""Local UI and API for the independent p2i-core package."""

from .app import create_app


def serve(ir, *, host: str = "127.0.0.1", port: int = 8000):
    """Block while serving the local frontend and API."""
    import uvicorn
    from p2i import Harness, ModelIR, load

    if not isinstance(ir, (ModelIR, Harness)):
        ir = load(ir)
    uvicorn.run(create_app(ir), host=host, port=port)


__all__ = ["create_app", "serve"]
