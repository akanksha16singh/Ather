import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const port=4175,base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(port)},stdio:'ignore'});
const request=async(path,{token,method='GET',body}={})=>{
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json();return {status:response.status,data};
};
const login=async(email,password)=>{const x=await request('/api/login',{method:'POST',body:{email,password}});assert.equal(x.status,200,`login for ${email}`);return x.data.token;};
try{
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/')).ok){ready=true;break}}catch{}await delay(125)}assert(ready,'server starts');
 assert.equal((await request('/api/state')).status,401,'API requires a session');
 assert.equal((await request('/api/login',{method:'POST',body:{email:'bad@ather.demo',password:'wrong'}})).status,401,'bad login rejected');
 const rider=await login('rider@ather.demo','Ride@123');
 const riderState=await request('/api/state',{token:rider});assert.equal(riderState.data.riders.length,1,'rider sees only own profile');assert.equal(riderState.data.riders[0].id,'R-1042');assert.equal(riderState.data.fleets.length,0,'rider cannot access fleet data');
 assert.equal((await request('/api/audit',{token:rider})).status,403,'audit restricted by role');
 assert.equal((await request('/api/agent-runs',{token:rider,method:'POST',body:{riderId:'R-1042'}})).status,403,'AI workflow restricted by role');
 assert.equal((await request('/api/demo-requests',{token:rider,method:'POST',body:{source:'E2E',interest:'Walkthrough'}})).status,201,'rider demo request saved');
 assert.equal((await request('/api/service-requests',{token:rider,method:'POST',body:{service:'Inspection',preferredDate:'tomorrow'}})).status,400,'invalid service date rejected');
 assert.equal((await request('/api/service-requests',{token:rider,method:'POST',body:{service:'Inspection',preferredDate:'2026-11-03'}})).status,201,'service request saved');
 const fleet=await login('fleet@ather.demo','Fleet@123'),fleetState=await request('/api/state',{token:fleet});assert.equal(fleetState.data.fleets.length,3);assert.equal(fleetState.data.riders.length,0,'fleet sees aggregate data only');
 const insurer=await login('insurer@ather.demo','Insure@123'),insurance=await request('/api/insurance/summary',{token:insurer});assert.equal(insurance.status,200);assert.equal(insurance.data.rows.every(x=>x.reference.startsWith('AMI-')&&x.consent==='Active'),true,'partner rows pseudonymous and consent gated');assert.equal((await request('/api/state',{token:insurer})).data.riders.length,0,'insurer cannot read rider profiles');
 const admin=await login('admin@ather.demo','Ather@123'),all=await request('/api/state',{token:admin});assert.equal(all.data.riders.length,72);assert.equal(new Set(all.data.riders.map(x=>x.id)).size,72,'all profile IDs unique');assert.equal(all.data.riders.every(x=>x.dataClass==='SYNTHETIC · ILLUSTRATIVE'),true,'all profiles explicitly labelled');
 const created=await request('/api/agent-runs',{token:admin,method:'POST',body:{riderId:'R-1042',purpose:'E2E verification'}});assert.equal(created.status,201);assert.equal(created.data.decision,'Pending','agent output cannot decide by itself');
 assert.equal((await request(`/api/reviews/${created.data.id}`,{token:rider,method:'POST',body:{decision:'Approved'}})).status,403,'rider cannot approve an AI recommendation');
 const reviewed=await request(`/api/reviews/${created.data.id}`,{token:admin,method:'POST',body:{decision:'Approved',note:'E2E human decision'}});assert.equal(reviewed.status,200);assert.equal(reviewed.data.status,'Human approved','human action owns final decision');
 const after=await request('/api/state',{token:admin});assert(after.data.recommendations.some(x=>x.sourceRun===created.data.id),'recommendation exists only after human review');
 assert.equal((await request('/api/reset',{token:admin,method:'POST'})).status,200,'test restores the seeded demo state');
 console.log('E2E PASS: sign-in, role access, data privacy, 72 profiles, rider requests, validation, human review, audit and reset.');
}catch(error){console.error(error);process.exitCode=1}
finally{child.kill();}
