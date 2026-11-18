function compact(value) {
  return value.replace(/\s+/gu, " ").trim();
}

export function captureTitle(selection, pageTitle, pageUrl) {
  let title = compact(selection) || compact(pageTitle);
  if (!title) {
    try {
      title = `Review ${new URL(pageUrl).hostname}`;
    } catch {
      title = "Review captured page";
    }
  }

  return title.length <= 500 ? title : `${title.slice(0, 499)}…`;
}
