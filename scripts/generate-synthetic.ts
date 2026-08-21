import { mkdir,writeFile } from 'node:fs/promises';
import { generateSynthetic } from '@cult/expression-engine';
const data=generateSynthetic();await mkdir('data/synthetic',{recursive:true});await writeFile('data/synthetic/market-v0.json',JSON.stringify(data));
console.log(`Generated ${Object.keys(data.history).length} assets, ${data.observations.length} platform observations, and ${data.events.length} annotated events (seed ${data.seed}).`);
