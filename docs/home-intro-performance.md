# Home intro: local LCP comparison

Measured on 2026-10-06 with Chromium Playwright at 1440×900 against two
separate local production builds served from `http://127.0.0.1`.

| Build | Commit | Five LCP samples (ms) | Median | LCP element |
| --- | --- | --- | --- | --- |
| Baseline | `61cd78c7622e2746e9a90a2938eae5474668290a` | 416, 188, 252, 232, 276 | 252 | `photos/13_medovik_process-960.webp` |
| With intro | local `feat/figma-home-intro` worktree | 268, 216, 244, 240, 228 | 240 | `photos/13_medovik_process-960.webp` |

The comparison uses new browser contexts for each sample. It is a local lab
measurement without network throttling or field data, so the 12 ms difference
is normal run-to-run variation. The useful result is that the decorative SVG
was not selected as LCP and did not move the median upward in this setup.
