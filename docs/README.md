# microinclude.js

A minimal, dependency-free JavaScript helper to include HTML snippets into a page by adding an `include` attribute to elements.

Purpose
- Simplify composition of static HTML pages by pulling snippet files into placeholders.
- Extremely small and modern-JS based — suitable for simple static sites or quick prototypes.
- Mostly for educational purposes, not considered production ready.

Status
- Version: 0.1
- Author: Matt Toegel
- License: MIT
- Created: 2025-10-08
- Updated: 2025-10-09

Features
- Include external HTML into any element with an `include` attribute.
- Prevents duplicate fetches of the same URL unless the element has a `multiple` attribute.
- Small and uses modern browser APIs (fetch, async/await, URL).

Quick install
- Place `microinclude.js` in your project and include it on pages that need snippet injection:

```html
<script src="microinclude.js" defer></script>
```

You can also load microinclude from a GitHub Pages-hosted copy:

```html
<script src="https://matttoegel.github.io/micro-include/microinclude.js" defer></script>

<!-- or  minified -->
<script src="https://matttoegel.github.io/micro-include/microinclude.min.js" defer></script>
```


Notes:
- For stability prefer pinning a tag instead of @latest: @v0.1

Usage
- Basic: Add an element with an `include` attribute pointing to the snippet URL.

Example
```html
<!-- Insert header.html content into this div -->
<div include="header.html"></div>

<!-- Allow the same source to be included multiple times -->
<div include="sidebar.html" multiple></div>
<div include="sidebar.html" multiple></div>
```

Behavior details
- The script resolves relative URLs against the page's base URL (document.baseURI).
- If multiple elements request the same source, only the first is fetched and inserted unless an element has the `multiple` attribute.
- If a fetch fails, the element receives a red error message (and a console error). If `window.verbose` is true, a browser alert is shown.

Debugging
- Enable console logging:
    - In browser console: window.debug = true
- Enable alert popups on errors:
    - In browser console: window.verbose = true

Security
- IMPORTANT: This script is NOT XSS-safe. Do NOT include untrusted content directly.
- If you must include third-party or user-supplied HTML, sanitize it before use. Recommended: DOMPurify.
  - Internally, it'll check of `DOMPurify` is found on `window` and will use it, otherwise it'll set raw html

Limitations
- Does not process nested includes inside fetched content (no second-pass resolution).
- Included inline <script> tags are not executed by default.
- Basic error handling only; failed fetches are reported to the element and console.
- Uses modern JavaScript — may not work in very old browsers without polyfills.

Implementation notes
- The library finds all elements with an `include` attribute and fetches the specified URL.
- It uses an internal map to avoid duplicate requests for the same URL unless `multiple` is present on the element.
- Example semantics:
    - attribute name: `include`
    - allow multiple occurrences: presence of the `multiple` attribute

Contributing
- Bug reports, small fixes, and suggestions welcome.
- Keep changes minimal and consistent with the project's small footprint and no-dependency goal.

License
- MIT — see LICENSE file for details.

Changelog
- 2025-10-08 — v0.1 — Initial release (basic include support, duplicate suppression).
- 2025-10-09 — v0.1 — Minor updates and documentation tweaks.

Notes and hints
- If you rely on scripts inside included fragments, you will need to evaluate them explicitly after insertion (microinclude does not do that).
- If you need nested includes, run the include pass again on inserted content or enhance the script to re-scan inserted fragments.
- The script aims to be tiny and opinionated — for more advanced templating or component logic consider using a framework.

Contact
- Author: Matt Toegel
- License: MIT