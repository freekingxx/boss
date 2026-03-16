# Repository Guidelines

## Project Structure & Module Organization
`boss-helper.user.js` is the only runtime source file and contains the Tampermonkey userscript: request interception, scoring rules, UI rendering, notifications, and config storage. Role presets live in `configs/*.json` for development, algorithm, operations, and product hiring tracks. `QA.md` records product decisions, bug fixes, and usage notes; update it when behavior or limitations change.

## Build, Test, and Development Commands
This repository has no package manager, build step, or CI pipeline. Development is done by editing the userscript and reloading it in Tampermonkey.

- `python3 -m json.tool configs/role-dev.json >/dev/null`
  Validates a role config file; run the same check for any JSON you modify.
- `git diff -- boss-helper.user.js configs/`
  Reviews script and preset changes before commit.
- `git log --oneline -5`
  Mirrors the existing commit style before writing a new commit message.

For manual verification, import `boss-helper.user.js` into Tampermonkey, open BOSS pages, and confirm candidate scoring, card highlighting, config editing, and remote preset loading still work.

## Coding Style & Naming Conventions
Use 2-space indentation and keep semicolons, matching `boss-helper.user.js`. Prefer `const` by default and use `let` only when reassignment is required. Use `camelCase` for functions and local variables, `UPPER_SNAKE_CASE` for script-wide constants, and keep rule IDs stable (for example `keyword_positive`, `salary_over`) because saved configs depend on them. JSON files should stay valid and structurally consistent across roles.

## Testing Guidelines
There is no automated test suite yet. Every change requires a browser smoke test on actual list pages. At minimum, verify request interception, score calculation, threshold coloring, config import/export, and any changed preset file. If you fix a regression, add a short note to `QA.md` describing the bug and the validation result.

## Commit & Pull Request Guidelines
Follow the current history: Conventional Commit prefixes with concise Chinese summaries, such as `feat: 添加多角色远程配置功能` or `fix: 修复关键词计分异常`. Keep each commit focused on one behavior change. PRs should explain the user-visible effect, list touched files, include screenshots for UI changes, and describe the manual verification you ran.

## Security & Configuration Tips
Do not commit account data, captured candidate payloads, cookies, or private endpoint URLs. Remote configs are fetched from raw GitHub JSON, so invalid schema changes can break live behavior; validate JSON and preserve backward-compatible keys when possible.
