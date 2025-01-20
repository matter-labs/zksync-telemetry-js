# ZKSync Telemetry for TypeScript
Simple telemetry integration for TypeScript CLI applications. The library automatically collects and sends anonymous usage data to help improve zkSync tools and services.

For a detailed integration example, refer: [Example.md](Example.md).

## Table of Contents
- [Installation](#installation)
- [Basic Setup](#basic-setup)
- [Advanced Usage](#advanced-usage)
- [Environment Management](#environment-management)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

## Installation

```bash
# Using npm
npm install zksync-telemetry

# Using yarn
yarn add zksync-telemetry

# Using pnpm
pnpm add zksync-telemetry
```

## Basic Setup

### 1. Initialize Telemetry
```typescript
import { Telemetry } from 'zksync-telemetry';

async function main() {
  // Simple initialization - no keys needed
  const telemetry = await Telemetry.initialize('your-cli-name');
}
```

### 2. Track Events
```typescript
// Track simple event
await telemetry.trackEvent('command_executed', {
  command: 'deploy'
});

// Track event with more context
await telemetry.trackEvent('deployment_completed', {
  environment: 'production',
  duration_ms: 1500,
  cache_enabled: true,
  custom_port: false
});
```

### 3. Track Errors
```typescript
try {
  await deployContract();
} catch (error) {
  telemetry.trackError(error as Error, {
    command: 'deploy',
    network: 'mainnet',
    last_action: 'contract_verification'
  });
  throw error;
}
```

### 4. Clean Shutdown
```typescript
// In your cleanup code
process.on('SIGINT', async () => {
  await telemetry.shutdown();
  process.exit(0);
});
```

## Advanced Usage

### Command Tracking Pattern
```typescript
import { Command } from 'commander';  // or your CLI framework
import { Telemetry } from 'zksync-telemetry';

class CLI {
  private telemetry: Telemetry;

  async initialize() {
    this.telemetry = await Telemetry.initialize('your-cli');

    const program = new Command();

    program
      .command('deploy')
      .option('-e, --environment <env>', 'deployment environment')
      .action(async (options) => {
        await this.trackCommand('deploy', options);
        try {
          // Command implementation
          await this.deploy(options);
        } catch (error) {
          await this.handleError('deploy', error as Error, options);
          throw error;
        }
      });
  }

  private async trackCommand(
    command: string, 
    options: Record<string, any>
  ) {
    await this.telemetry.trackEvent('command_executed', {
      command,
      ...this.sanitizeOptions(options)
    });
  }

  private async handleError(
    command: string, 
    error: Error, 
    context: Record<string, any>
  ) {
    this.telemetry.trackError(error, {
      command,
      ...this.sanitizeOptions(context)
    });
  }

  private sanitizeOptions(options: Record<string, any>): Record<string, any> {
    // Library handles automatic removal of sensitive keys
    // You can add additional custom sanitization here
    const { privateKey, password, secret, ...safeOptions } = options;
    return safeOptions;
  }
}
```

### User Consent Management
```typescript
// User consent is managed automatically via interactive prompts
// To programmatically update consent:
await telemetry.updateConsent(false);  // Disable telemetry
await telemetry.updateConsent(true);   // Enable telemetry
```

## Environment Management

### Environment Detection
The library automatically:
- Disables telemetry in non-interactive environments
- Detects CI environments
- Handles TTY detection for appropriate consent prompts
- Manages configuration persistence between runs

## Best Practices

### 1. Data Privacy
```typescript
// Good - sanitized data
telemetry.trackEvent('wallet_connected', {
  network: 'mainnet',
  has_funds: true,
  transaction_count: 5
});

// Bad - sensitive data
telemetry.trackEvent('wallet_connected', {
  address: '0x123...',  // PII
  private_key: '...',   // Sensitive
  balance: '1000',      // Sensitive
  api_key: '...',       // Will be automatically removed
  password: '...'       // Will be automatically removed
});
```

Note: The library automatically removes any property keys containing 'key', 'password', or 'token' for additional security.

## API Reference

### Telemetry Class
```typescript
class Telemetry {
  static initialize(
    appName: string,
    customConfigPath?: string
  ): Promise<Telemetry>;

  trackEvent(
    eventName: string,
    properties?: Record<string, any>
  ): Promise<void>;

  trackError(
    error: Error,
    context?: Record<string, any>
  ): void;

  updateConsent(enabled: boolean): Promise<void>;
  
  shutdown(): Promise<void>;
}
```

### Features
- 🔒 Privacy-first: Telemetry is off by default and requires user consent
- 🤖 CI-aware: Automatically detects non-interactive environments
- 🔄 Automatic reconnection on network issues
- 🧹 Automatic sensitive data removal
- 💾 Persistent configuration between runs
- 📝 Detailed error tracking and event logging

### Data Collection
We collect:
- Basic usage statistics
- Error reports
- Platform information

We DO NOT collect:
- Personal information
- Private keys or addresses
- Sensitive configuration
- Financial data

For questions or support, please open an issue on the GitHub repository.