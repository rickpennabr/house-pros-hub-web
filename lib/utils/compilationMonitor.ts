/**
 * Compilation time monitoring utility for Next.js development
 * 
 * Tracks and logs route compilation times to identify performance bottlenecks.
 * Only active in development mode.
 */

const isDevelopment = process.env.NODE_ENV === 'development';

interface CompilationMetric {
  route: string;
  compileTime: number;
  renderTime: number;
  totalTime: number;
  timestamp: number;
}

class CompilationMonitor {
  private metrics: CompilationMetric[] = [];
  private readonly maxMetrics = 100; // Keep last 100 metrics
  private readonly slowCompileThreshold = 2000; // Warn if compile > 2s

  /**
   * Record a compilation metric
   */
  record(route: string, compileTime: number, renderTime: number): void {
    if (!isDevelopment) {
      return; // Only track in development
    }

    const totalTime = compileTime + renderTime;
    const metric: CompilationMetric = {
      route,
      compileTime,
      renderTime,
      totalTime,
      timestamp: Date.now(),
    };

    this.metrics.push(metric);

    // Keep only the last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Warn about slow compilations
    if (compileTime > this.slowCompileThreshold) {
      console.warn(
        `[CompilationMonitor] Slow compilation detected:`,
        {
          route,
          compileTime: `${compileTime.toFixed(0)}ms`,
          renderTime: `${renderTime.toFixed(0)}ms`,
          totalTime: `${totalTime.toFixed(0)}ms`,
        }
      );
    }

    // Log compilation summary (only for slow ones or first 10)
    if (compileTime > 1000 || this.metrics.length <= 10) {
      console.log(
        `[CompilationMonitor]`,
        `${route}: compile=${compileTime.toFixed(0)}ms, render=${renderTime.toFixed(0)}ms, total=${totalTime.toFixed(0)}ms`
      );
    }
  }

  /**
   * Get compilation statistics for a route
   */
  getStats(route?: string): {
    count: number;
    avgCompileTime: number;
    avgRenderTime: number;
    avgTotalTime: number;
    maxCompileTime: number;
    maxRenderTime: number;
  } {
    const relevantMetrics = route
      ? this.metrics.filter((m) => m.route === route)
      : this.metrics;

    if (relevantMetrics.length === 0) {
      return {
        count: 0,
        avgCompileTime: 0,
        avgRenderTime: 0,
        avgTotalTime: 0,
        maxCompileTime: 0,
        maxRenderTime: 0,
      };
    }

    const totalCompile = relevantMetrics.reduce((sum, m) => sum + m.compileTime, 0);
    const totalRender = relevantMetrics.reduce((sum, m) => sum + m.renderTime, 0);
    const totalTime = relevantMetrics.reduce((sum, m) => sum + m.totalTime, 0);
    const maxCompile = Math.max(...relevantMetrics.map((m) => m.compileTime));
    const maxRender = Math.max(...relevantMetrics.map((m) => m.renderTime));

    return {
      count: relevantMetrics.length,
      avgCompileTime: totalCompile / relevantMetrics.length,
      avgRenderTime: totalRender / relevantMetrics.length,
      avgTotalTime: totalTime / relevantMetrics.length,
      maxCompileTime: maxCompile,
      maxRenderTime: maxRender,
    };
  }

  /**
   * Get routes with slowest compilations
   */
  getSlowestRoutes(limit: number = 10): Array<{
    route: string;
    avgCompileTime: number;
    count: number;
  }> {
    const routeMap = new Map<string, number[]>();

    for (const metric of this.metrics) {
      const existing = routeMap.get(metric.route) || [];
      existing.push(metric.compileTime);
      routeMap.set(metric.route, existing);
    }

    const routeStats = Array.from(routeMap.entries())
      .map(([route, compileTimes]) => ({
        route,
        avgCompileTime: compileTimes.reduce((a, b) => a + b, 0) / compileTimes.length,
        count: compileTimes.length,
      }))
      .sort((a, b) => b.avgCompileTime - a.avgCompileTime)
      .slice(0, limit);

    return routeStats;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Print compilation summary
   */
  printSummary(): void {
    if (!isDevelopment || this.metrics.length === 0) {
      return;
    }

    const allStats = this.getStats();
    const slowest = this.getSlowestRoutes(5);

    console.log('\n[CompilationMonitor] Summary:');
    console.log(`Total routes compiled: ${allStats.count}`);
    console.log(`Average compile time: ${allStats.avgCompileTime.toFixed(0)}ms`);
    console.log(`Average render time: ${allStats.avgRenderTime.toFixed(0)}ms`);
    console.log(`Average total time: ${allStats.avgTotalTime.toFixed(0)}ms`);
    console.log(`Max compile time: ${allStats.maxCompileTime.toFixed(0)}ms`);
    console.log('\nSlowest routes:');
    slowest.forEach((stat, index) => {
      console.log(
        `  ${index + 1}. ${stat.route}: ${stat.avgCompileTime.toFixed(0)}ms avg (${stat.count} compilations)`
      );
    });
    console.log('');
  }
}

// Singleton instance
export const compilationMonitor = new CompilationMonitor();

/**
 * Middleware to parse Next.js compilation logs and track metrics
 * 
 * In development, Next.js logs compilation times like:
 * "GET /api/businesses 200 in 2.4s (compile: 1434ms, render: 936ms)"
 * 
 * This function extracts and records these metrics.
 */
export function parseAndRecordCompilationLog(logLine: string): void {
  if (!isDevelopment) {
    return;
  }

  // Match Next.js compilation log format
  // Format: "METHOD /path STATUS in TOTAL_TIME (compile: COMPILE_TIME, render: RENDER_TIME)"
  const pattern = /(?:GET|POST|PUT|DELETE|PATCH)\s+([^\s]+)\s+\d+\s+in\s+([\d.]+)s\s+\(compile:\s+([\d.]+)ms,\s+render:\s+([\d.]+)ms\)/;

  const match = logLine.match(pattern);
  if (!match) {
    return;
  }

  const [, route, totalTimeStr, compileTimeStr, renderTimeStr] = match;
  const compileTime = parseFloat(compileTimeStr);
  const renderTime = parseFloat(renderTimeStr);

  compilationMonitor.record(route, compileTime, renderTime);
}

// Auto-print summary on process exit in development
if (isDevelopment && typeof process !== 'undefined') {
  process.on('SIGINT', () => {
    compilationMonitor.printSummary();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    compilationMonitor.printSummary();
    process.exit(0);
  });
}

