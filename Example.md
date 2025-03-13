# ZKSync Telemetry Integration Guide

A comprehensive guide to integrating the ZKSync Telemetry library into your TypeScript/JavaScript CLI application, with detailed examples and best practices.

## Prerequisites

- Node.js (v14 or higher)
- npm, yarn, or pnpm
- A TypeScript/JavaScript CLI application

## Table of Contents

1. [Installation](#1-installation)
2. [Basic Integration](#2-basic-integration)
3. [Usage Patterns](#3-usage-patterns)
4. [Error Handling](#4-error-handling)
5. [Advanced Integration](#5-advanced-integration)
6. [Best Practices](#6-best-practices)
7. [Troubleshooting](#7-troubleshooting)

## 1. Installation

Install the library using your preferred package manager:

```bash
# Using npm
npm install zksync-telemetry

# Using yarn
yarn add zksync-telemetry

# Using pnpm
pnpm add zksync-telemetry
```

## 2. Basic Integration

### Step 1: Initialize Telemetry

Create a new file called `telemetry.ts` (or `.js`) to manage your telemetry instance:

```typescript
// src/telemetry.ts
import { Telemetry } from 'zksync-telemetry';

export function initializeTelemetry() {
  const telemetry = Telemetry.initialize(
    'your-cli-name',
    'your-cli-version',
    'your-config-file-name',
    'your-posthog-key',
  );

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await telemetry.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await telemetry.shutdown();
    process.exit(0);
  });

  return telemetry;
}

// Create a singleton instance
let telemetryInstance: Telemetry | null = null;

export function getTelemetry() {
  if (!telemetryInstance) {
    telemetryInstance = initializeTelemetry();
  }
  return telemetryInstance;
}
```

### Step 2: Basic Usage in Your CLI

```typescript
// src/cli.ts
import { Command } from 'commander'; // or your preferred CLI framework
import { getTelemetry } from './telemetry';

async function main() {
  const telemetry = getTelemetry();
  const program = new Command();

  program.name('your-cli').version('1.0.0');

  program
    .command('hello')
    .description('Say hello')
    .action(() => {
      telemetry.trackEvent('command_executed', {
        command: 'hello',
      });
      console.log('Hello, World!');
    });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  const telemetry = getTelemetry();
  telemetry.trackError(error, {
    context: 'cli_initialization',
  });
  console.error('Error:', error);
  process.exit(1);
});
```

## 3. Usage Patterns

### Tracking Command Execution

```typescript
telemetry.trackEvent('command_executed', {
  command: 'deploy',
  duration_ms: 1500,
  cache_used: true,
  network: 'testnet',
});
```

### Tracking Operation Status

```typescript
const startTime = Date.now();
try {
  await someOperation();
  telemetry.trackEvent('operation_completed', {
    operation: 'contract_deployment',
    duration_ms: Date.now() - startTime,
    status: 'success',
  });
} catch (error) {
  telemetry.trackEvent('operation_failed', {
    operation: 'contract_deployment',
    duration_ms: Date.now() - startTime,
    status: 'failure',
  });
  throw error;
}
```

## 4. Error Handling

### Basic Error Tracking

```typescript
try {
  await riskyOperation();
} catch (error) {
  telemetry.trackError(error as Error, {
    operation: 'contract_deployment',
    network: 'mainnet',
    last_action: 'compilation',
  });
  throw error;
}
```

### Error Context Enrichment

```typescript
class OperationHandler {
  private context: Record<string, any>;

  constructor() {
    this.context = {
      handler_id: crypto.randomUUID(),
      start_time: Date.now(),
    };
  }

  private enrichErrorContext(additional: Record<string, any>) {
    return {
      ...this.context,
      ...additional,
      duration_ms: Date.now() - this.context.start_time,
    };
  }

  async execute() {
    try {
      await this.riskyOperation();
    } catch (error) {
      const telemetry = getTelemetry();
      telemetry.trackError(
        error as Error,
        this.enrichErrorContext({
          last_successful_step: this.lastStep,
        }),
      );
      throw error;
    }
  }
}
```

## 5. Advanced Integration

### Class-based CLI Structure

```typescript
// src/cli/base-command.ts
import { Command } from 'commander';
import { Telemetry } from 'zksync-telemetry';
import { getTelemetry } from '../telemetry';

export abstract class BaseCommand {
  protected telemetry: Telemetry;
  protected startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  initialize() {
    this.telemetry = getTelemetry();
  }

  protected trackCommandExecution(
    command: string,
    status: 'success' | 'failure',
    additionalProps: Record<string, any> = {},
  ) {
    const duration = Date.now() - this.startTime;

    this.telemetry.trackEvent('command_executed', {
      command,
      status,
      duration_ms: duration,
      ...additionalProps,
    });
  }

  protected handleError(error: Error, context: Record<string, any> = {}) {
    this.telemetry.trackError(error, {
      duration_ms: Date.now() - this.startTime,
      ...context,
    });
  }
}

// Example command implementation
export class DeployCommand extends BaseCommand {
  async execute(options: any) {
    this.initialize();

    try {
      await this.deploy(options);

      this.trackCommandExecution('deploy', 'success', {
        network: options.network,
        optimization: options.optimization,
      });
    } catch (error) {
      this.trackCommandExecution('deploy', 'failure');
      this.handleError(error as Error, {
        command: 'deploy',
        options,
      });
      throw error;
    }
  }
}
```

## 6. Best Practices

### Data Privacy

```typescript
// DO: Track non-sensitive information
telemetry.trackEvent('wallet_action', {
  action: 'balance_check',
  network: 'mainnet',
  has_sufficient_funds: true,
});

// DON'T: Track sensitive information
telemetry.trackEvent('wallet_action', {
  wallet_address: '0x123...', // PII - don't track
  private_key: '...', // Sensitive - don't track
  balance: '1000', // Sensitive - don't track
});
```

### Performance Tracking

```typescript
class PerformanceTracker {
  private startTimes: Map<string, number> = new Map();

  startOperation(operation: string) {
    this.startTimes.set(operation, Date.now());
  }

  endOperation(operation: string, success: boolean) {
    const startTime = this.startTimes.get(operation);
    if (!startTime) return;

    const duration = Date.now() - startTime;
    const telemetry = getTelemetry();

    telemetry.trackEvent('operation_completed', {
      operation,
      duration_ms: duration,
      success,
    });

    this.startTimes.delete(operation);
  }
}
```

## 7. Troubleshooting

### Common Issues and Solutions

1. **Telemetry Not Working in CI Environment**

   - This is expected behavior. The library automatically disables telemetry in non-interactive environments.
   - To override: Use a custom config path with pre-configured consent.

2. **Events Not Being Tracked**

   - Check if telemetry is enabled (user might have disabled it)
   - Verify network connectivity
   - Check if the application has proper shutdown handling

3. **Error Tracking Not Working**
   - Ensure errors are properly caught and passed to trackError
   - Check if sourcemaps are properly configured for better stack traces

### Health Check

```typescript
function checkTelemetryHealth() {
  const telemetry = getTelemetry();

  try {
    // Test event tracking
    telemetry.trackEvent('health_check', {
      timestamp: Date.now(),
    });

    // Test error tracking
    telemetry.trackError(new Error('Health check error'));

    console.log('Telemetry health check passed');
  } catch (error) {
    console.error('Telemetry health check failed:', error);
  }
}
```

Remember:

- Telemetry is off by default and requires user consent
- The library handles sensitive data removal automatically
- Automatic reconnection is built-in for network issues
- Configuration is persisted between runs
- The library is designed to fail gracefully if services are unavailable

For additional support or questions, please open an issue on the GitHub repository.
