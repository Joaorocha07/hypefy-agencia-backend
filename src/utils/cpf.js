function isValidCpf(cpfDigits) {
  if (!/^\d{11}$/.test(cpfDigits) || /^(\d)\1{10}$/.test(cpfDigits)) return false;

  const digits = cpfDigits.split('').map(Number);

  const checkDigit = (length) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += digits[i] * (length + 1 - i);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return checkDigit(9) === digits[9] && checkDigit(10) === digits[10];
}

module.exports = { isValidCpf };
