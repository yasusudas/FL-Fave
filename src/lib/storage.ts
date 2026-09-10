import Dexie, {type Table} from 'dexie';
import type {Result} from './types';
class HistoryDB extends Dexie { results!:Table<Result,string>; constructor(){super('fl-fave');this.version(1).stores({results:'id,analyzedAt'});} }
export const db=new HistoryDB();
