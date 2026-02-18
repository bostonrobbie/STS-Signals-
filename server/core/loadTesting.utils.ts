import { logger } from "./logger";

/**
 * Load Testing & Capacity Planning Utilities
 * Provides tools for simulating concurrent users and measuring system performance
 */

export interface LoadTestConfig {
  concurrentUsers: number;
  rampUpTime: number; // seconds
  testDuration: number; // seconds
  endpoints: LoadTestEndpoint[];
}

export interface LoadTestEndpoint {
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: Record<string, any>;
  weight: number; // percentage of requests
}

export interface LoadTestResult {
  endpoint: string;
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
}

export interface LoadTestReport {
  startTime: Date;
  endTime: Date;
  duration: number;
  concurrentUsers: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  results: LoadTestResult[];
  systemMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    databaseConnections: number;
  };
}

/**
 * Simulate concurrent users making requests
 */
export const simulateConcurrentUsers = async (
  config: LoadTestConfig,
  makeRequest: (
    endpoint: LoadTestEndpoint
  ) => Promise<{ statusCode: number; responseTime: number }>
): Promise<LoadTestReport> => {
  const startTime = new Date();
  const results = new Map<string, LoadTestResult>();
  const responseTimes = new Map<string, number[]>();

  // Initialize results
  config.endpoints.forEach(endpoint => {
    results.set(endpoint.name, {
      endpoint: endpoint.name,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
    });
    responseTimes.set(endpoint.name, []);
  });

  // Ramp up users gradually
  const usersPerSecond = config.concurrentUsers / config.rampUpTime;
  // @ts-expect-error TS6133 unused
  const _requestsPerUser = config.testDuration / config.rampUpTime;

  logger.info(
    `Starting load test: ${config.concurrentUsers} users over ${config.testDuration}s`
  );

  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;

  // Simulate users
  for (let user = 0; user < config.concurrentUsers; user++) {
    // Stagger user creation
    const delay = (user / usersPerSecond) * 1000;

    setTimeout(async () => {
      const userStartTime = Date.now();

      while (Date.now() - userStartTime < config.testDuration * 1000) {
        // Select endpoint based on weight
        const random = Math.random() * 100;
        let cumulativeWeight = 0;
        let selectedEndpoint = config.endpoints[0];

        for (const endpoint of config.endpoints) {
          cumulativeWeight += endpoint.weight;
          if (random <= cumulativeWeight) {
            selectedEndpoint = endpoint;
            break;
          }
        }

        try {
          const response = await makeRequest(selectedEndpoint);
          const result = results.get(selectedEndpoint.name)!;

          result.totalRequests++;
          totalRequests++;

          if (response.statusCode >= 200 && response.statusCode < 300) {
            result.successfulRequests++;
            successfulRequests++;
          } else {
            result.failedRequests++;
            failedRequests++;
          }

          result.minResponseTime = Math.min(
            result.minResponseTime,
            response.responseTime
          );
          result.maxResponseTime = Math.max(
            result.maxResponseTime,
            response.responseTime
          );

          const times = responseTimes.get(selectedEndpoint.name)!;
          times.push(response.responseTime);
        } catch (error) {
          const result = results.get(selectedEndpoint.name)!;
          result.totalRequests++;
          result.failedRequests++;
          totalRequests++;
          failedRequests++;

          logger.error(
            `Load test request failed for ${selectedEndpoint.name}`,
            error
          );
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, delay);
  }

  // Wait for all tests to complete
  await new Promise(resolve =>
    setTimeout(resolve, (config.rampUpTime + config.testDuration) * 1000 + 1000)
  );

  const endTime = new Date();
  const duration = (endTime.getTime() - startTime.getTime()) / 1000;

  // Calculate percentiles
  const finalResults: LoadTestResult[] = [];

  // @ts-expect-error TS2802
  for (const [name, result] of results.entries()) {
    const times = responseTimes.get(name)!.sort((a, b) => a - b);

    if (times.length > 0) {
      result.averageResponseTime =
        times.reduce((a, b) => a + b, 0) / times.length;
      result.p50ResponseTime = times[Math.floor(times.length * 0.5)];
      result.p95ResponseTime = times[Math.floor(times.length * 0.95)];
      result.p99ResponseTime = times[Math.floor(times.length * 0.99)];
      result.requestsPerSecond = result.totalRequests / duration;
      result.errorRate =
        result.totalRequests > 0
          ? (result.failedRequests / result.totalRequests) * 100
          : 0;
    }

    finalResults.push(result);
  }

  return {
    startTime,
    endTime,
    duration,
    concurrentUsers: config.concurrentUsers,
    totalRequests,
    successfulRequests,
    failedRequests,
    averageResponseTime:
      totalRequests > 0
        ? Array.from(responseTimes.values())
            .flat()
            .reduce((a, b) => a + b, 0) / totalRequests
        : 0,
    requestsPerSecond: totalRequests / duration,
    errorRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
    results: finalResults,
    systemMetrics: {
      cpuUsage: process.cpuUsage().user / 1000000,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      databaseConnections: 0, // Would be populated from actual metrics
    },
  };
};

/**
 * Calculate capacity based on load test results
 */
export const calculateCapacity = (
  report: LoadTestReport
): { maxConcurrentUsers: number; maxRPS: number } => {
  // Assume linear scaling up to 2x the tested load
  const maxConcurrentUsers = report.concurrentUsers * 2;
  const maxRPS = report.requestsPerSecond * 2;

  return {
    maxConcurrentUsers,
    maxRPS,
  };
};

/**
 * Generate load test report
 */
export const generateLoadTestReport = (report: LoadTestReport): string => {
  const lines: string[] = [];

  lines.push("=".repeat(80));
  lines.push("LOAD TEST REPORT");
  lines.push("=".repeat(80));
  lines.push("");

  lines.push(`Test Duration: ${report.duration.toFixed(2)}s`);
  lines.push(`Concurrent Users: ${report.concurrentUsers}`);
  lines.push(`Total Requests: ${report.totalRequests}`);
  lines.push(
    `Successful: ${report.successfulRequests} (${((report.successfulRequests / report.totalRequests) * 100).toFixed(2)}%)`
  );
  lines.push(
    `Failed: ${report.failedRequests} (${report.errorRate.toFixed(2)}%)`
  );
  lines.push("");

  lines.push("PERFORMANCE METRICS");
  lines.push("-".repeat(80));
  lines.push(
    `Average Response Time: ${report.averageResponseTime.toFixed(2)}ms`
  );
  lines.push(`Requests Per Second: ${report.requestsPerSecond.toFixed(2)}`);
  lines.push("");

  lines.push("ENDPOINT RESULTS");
  lines.push("-".repeat(80));

  for (const result of report.results) {
    lines.push(`\n${result.endpoint}`);
    lines.push(`  Total Requests: ${result.totalRequests}`);
    lines.push(
      `  Success Rate: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%`
    );
    lines.push(
      `  Avg Response Time: ${result.averageResponseTime.toFixed(2)}ms`
    );
    lines.push(`  Min Response Time: ${result.minResponseTime.toFixed(2)}ms`);
    lines.push(`  Max Response Time: ${result.maxResponseTime.toFixed(2)}ms`);
    lines.push(`  P50 Response Time: ${result.p50ResponseTime.toFixed(2)}ms`);
    lines.push(`  P95 Response Time: ${result.p95ResponseTime.toFixed(2)}ms`);
    lines.push(`  P99 Response Time: ${result.p99ResponseTime.toFixed(2)}ms`);
    lines.push(`  Requests Per Second: ${result.requestsPerSecond.toFixed(2)}`);
  }

  lines.push("");
  lines.push("SYSTEM METRICS");
  lines.push("-".repeat(80));
  lines.push(`CPU Usage: ${report.systemMetrics.cpuUsage.toFixed(2)}%`);
  lines.push(`Memory Usage: ${report.systemMetrics.memoryUsage.toFixed(2)}MB`);
  lines.push(
    `Database Connections: ${report.systemMetrics.databaseConnections}`
  );
  lines.push("");

  lines.push("CAPACITY ANALYSIS");
  lines.push("-".repeat(80));
  const capacity = calculateCapacity(report);
  lines.push(`Estimated Max Concurrent Users: ${capacity.maxConcurrentUsers}`);
  lines.push(
    `Estimated Max Requests Per Second: ${capacity.maxRPS.toFixed(2)}`
  );
  lines.push("");

  lines.push("=".repeat(80));

  return lines.join("\n");
};

/**
 * Performance thresholds for validation
 */
export const performanceThresholds = {
  avgResponseTime: 500, // ms
  p95ResponseTime: 1000, // ms
  p99ResponseTime: 2000, // ms
  errorRate: 0.1, // %
  minRPS: 100, // requests per second
};

/**
 * Validate load test results against thresholds
 */
export const validateLoadTestResults = (
  report: LoadTestReport
): { passed: boolean; failures: string[] } => {
  const failures: string[] = [];

  if (report.averageResponseTime > performanceThresholds.avgResponseTime) {
    failures.push(
      `Average response time ${report.averageResponseTime.toFixed(2)}ms exceeds threshold ${performanceThresholds.avgResponseTime}ms`
    );
  }

  if (report.errorRate > performanceThresholds.errorRate) {
    failures.push(
      `Error rate ${report.errorRate.toFixed(2)}% exceeds threshold ${performanceThresholds.errorRate}%`
    );
  }

  if (report.requestsPerSecond < performanceThresholds.minRPS) {
    failures.push(
      `RPS ${report.requestsPerSecond.toFixed(2)} below minimum threshold ${performanceThresholds.minRPS}`
    );
  }

  return {
    passed: failures.length === 0,
    failures,
  };
};

export default {
  simulateConcurrentUsers,
  calculateCapacity,
  generateLoadTestReport,
  validateLoadTestResults,
  performanceThresholds,
};
