#!/usr/bin/env node
/**
 * Performance Audit Script
 * Analyzes the application for performance bottlenecks and generates recommendations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Performance audit results
const auditResults = {
  timestamp: new Date().toISOString(),
  summary: {
    score: 0,
    totalIssues: 0,
    criticalIssues: 0,
    warnings: 0,
    optimizations: 0,
  },
  categories: {
    bundleSize: { score: 0, issues: [], recommendations: [] },
    codeQuality: { score: 0, issues: [], recommendations: [] },
    database: { score: 0, issues: [], recommendations: [] },
    caching: { score: 0, issues: [], recommendations: [] },
    network: { score: 0, issues: [], recommendations: [] },
  },
};

// Check bundle size by analyzing imports
function analyzeBundleSize() {
  console.log('\n📦 Analyzing bundle size...');
  
  const clientDir = path.join(projectRoot, 'client', 'src');
  const issues = [];
  const recommendations = [];
  let score = 100;
  
  // Check for large dependencies
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const largeDeps = ['moment', 'lodash', 'jquery', 'bootstrap'];
  largeDeps.forEach(dep => {
    if (deps[dep]) {
      issues.push({ severity: 'warning', message: `Large dependency detected: ${dep}` });
      score -= 10;
    }
  });
  
  // Check for tree-shakeable imports
  const checkTreeShaking = (dir) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    files.forEach(file => {
      if (file.isDirectory()) {
        checkTreeShaking(path.join(dir, file.name));
      } else if (file.name.endsWith('.tsx') || file.name.endsWith('.ts')) {
        const content = fs.readFileSync(path.join(dir, file.name), 'utf-8');
        
        // Check for non-tree-shakeable imports
        if (content.includes("import * as")) {
          issues.push({ 
            severity: 'info', 
            message: `Namespace import in ${file.name} - consider named imports for better tree-shaking` 
          });
        }
      }
    });
  };
  
  checkTreeShaking(clientDir);
  
  // Recommendations
  recommendations.push('Use dynamic imports for route-level code splitting');
  recommendations.push('Consider using React.lazy() for heavy components');
  recommendations.push('Enable gzip/brotli compression in production');
  
  auditResults.categories.bundleSize = { score: Math.max(0, score), issues, recommendations };
  console.log(`  Score: ${Math.max(0, score)}/100`);
  console.log(`  Issues found: ${issues.length}`);
}

// Analyze code quality
function analyzeCodeQuality() {
  console.log('\n🔍 Analyzing code quality...');
  
  const serverDir = path.join(projectRoot, 'server');
  const issues = [];
  const recommendations = [];
  let score = 100;
  
  // Check for console.log statements
  const checkConsoleLogs = (dir) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    files.forEach(file => {
      if (file.isDirectory() && !file.name.startsWith('_') && file.name !== 'node_modules') {
        checkConsoleLogs(path.join(dir, file.name));
      } else if (file.name.endsWith('.ts') && !file.name.includes('.test.')) {
        const content = fs.readFileSync(path.join(dir, file.name), 'utf-8');
        const consoleMatches = content.match(/console\.(log|warn|error)/g);
        if (consoleMatches && consoleMatches.length > 5) {
          issues.push({ 
            severity: 'info', 
            message: `${file.name} has ${consoleMatches.length} console statements - consider using structured logging` 
          });
        }
      }
    });
  };
  
  checkConsoleLogs(serverDir);
  
  // Check for error handling
  const routersPath = path.join(serverDir, 'routers.ts');
  if (fs.existsSync(routersPath)) {
    const content = fs.readFileSync(routersPath, 'utf-8');
    const tryBlocks = (content.match(/try\s*{/g) || []).length;
    
    if (tryBlocks < 5) {
      issues.push({ severity: 'warning', message: 'Limited error handling in routers - consider adding try-catch blocks' });
      score -= 10;
    }
  }
  
  recommendations.push('Use structured logging (e.g., pino, winston) instead of console.log');
  recommendations.push('Add error boundaries in React components');
  recommendations.push('Implement request validation with Zod schemas');
  
  auditResults.categories.codeQuality = { score: Math.max(0, score), issues, recommendations };
  console.log(`  Score: ${Math.max(0, score)}/100`);
  console.log(`  Issues found: ${issues.length}`);
}

// Analyze database queries
function analyzeDatabase() {
  console.log('\n🗄️ Analyzing database patterns...');
  
  const dbPath = path.join(projectRoot, 'server', 'db.ts');
  const issues = [];
  const recommendations = [];
  let score = 100;
  
  if (fs.existsSync(dbPath)) {
    const content = fs.readFileSync(dbPath, 'utf-8');
    
    // Check for N+1 query patterns
    const selectCount = (content.match(/\.select\(/g) || []).length;
    const forLoopCount = (content.match(/for\s*\(/g) || []).length;
    
    if (forLoopCount > 3 && selectCount > 5) {
      issues.push({ severity: 'warning', message: 'Potential N+1 query pattern detected - consider using joins or batch queries' });
      score -= 15;
    }
    
    // Check for missing indexes (heuristic)
    if (!content.includes('.index(') && !content.includes('INDEX')) {
      recommendations.push('Consider adding database indexes for frequently queried columns');
    }
    
    // Check for connection pooling
    if (content.includes('createConnection') && !content.includes('pool')) {
      issues.push({ severity: 'info', message: 'Consider using connection pooling for better performance' });
    }
  }
  
  recommendations.push('Use database connection pooling');
  recommendations.push('Add indexes on frequently queried columns (userId, strategyId, createdAt)');
  recommendations.push('Consider query result caching for read-heavy operations');
  
  auditResults.categories.database = { score: Math.max(0, score), issues, recommendations };
  console.log(`  Score: ${Math.max(0, score)}/100`);
  console.log(`  Issues found: ${issues.length}`);
}

// Analyze caching opportunities
function analyzeCaching() {
  console.log('\n💾 Analyzing caching opportunities...');
  
  const issues = [];
  const recommendations = [];
  let score = 85; // Start lower as caching is often missing
  
  const serverDir = path.join(projectRoot, 'server');
  
  // Check for caching implementations
  const checkCaching = (dir) => {
    if (!fs.existsSync(dir)) return false;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    let hasCaching = false;
    
    files.forEach(file => {
      if (file.isDirectory() && !file.name.startsWith('_')) {
        if (checkCaching(path.join(dir, file.name))) hasCaching = true;
      } else if (file.name.endsWith('.ts')) {
        const content = fs.readFileSync(path.join(dir, file.name), 'utf-8');
        if (content.includes('cache') || content.includes('Cache') || content.includes('memoize')) {
          hasCaching = true;
        }
      }
    });
    
    return hasCaching;
  };
  
  if (!checkCaching(serverDir)) {
    issues.push({ severity: 'info', message: 'No explicit caching layer detected' });
    score -= 15;
  }
  
  recommendations.push('Implement in-memory caching for strategy data (changes infrequently)');
  recommendations.push('Cache webhook stats aggregations (expensive queries)');
  recommendations.push('Use React Query staleTime for client-side caching');
  recommendations.push('Consider Redis for distributed caching in production');
  
  auditResults.categories.caching = { score: Math.max(0, score), issues, recommendations };
  console.log(`  Score: ${Math.max(0, score)}/100`);
  console.log(`  Issues found: ${issues.length}`);
}

// Analyze network optimizations
function analyzeNetwork() {
  console.log('\n🌐 Analyzing network optimizations...');
  
  const issues = [];
  const recommendations = [];
  let score = 90;
  
  // Check for compression middleware
  const serverCorePath = path.join(projectRoot, 'server', '_core');
  if (fs.existsSync(serverCorePath)) {
    const files = fs.readdirSync(serverCorePath);
    let hasCompression = false;
    
    files.forEach(file => {
      if (file.endsWith('.ts')) {
        const content = fs.readFileSync(path.join(serverCorePath, file), 'utf-8');
        if (content.includes('compression')) {
          hasCompression = true;
        }
      }
    });
    
    if (!hasCompression) {
      issues.push({ severity: 'warning', message: 'No compression middleware detected' });
      score -= 10;
    }
  }
  
  recommendations.push('Enable gzip/brotli compression for API responses');
  recommendations.push('Use HTTP/2 for multiplexed connections');
  recommendations.push('Implement request batching for multiple API calls');
  recommendations.push('Add CDN for static assets in production');
  
  auditResults.categories.network = { score: Math.max(0, score), issues, recommendations };
  console.log(`  Score: ${Math.max(0, score)}/100`);
  console.log(`  Issues found: ${issues.length}`);
}

// Calculate overall score
function calculateOverallScore() {
  const categories = auditResults.categories;
  const scores = Object.values(categories).map(c => c.score);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  let totalIssues = 0;
  let criticalIssues = 0;
  let warnings = 0;
  
  Object.values(categories).forEach(category => {
    category.issues.forEach(issue => {
      totalIssues++;
      if (issue.severity === 'critical') criticalIssues++;
      if (issue.severity === 'warning') warnings++;
    });
  });
  
  auditResults.summary = {
    score: Math.round(avgScore),
    totalIssues,
    criticalIssues,
    warnings,
    optimizations: Object.values(categories).reduce((sum, c) => sum + c.recommendations.length, 0),
  };
}

// Generate report
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 PERFORMANCE AUDIT REPORT');
  console.log('='.repeat(60));
  
  console.log(`\n🎯 Overall Score: ${auditResults.summary.score}/100`);
  console.log(`   Total Issues: ${auditResults.summary.totalIssues}`);
  console.log(`   Critical: ${auditResults.summary.criticalIssues}`);
  console.log(`   Warnings: ${auditResults.summary.warnings}`);
  console.log(`   Optimization Opportunities: ${auditResults.summary.optimizations}`);
  
  console.log('\n📋 Category Breakdown:');
  Object.entries(auditResults.categories).forEach(([name, data]) => {
    console.log(`\n  ${name.toUpperCase()}: ${data.score}/100`);
    if (data.issues.length > 0) {
      console.log('    Issues:');
      data.issues.forEach(issue => {
        const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
        console.log(`      ${icon} ${issue.message}`);
      });
    }
    if (data.recommendations.length > 0) {
      console.log('    Recommendations:');
      data.recommendations.forEach(rec => {
        console.log(`      💡 ${rec}`);
      });
    }
  });
  
  // Save report to file
  const reportPath = path.join(projectRoot, 'performance-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2));
  console.log(`\n✅ Full report saved to: ${reportPath}`);
}

// Run audit
console.log('🚀 Starting Performance Audit...');
console.log('='.repeat(60));

analyzeBundleSize();
analyzeCodeQuality();
analyzeDatabase();
analyzeCaching();
analyzeNetwork();
calculateOverallScore();
generateReport();

console.log('\n✨ Audit complete!');
