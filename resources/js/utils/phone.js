// Normalize a Philippine mobile number for display.
// Accepts 09XXXXXXXXX, 639XXXXXXXXX, +639XXXXXXXXX, 9XXXXXXXXX and returns 09XXXXXXXXX.
// Returns the input unchanged if it doesn't look like a PH mobile number.
export function normalizePhPhone(input) {
    if (!input) return '';
    const digits = String(input).replace(/[^\d]/g, '');
    if (/^09\d{9}$/.test(digits)) return digits;
    if (/^639\d{9}$/.test(digits)) return '0' + digits.slice(2);
    if (/^9\d{9}$/.test(digits)) return '0' + digits;
    return String(input); // unknown format - leave alone
}

// Validate a Philippine mobile number in the canonical 09XXXXXXXXX form.
export function isValidPhPhone(input) {
    return /^09\d{9}$/.test(String(input || '').replace(/[^\d]/g, ''));
}
