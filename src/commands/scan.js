import ora from 'ora';
import pc from 'picocolors';
import { scan, RevensiError } from '../client.js';

export function registerScan(program) {
  program
    .command('scan')
    .description('Scan a domain via the Revensi API')
    .argument('<domain>', 'domain to scan, e.g. example.com')
    .addHelpText(
      'after',
      `\nExamples:\n  $ revensi scan example.com\n  $ revensi scan example.com --json | jq .\n  $ REVENSI_API_KEY=sk_live_... revensi scan example.com\n`,
    )
    .action(async (domain, _opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const useJson = !!opts.json;
      const useColor = opts.color !== false;

      const cleanDomain = normalizeDomain(domain);
      if (!cleanDomain.ok) {
        printError(cleanDomain.message, useColor);
        process.exit(2);
      }

      const apiKey = opts.apiKey || process.env.REVENSI_API_KEY;
      if (!apiKey) {
        printError(
          'Missing API key.\n' +
            '  Pass --api-key <key>, or set REVENSI_API_KEY in your environment.\n' +
            '  Get a key at https://revensi.com',
          useColor,
        );
        process.exit(2);
      }

      const spinner = useJson
        ? null
        : ora({ text: `Scanning ${pc.cyan(cleanDomain.value)}…`, color: 'cyan' }).start();

      try {
        const result = await scan({ domain: cleanDomain.value, apiKey });
        spinner?.succeed(`Scan complete for ${pc.cyan(cleanDomain.value)}`);

        if (useJson) {
          process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        } else {
          printSummary(cleanDomain.value, result, useColor);
        }
      } catch (err) {
        spinner?.fail('Scan failed');
        if (err instanceof RevensiError) {
          printError(err.message, useColor);
          if (err.status) process.stderr.write(pc.dim(`  status: ${err.status}\n`));
        } else {
          printError(err?.message || String(err), useColor);
        }
        process.exit(1);
      }
    });
}

function normalizeDomain(input) {
  const trimmed = String(input).trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return {
      ok: false,
      message: `Pass a bare domain, not a URL. Try: revensi scan ${trimmed.replace(/^https?:\/\//i, '').split('/')[0]}`,
    };
  }
  // Permissive domain check: labels separated by dots, optional port stripped.
  const value = trimmed.replace(/\/.*$/, '').replace(/:\d+$/, '');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(value)) {
    return { ok: false, message: `"${trimmed}" doesn't look like a valid domain.` };
  }
  return { ok: true, value: value.toLowerCase() };
}

function printError(msg, useColor) {
  const tag = useColor ? pc.red('error') : 'error';
  process.stderr.write(`${tag}: ${msg}\n`);
}

function printSummary(domain, result, useColor) {
  const c = useColor ? pc : passthroughColors();
  const lines = [];
  lines.push('');
  lines.push(`  ${c.bold('Domain')}    ${c.cyan(domain)}`);

  // Best-effort: surface common fields if present, otherwise dump compact JSON.
  const known = ['status', 'score', 'risk', 'rating', 'grade', 'verdict', 'id'];
  let printedSomething = false;
  for (const k of known) {
    if (result && Object.prototype.hasOwnProperty.call(result, k)) {
      lines.push(`  ${c.bold(pad(capitalize(k), 9))} ${formatValue(result[k], c)}`);
      printedSomething = true;
    }
  }

  if (Array.isArray(result?.findings) && result.findings.length) {
    lines.push('');
    lines.push(`  ${c.bold('Findings')}`);
    for (const f of result.findings.slice(0, 20)) {
      const sev = f?.severity || f?.level || 'info';
      const title = f?.title || f?.message || JSON.stringify(f);
      lines.push(`    ${severityTag(sev, c)} ${title}`);
    }
    if (result.findings.length > 20) {
      lines.push(c.dim(`    …and ${result.findings.length - 20} more (use --json to see all)`));
    }
    printedSomething = true;
  }

  if (!printedSomething) {
    lines.push('');
    lines.push(c.dim('  (no recognized fields — re-run with --json for full output)'));
  }

  lines.push('');
  process.stdout.write(lines.join('\n') + '\n');
}

function pad(s, n) {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatValue(v, c) {
  if (v == null) return c.dim('null');
  if (typeof v === 'boolean') return v ? c.green('true') : c.red('false');
  if (typeof v === 'number') return c.yellow(String(v));
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function severityTag(sev, c) {
  const s = String(sev).toLowerCase();
  if (s.startsWith('crit')) return c.red('●') + ' ' + c.bold(c.red('CRITICAL'));
  if (s.startsWith('high')) return c.red('●') + ' ' + c.red('HIGH    ');
  if (s.startsWith('med')) return c.yellow('●') + ' ' + c.yellow('MEDIUM  ');
  if (s.startsWith('low')) return c.cyan('●') + ' ' + c.cyan('LOW     ');
  return c.dim('●') + ' ' + c.dim('INFO    ');
}

function passthroughColors() {
  const id = (s) => s;
  return new Proxy({}, { get: () => id });
}
