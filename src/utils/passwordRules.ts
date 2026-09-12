export interface PasswordRule {
  key: string
  label: string
  test: (value: string) => boolean
}

/** Mirrors the backend's Password::min(8)->mixedCase()->numbers()->symbols(). */
export const PASSWORD_RULES: PasswordRule[] = [
  { key: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'upper', label: 'An uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'lower', label: 'A lowercase letter', test: (v) => /[a-z]/.test(v) },
  { key: 'number', label: 'A number', test: (v) => /[0-9]/.test(v) },
  { key: 'symbol', label: 'A symbol (!@#$…)', test: (v) => /[^A-Za-z0-9]/.test(v) },
]

export const isPasswordStrong = (value: string): boolean =>
  PASSWORD_RULES.every((rule) => rule.test(value))
