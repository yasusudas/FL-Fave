import {cropFor,findCamera,manufacturerFor,normalize} from '@/data/cameras';
import {rawExtensions,extensionOf} from '@/data/formats';
import {lenses} from '@/data/lenses';
import type {Shot,Stats,CameraAggregate,Histogram,Lens,Target,Recommendation} from './types';
export const emptyStats=():Stats=>({detected:0,pairs:0,shots:0,success:0,missing:0,errors:0});
export const positive=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>0;
export function pairMatches(a:Shot,b:Shot) {
 if(a.error||b.error||!positive(a.focal)||a.focal!==b.focal||!a.make||!b.make||!a.model||!b.model||!a.timestamp||!b.timestamp)return false;
 return (manufacturerFor(a.make)?.id??normalize(a.make))===(manufacturerFor(b.make)?.id??normalize(b.make)) && normalize(a.model)===normalize(b.model) && a.timestamp===b.timestamp && (!a.subsecond||!b.subsecond||a.subsecond.padEnd(9,'0')===b.subsecond.padEnd(9,'0'));
}
export type Transient = {name:string;relativePath:string;metadata:Shot};
export function deduplicate(records:Transient[]) {
 const candidates=new Map<string,{raw:Transient[];jpeg:Transient[]}>();
 for(const r of records){const ext=extensionOf(r.name);const kind=rawExtensions.has(ext)?'raw':['jpg','jpeg','jpe'].includes(ext)?'jpeg':null;if(!kind)continue;const base=r.relativePath.replace(/\.[^.]+$/,'');const v=candidates.get(base)??{raw:[],jpeg:[]};v[kind].push(r);candidates.set(base,v);}
 const removed=new Set<Transient>();const paired=new Set<Transient>();
 for(const v of candidates.values()) { // Ambiguous 1-to-many groups are intentionally left separate.
  if(v.raw.length===1&&v.jpeg.length===1&&pairMatches(v.raw[0].metadata,v.jpeg[0].metadata)){removed.add(v.jpeg[0]);paired.add(v.raw[0]);}
 }
 return {records:records.filter(r=>!removed.has(r)),paired};
}
export function aggregate(records:Transient[],target:Target) {
 const {records:logical,paired}=deduplicate(records);const groups=new Map<string,CameraAggregate>();const stats=emptyStats();stats.detected=records.length;stats.pairs=paired.size;stats.shots=logical.length;
 for(const r of logical){const s=r.metadata;const camera=findCamera(s.make,s.model);const manufacturer=manufacturerFor(s.make)?.name??s.make?.trim()??'メーカー不明';const model=camera?.model??s.model?.trim()??'機種不明';const key=JSON.stringify([manufacturerFor(s.make)?.id??normalize(s.make),normalize(model)]);const sensorProfileId=camera?.sensorProfileId??target.sensorProfileId;
  let g=groups.get(key);if(!g){g={key,manufacturer,model,match:camera?'matched':s.model?'unregistered':'unknown',sensorProfileId,cropFactor:cropFor(sensorProfileId),sources:{exif:0,database:0,fallback:0},actual:{},equivalent:{},stats:emptyStats()};groups.set(key,g);}
  g.stats.shots++;g.stats.detected+=paired.has(r)?2:1;g.stats.pairs+=paired.has(r)?1:0;
  const outcome=s.error?'errors':positive(s.focal)?'success':'missing';stats[outcome]++;g.stats[outcome]++;
  if(outcome==='success'){const actual=s.focal!;const source=positive(s.equivalent)?'exif':camera?'database':'fallback';const eq=source==='exif'?s.equivalent!:actual*g.cropFactor;g.sources[source]++;const a=Math.round(actual),e=Math.round(eq);g.actual[a]=(g.actual[a]??0)+1;g.equivalent[e]=(g.equivalent[e]??0)+1;}
 }
 return {stats,cameraAggregates:[...groups.values()],selectedCameraKeys:[...groups.keys()]};
}
export function combine(groups:CameraAggregate[],keys:string[]) {const active=groups.filter(g=>keys.includes(g.key));const actual:Histogram={},equivalent:Histogram={};const stats=emptyStats();for(const g of active){for(const k of Object.keys(stats) as (keyof Stats)[])stats[k]+=g.stats[k];for(const [k,v]of Object.entries(g.actual))actual[k]=(actual[k]??0)+v;for(const [k,v]of Object.entries(g.equivalent))equivalent[k]=(equivalent[k]??0)+v;}return {actual,equivalent,stats,active};}
export function modes(hist:Histogram) {let max=0;for(const n of Object.values(hist))max=Math.max(max,n);return max?Object.keys(hist).filter(k=>hist[k]===max).map(Number).sort((a,b)=>a-b):[];}
export function bins(hist:Histogram,total:number) {const occupied=Object.keys(hist).filter(k=>hist[k]>0).map(Number);if(!occupied.length)return [];const min=Math.min(...occupied),max=Math.max(...occupied);return Array.from({length:max-min+1},(_,i)=>({focal:min+i,count:hist[min+i]??0,ratio:total?(hist[min+i]??0)/total:0}));}
const price=(l:Lens)=>l.price??Infinity;
const priceOrder=(a:Lens,b:Lens)=>(price(a)===price(b)?0:price(a)<price(b)?-1:1);
export function recommend(values:number[],target:Target,catalog:Lens[]=lenses):Recommendation[]{
 const compatible=catalog.filter(l=>l.manufacturerId===target.manufacturerId&&l.firstParty&&l.prime&&l.mountId===target.mountId&&l.sensors.includes(target.sensorProfileId));
 return values.map(equivalent=>{const targetActual=equivalent/cropFor(target.sensorProfileId);const grouped=new Map<number,Lens[]>();for(const l of compatible.filter(l=>l.status==='current'))grouped.set(l.focal,[...(grouped.get(l.focal)??[]),l]);const choices=[...grouped.values()].map(ls=>{ls.sort(priceOrder);return {lens:ls[0],alternatives:ls.slice(1)};}).sort((a,b)=>Math.abs(a.lens.focal-targetActual)-Math.abs(b.lens.focal-targetActual)||priceOrder(a.lens,b.lens)).slice(0,3);const rounded=Math.round(targetActual);const discontinued=grouped.has(rounded)?[]:compatible.filter(l=>l.status==='discontinued'&&l.focal===rounded).sort(priceOrder);return {equivalent,targetActual,choices,discontinued};});
}
