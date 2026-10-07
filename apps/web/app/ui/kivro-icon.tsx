import type { SVGProps } from 'react';

type IconName = 'arrow' | 'search' | 'heart' | 'star' | 'menu' | 'check' | 'alert' | 'clock' | 'shield';

const shapes: Record<IconName, React.ReactNode> = {
  arrow: <><path d="M4.5 12h14"/><path d="m12.5 5.5 6.5 6.5-6.5 6.5"/></>,
  search: <><circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.4 15.4 4.1 4.1"/></>,
  heart: <path d="M20 8.5c0 4.4-8 9.7-8 9.7S4 12.9 4 8.5a4.1 4.1 0 0 1 8-1.1 4.1 4.1 0 0 1 8 1.1Z"/>,
  star: <path d="m12 2.8 2.8 5.7 6.3.9-4.5 4.4 1 6.2-5.6-3-5.6 3 1-6.2-4.5-4.4 6.3-.9L12 2.8Z"/>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  check: <path d="m4.5 12.4 5 5 10-10"/>,
  alert: <><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4.5M12 16.5h.01"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
  shield: <><path d="M12 2.8 20 6v5.4c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3.2Z"/><path d="m8.5 12.3 2.2 2.2 4.8-4.8"/></>,
};

export function Icon({name,...props}:SVGProps<SVGSVGElement>&{name:IconName}){
  return <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
    strokeLinejoin="round" {...props}>{shapes[name]}</svg>;
}
