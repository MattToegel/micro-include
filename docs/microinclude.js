/** 
 * microinclude.js
 * A minimal JavaScript library to include HTML snippets into a page.
 * Usage: Add an element with an 'include' attribute specifying the URL to include.
 * Example: <div include="header.html"></div>
 * Optional Attributes:
 *   - multiple: If present, allows multiple inclusions of the same source.
 * Debugging:
 *  - Set `debug=true` in the console to enable logging.
 *  - Set `verbose=true` in the console to get alert popups on errors.   
 * Author: Matt Toegel
 * License: MIT
 * Date: 2025-10-08
 * Updated: 2025-10-09
 * Version: 0.1
 * 
 * Note: This script uses modern JavaScript features and may not work in very old browsers.
 * IMPORTANT: It is not XSS safe - do not include untrusted content.
 * Hint: Use something like [DOMPurify](https://www.npmjs.com/package/dompurify) to sanitize untrusted HTML before including 
 * 
 * Limitations:
 * - Does not handle nested includes within included content.
 * - Does not execute scripts within included content.
 * - Basic error handling; failed fetches display an error message in the element.
 * - Relative URLs are resolved against the page's base URL.
 * 
*/
(async () => {
    const d = !!window.debug; // set debug=true in console to enable logging
    const dlog = (msg) => { if (d) console.log(msg); };// debug log function
    dlog("Running microinclude.js");
    const includes = document.querySelectorAll("[include]");// find all elements with 'include' attribute
    dlog("Found includes:", includes);
    const includeMap = {}; // track included sources to avoid duplicates unless 'multiple' is set
    for (let el of includes) {
        const src = new URL(s.src, document.baseURI).href;// resolve relative to the page base URL
        dlog("Checking src:", src);
        if (includeMap[src] && !includeMap[src].multiple) {
            continue;
        }
        if (!includeMap[src]) {
            includeMap[src] = { element: el, multiple: el.hasAttribute("multiple") };
        }
        // fetch and insert the content
        await fetch(src).then(res => res.text()).then(html => {
            // check for dompurify
            if (window.DOMPurify) {
                dlog("Sanitizing HTML with DOMPurify");
                html = DOMPurify.sanitize(html);
            }
            el.innerHTML = html;
        }).catch(err => {
            el.innerHTML = `<pre style="color:red">Failed to load include: ${JSON.stringify(err)}</pre>`;
            console.error("Failed to fetch include:", err);
            if (window.verbose) {// set verbose=true in console to get alerts
                alert(`Failed to load include: ${JSON.stringify(err)}`);
            }
        });
    }
})();