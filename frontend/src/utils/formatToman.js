const persianNumber = new Intl.NumberFormat("fa-IR");

export function formatToman(amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) return "—";
  if (amount % 1_000_000 === 0) return `${persianNumber.format(amount / 1_000_000)} میلیون تومان`;
  if (amount % 1_000 === 0) return `${persianNumber.format(amount / 1_000)} هزار تومان`;
  return `${persianNumber.format(amount)} تومان`;
}
