export type AssetType = 'EMOJI' | 'PHRASE' | 'SLANG' | 'EMOTICON' | 'ACRONYM';
export type Platform = 'Reddit' | 'YouTube' | 'Bluesky' | 'Forum';
export type OrderSide = 'BUY' | 'SELL' | 'SHORT' | 'COVER';
export type OrderStatus = 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
export type LedgerType = 'INITIAL_GRANT' | 'TRADE_DEBIT' | 'TRADE_CREDIT' | 'TRADING_FEE' | 'BAILOUT' | 'BANKRUPTCY_RESET' | 'ADMIN_ADJUSTMENT' | 'REWARD' | 'INDEX_FEE';
export interface ExpressionAsset { id:string; ticker:string; canonicalExpression:string; assetType:AssetType; unicode?:string; displayName:string; description:string; active:boolean; currentIndexValue:number; marketPrice:number; previousClose:number; dailyChange:number; weeklyChange:number; monthlyChange:number; confidence:number; createdAt:string }
export interface Observation { expressionId:string; timestamp:string; platform:Platform; usageCount:number; eligibleDocumentCount:number; uniqueUserEstimate:number; normalizedUsage:number; velocity:number; acceleration:number; breadth:number }
export interface SemanticPoint { expressionId:string; timestamp:string; labels:Record<string,number>; entropy:number }
export interface MarketPoint { timestamp:string; indexValue:number; marketPrice:number; event?:string }
export interface Position { assetId:string; quantity:number; averageEntryPrice:number; realizedPnl:number }
export interface Order { id:string; userId:string; assetId:string; side:OrderSide; quantity:number; price:number; fee:number; status:OrderStatus; submittedAt:string; filledAt?:string }
export interface LedgerEntry { id:string; accountId:string; type:LedgerType; amountMinor:bigint; referenceId?:string; createdAt:string }
export interface IndexDefinition { id:string; ticker:string; name:string; description:string; methodology:string; weighting:'EQUAL'|'ATTENTION_WEIGHTED'|'SQRT_ATTENTION_WEIGHTED'|'CUSTOM'; constituents:{assetId:string;weight:number}[]; currentValue:number; dailyChange:number; rebalanceFrequency:'WEEKLY'|'MONTHLY'|'QUARTERLY' }
export const PLATFORMS: Platform[] = ['Reddit','YouTube','Bluesky','Forum'];
export const nowIso = () => new Date().toISOString();
export const round = (n:number, places=4) => Number(n.toFixed(places));
export { ASSETS } from './assets.js';
