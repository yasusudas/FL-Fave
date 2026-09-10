import {parseMetadata} from '@uswriting/exiftool';
import exifr from 'exifr';
import type {Shot} from './types';
import {positive} from './analysis';
const fields=['Make','Model','FocalLength','FocalLengthIn35mmFormat','DateTimeOriginal','SubSecTimeOriginal'];
const number=(v:unknown)=>{const n=typeof v==='number'?v:typeof v==='string'?Number(v):NaN;return positive(n)?n:undefined;};
const text=(v:unknown)=>typeof v==='string'?v.trim()||undefined:undefined;
export function minimal(tags:Record<string,unknown>):Shot {const stamp=tags.DateTimeOriginal;return {make:text(tags.Make),model:text(tags.Model),focal:number(tags.FocalLength),equivalent:number(tags.FocalLengthIn35mmFormat??tags.FocalLengthIn35mmFilm),timestamp:stamp instanceof Date?stamp.toISOString().slice(0,19):text(stamp)?.replace(/\.\d+$/,''),subsecond:text(tags.SubSecTimeOriginal)};}
export async function extract(file:File):Promise<Shot> {
 // Fast path reads only selected TIFF tags; GPS, MakerNotes, IPTC and XMP disabled.
 if(/\.(jpe?g|tiff?|dng|arw|nef|pef|png|heic|heif|avif)$/i.test(file.name)){
  try{const tags=await exifr.parse(file,{pick:[...fields,'FocalLengthIn35mmFilm'],gps:false,makerNote:false,userComment:false,xmp:false,iptc:false,icc:false,jfif:false,translateValues:false,reviveValues:false});if(tags&&positive(number(tags.FocalLength)))return minimal(tags);}catch{/* Full format parser below distinguishes missing metadata from read errors. */}
 }
 try{
  const result=await parseMetadata(file,{args:['-j','-n','-q','-q',...fields.map(f=>`-${f}`)],fetch:()=>fetch('/parser/zeroperl.wasm'),transform:(s)=>JSON.parse(s) as Record<string,unknown>[]});
  if(!result.success)return {error:true};return minimal(result.data[0]??{});
 }catch{return {error:true};}
}
