/** 
 * microinclude.js (Custom Element Version)
 * A minimal JavaScript library to include HTML snippets into a page using a custom element.
 * Usage: Add a <micro-include> element with a 'src' attribute specifying the URL to include.
 * Example: <micro-include src="header.html"></micro-include>
 * Optional Attributes:
 *   - multiple: If present, allows multiple inclusions of the same source, be mindful of infinite includes.
 *   - allow-untrusted: If present, skips sanitization of the included HTML (use with caution).
 * Debugging:
 *  - Set `debug=true` in the console to enable logging.
 *  - Or set localStorage item "mi-debug" to "true". 
 * Author: Matt Toegel
 * License: MIT
 * Date: 2025-10-08
 * Updated: 2025-10-15
 * Version: 0.2
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
    const debug = !!window.debug || localStorage?.getItem("mi-debug") === "true"; // Enable debug logging
    const dlog = (...msg) => { if (debug) console.log(...msg); };

    // Define the custom element
    class MicroInclude extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: "open" }); // Use shadow DOM for encapsulation
        }

        async connectedCallback() {
            const src = this.getAttribute("src");
            const allowMultiple = this.hasAttribute("multiple");
            const allowUntrusted = this.hasAttribute("allow-untrusted");
            dlog("MicroInclude connected:", { src, allowMultiple, allowUntrusted });

            if (!src) {
                console.error("MicroInclude: 'src' attribute is required.");
                this.shadowRoot.innerHTML = `<p style="color: red;">Error: 'src' attribute is missing.</p>`;
                return;
            }

            // Avoid duplicate inclusions unless 'multiple' is set
            if (!allowMultiple && MicroInclude.includedSources.has(src)) {
                dlog(`MicroInclude: Skipping duplicate inclusion for ${src}`);
                return;
            }

            try {
                const srcUrl = new URL(src, document.baseURI).href;
                const isExternal = this.isExternalReference(srcUrl);
                dlog(`MicroInclude: src="${src}" isExternal=${isExternal}`);
                const response = await fetch(srcUrl);
                if (!response.ok) throw new Error(`Failed to fetch ${src}: ${response.statusText}`);
                let html = await response.text();

                // Sanitize HTML if 'allow-untrusted' attribute is not set
                if (!allowUntrusted && isExternal) {
                    // feature check for DOMPurify
                    try {
                        let sanitizedHtml = html;
                        if (typeof DOMPurify !== "undefined" && typeof DOMPurify.sanitize === "function") {
                            sanitizedHtml = DOMPurify.sanitize(html);
                            dlog("MicroInclude: content sanitized with DOMPurify.");
                        } else if (typeof window.createDOMPurify === "function") {
                            const purifier = window.createDOMPurify(window);
                            if (typeof purifier.sanitize === "function") {
                                sanitizedHtml = purifier.sanitize(html);
                                dlog("MicroInclude: content sanitized with createDOMPurify.");
                            }
                        } else {
                            console.warn("MicroInclude: DOMPurify not found; inserting untrusted HTML.");
                        }
                        html = sanitizedHtml;
                    } catch (err) {
                        dlog("MicroInclude: DOMPurify threw an error", err);
                        console.error("MicroInclude: It's strongly encouraged to use DOMPurify to sanitize untrusted HTML.");
                    }

                }
                this.outerHTML = html;
                MicroInclude.includedSources.add(src); // Track included sources
                dlog(`MicroInclude: Successfully included ${src}`);
            } catch (error) {
                console.error("MicroInclude: Error including content:", error);
                this.shadowRoot.innerHTML = `<p style="color: red;">Error loading content from ${src}</p>`;
            }
        }
        /**
            * Checks if the given src is an external reference.
            * @param {string} src - The URL to check.
            * @returns {boolean} - True if the src is external, false otherwise.
            */
        isExternalReference(src) {
            try {
                const srcUrl = new URL(src, document.baseURI); // Resolve relative URLs
                return srcUrl.origin !== window.location.origin; // Compare origins
            } catch (error) {
                console.error("MicroInclude: Invalid URL in 'src' attribute:", src, error);
                return false; // Treat invalid URLs as non-external
            }
        }
    }

    // Static property to track included sources
    MicroInclude.includedSources = new Set();

    // Register the custom element
    customElements.define("micro-include", MicroInclude);
})();
