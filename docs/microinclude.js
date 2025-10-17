/** 
 * microinclude.js (Custom Element Version)
 * A minimal JavaScript library to include HTML snippets into a page using a custom element.
 * Usage: Add a <micro-include> element with a 'src' attribute specifying the URL to include.
 * Example: <micro-include src="header.html"></micro-include>
 * Optional Attributes:
 *   - multiple: If present, allows multiple inclusions of the same source, be mindful of infinite includes.
 *   - allow-untrusted: If present, skips sanitization of the included HTML (use with caution).
 *   - allow-scripts: If present, enables the execution of <script> tags in the included content.
 * Debugging:
 *  - Set `debug=true` in the console to enable logging.
 *  - Or set localStorage item "mi-debug" to "true". 
 * Author: Matt Toegel
 * License: MIT
 * Version: 0.2.3
 * Updated: 2025-10-17
 *
 * Note: This script uses modern JavaScript features and may not work in very old browsers.
 * IMPORTANT: It is not XSS safe - do not include untrusted content.
 * Hint: Use something like [DOMPurify](https://www.npmjs.com/package/dompurify) to sanitize untrusted HTML before including.
 * 
 * Limitations:
 * - Does not handle nested includes within included content.
 * - Does not execute scripts within included content.
 * - Basic error handling; failed fetches display an error message in the element.
 * - Relative URLs are resolved against the page's base URL.
 */

(() => {
    const debug = !!window.debug || localStorage?.getItem("mi-debug") === "true";
    const dlog = (...msg) => debug && console.log("MicroInclude:", ...msg);

    // --- URL helpers --------------------------------------------------------
    const isAbsoluteLike = (s) => /^\w+:\/\//.test(s) || s.startsWith("//");
    const getGhProjectBase = () => {
        // On project sites, path starts with "/<repo>/...".
        // On user/org sites, path is "/...".
        if (!location.hostname.endsWith(".github.io")) return "";
        const parts = location.pathname.split("/").filter(Boolean);
        // If there's a first segment and we're not already at repo root page, use it.
        // Example: "username.github.io/repo/some/page" -> base "/repo"
        return parts.length ? `/${parts[0]}` : "";
    };

    /**
     * Resolve a URL string against a context, while fixing root-relative
     * paths for GitHub Pages project sites.
     * @param {string} input URL-like string (may be relative, root-relative, or absolute)
     * @param {string} [context] Base URL to resolve against (defaults to document.baseURI)
     * @returns {string} absolute URL href
     */
    const resolveUrl = (input, context = document.baseURI) => {
        try {
            if (isAbsoluteLike(input)) {
                // Absolute or protocol-relative (//) — let URL handle it
                return new URL(input, context).href;
            }
            if (input.startsWith("/")) {
                // Root-relative: adjust for GH Pages project sites
                const ctx = new URL(context, document.baseURI);
                const ghBase = getGhProjectBase();
                const origin = `${ctx.protocol}//${ctx.host}`;
                // If already includes the ghBase (e.g., "/repo/..."), leave it alone.
                const fixedPath = ghBase && !input.startsWith(`${ghBase}/`)
                    ? `${ghBase}${input}`
                    : input;
                return new URL(fixedPath, origin).href;
            }
            // Normal relative path: resolve against the provided context
            return new URL(input, context).href;
        } catch (e) {
            console.warn("MicroInclude: resolveUrl failed for", input, "with context", context, e);
            // Best-effort fallback
            return input;
        }
    };
    // ------------------------------------------------------------------------

    class MicroInclude extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: "open" });
        }

        async connectedCallback() {
            const srcAttr = this.getAttribute("src");
            if (!srcAttr) return this.showError("'src' attribute is required.");

            if (!this.hasAttribute("multiple") && MicroInclude.includedSources.has(srcAttr)) {
                dlog(`Skipping duplicate inclusion for ${srcAttr}`);
                return;
            }

            // Remember parent insertion point for inline scripts
            const parent = this.parentNode;
            const nextSibling = this.nextSibling;

            // Resolve primary URL (with GH Pages fix)
            const candidate = resolveUrl(srcAttr, document.baseURI);

            try {
                const response = await fetch(candidate, { credentials: "same-origin" });
                if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);

                let html = await response.text();
                if (!this.hasAttribute("allow-untrusted") && this.isExternalReference(candidate)) {
                    html = this.sanitizeHtml(html);
                }

                await this._insertContent(html, parent, nextSibling, candidate);
                MicroInclude.includedSources.add(srcAttr);
                dlog(`Successfully included ${candidate}`);
                return;
            } catch (err) {
                dlog("Fetch failed", err);
            }

            this.showError(`Error loading content from ${srcAttr}`);
            console.error(`MicroInclude: Failed to load ${srcAttr}`);
        }

        async _insertContent(html, parent, nextSibling, baseUrl) {
            const container = document.createElement("div");
            container.innerHTML = html;

            // Collect scripts and remove them to control execution order
            const external = Array.from(container.querySelectorAll("script[src]"));
            const inline = Array.from(container.querySelectorAll("script:not([src])"));
            external.concat(inline).forEach((s) => s.remove());

            // Load external scripts sequentially (dedupe)
            for (const oldScript of external) {
                const rawSrc = oldScript.getAttribute("src") || oldScript.src;
                const resolvedSrc = resolveUrl(rawSrc, baseUrl);

                if (
                    MicroInclude.loadedScripts.has(resolvedSrc) ||
                    Array.from(document.scripts).some((s) => s.src === resolvedSrc)
                ) {
                    continue;
                }

                const newScript = document.createElement("script");
                this.copyAttributes(oldScript, newScript);
                newScript.src = resolvedSrc;

                try {
                    await this.loadScript(newScript);
                    MicroInclude.loadedScripts.add(resolvedSrc);
                } catch (err) {
                    console.error(`MicroInclude: Failed to load script ${resolvedSrc}`, err);
                }
            }

            // Inject fetched DOM
            this.replaceWith(...container.childNodes);

            // Execute inline scripts after DOM insertion (optional gate)
            if (this.hasAttribute("allow-scripts")) {
                for (const oldScript of inline) {
                    const newScript = document.createElement("script");
                    this.copyAttributes(oldScript, newScript);
                    newScript.textContent = oldScript.textContent;
                    parent.insertBefore(newScript, nextSibling);
                }
            }
        }

        copyAttributes(source, target) {
            [...source.attributes].forEach((attr) => {
                if (attr.name === "src") return; // handled explicitly
                target.setAttribute(attr.name, attr.value);
            });
        }

        loadScript(script) {
            return new Promise((resolve, reject) => {
                script.onload = () => resolve();
                script.onerror = (e) => reject(e);
                document.head.appendChild(script);
            });
        }

        sanitizeHtml(html) {
            if (typeof DOMPurify !== "undefined" && typeof DOMPurify.sanitize === "function") {
                dlog("Content sanitized with DOMPurify.");
                return DOMPurify.sanitize(html);
            }
            console.warn("DOMPurify not found; inserting untrusted HTML.");
            return html;
        }

        isExternalReference(src) {
            try {
                return new URL(src, document.baseURI).origin !== window.location.origin;
            } catch {
                return false;
            }
        }

        showError(message) {
            this.shadowRoot.innerHTML = `<p style="color: red;">${message}</p>`;
        }
    }

    MicroInclude.includedSources = new Set();
    MicroInclude.loadedScripts = new Set();
    customElements.define("micro-include", MicroInclude);
})();
