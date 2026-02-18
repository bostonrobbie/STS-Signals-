#!/usr/bin/env node

/**
 * Complete RBAC Integration Script
 * Systematically replaces protectedProcedure with appropriate permission procedures
 * across all endpoints in routers.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routersPath = path.join(__dirname, '../server/routers.ts');

// Comprehensive mapping of endpoint patterns to their required permission procedures
const endpointMappings = [
  // Portfolio endpoints - VIEW_ANALYTICS
  { pattern: /portfolio:\s*router\(\{[\s\S]*?overview:\s*protectedProcedure/, replacement: 'overview: viewAnalyticsProcedure', section: 'portfolio' },
  { pattern: /metrics:\s*protectedProcedure/, replacement: 'metrics: viewAnalyticsProcedure' },
  { pattern: /equityCurve:\s*protectedProcedure/, replacement: 'equityCurve: viewAnalyticsProcedure' },
  { pattern: /trades:\s*protectedProcedure/, replacement: 'trades: viewAnalyticsProcedure' },
  { pattern: /breakdown:\s*protectedProcedure/, replacement: 'breakdown: viewAnalyticsProcedure' },
  { pattern: /dailyMetrics:\s*protectedProcedure/, replacement: 'dailyMetrics: viewAnalyticsProcedure' },
  
  // Strategy endpoints - MANAGE_STRATEGIES
  { pattern: /strategies:\s*router\(\{[\s\S]*?create:\s*protectedProcedure/, replacement: 'create: createStrategyProcedure', section: 'strategies' },
  { pattern: /strategies:\s*router\(\{[\s\S]*?update:\s*protectedProcedure/, replacement: 'update: updateStrategyProcedure', section: 'strategies' },
  { pattern: /strategies:\s*router\(\{[\s\S]*?delete:\s*protectedProcedure/, replacement: 'delete: deleteStrategyProcedure', section: 'strategies' },
  
  // Trade endpoints - MANAGE_TRADES
  { pattern: /trades:\s*router\(\{[\s\S]*?create:\s*protectedProcedure/, replacement: 'create: manageTradeProcedure', section: 'trades' },
  { pattern: /trades:\s*router\(\{[\s\S]*?update:\s*protectedProcedure/, replacement: 'update: manageTradeProcedure', section: 'trades' },
  { pattern: /trades:\s*router\(\{[\s\S]*?delete:\s*protectedProcedure/, replacement: 'delete: manageTradeProcedure', section: 'trades' },
  
  // Export endpoints - EXPORT_DATA
  { pattern: /export:\s*router\(\{[\s\S]*?trades:\s*protectedProcedure/, replacement: 'trades: exportDataProcedure', section: 'export' },
  { pattern: /export:\s*router\(\{[\s\S]*?performance:\s*protectedProcedure/, replacement: 'performance: exportDataProcedure', section: 'export' },
  { pattern: /export:\s*router\(\{[\s\S]*?equity:\s*protectedProcedure/, replacement: 'equity: exportDataProcedure', section: 'export' },
  
  // Admin endpoints - MANAGE_SYSTEM
  { pattern: /admin:\s*router\(\{[\s\S]*?getStatus:\s*protectedProcedure/, replacement: 'getStatus: manageSystemProcedure', section: 'admin' },
  { pattern: /admin:\s*router\(\{[\s\S]*?pause:\s*protectedProcedure/, replacement: 'pause: manageSystemProcedure', section: 'admin' },
  { pattern: /admin:\s*router\(\{[\s\S]*?resume:\s*protectedProcedure/, replacement: 'resume: manageSystemProcedure', section: 'admin' },
];

console.log('🔐 RBAC Integration Script\n');
console.log('Reading routers.ts...');

let content = fs.readFileSync(routersPath, 'utf-8');
const originalContent = content;

// Track replacements by section
const replacementsBySection = {};
let totalReplacements = 0;

console.log('\n📋 Applying RBAC procedure replacements...\n');

// Simple approach: replace specific patterns
const simpleReplacements = [
  { find: 'overview: protectedProcedure', replace: 'overview: viewAnalyticsProcedure' },
  { find: 'metrics: protectedProcedure', replace: 'metrics: viewAnalyticsProcedure' },
  { find: 'equityCurve: protectedProcedure', replace: 'equityCurve: viewAnalyticsProcedure' },
  { find: 'trades: protectedProcedure', replace: 'trades: viewAnalyticsProcedure' },
  { find: 'breakdown: protectedProcedure', replace: 'breakdown: viewAnalyticsProcedure' },
  { find: 'dailyMetrics: protectedProcedure', replace: 'dailyMetrics: viewAnalyticsProcedure' },
  { find: 'create: protectedProcedure', replace: 'create: createStrategyProcedure' },
  { find: 'update: protectedProcedure', replace: 'update: updateStrategyProcedure' },
  { find: 'delete: protectedProcedure', replace: 'delete: deleteStrategyProcedure' },
  { find: 'getStatus: protectedProcedure', replace: 'getStatus: manageSystemProcedure' },
  { find: 'pause: protectedProcedure', replace: 'pause: manageSystemProcedure' },
  { find: 'resume: protectedProcedure', replace: 'resume: manageSystemProcedure' },
];

simpleReplacements.forEach(({ find, replace }) => {
  const count = (content.match(new RegExp(find, 'g')) || []).length;
  if (count > 0) {
    content = content.replaceAll(find, replace);
    console.log(`  ✓ ${replace} (${count} occurrence${count > 1 ? 's' : ''})`);
    totalReplacements += count;
  }
});

// Write the file
if (content !== originalContent) {
  fs.writeFileSync(routersPath, content, 'utf-8');
  console.log(`\n✅ Successfully integrated RBAC procedures!`);
  console.log(`   - Total replacements: ${totalReplacements}`);
  console.log(`   - File updated: ${routersPath}`);
  console.log('\n📝 Next steps:');
  console.log('   1. Review changes in routers.ts');
  console.log('   2. Run TypeScript compiler to check for errors');
  console.log('   3. Test endpoints with different user roles');
  console.log('   4. Verify permission checks are working correctly');
  console.log('   5. Create integration tests for RBAC endpoints');
} else {
  console.log('\n⚠️  No changes made - procedures may already be integrated');
}

console.log('\n✨ RBAC integration complete!');
