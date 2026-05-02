import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';
import { registerScan } from './commands/scan.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));

export function run(argv) {
  const program = new Command();

  program
    .name('revensi')
    .description('Revensi CLI — scan domains via the Revensi API.')
    .version(pkg.version, '-v, --version', 'show version')
    .option('--api-key <key>', 'Revensi API key (or set REVENSI_API_KEY)')
    .option('--json', 'output raw JSON instead of a formatted summary')
    .option('--no-color', 'disable colored output')
    .showHelpAfterError(pc.dim('(use --help for usage)'))
    .configureHelp({ sortSubcommands: true });

  registerScan(program);

  program.on('command:*', ([cmd]) => {
    process.stderr.write(pc.red(`Unknown command: ${cmd}\n`));
    program.outputHelp();
    process.exit(2);
  });

  program.parseAsync(argv).catch((err) => {
    process.stderr.write(pc.red(`Error: ${err?.message ?? err}\n`));
    process.exit(1);
  });
}
