from fastapi.testclient import TestClient
import torch
from torch import nn
import p2i
from p2i_gui.app import create_app


def test_paged_model_reassembles_exactly_and_rejects_stale_snapshot():
    harness = p2i.Harness(nn.Sequential(nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 2)), example_inputs=(torch.randn(2, 4),))
    client = TestClient(create_app(harness))
    manifest = client.get('/api/model/manifest').json()
    original = client.get('/api/model').json()
    rebuilt = manifest['header']
    for kind, total in manifest['counts'].items():
        values, offset = [], 0
        while offset is not None:
            response = client.get(f'/api/evidence/{kind}', params={'offset': offset, 'limit': 3, 'snapshot_id': manifest['snapshot']})
            assert response.status_code == 200
            page = response.json()
            assert page['total'] == total and len(page['items']) <= 3
            values += page['items']
            offset = page['next_offset']
        if kind == 'calls':
            rebuilt['runtime']['calls'] = values
        else:
            rebuilt[kind] = values
    assert rebuilt == original
    assert client.get('/api/evidence/tensors', params={'limit': 501}).status_code == 422
    assert client.get('/api/evidence/tensors', params={'offset': -1}).status_code == 422
    assert client.get('/api/evidence/wrong').status_code == 404
    client.post('/api/harness/retrace', json={})
    assert client.get('/api/evidence/operations', params={'snapshot_id': manifest['snapshot']}).status_code == 409
    assert client.get('/api/model/manifest').json()['snapshot'] != manifest['snapshot']
