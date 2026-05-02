# revensi

Command-line interface for the [Revensi](https://revensi.com) API.

## Quick start

```sh
npx revensi scan example.com
```

Or install globally:

```sh
npm install -g revensi
revensi scan example.com
```

## Authentication

The CLI needs an API key. Get one at [revensi.com](https://revensi.com), then either:

```sh
export REVENSI_API_KEY=sk_live_...
revensi scan example.com
```

…or pass it per call:

```sh
revensi scan example.com --api-key sk_live_...
```

## Commands

### `scan <domain>`

Scan a domain via `POST https://api.revensi.com/scan`.

```sh
revensi scan example.com           # formatted summary
revensi scan example.com --json    # raw JSON, for piping into jq
```

## Options

| Flag             | Description                                          |
| ---------------- | ---------------------------------------------------- |
| `--api-key <k>`  | API key. Falls back to `$REVENSI_API_KEY`.           |
| `--json`         | Print raw JSON response on stdout, no spinner.       |
| `--no-color`     | Disable ANSI colors.                                 |
| `-v, --version`  | Print CLI version.                                   |
| `-h, --help`     | Print help. Works for subcommands too.               |

## Exit codes

| Code | Meaning                                       |
| ---- | --------------------------------------------- |
| `0`  | Success.                                      |
| `1`  | API error or network failure.                 |
| `2`  | Usage error (bad args, missing API key, …).   |

## Requirements

Node.js 18 or later.

## License

MIT
