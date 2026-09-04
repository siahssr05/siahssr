import { useEffect } from "react";

/**
 * Sets document title + meta description/OG tags + an optional JSON-LD
 * script for the current page, without pulling in a new dependency
 * (react-helmet etc). Cleans up after itself when the page unmounts so
 * tags don't leak across client-side route changes.
 */
export default function useSEO({ title, description, jsonLd } = {}) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    const managedTags = [];

    function upsertMeta(attr, key, content) {
      if (!content) return;
      let tag = document.querySelector(`meta[${attr}="${key}"]`);
      const created = !tag;
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attr, key);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
      if (created) managedTags.push(tag);
    }

    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);

    let scriptTag = null;
    if (jsonLd) {
      scriptTag = document.createElement("script");
      scriptTag.type = "application/ld+json";
      scriptTag.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(scriptTag);
    }

    return () => {
      document.title = prevTitle;
      managedTags.forEach((tag) => tag.remove());
      if (scriptTag) scriptTag.remove();
    };
  }, [title, description, jsonLd]);
}
