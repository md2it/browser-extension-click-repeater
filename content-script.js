function buildSelector(element) {
  if (!(element instanceof Element)) {
    return "";
  }

  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const parts = [];
  let current = element;

  while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 6) {
    const tagName = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (!parent) {
      parts.unshift(tagName);
      break;
    }

    const sameTagSiblings = Array.from(parent.children).filter(
      (child) => child.tagName === current.tagName
    );
    const index = sameTagSiblings.indexOf(current) + 1;
    const part = sameTagSiblings.length > 1 ? `${tagName}:nth-of-type(${index})` : tagName;
    parts.unshift(part);

    current = parent;
  }

  return parts.join(" > ");
}

function getEventElement(event) {
  if (event.target instanceof Element) {
    return event.target;
  }

  if (typeof event.composedPath === "function") {
    const path = event.composedPath();
    const firstElement = path.find((item) => item instanceof Element);
    if (firstElement instanceof Element) {
      return firstElement;
    }
  }

  return null;
}

document.addEventListener(
  "click",
  (event) => {
    const target = getEventElement(event);
    const selector = target ? buildSelector(target) : "";

    void chrome.runtime.sendMessage({
      type: "recording-click",
      x: event.clientX,
      y: event.clientY,
      selector
    });
  },
  true
);
