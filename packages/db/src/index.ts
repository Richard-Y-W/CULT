export const migrations=['001_initial.sql'] as const;
export const moneyToMinor=(cult:number)=>BigInt(Math.round(cult*100));
export const minorToMoney=(minor:bigint)=>Number(minor)/100;
