/// <reference lib="webworker" />
import {aggregate,type Transient} from '@/lib/analysis';
import {isCandidate} from '@/data/formats';
import {extract} from '@/lib/metadata';
import type {Target,Progress} from '@/lib/types';
self.onmessage=async(event:MessageEvent<{files:File[];target:Target}>)=>{
 try{
 const {files,target}=event.data;
 const progress:Progress={phase:'discovering',total:0,processed:0,success:0,missing:0,errors:0};const candidates:File[]=[];
 for(let i=0;i<files.length;i++){const f=files[i];if(isCandidate(f.name,f.webkitRelativePath||f.name))candidates.push(f);if(i%200===0)self.postMessage({type:'progress',progress:{...progress,total:candidates.length}});}
 progress.total=candidates.length;progress.phase='analyzing';self.postMessage({type:'progress',progress:{...progress}});
 const records:Transient[]=[];
 for(const file of candidates){const metadata=await extract(file);records.push({name:file.name,relativePath:file.webkitRelativePath||file.name,metadata});progress.processed++;if(metadata.error)progress.errors++;else if(metadata.focal)progress.success++;else progress.missing++;self.postMessage({type:'progress',progress:{...progress}});}
 const result=aggregate(records,target);records.length=0;self.postMessage({type:'complete',analysis:result});self.close();
 }catch{self.postMessage({type:'error',message:'解析を完了できませんでした。ファイル数を減らして再試行してください。'});self.close();}
};
