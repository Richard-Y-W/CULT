const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
export const simpleReturns=(xs:number[])=>xs.slice(1).map((x,i)=>x/(xs[i]??x)-1);
export const logReturns=(xs:number[])=>xs.slice(1).map((x,i)=>Math.log(x/(xs[i]??x)));
export const momentum=(xs:number[],period:number)=>xs.length<=period?0:(xs.at(-1)!/xs.at(-(period+1))!)-1;
export const volatility=(returns:number[])=>{if(returns.length<2)return 0;const m=avg(returns);return Math.sqrt(returns.reduce((s,x)=>s+(x-m)**2,0)/(returns.length-1));};
export const covariance=(a:number[],b:number[])=>{const n=Math.min(a.length,b.length);if(n<2)return 0;const aa=a.slice(-n),bb=b.slice(-n),ma=avg(aa),mb=avg(bb);return aa.reduce((s,x,i)=>s+(x-ma)*(bb[i]!-mb),0)/(n-1);};
export const correlation=(a:number[],b:number[])=>{const den=volatility(a)*volatility(b);return den?covariance(a,b)/den:0;};
export const beta=(asset:number[],benchmark:number[])=>{const v=volatility(benchmark)**2;return v?covariance(asset,benchmark)/v:0;};
export const drawdown=(xs:number[])=>{let peak=-Infinity,max=0,current=0;for(const x of xs){peak=Math.max(peak,x);current=peak?x/peak-1:0;max=Math.min(max,current);}return {current,max};};
export const zScore=(value:number,history:number[])=>{const m=avg(history),sd=volatility(history);return sd?(value-m)/sd:0;};
export const normalizedEntropy=(weights:number[])=>{const clean=weights.filter(x=>x>0);return clean.length<2?0:-clean.reduce((s,p)=>s+p*Math.log(p),0)/Math.log(clean.length);};
export const rolling=(xs:number[],window:number,fn:(x:number[])=>number)=>xs.map((_,i)=>i+1<window?null:fn(xs.slice(i-window+1,i+1)));
export const annualizedSharpe=(returns:number[],periods=365)=>{const sd=volatility(returns);return sd?avg(returns)/sd*Math.sqrt(periods):0;};

export interface BacktestBar { timestamp:string; prices:Record<string,number> }
export interface OrderIntent { assetId:string; targetWeight:number }
export interface StrategyContext { index:number; history:BacktestBar[]; cash:number; equity:number }
export interface Strategy { name:string; onBar(context:StrategyContext):OrderIntent[] }
export interface BacktestConfig { initialCash:number; feeRate:number; rebalanceEvery:number }
export interface BacktestResult { equityCurve:{timestamp:string;value:number}[]; totalReturn:number; maxDrawdown:number; volatility:number; sharpe:number; turnover:number; trades:number }
export function runBacktest(bars:BacktestBar[],strategy:Strategy,config:BacktestConfig):BacktestResult{
 let cash=config.initialCash,turnover=0,trades=0;const positions:Record<string,number>={},curve:{timestamp:string;value:number}[]=[];
 bars.forEach((bar,i)=>{let equity=cash+Object.entries(positions).reduce((s,[id,q])=>s+q*(bar.prices[id]??0),0);if(i%config.rebalanceEvery===0){const intents=strategy.onBar({index:i,history:bars.slice(0,i+1),cash,equity}),targets=new Map(intents.map(x=>[x.assetId,x.targetWeight]));for(const id of Object.keys(positions))if(!targets.has(id))targets.set(id,0);for(const [assetId,targetWeight] of targets){const px=bar.prices[assetId];if(!px)continue;const desired=equity*targetWeight/px,delta=desired-(positions[assetId]??0),notional=Math.abs(delta*px);if(notional<1e-8)continue;const fee=notional*config.feeRate;cash-=delta*px+fee;positions[assetId]=desired;turnover+=notional;trades++;}equity=cash+Object.entries(positions).reduce((s,[id,q])=>s+q*(bar.prices[id]??0),0);}curve.push({timestamp:bar.timestamp,value:equity});});
 const values=curve.map(x=>x.value),rets=simpleReturns(values),dd=drawdown(values);return {equityCurve:curve,totalReturn:values.length?values.at(-1)!/config.initialCash-1:0,maxDrawdown:dd.max,volatility:volatility(rets)*Math.sqrt(365),sharpe:annualizedSharpe(rets),turnover:turnover/config.initialCash,trades};
}
export const momentumStrategy=(assetIds:string[],lookback=30):Strategy=>({name:'Momentum',onBar:({history})=>{if(history.length<=lookback)return[];const ranked=assetIds.map(id=>({id,m:momentum(history.map(b=>b.prices[id]??0),lookback)})).sort((a,b)=>b.m-a.m).slice(0,3);return ranked.map(x=>({assetId:x.id,targetWeight:1/ranked.length}));}});
export const meanReversionStrategy=(assetIds:string[],lookback=14):Strategy=>({name:'Mean Reversion',onBar:({history})=>{if(history.length<lookback)return[];const ranked=assetIds.map(id=>({id,z:zScore(history.at(-1)!.prices[id]??0,history.slice(-lookback).map(b=>b.prices[id]??0))})).sort((a,b)=>a.z-b.z).slice(0,3);return ranked.map(x=>({assetId:x.id,targetWeight:1/3}));}});
export const pairsStrategy=(longId:string,shortId:string,lookback=30):Strategy=>({name:'Pairs Z-Score',onBar:({history})=>{if(history.length<lookback)return[];const ratios=history.slice(-lookback).map(b=>(b.prices[longId]??1)/(b.prices[shortId]??1)),z=zScore(ratios.at(-1)!,ratios);return Math.abs(z)<.5?[{assetId:longId,targetWeight:0},{assetId:shortId,targetWeight:0}]:z<0?[{assetId:longId,targetWeight:.5},{assetId:shortId,targetWeight:-.5}]:[{assetId:longId,targetWeight:-.5},{assetId:shortId,targetWeight:.5}];}});
