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
 * Date: 2025-10-08
 * Updated: 2025-10-16
 * Version: 0.2.2
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

            // Resolve the primary candidate URL
            const isFullUrl = /^\w+:\/\//.test(srcAttr) || srcAttr.startsWith("//");
            const candidate1 = isFullUrl ? srcAttr : new URL(srcAttr, document.baseURI).href;
            let srcUrl = candidate1;

            try {
                // Try the primary URL first
                let response = await fetch(candidate1);
                if (!response.ok) throw new Error(`Primary URL failed: ${response.status}`);

                let html = await response.text();
                if (!this.hasAttribute("allow-untrusted") && this.isExternalReference(candidate1)) html = this.sanitizeHtml(html);

                await this._insertContent(html, parent, nextSibling, candidate1);
                MicroInclude.includedSources.add(candidate1);
                dlog(`Successfully included ${candidate1}`);
                return;
            } catch (err) {
                dlog("Primary fetch failed, attempting GH Pages fallback if applicable", err);
            }

            /*
            // GitHub Pages project-site fallback (WIP/TBD)
            if (srcAttr.startsWith('/') && window.location.hostname.endsWith('.github.io')) {
                const parts = window.location.pathname.split('/').filter(Boolean);
                const repo = parts.length ? parts[0] : '';
                const candidate2 = window.location.origin + (repo ? `/${repo}` : '') + srcAttr;
                try {
                    const response2 = await fetch(candidate2);
                    if (!response2.ok) throw new Error(`Fallback URL failed: ${response2.status}`);
                    let html = await response2.text();
                    if (!this.hasAttribute("allow-untrusted") && this.isExternalReference(candidate2)) html = this.sanitizeHtml(html);

                    await this._insertContent(html, parent, nextSibling, candidate2);
                    MicroInclude.includedSources.add(candidate2);
                    dlog(`Successfully included ${candidate2}`);
                    return;
                } catch (err) {
                    dlog("Fallback fetch also failed", err);
                }
            }
            */

            this.showError(`Error loading content from ${srcAttr}`);
            console.error(`MicroInclude: Failed to load ${srcAttr}`);
        }

        async _insertContent(html, parent, nextSibling, baseUrl) {
            const container = document.createElement('div');
            container.innerHTML = html;

            // Collect scripts and remove them from the container to avoid duplicate execution
            const external = Array.from(container.querySelectorAll('script[src]'));
            const inline = Array.from(container.querySelectorAll('script:not([src])'));
            external.concat(inline).forEach(s => s.remove());

            // Load external scripts sequentially and deduplicate
            for (const oldScript of external) {
                const src = oldScript.getAttribute('src') || oldScript.src;
                const resolvedSrc = new URL(src, baseUrl).href;

                if (MicroInclude.loadedScripts.has(resolvedSrc) || Array.from(document.scripts).some(s => s.src === resolvedSrc)) continue;

                const newScript = document.createElement('script');
                this.copyAttributes(oldScript, newScript);
                newScript.src = resolvedSrc;

                try {
                    await this.loadScript(newScript);
                    MicroInclude.loadedScripts.add(resolvedSrc);
                } catch (err) {
                    console.error(`MicroInclude: Failed to load script ${resolvedSrc}`, err);
                }
            }

            // Insert the fetched content into the DOM
            this.replaceWith(...container.childNodes);

            // Execute inline scripts after content is in place
            for (const oldScript of inline) {
                const newScript = document.createElement('script');
                this.copyAttributes(oldScript, newScript);
                newScript.textContent = oldScript.textContent;
                parent.insertBefore(newScript, nextSibling);
            }
        }

        copyAttributes(source, target) {
            [...source.attributes].forEach(attr => {
                if (attr.name === 'src') return; // src handled separately to allow resolution
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
