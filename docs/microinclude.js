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
 * Updated: 2025-10-15
 * Version: 0.2.1
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
            const src = this.getAttribute("src");
            if (!src) return this.showError("'src' attribute is required.");

            // Adjust base URL for GitHub Pages compatibility
            const base = document.querySelector('base')?.href || window.location.origin;

            if (!this.hasAttribute("multiple") && MicroInclude.includedSources.has(src)) {
                dlog(`Skipping duplicate inclusion for ${src}`);
                return;
            }

            try {
                const srcUrl = new URL(src, base).href; // Use adjusted base URL
                const isExternal = this.isExternalReference(srcUrl);
                dlog(`src="${src}" resolved to "${srcUrl}" isExternal=${isExternal}`);

                const response = await fetch(srcUrl);
                if (!response.ok) throw new Error(`Failed to fetch ${src}: ${response.statusText}`);

                let html = await response.text();
                if (!this.hasAttribute("allow-untrusted") && isExternal) html = this.sanitizeHtml(html);

                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = html;

                if (this.hasAttribute("allow-scripts")) this.executeScripts(tempDiv);

                this.replaceWith(...tempDiv.childNodes);
                MicroInclude.includedSources.add(src);
                dlog(`Successfully included ${src}`);
            } catch (error) {
                this.showError(`Error loading content from ${src}`);
                console.error(error);
            }
        }

        async executeScripts(container) {
            const scripts = container.querySelectorAll("script");

            for (const oldScript of scripts) {
                const newScript = document.createElement("script");
                this.copyAttributes(oldScript, newScript);
                newScript.textContent = oldScript.textContent;

                if (newScript.src) {
                    // Load external scripts sequentially
                    await this.loadScript(newScript);
                } else {
                    // Execute inline scripts immediately
                    document.body.appendChild(newScript);
                }

                oldScript.remove();
            }
        }

        copyAttributes(source, target) {
            [...source.attributes].forEach(attr => target.setAttribute(attr.name, attr.value));
        }

        loadScript(script) {
            return new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
                document.body.appendChild(script);
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
    customElements.define("micro-include", MicroInclude);
})();
