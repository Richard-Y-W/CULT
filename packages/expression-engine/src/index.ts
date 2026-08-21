import { normalizedEntropy } from '@cult/analytics';
export interface ExpressionDataSource<T=unknown>{fetchBatch(cursor?:string):Promise<T[]>;normalize(raw:T):unknown;validate(raw:T):boolean}
const phraseAliases:Record<string,string>={"were cooked":"we're cooked","we are cooked":"we're cooked","we’re cooked":"we're cooked","we are so back":"we're so back","were so back":"we're so back","we’re so back":"we're so back"};
export function normalizeExpression(input:string){let value=input.normalize('NFC').replace(/[\uFE0E\uFE0F]/g,'').trim();if(/[a-z]/i.test(value))value=value.toLowerCase().replace(/[’]/g,"'").replace(/\s+/g,' ');return phraseAliases[value]??value;}
export const canonicalId=(input:string)=>`expr_${normalizeExpression(input).replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,'').toLowerCase()||Array.from(normalizeExpression(input)).map(x=>x.codePointAt(0)?.toString(16)).join('_')}`;
export const usagePerMillion=(expressionDocs:number,eligibleDocs:number)=>eligibleDocs>0?expressionDocs/eligibleDocs*1_000_000:0;
export const velocity=(values:number[])=>values.length<2?0:values.at(-1)!-values.at(-2)!;
export const acceleration=(values:number[])=>values.length<3?0:(values.at(-1)!-values.at(-2)!)-(values.at(-2)!-values.at(-3)!);
export const breadth=(changes:number[])=>changes.length?Math.max(changes.filter(x=>x>0).length,changes.filter(x=>x<0).length)/changes.length:0;
export const persistence=(changes:number[])=>changes.length?Math.abs(changes.reduce((s,x)=>s+Math.sign(x),0))/changes.length:0;
export const semanticEntropy=(labels:Record<string,number>)=>normalizedEntropy(Object.values(labels));
export { generateSynthetic } from './synthetic.js';
export type { SyntheticDataset } from './synthetic.js';
