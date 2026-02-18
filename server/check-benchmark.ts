import * as db from './db';

async function checkBenchmark() {
  const data = await db.getBenchmarkData({});
  console.log('Benchmark data points:', data.length);
  
  if (data.length > 0) {
    console.log('First:', data[0]);
    console.log('Last:', data[data.length - 1]);
    
    // Check a few points
    console.log('\nSample points:');
    for (let i = 0; i < Math.min(5, data.length); i++) {
      console.log(`Point ${i}:`, data[i]);
    }
  }
  
  process.exit(0);
}

checkBenchmark().catch(console.error);
