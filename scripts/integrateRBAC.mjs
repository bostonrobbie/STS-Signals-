#!/usr/bin/env node

/**
 * Automated RBAC Integration Script
 * Systematically replaces protectedProcedure with appropriate permission procedures
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routersPath = path.join(__dirname, '../server/routers.ts');

// Mapping of endpoint patterns to their required permission procedures
const endpointMapping = [
  // Portfolio endpoints - VIEW_ANALYTICS
  { pattern: /overview:\s*protectedProcedure/, replacement: 'overview: viewAnalyticsProcedure' },
  { pattern: /metrics:\s*protectedProcedure/, replacement: 'metrics: viewAnalyticsProcedure' },
  { pattern: /equityCurve:\s*protectedProcedure/, replacement: 'equityCurve: viewAnalyticsProcedure' },
  { pattern: /trades:\s*protectedProcedure/, replacement: 'trades: viewAnalyticsProcedure' },
  { pattern: /breakdown:\s*protectedProcedure/, replacement: 'breakdown: viewAnalyticsProcedure' },
  { pattern: /dailyMetrics:\s*protectedProcedure/, replacement: 'dailyMetrics: viewAnalyticsProcedure' },
  
  // Strategy endpoints - MANAGE_STRATEGIES
  { pattern: /create:\s*protectedProcedure/, replacement: 'create: createStrategyProcedure' },
  { pattern: /update:\s*protectedProcedure/, replacement: 'update: updateStrategyProcedure' },
  { pattern: /delete:\s*protectedProcedure/, replacement: 'delete: deleteStrategyProcedure' },
  
  // Trade endpoints - MANAGE_TRADES
  { pattern: /createTrade:\s*protectedProcedure/, replacement: 'createTrade: manageTradeProcedure' },
  { pattern: /updateTrade:\s*protectedProcedure/, replacement: 'updateTrade: manageTradeProcedure' },
  { pattern: /deleteTrade:\s*protectedProcedure/, replacement: 'deleteTrade: manageTradeProcedure' },
  
  // Export endpoints - EXPORT_DATA
  { pattern: /export:\s*protectedProcedure/, replacement: 'export: exportDataProcedure' },
  { pattern: /exportTrades:\s*protectedProcedure/, replacement: 'exportTrades: exportDataProcedure' },
  
  // User preference endpoints - keep as protectedProcedure (general user access)
  // These don't need specific permissions
];

// Read the file
console.log('Reading routers.ts...');
let content = fs.readFileSync(routersPath, 'utf-8');
const originalContent = content;

// Apply replacements
console.log('Applying RBAC procedure replacements...');
let replacementCount = 0;

endpointMapping.forEach(({ pattern, replacement }) => {
  const matches = content.match(pattern);
  if (matches) {
    console.log(`  ✓ Replacing: ${replacement}`);
    content = content.replace(pattern, replacement);
    replacementCount++;
  }
});

// Check if we need to add imports
if (!content.includes('viewAnalyticsProcedure')) {
  console.log('Adding permission procedure imports to routers.ts...');
  const importLine = 'import {\n  publicProcedure,\n  protectedProcedure,\n  adminProcedure,\n  router,';
  const newImportLine = 'import {\n  publicProcedure,\n  protectedProcedure,\n  adminProcedure,\n  router,\n  viewAnalyticsProcedure,\n  createStrategyProcedure,\n  updateStrategyProcedure,\n  deleteStrategyProcedure,\n  manageTradeProcedure,\n  exportDataProcedure,\n  manageSystemProcedure,\n  manageCredentialsProcedure,';
  
  content = content.replace(importLine, newImportLine);
}

// Write the file
if (content !== originalContent) {
  fs.writeFileSync(routersPath, content, 'utf-8');
  console.log(`\n✅ Successfully integrated RBAC procedures!`);
  console.log(`   - Replacements made: ${replacementCount}`);
  console.log(`   - File updated: ${routersPath}`);
} else {
  console.log('\n⚠️  No changes made - procedures may already be integrated or patterns not found');
}

console.log('\nNext steps:');
console.log('1. Review the changes in routers.ts');
console.log('2. Run TypeScript compiler to check for errors');
console.log('3. Test endpoints with different user roles');
console.log('4. Verify permission checks are working correctly');
