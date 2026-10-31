from io import BytesIO

from fastapi.testclient import TestClient
import pytest
import torch
from torch import nn

import p2i
from p2i.examples import make_demo
from p2i_gui.app import create_app


@pytest.mark.parametrize('name', ['mlp', 'cnn', 'transformer'])
def test_checkpoint_api_roundtrip(name):
    model, inputs = make_demo(name)
    harness = p2i.Harness(model, example_inputs=inputs)
    client = TestClient(create_app(harness))
    target = {'mlp': 'layers.0', 'cnn': 'features.0', 'transformer': 'head'}[name]
    edited = client.post('/api/harness/apply', json={
        'type': 'set_parameter', 'target': target, 'parameter': 'bias', 'value': False,
    }).json()
    assert edited['result']['committed']
    downloaded = client.post('/api/checkpoint/export', json={'expected_revision': 1})
    assert downloaded.status_code == 200
    assert downloaded.headers['cache-control'] == 'no-store'
    assert 'model-r1.p2i' in downloaded.headers['content-disposition']
    independent = p2i.load_model(downloaded.content)
    torch.testing.assert_close(independent(*inputs), harness.build()(*inputs), rtol=0, atol=0)
    # Move away from the checkpoint and then restore it through the same API.
    client.post('/api/harness/undo', json={'expected_revision': 1})
    restored = client.post('/api/checkpoint/import', content=downloaded.content,
                           headers={'Content-Type': 'application/octet-stream'})
    assert restored.status_code == 200, restored.text
    state = restored.json()['state']
    assert state['summary']['revision'] == state['summary']['observed_revision'] == 1
    assert state['summary']['baseline_revision'] == 1
    node = next(n for n in state['architecture']['nodes'] if n['qualified_name'] == target)
    assert node['parameters']['bias'] is False
    assert client.get('/api/model').json() == restored.json()['result']['model']
    assert client.post('/api/harness/validate', json={'backward': True}).json()['result']['backward_valid']


def test_rejected_import_keeps_active_model_and_revision():
    model, inputs = make_demo('mlp')
    client = TestClient(create_app(p2i.Harness(model, example_inputs=inputs)))
    before = client.get('/api/harness').json()
    response = client.post('/api/checkpoint/import', content=b'bad',
                           headers={'Content-Type': 'application/octet-stream'})
    assert response.status_code == 422
    assert client.get('/api/harness').json() == before
    assert client.post('/api/checkpoint/export', json={'expected_revision': 99}).status_code == 409
    assert client.post('/api/checkpoint/export', json={'include_inputs': 'false'}).status_code == 422
    assert client.post('/api/checkpoint/export', json=[], headers={'Origin': 'http://other.test'}).status_code == 403
    assert client.post('/api/checkpoint/import', json={}).status_code == 415


def test_readonly_view_can_open_an_editable_checkpoint():
    model = nn.Linear(4, 2)
    inputs = (torch.ones(1, 4),)
    client = TestClient(create_app(p2i.trace(model, inputs, static=False)))
    assert client.post('/api/checkpoint/export', json={}).status_code == 409
    from p2i.checkpoint import checkpoint_bytes
    response = client.post('/api/checkpoint/import', content=checkpoint_bytes(p2i.Harness(model, example_inputs=inputs)),
                           headers={'Content-Type': 'application/octet-stream'})
    assert response.status_code == 200
    assert client.get('/api/harness').json()['enabled']


def test_inputs_can_be_omitted_for_python_only_export():
    client = TestClient(create_app(p2i.Harness(nn.Linear(2, 2), example_inputs=(torch.ones(1, 2),))))
    data = client.post('/api/checkpoint/export', json={'include_inputs': False}).content
    payload = torch.load(BytesIO(data), weights_only=True)
    assert payload['example_inputs'] is None
    assert p2i.load_model(data)(torch.ones(1, 2)).shape == (1, 2)
    # A browser needs examples to generate a fresh observation.
    response = client.post('/api/checkpoint/import', content=data,
                           headers={'Content-Type': 'application/octet-stream'})
    assert response.status_code == 422
    assert 'example_inputs' in response.json()['detail']


def test_dimension_plan_preview_apply_and_stale_rejection():
    harness = p2i.Harness(nn.Sequential(nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 2)),
                          example_inputs=(torch.ones(2, 4),))
    client = TestClient(create_app(harness))
    plan = client.post('/api/harness/plan', json={
        'target': '0', 'parameter': 'out_features', 'value': 6, 'expected_revision': 0,
    }).json()['result']
    assert len(plan['action']['actions']) == 2
    assert client.get('/api/harness').json()['summary']['revision'] == 0
    assert client.post('/api/harness/preview', json=plan['action']).json()['result']['success']
    assert client.post('/api/harness/apply', json=plan['action']).json()['result']['committed']
    assert not client.post('/api/harness/apply', json=plan['action']).json()['result']['success']
    assert not client.post('/api/harness/plan', json={}).json()['result']['success']
    assert client.post('/api/harness/validate', json={'backward': True}).json()['result']['backward_valid']


@pytest.mark.parametrize('name', ['rnn', 'lstm', 'gru'])
def test_recurrent_checkpoint_api(name):
    model, inputs = make_demo(name)
    client = TestClient(create_app(p2i.Harness(model, example_inputs=inputs)))
    changes = {'type': 'batch', 'actions': [
        {'type': 'set_parameter', 'target': 'recurrent', 'parameter': 'hidden_size', 'value': 12},
        {'type': 'set_parameter', 'target': 'head', 'parameter': 'in_features', 'value': 12},
    ]}
    assert client.post('/api/harness/apply', json=changes).json()['result']['committed']
    data = client.post('/api/checkpoint/export', json={}).content
    restored = client.post('/api/checkpoint/import', content=data,
                           headers={'Content-Type': 'application/octet-stream'})
    assert restored.status_code == 200, restored.text
    assert client.post('/api/harness/validate', json={'backward': True}).json()['result']['backward_valid']
