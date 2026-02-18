/**
 * Load Testing Suite
 * Simulates concurrent users and measures system performance under load
 */

import axios, { AxiosInstance } from "axios";

interface LoadTestConfig {
  baseUrl: string;
  concurrentUsers: number;
  requestsPerUser: number;
  rampUpTime: number; // milliseconds
  endpoints: LoadTestEndpoint[];
}

interface LoadTestEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  weight?: number; // Probability of this endpoint being called (0-1)
  data?: any;
  headers?: Record<string, string>;
}

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  errors: Map<string, number>;
}

class LoadTester {
  private config: LoadTestConfig;
  private client: AxiosInstance;
  private responseTimes: number[] = [];
  private errors: Map<string, number> = new Map();
  private startTime: number = 0;
  private endTime: number = 0;

  constructor(config: LoadTestConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      validateStatus: () => true, // Don't throw on any status code
    });
  }

  /**
   * Run the load test
   */
  async run(): Promise<LoadTestResult> {
    console.log(
      `Starting load test with ${this.config.concurrentUsers} concurrent users...`
    );

    this.responseTimes = [];
    this.errors = new Map();
    this.startTime = Date.now();

    const userPromises: Promise<void>[] = [];
    const rampUpInterval = this.config.rampUpTime / this.config.concurrentUsers;

    // Ramp up users gradually
    for (let i = 0; i < this.config.concurrentUsers; i++) {
      await new Promise(resolve => setTimeout(resolve, rampUpInterval));

      userPromises.push(this.simulateUser(i));
    }

    // Wait for all users to complete
    await Promise.all(userPromises);

    this.endTime = Date.now();

    return this.generateReport();
  }

  /**
   * Simulate a single user making requests
   */
  private async simulateUser(_userId: number): Promise<void> {
    for (let i = 0; i < this.config.requestsPerUser; i++) {
      try {
        const endpoint = this.selectEndpoint();
        const startTime = performance.now();

        const response = await this.client({
          method: endpoint.method,
          url: endpoint.path,
          data: endpoint.data,
          headers: endpoint.headers,
        });

        const duration = performance.now() - startTime;
        this.responseTimes.push(duration);

        if (response.status >= 400) {
          const errorKey = `${endpoint.path} - ${response.status}`;
          this.errors.set(errorKey, (this.errors.get(errorKey) || 0) + 1);
        }
      } catch (error: any) {
        const errorKey = error.message || "Unknown error";
        this.errors.set(errorKey, (this.errors.get(errorKey) || 0) + 1);
      }

      // Add small delay between requests to simulate real user behavior
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    }
  }

  /**
   * Select an endpoint based on weights
   */
  private selectEndpoint(): LoadTestEndpoint {
    const random = Math.random();
    let cumulative = 0;

    for (const endpoint of this.config.endpoints) {
      const weight = endpoint.weight || 1 / this.config.endpoints.length;
      cumulative += weight;

      if (random <= cumulative) {
        return endpoint;
      }
    }

    return this.config.endpoints[0]!;
  }

  /**
   * Generate test report
   */
  private generateReport(): LoadTestResult {
    const totalRequests =
      this.config.concurrentUsers * this.config.requestsPerUser;
    const failedRequests = Array.from(this.errors.values()).reduce(
      (a, b) => a + b,
      0
    );
    const successfulRequests = totalRequests - failedRequests;
    const duration = this.endTime - this.startTime;

    // Sort response times for percentile calculation
    const sorted = [...this.responseTimes].sort((a, b) => a - b);

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime:
        this.responseTimes.reduce((a, b) => a + b, 0) /
        this.responseTimes.length,
      minResponseTime: Math.min(...this.responseTimes),
      maxResponseTime: Math.max(...this.responseTimes),
      p50ResponseTime: sorted[Math.floor(sorted.length * 0.5)]!,
      p95ResponseTime: sorted[Math.floor(sorted.length * 0.95)]!,
      p99ResponseTime: sorted[Math.floor(sorted.length * 0.99)]!,
      requestsPerSecond: (totalRequests / duration) * 1000,
      errorRate: failedRequests / totalRequests,
      errors: this.errors,
    };
  }

  /**
   * Print report to console
   */
  static printReport(result: LoadTestResult): void {
    console.log("\n========== LOAD TEST REPORT ==========\n");

    console.log("Request Statistics:");
    console.log(`  Total Requests: ${result.totalRequests}`);
    console.log(
      `  Successful: ${result.successfulRequests} (${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%)`
    );
    console.log(
      `  Failed: ${result.failedRequests} (${(result.errorRate * 100).toFixed(2)}%)`
    );

    console.log("\nResponse Time (ms):");
    console.log(`  Average: ${result.averageResponseTime.toFixed(2)}`);
    console.log(`  Min: ${result.minResponseTime.toFixed(2)}`);
    console.log(`  Max: ${result.maxResponseTime.toFixed(2)}`);
    console.log(`  P50: ${result.p50ResponseTime.toFixed(2)}`);
    console.log(`  P95: ${result.p95ResponseTime.toFixed(2)}`);
    console.log(`  P99: ${result.p99ResponseTime.toFixed(2)}`);

    console.log("\nThroughput:");
    console.log(`  Requests/sec: ${result.requestsPerSecond.toFixed(2)}`);

    if (result.errors.size > 0) {
      console.log("\nErrors:");
      // @ts-expect-error TS2802
      for (const [error, count] of result.errors) {
        console.log(`  ${error}: ${count}`);
      }
    }

    console.log("\n=====================================\n");
  }
}

/**
 * Example: Run load test
 */
export async function runLoadTest(): Promise<void> {
  const tester = new LoadTester({
    baseUrl: "http://localhost:3001",
    concurrentUsers: 100,
    requestsPerUser: 10,
    rampUpTime: 30000, // 30 seconds
    endpoints: [
      {
        method: "GET",
        path: "/api/trpc/publicApi.listStrategies",
        weight: 0.3,
      },
      {
        method: "GET",
        path: "/api/trpc/platform.stats",
        weight: 0.2,
      },
      {
        method: "GET",
        path: "/api/health",
        weight: 0.5,
      },
    ],
  });

  try {
    const result = await tester.run();
    LoadTester.printReport(result);

    // Check if test passed
    if (result.errorRate > 0.01) {
      console.warn("⚠️  Error rate exceeded 1%");
    }

    if (result.p95ResponseTime > 1000) {
      console.warn("⚠️  P95 response time exceeded 1 second");
    }

    if (result.requestsPerSecond < 100) {
      console.warn("⚠️  Throughput below expected threshold");
    }

    console.log("✅ Load test completed");
  } catch (error) {
    console.error("❌ Load test failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runLoadTest();
}
