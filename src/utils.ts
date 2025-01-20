import { isatty } from 'tty';

export function isInteractive(): boolean {
  return isatty(process.stdin.fd) && 
         isatty(process.stdout.fd) && 
         !isCiEnvironment();
}

export function isCiEnvironment(): boolean {
  return Boolean(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.BUILD_NUMBER ||
    process.env.GITHUB_ACTIONS
  );
}

export async function promptYesNo(prompt: string): Promise<boolean> {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    readline.question(`${prompt} (y/n) `, (answer: string) => {
      readline.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}