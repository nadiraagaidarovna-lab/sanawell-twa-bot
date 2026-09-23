// Run against Vite dev; all API requests are mocked, never real user data.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ONBOARDING_TEST_BASE_URL || 'http://127.0.0.1:5175/checkin/';
(async () => {
 const browser = await chromium.launch({headless:true,channel:'msedge'});
 try {
 for (const scenario of ['new','existing','blank-preserves','name-fails','age-fails','load-fails','duplicate','validation','empty']) {
  const page = await browser.newPage(); const writes=[]; let reads=0,failed=false,release,started;
  const barrier=new Promise(r=>release=r); const waiting=new Promise(r=>started=r);
  const record={medicalDisclaimerConsented:true,dataStorageConsented:true,displayName:['existing','blank-preserves'].includes(scenario)?'Сохранённое имя':null,age:['existing','blank-preserves'].includes(scenario)?49:null,email:'unchanged@example.test',phone:'+77000000000',cycleSituation:null,mhtStatus:null};
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/me') {
    reads++;
    if(scenario==='load-fails' && reads===2){return route.fulfill({status:503,json:{}});}
    return route.fulfill({json:record});
   }
   assert(['/api/anketa/name','/api/anketa/age'].includes(path),path);
   const data=route.request().postDataJSON();writes.push({path,data});
   if(scenario==='duplicate' && writes.length===1){started();await barrier;}
   if(!failed && ((scenario==='name-fails' && path.endsWith('/name')) || (scenario==='age-fails' && path.endsWith('/age')))) {failed=true;return route.fulfill({status:500,json:{}});}
   if(path.endsWith('/name')){assert.deepEqual(Object.keys(data),['displayName']);record.displayName=data.displayName;}
   else {assert.deepEqual(Object.keys(data),['age']);record.age=data.age;}
   return route.fulfill({json:{ok:true}});
  });
  await page.goto(`${base}?onboarding-preview`);
  await page.getByRole('button',{name:'Начать мою историю 360°'}).click();
  await page.getByRole('checkbox').nth(0).check();await page.getByRole('checkbox').nth(1).check();
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  const name=page.getByLabel('Как к вам обращаться?');const age=page.getByLabel('Сколько вам лет?');
  const next=page.getByRole('button',{name:'Продолжить',exact:true});
  if(scenario==='load-fails') {await page.getByRole('alert').waitFor();assert(await next.isDisabled());assert.equal(writes.length,0);await page.getByRole('button',{name:'Повторить загрузку'}).click();}
  await page.waitForFunction(()=>!document.querySelector('#onboarding-name')?.disabled);
  if(['existing','blank-preserves'].includes(scenario)){assert.equal(await name.inputValue(),'Сохранённое имя');assert.equal(await age.inputValue(),'49');}
  if(['blank-preserves','empty'].includes(scenario)){await name.fill('');await age.fill('');}
  else if(!['existing','empty'].includes(scenario)){await name.fill('Надира');await age.fill('39');}
  if(scenario==='validation'){
   for(const bad of ['17','101','4.5','abc']){await age.fill(bad);await age.blur();assert(await next.isDisabled());assert.equal(writes.length,0);}
   await age.fill('49');
  }
  if(scenario==='duplicate'){
   await next.evaluate(b=>{b.click();b.click();b.click();});await waiting;
   assert(await name.isDisabled());assert(await age.isDisabled());assert(await page.getByRole('button',{name:'← Назад'}).isDisabled());
   assert(await page.getByRole('button',{name:'Сохраняем…',exact:true}).isDisabled());release();
  } else await next.click();
  if(['name-fails','age-fails'].includes(scenario)){
   await page.getByRole('alert').waitFor();assert(await page.getByRole('heading',{name:'Немного о вас',exact:true}).isVisible());
   assert.equal(await name.inputValue(),'Надира');assert.equal(await age.inputValue(),'39');await next.click();
  }
  await page.getByRole('heading',{name:'Расскажите немного о вашем цикле',exact:true}).waitFor();
  assert.equal(record.email,'unchanged@example.test');assert.equal(record.phone,'+77000000000');
  if(['existing','blank-preserves','empty'].includes(scenario))assert.equal(writes.length,0);
  else {assert.equal(record.displayName,'Надира');assert.equal(record.age,scenario==='validation'?49:39);}
  if(scenario==='age-fails')assert.equal(writes.filter(w=>w.path.endsWith('/name')).length,1);
  if(scenario==='duplicate')assert.equal(writes.length,2);
  await page.getByRole('button',{name:'← Назад'}).click();
  assert.equal(await name.inputValue(),record.displayName??'');assert.equal(await age.inputValue(),record.age===null?'':String(record.age));
  console.log(`PASS ${scenario}: ${writes.length} dedicated writes; saved values preserved on back`);
  await page.close();
 }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
