from pathlib import Path
from urllib.parse import urlparse
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from p2i.ir import ModelIR

def create_app(ir):
    from p2i.harness import Harness
    harness=ir if isinstance(ir,Harness) else None
    if harness:
        if harness.latest_ir is None:harness.retrace()
        ir=harness.latest_ir
    app=FastAPI(title='p2i',description='Local model explorer and optional deterministic editing harness')
    def observed():return harness.latest_ir if harness else ir
    def state():
        if not harness:return {'enabled':False}
        return {'enabled':True,'summary':harness.observe(),'architecture':harness.observe(level='architecture'),'history':harness.history(),'observed_configuration':harness.observed_configuration}
    @app.get('/api/model')
    async def model():return observed().model_dump(mode='json')
    @app.get('/api/modules')
    async def modules():return [m.model_dump(mode='json') for m in observed().modules]
    @app.get('/api/inspection')
    async def inspection():return harness.inspection.as_dict() if harness and harness.inspection else {'tensors':{},'operations':{}}
    @app.get('/api/harness')
    async def harness_state():return state()
    @app.get('/api/comparison')
    async def comparison():
        if not harness or not harness.previous_observation:return {'available':False}
        from p2i.harness.comparison import compare_observations
        with harness._lock:
            before=harness.previous_observation
            after={'model':harness.latest_ir.model_dump(mode='json'),'revision':harness.observed_revision,'configuration':harness.observed_configuration,'inspection':harness.inspection.as_dict() if harness.inspection else {'tensors':{},'operations':{}}}
            return {'available':True,'before':before,'after':after,'diff':compare_observations(before,after)}
    @app.post('/api/harness/{command}')
    async def command(command:str,request:Request):
        if not harness:raise HTTPException(409,'Editing requires a live Harness session. Use p2i demo transformer --edit.')
        # Local mutations are same-origin JSON only; no credentials or remote execution.
        origin=request.headers.get('origin')
        if origin and urlparse(origin).netloc!=request.headers.get('host'):raise HTTPException(403,'Cross-origin edits are not allowed')
        if 'application/json' not in request.headers.get('content-type',''):raise HTTPException(415,'Use application/json')
        try:body=await request.json()
        except Exception:raise HTTPException(422,'Invalid JSON request')
        if not isinstance(body,dict):raise HTTPException(422,'Expected a JSON object')
        for key in ('backward','capture_values'):
            if key in body and type(body[key]) is not bool:raise HTTPException(422,f'{key} must be boolean')
        try:
            if command in ('preview','apply'):result=getattr(harness,command)(body).model_dump(mode='json')
            elif command=='validate':result=harness.validate(backward=body.get('backward',False)).model_dump(mode='json')
            elif command in ('undo','redo'):result=getattr(harness,command)(expected_revision=body.get('expected_revision'))
            elif command=='retrace':
                with harness._lock:
                    if body.get('expected_revision') is not None and body['expected_revision']!=harness.architecture().revision:raise ValueError('Stale revision')
                    new=harness.retrace(capture_values=body.get('capture_values',False));result={'success':True,'model':new.model_dump(mode='json')}
            else:raise HTTPException(404,'Unknown harness command')
            return {'result':result,'state':state()}
        except ValueError as exc:return {'result':{'success':False,'errors':[str(exc)]},'state':state()}
    @app.get('/api/skills')
    async def skills(query:str='',status:str|None=None,kind:str|None=None):
        from p2i.skills import SkillRegistry
        registry=harness.skill_registry if harness else SkillRegistry()
        values=registry.list(status=status,kind=kind)
        if query:
            found={r.skill_id for r in registry.search(query,status=[status] if status else ['candidate','validated','evaluated','promoted','rejected','deprecated'])}
            values=[s for s in values if s.id in found]
        return {'skills':[s.model_dump(mode='json') for s in values]}
    @app.get('/api/skills/compatible/{node_id}')
    async def compatible_skills(node_id:str):
        if not harness:return {'skills':[]}
        from p2i.skills.application import compatible_replacements
        try:return {'skills':compatible_replacements(harness,node_id)}
        except ValueError as exc:raise HTTPException(422,str(exc))
    @app.get('/api/skills/{skill_id}')
    async def skill(skill_id:str):
        from p2i.skills import SkillRegistry
        registry=harness.skill_registry if harness else SkillRegistry()
        try:return {'skill':registry.get(skill_id).model_dump(mode='json'),'versions':[s.model_dump(mode='json') for s in registry.versions(skill_id)]}
        except ValueError as exc:raise HTTPException(404,str(exc))
    @app.post('/api/tools')
    async def tool(request:Request):
        origin=request.headers.get('origin')
        if origin and urlparse(origin).netloc!=request.headers.get('host'):raise HTTPException(403,'Cross-origin tools are not allowed')
        if 'application/json' not in request.headers.get('content-type',''):raise HTTPException(415,'Use application/json')
        from p2i.tools import dispatch
        try:body=await request.json()
        except Exception:raise HTTPException(422,'Invalid JSON')
        return dispatch(body,harness=harness).model_dump(mode='json')
    @app.get('/api/{kind}/{item_id}')
    async def item(kind:str,item_id:str):
        if kind not in ('modules','operations','tensors'):raise HTTPException(404,'Unknown object type')
        value=next((x for x in getattr(observed(),kind) if x.id==item_id),None)
        if value is None:raise HTTPException(404,'Unknown model object')
        return value.model_dump(mode='json')
    static=Path(__file__).parent/'static'
    if (static/'index.html').exists():app.mount('/',StaticFiles(directory=static,html=True),name='frontend')
    else:
        @app.get('/',response_class=HTMLResponse)
        def missing_build():return HTMLResponse('<h1>p2i frontend is not built</h1><p>Run npm ci &amp;&amp; npm run build in frontend/. The API is available at /api/model.</p>',status_code=503)
    return app
