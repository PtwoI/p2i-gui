"""Bounded transport of one observed evidence snapshot."""
from uuid import uuid4
from fastapi import HTTPException, Query

KINDS = ('modules', 'operations', 'tensors', 'module_edges', 'data_edges', 'calls')


def install_evidence_routes(app, observed):
    active_model, token = None, None

    def snapshot():
        nonlocal active_model, token
        model = observed()
        if model is not active_model:
            active_model, token = model, uuid4().hex
        return model, token

    def items(model, kind):
        return (model.runtime.calls if model.runtime else []) if kind == 'calls' else getattr(model, kind)

    @app.get('/api/model/manifest')
    async def manifest():
        model, current = snapshot()
        header = model.model_dump(mode='json', exclude=set(KINDS) | {'runtime'})
        header['runtime'] = model.runtime.model_dump(mode='json', exclude={'calls'}) if model.runtime else None
        return {'snapshot': current, 'header': header,
                'counts': {kind: len(items(model, kind)) for kind in KINDS}, 'page_limit': 500}

    @app.get('/api/evidence/{kind}')
    async def evidence(kind: str, offset: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500),
                       snapshot_id: str | None = None):
        if kind not in KINDS:
            raise HTTPException(404, 'Unknown evidence collection')
        model, current = snapshot()
        if snapshot_id is not None and snapshot_id != current:
            raise HTTPException(409, 'Model evidence changed; request a new manifest')
        values = items(model, kind)
        end = min(offset + limit, len(values))
        return {'snapshot': current, 'kind': kind, 'offset': offset, 'limit': limit,
                'total': len(values), 'next_offset': end if end < len(values) else None,
                'items': [item.model_dump(mode='json') for item in values[offset:end]]}
