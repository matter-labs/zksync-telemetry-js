import { isatty } from 'tty';
import readlineSync from 'readline-sync';

export function isInteractive(): boolean {
  return (
    isatty(process.stdin.fd) && isatty(process.stdout.fd) && !isCiEnvironment()
  );
}

export function isCiEnvironment(): boolean {
  return Boolean(
    process.env.CI ||
      process.env.CONTINUOUS_INTEGRATION ||
      process.env.BUILD_NUMBER ||
      process.env.GITHUB_ACTIONS,
  );
}

export function promptYesNo(prompt: string): boolean {
  const answer = readlineSync.question(`${prompt} (y/n) `);
  return answer.toLowerCase().startsWith('y');
}
