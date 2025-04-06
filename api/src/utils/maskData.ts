export function maskEmail({
  email,
  char,
  percent,
}: {
  email: string;
  char: string;
  percent: number;
}) {
  const [local, domain] = email.split('@');
  const unmaskedLength = Math.floor(local.length * percent);
  const masked = local
    .split('')
    .map((c, i) => (i < unmaskedLength ? c : char))
    .join('');
  return `${masked}@${domain}`;
}
