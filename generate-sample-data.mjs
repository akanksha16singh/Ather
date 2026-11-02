import fs from 'node:fs';
const file=new URL('./data.json',import.meta.url);
const d=JSON.parse(fs.readFileSync(file,'utf8'));
// Keep the ten hand-authored demo examples and regenerate the additional rows deterministically.
d.riders=d.riders.slice(0,10);
const cities=['Bengaluru','Mumbai','Pune','Hyderabad','Delhi NCR','Chennai','Ahmedabad','Kochi'];
const models=[['450X Gen 3','ATH-45X'],['450X','ATH-45X'],['450S','ATH-45S'],['Rizta Z','ATH-RIZ'],['Rizta S','ATH-RIZ']];
const signals=[['Progressive braking','Consistent riding cadence'],['Low harsh-braking frequency','Regular service adherence'],['Stable speed profile','Occasional abrupt acceleration'],['Service reminder due','Moderate exposure variability'],['High night-riding share','Tyre inspection reminder'],['Frequent short rides','Consistent braking'],['Smooth cornering','Stable usage pattern'],['High vehicle-care adherence','Predictable weekly distance']];
const bands=(score)=>score>=800?'Smooth':score>=680?'Steady':score>=560?'Building':'Needs attention';
for(let i=11;i<=72;i++){
 const n=i-11,km=280+((n*137+91)%820),days=18+((n*17+31)%73),health=76+((n*7+13)%24),score=(km<500||days<30)?null:540+((n*53+107)%351),[vehicle,prefix]=models[n%models.length],id=`R-${1052+n}`;
 d.riders.push({id,name:`Demo Rider ${String(i).padStart(2,'0')}`,vehicle,vin:`${prefix}-${id.slice(-4)}`,city:cities[(n*3+1)%cities.length],km90:km,days90:days,score,band:score===null?'Not eligible':bands(score),health,consent:{ridescore:true,insurance:n%4!==1&&n%7!==3,claims:n%3!==1,offers:n%5!==2},riskSignals:signals[n%signals.length],lastRide:['Today, 08:15','Today, 18:42','Yesterday, 19:10','Today, 07:35'][n%4],dataClass:'SYNTHETIC · ILLUSTRATIVE'});
}
d.riders.forEach(r=>{r.dataClass='SYNTHETIC · ILLUSTRATIVE'});
d.meta.sampleRecordCount=d.riders.length;
d.meta.dataBasis='All named rider profiles, telemetry summaries, vehicle condition indices, policies and outcomes in this prototype are synthetic. Operating ranges are scenario assumptions for UI demonstration, not measured Ather fleet data or external research findings.';
fs.writeFileSync(file,JSON.stringify(d,null,2)+'\n');
console.log(`Generated ${d.riders.length} synthetic rider profile records.`);
