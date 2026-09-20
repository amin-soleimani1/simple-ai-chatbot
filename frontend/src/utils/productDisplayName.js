const categoryProductNames = Object.freeze({
  "iranian-bulbs-warranty": "لامپ",
  "economy-bulbs": "لامپ",
  projectors: "پروژکتور",
  repairs: "تعمیر لامپ",
});

export function productDisplayName(categoryId, fallbackTitle) {
  return categoryProductNames[categoryId] ?? fallbackTitle;
}
