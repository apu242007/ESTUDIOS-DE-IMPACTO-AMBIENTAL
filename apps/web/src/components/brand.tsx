/** Marca: curvas de nivel (cartografía de campo). Decorativa: el nombre va al lado como texto. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 20c2-8 8-14 15-14 6 0 9 4 9 9 0 7-6 11-13 11-6 0-10-2-11-6z" />
      <path d="M9 19c1.5-5 5-8.5 10-8.5 3.5 0 5.5 2.3 5.5 5.3 0 4.2-3.6 6.7-8 6.7-3.8 0-6.5-1.2-7.5-3.5z" />
      <path d="M14.5 18c.8-2.4 2.4-3.7 4.4-3.7 1.4 0 2.3.9 2.3 2.2 0 1.8-1.7 2.9-3.6 2.9-1.5 0-2.7-.5-3.1-1.4z" />
    </svg>
  );
}

/** Curvas de nivel grandes y tenues para fondos (login). Solo decorativo. */
export function Contours({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 600" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" preserveAspectRatio="xMidYMid slice">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <path
          key={i}
          d={`M${40 + i * 22} ${360 - i * 12}C${90 + i * 18} ${150 + i * 14} ${250 - i * 8} ${70 + i * 20} ${390 - i * 10} ${118 + i * 16}C${560 - i * 22} ${180 + i * 8} ${590 - i * 24} ${420 - i * 12} ${440 - i * 18} ${520 - i * 22}C${290 - i * 6} ${590 - i * 26} ${20 + i * 24} ${560 - i * 24} ${40 + i * 22} ${360 - i * 12}Z`}
        />
      ))}
    </svg>
  );
}
