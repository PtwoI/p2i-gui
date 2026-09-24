// Requires a fresh Transformer --edit server. No mocked API responses.
import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.goto(process.env.P2I_URL??'http://127.0.0.1:8000');
 await expect(page.locator('.explore-overview')).toBeVisible();
 for(const path of ['blocks','blocks.0','blocks.0.mlp','blocks.0.mlp.1'])await page.getByRole('button',{name:`Explore ${path}`,exact:true}).click();
 await page.getByRole('button',{name:'Skills',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Skill Library',exact:true})).toBeVisible();
 await page.getByLabel('Search skills').fill('dropout');
 await page.locator('.skill-card').first().click();
 await expect(page.locator('.skill-detail')).toContainText('promoted');
 await page.screenshot({path:'../docs/phase3-skill-library.png',fullPage:true});
 // Register via real local tool protocol to test UNVALIDATED display without executing source.
 const skill={id:'user.browser_candidate',name:'BrowserCandidate',kind:'custom',description:'Browser candidate fixture',implementation:{type:'python_module',class_name:'BrowserCandidate',source:'from torch import nn\nclass BrowserCandidate(nn.Module):\n    def __init__(self):\n        super().__init__()\n    def forward(self, x):\n        return x\n'}};
 const response=await page.request.post(new URL('/api/tools',page.url()).href,{data:{tool:'register_skill',arguments:{skill}}});
 if(!(await response.json()).success)throw Error('Candidate registration failed');
 await page.getByLabel('Search skills').fill('BrowserCandidate');
 await expect(page.locator('.skill-card')).toContainText('UNVALIDATED');
 await page.screenshot({path:'../docs/phase3-candidate.png',fullPage:true});
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 await expect(page.locator('.scope h2')).toHaveText('blocks.0.mlp.1');
 await page.getByLabel('Replacement skill').selectOption('builtin.silu');
 await page.getByRole('button',{name:'Preview & validate',exact:true}).click();
 await expect(page.locator('.validation-result')).toContainText('Validation passed');
 await expect(page.locator('.diff-table')).toContainText('builtin.silu');
 await page.screenshot({path:'../docs/phase3-skill-preview.png',fullPage:true});
 await page.getByRole('button',{name:'Commit edit',exact:true}).click();
 await expect(page.locator('.revision-list')).toContainText('replace_with_skill');
 await page.getByRole('button',{name:'Build & Re-trace',exact:true}).click();
 await expect(page.locator('.pending-banner')).toHaveCount(0,{timeout:30000});
 const state=await (await page.request.get(new URL('/api/harness',page.url()).href)).json();
 if(state.summary.revision!==state.summary.observed_revision)throw Error('Observed revision mismatch');
 const node=state.architecture.nodes.find(n=>n.qualified_name==='blocks.0.mlp.1');
 if(node.skill_id!=='builtin.silu')throw Error('Skill binding missing');
 await expect(page.locator('.details')).toContainText('SiLU');
 await page.getByRole('button',{name:'Explore',exact:true}).click();
 await page.screenshot({path:'../docs/phase3-retraced.png',fullPage:true});
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS phase3: live library, inspect, candidate state, preserved focus, skill preview, validation, commit, rebuild/retrace, skill binding');
}finally{await browser.close()}
