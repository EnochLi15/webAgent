---
name: browser-automation
description: Use this skill when an agent needs to browse, inspect, extract data from, or interact with websites.
---

# Browser Automation

Use browser tools for pages that require JavaScript rendering, authentication, clicking, typing, or visual state.

## Workflow

1. Navigate with `browser_goto`.
2. Inspect with `browser_snapshot` before acting.
3. Use element refs from the snapshot for `browser_click`, `browser_type`, `browser_select`, and related tools.
4. Re-check the snapshot after each meaningful page change.
5. Prefer `fetch-url-metadata` for simple title/status/description checks that do not need a real browser.

## Safety

- Do not submit forms, purchase items, delete data, or change account settings without explicit user confirmation.
- Avoid using `browser_evaluate` unless normal browser tools cannot do the job.
- Summarize what changed after completing a multi-step browser workflow.
