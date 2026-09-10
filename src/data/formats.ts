// Release manifest: Adobe Camera Raw / Lightroom still-image formats. No runtime lookups.
export const formatManifest = {version:'2026.09.10.1',updatedAt:'2026-09-10',sources:['https://helpx.adobe.com/camera-raw/kb/camera-raw-plug-supported-cameras.html','https://helpx.adobe.com/lightroom-classic/desktop/introduction-to-lightroom-classic/supported-file-formats.html']};
export const rawExtensions = new Set('3fr arw bay cap cr2 cr3 crw dcr dcs dng drf eip erf fff gpr iiq k25 kdc mdc mef mos mrw nef nrw obm orf pef ptx pxn r3d raf raw rw2 rwl rwz sr2 srf srw sti x3f'.split(' ').filter(e=>e!=='r3d'));
export const extensions = new Set([...rawExtensions,...'avif heif heic hif tiff tif jpeg jpg jpe jxl psd psb png webp'.split(' ')]);
export const extensionOf=(name:string)=>name.split('.').pop()?.toLowerCase()??'';
export function isCandidate(name:string,relativePath:string=name) {return !relativePath.split(/[\\/]/).some(part=>part.startsWith('.')) && name.toLowerCase()!=='thumbs.db' && extensions.has(extensionOf(name));}
