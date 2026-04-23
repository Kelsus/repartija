import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...rest }: Props & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconCamera = (p: Props) => (
  <Base {...p}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Base>
);

export const IconQr = (p: Props) => (
  <Base {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3h-3zM20 14v3M14 20h3v1M20 17v4" />
  </Base>
);

export const IconPlus = (p: Props) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconTrash = (p: Props) => (
  <Base {...p}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
  </Base>
);

export const IconCheck = (p: Props) => (
  <Base {...p}>
    <path d="M5 12l5 5L20 7" />
  </Base>
);

export const IconX = (p: Props) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);

export const IconUsers = (p: Props) => (
  <Base {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Base>
);

export const IconWallet = (p: Props) => (
  <Base {...p}>
    <path d="M20 7H5a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2h13.5a.5.5 0 0 1 .5.5V7Z" />
    <path d="M3 5v13a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-3" />
    <path d="M18 12h3a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-3a2 2 0 0 1 0-4Z" />
  </Base>
);

export const IconCash = (p: Props) => (
  <Base {...p}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="3" />
    <path d="M6 10v4M18 10v4" />
  </Base>
);

export const IconLink = (p: Props) => (
  <Base {...p}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.72" />
  </Base>
);

export const IconReceipt = (p: Props) => (
  <Base {...p}>
    <path d="M4 2l1.5 2L7 2l1.5 2L10 2l1.5 2L13 2l1.5 2L16 2l1.5 2L19 2v19l-1.5-2L16 21l-1.5-2L13 21l-1.5-2L10 21l-1.5-2L7 21l-1.5-2L4 21V2Z" />
    <path d="M8 8h7M8 12h7M8 16h4" />
  </Base>
);

export const IconLock = (p: Props) => (
  <Base {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Base>
);

export const IconUnlock = (p: Props) => (
  <Base {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 7.17-2.45" />
  </Base>
);

export const IconSparkle = (p: Props) => (
  <Base {...p}>
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" />
    <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />
  </Base>
);

export const IconCopy = (p: Props) => (
  <Base {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Base>
);
