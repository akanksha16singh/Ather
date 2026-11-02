import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, "data.json");
const PORT = Number(process.env.PORT || 4173);
const seed = JSON.parse(fs.readFileSync(DATA, "utf8"));
let state = JSON.parse(JSON.stringify(seed));
const demoUsers = [
 {email:"rider@ather.demo",password:"Ride@123",name:"Arjun Mehta",role:"rider",riderId:"R-1042"},
 {email:"fleet@ather.demo",password:"Fleet@123",name:"Fleet Manager",role:"fleet"},
 {email:"insurer@ather.demo",password:"Insure@123",name:"Insurance Partner",role:"insurer"},
 {email:"admin@ather.demo",password:"Ather@123",name:"Ather Reviewer",role:"ather"}
];
const sessions = new Map();

function persist(){ fs.writeFileSync(DATA, JSON.stringify(state,null,2)); }
function json(res,status,obj){ res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"*"}); res.end(JSON.stringify(obj)); }
function body(req){ return new Promise((resolve,reject)=>{let s="";req.on("data",c=>s+=c);req.on("end",()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}})}); }
function audit(actor,action,target,purpose){state.audit.unshift({id:"AUD-"+crypto.randomUUID().slice(0,8).toUpperCase(),time:new Date().toISOString(),actor,action,target,purpose});}
function summary(){
 const eligible=state.riders.filter(r=>r.km90>=500&&r.days90>=30);
 const consented=eligible.filter(r=>r.consent.insurance);
 const converted=state.policies.filter(p=>p.status==="Converted");
 const premium=converted.reduce((a,p)=>a+p.premium,0);
 const revenue=converted.reduce((a,p)=>a+p.premium*p.commission/100,0);
 const conversion=consented.length?Math.round(converted.length/consented.length*100):0;
 return {riders:state.riders.length,eligible:eligible.length,consented:consented.length,conversion,policies:state.policies.length,converted:converted.length,grossPremium:premium,commissionRevenue:Math.round(revenue),avgHealth:Math.round(state.riders.reduce((a,r)=>a+r.health,0)/state.riders.length),openClaims:state.claims.filter(c=>c.status!=="Closed").length,agentRuns:state.agentRuns.length};
}
function safeInsuranceRows(){
 return state.riders.filter(r=>r.consent.insurance&&r.km90>=500&&r.days90>=30).map(r=>({reference:"AMI-"+r.id.slice(-4),scoreBand:r.band,distanceRange:r.km90<600?"500–600 km":r.km90<800?"600–800 km":"800+ km",validity:"90-day window",consent:"Active"}));
}
function roleState(actor){
 const result={...state,analytics:summary(),insuranceRows:safeInsuranceRows()};
 if(actor.role==="rider"){
   result.riders=state.riders.filter(r=>r.id===actor.riderId);
   result.claims=state.claims.filter(c=>c.rider===actor.riderId).map(c=>({...c,consent:Boolean(c.consent&&result.riders[0]?.consent.claims)}));
   result.fleets=[];result.vehicles=[];result.policies=[];result.agentRuns=[];result.audit=[];
   result.insuranceRows=[];result.recommendations=state.recommendations.filter(r=>r.rider===actor.riderId);
   result.demoRequests=(state.demoRequests||[]).filter(x=>x.rider===actor.riderId);
   result.serviceRequests=(state.serviceRequests||[]).filter(x=>x.rider===actor.riderId);
 } else if(actor.role==="insurer"){
   result.riders=[];result.claims=[];result.fleets=[];result.vehicles=[];result.agentRuns=[];result.audit=[];result.recommendations=[];
   result.demoRequests=[];result.serviceRequests=[];
 } else if(actor.role==="fleet"){
   result.riders=[];result.claims=[];result.policies=[];result.insuranceRows=[];result.agentRuns=[];result.audit=[];result.recommendations=[];result.demoRequests=[];result.serviceRequests=[];
 }
 return result;
}
async function route(req,res){
 const url=new URL(req.url,"http://localhost");
 if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,PATCH,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization"});return res.end();}
 if(req.method==="POST"&&url.pathname==="/api/login"){
   const input=await body(req),user=demoUsers.find(x=>x.email===String(input.email||"").toLowerCase()&&x.password===input.password);
   if(!user)return json(res,401,{error:"Email or password did not match a demo account."});
   const token=crypto.randomBytes(24).toString("hex");sessions.set(token,{...user});
   return json(res,200,{token,user:{name:user.name,role:user.role,riderId:user.riderId||null}});
 }
 if(req.method==="POST"&&url.pathname==="/api/logout"){sessions.delete((req.headers.authorization||"").replace(/^Bearer\s+/i,""));return json(res,200,{ok:true});}
 const token=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
 const actor=sessions.get(token);
 if(url.pathname.startsWith("/api/")&&url.pathname!=="/api/login"&&!actor)return json(res,401,{error:"Please sign in with a demo account to continue."});
 if(url.pathname==="/api/agent-runs"&&actor?.role!=="ather")return json(res,403,{error:"AI workflows are available to the Ather reviewer account."});
 if(url.pathname.startsWith("/api/reviews/")&&actor?.role!=="ather")return json(res,403,{error:"Only the Ather reviewer account can decide queued recommendations."});
 if(url.pathname==="/api/reset"&&actor?.role!=="ather")return json(res,403,{error:"Only the Ather reviewer account can reset demo data."});
 if(req.method==="GET"&&url.pathname==="/api/state")return json(res,200,roleState(actor));
 if(req.method==="GET"&&url.pathname==="/api/analytics")return json(res,200,summary());
 if(req.method==="GET"&&url.pathname==="/api/insurance/summary"){
   if(!["insurer","ather"].includes(actor?.role))return json(res,403,{error:"This summary is restricted to insurance and Ather demo profiles."});
   return json(res,200,{analytics:summary(),rows:safeInsuranceRows(),policies:state.policies});
 }
 if(req.method==="GET"&&url.pathname==="/api/audit"){
   if(actor?.role!=="ather")return json(res,403,{error:"Audit export is restricted to the Ather reviewer account."});
   return json(res,200,state.audit);
 }
 if(req.method==="POST"&&url.pathname==="/api/demo-requests"){
   if(actor?.role!=="rider")return json(res,403,{error:"Demo requests are available from the rider profile."});
   const input=await body(req),item={id:"DEMO-"+Date.now(),rider:actor.riderId,source:String(input.source||"Rider app").slice(0,80),interest:String(input.interest||"Product walkthrough").slice(0,120),status:"Received",createdAt:new Date().toISOString()};
   state.demoRequests??=[];state.demoRequests.unshift(item);audit(actor.name,"Requested product demo",item.id,"Rider product walkthrough");persist();return json(res,201,item);
 }
 if(req.method==="POST"&&url.pathname==="/api/service-requests"){
   if(actor?.role!=="rider")return json(res,403,{error:"Service requests are available from the rider profile."});
   const input=await body(req);if(!String(input.preferredDate||"").match(/^\d{4}-\d{2}-\d{2}$/))return json(res,400,{error:"Choose a valid preferred service date."});
   const item={id:"SVC-"+Date.now(),rider:actor.riderId,service:String(input.service||"Vehicle inspection").slice(0,100),preferredDate:input.preferredDate,status:"Request received",createdAt:new Date().toISOString()};
   state.serviceRequests??=[];state.serviceRequests.unshift(item);audit(actor.name,"Requested service appointment",item.id,"Vehicle care");persist();return json(res,201,item);
 }
 if(req.method==="POST"&&url.pathname==="/api/agent-runs"){
   const input=await body(req); const rider=state.riders.find(r=>r.id===(input.riderId||"R-1042"));
   if(!rider)return json(res,404,{error:"Rider not found"});
   const agents=[
    {name:"Telemetry Quality Agent",role:"Data validation",status:"Complete",confidence:.97,output:`${rider.km90} km and ${rider.days90} days of synthetic telemetry passed completeness checks.`,evidence:["Ride event coverage 96%","Timestamp sequence consistent","Outlier scan: 2 low-severity flags"]},
    {name:"Riding Behaviour Agent",role:"Behaviour analytics",status:"Complete",confidence:.91,output:`${rider.band} pattern; key signals: ${rider.riskSignals.join(", ")}.`,evidence:["Smoothness trend assessed","Harsh braking frequency assessed","No protected attributes used"]},
    {name:"Vehicle Health Agent",role:"Predictive maintenance",status:"Complete",confidence:rider.health/100,output:`Vehicle health index ${rider.health}/100. ${rider.health<88?"Inspection recommendation may be appropriate.":"No urgent maintenance signal."}`,evidence:["Battery/vehicle health proxy","Service adherence proxy","No diagnostic fault claim"]},
    {name:"Exposure Context Agent",role:"Context modelling",status:"Complete",confidence:.82,output:"Exposure features are aggregated to coarse time and distance bands; precise route is excluded.",evidence:["Night-use share band","Distance band","No raw GPS included"]},
    {name:"Insurance Opportunity Agent",role:"Commercial matching",status:rider.consent.insurance?"Complete":"Blocked by consent",confidence:rider.consent.insurance ? .86 : 0,output:rider.consent.insurance?"Potential opt-in renewal conversation. No premium or risk decision is generated.":"Insurance partner use blocked: rider has not enabled insurer-sharing consent.",evidence:["Purpose-specific consent check","Product eligibility is insurer-owned","Commission estimate is illustrative"]},
   ];
   const eligible=rider.km90>=500&&rider.days90>=30;
   const contradictions=agents.some(a=>a.status==="Blocked by consent");
   const judge={name:"LLM Judge · Evidence & Policy Reviewer",score:eligible && !contradictions ? .93 : .71,verdict:eligible?"HUMAN REVIEW REQUIRED":"INSUFFICIENT DATA",reason:eligible?"Evidence is sufficiently complete for a human reviewer. Commercial use remains consent-gated; no underwriting recommendation is made.":"Rider does not meet the 500 km / 30-day score eligibility gate.",checks:[{label:"Evidence sufficiency",result:eligible?"Pass":"Fail"},{label:"Consent boundary",result:rider.consent.insurance?"Pass":"Flag for purpose review"},{label:"Protected data exclusion",result:"Pass"},{label:"No automated underwriting",result:"Pass"},{label:"Agent disagreement",result:contradictions?"Review required":"Low"}]};
   const run={id:"RUN-"+String(Date.now()).slice(-7),createdAt:new Date().toISOString(),status:"Awaiting human decision",rider:rider.id,headline:`${rider.band} riding profile · ${rider.health}/100 vehicle health`,judgeScore:judge.score,decision:"Pending",agents:agents.map(a=>a.name),summary:"Multi-agent analysis completed. Judge has prepared a review brief; no action is taken until a human reviewer decides.",agentDetails:agents,judge};
   state.agentRuns.unshift(run);audit("AI Orchestrator","Agent workflow completed",run.id,"Human review queue");persist();
   return json(res,201,run);
 }
 if(req.method==="POST"&&url.pathname.startsWith("/api/reviews/")){
   const id=url.pathname.split("/").pop(); const input=await body(req); const run=state.agentRuns.find(x=>x.id===id);
   if(!run)return json(res,404,{error:"Workflow not found"});
   if(["Approved","Rejected"].includes(run.decision))return json(res,409,{error:"This workflow already has a final human decision."});
   if(!["Approved","Rejected","Needs more data"].includes(input.decision))return json(res,400,{error:"Invalid decision"});
   run.status=input.decision==="Approved"?"Human approved":input.decision==="Rejected"?"Human rejected":"Returned for more data";
   run.decision=input.decision;run.reviewer=input.reviewer||"Ather Human Reviewer";run.reviewNote=(input.note||"").slice(0,600);run.reviewedAt=new Date().toISOString();
   audit(run.reviewer,`Workflow ${input.decision.toLowerCase()}`,id,input.purpose||"Human-in-the-loop review");
   if(input.decision==="Approved"){
     state.recommendations.unshift({id:"REC-"+Date.now(),rider:run.rider,type:"COACHING",title:"Personalised riding feedback approved",confidence:run.judgeScore,status:"Approved",why:run.headline,sourceRun:id});
   }
   persist();return json(res,200,run);
 }
 if(req.method==="PATCH"&&url.pathname.startsWith("/api/riders/")&&url.pathname.endsWith("/consent")){
   const id=url.pathname.split("/")[3], input=await body(req),r=state.riders.find(x=>x.id===id);
   if(actor?.role!=="rider"||actor.riderId!==id)return json(res,403,{error:"Rider permissions can only be changed by that rider's demo account."});
   if(!r)return json(res,404,{error:"Rider not found"});
   const key=input.purpose;if(!["ridescore","insurance","claims","offers"].includes(key))return json(res,400,{error:"Invalid consent purpose"});
   r.consent[key]=!!input.granted;audit(id,`Consent ${input.granted?"granted":"withdrawn"}`,key,"Purpose-specific rider permission");persist();return json(res,200,r);
 }
 if(req.method==="PATCH"&&url.pathname.startsWith("/api/claims/")){
   const id=url.pathname.split("/").pop(),input=await body(req),c=state.claims.find(x=>x.id===id);
   if(actor?.role!=="rider"||actor.riderId!==c?.rider)return json(res,403,{error:"Claims actions require the matching rider demo account."});
   if(!c)return json(res,404,{error:"Claim not found"});
   const rider=state.riders.find(r=>r.id===c.rider);
   if(input.decision==="Share evidence"&&(!c.consent||!rider?.consent.claims))return json(res,403,{error:"Active rider claims permission and claim evidence consent are required"});
   if(!["Share evidence","Reject sharing","Request more evidence"].includes(input.decision))return json(res,400,{error:"Invalid decision"});
   c.status=input.decision==="Share evidence"?"Approved for rider-authorised sharing":input.decision==="Reject sharing"?"Sharing rejected by rider":"More evidence requested";
   audit(input.actor||"Rider",input.decision,id,"Claims evidence");persist();return json(res,200,c);
 }
 if(req.method==="POST"&&url.pathname==="/api/reset"){state=JSON.parse(JSON.stringify(seed));persist();return json(res,200,{ok:true});}
 if(req.method==="GET"&&url.pathname==="/")return serveFile(res,path.join(__dirname,"index.html"));
 if(req.method==="GET"&&url.pathname.startsWith("/public/"))return serveFile(res,path.join(__dirname,url.pathname));
 return json(res,404,{error:"Not found"});
}
function serveFile(res,file){if(!fs.existsSync(file)){res.writeHead(404);return res.end("Not found");}const ext=path.extname(file);const type=ext===".html"?"text/html":ext===".png"?"image/png":"text/plain";res.writeHead(200,{"Content-Type":type});res.end(fs.readFileSync(file));}
const server=http.createServer((req,res)=>{Promise.resolve(route(req,res)).catch(e=>json(res,500,{error:e.message||"Server error"}));});
server.listen(PORT,()=>console.log(`Ather Mobility Intelligence running at http://localhost:${PORT}`));
