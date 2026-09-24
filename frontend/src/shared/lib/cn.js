import { twMerge } from 'tailwind-merge';
export function cn(...classes) {
    return twMerge(classes.filter(Boolean).join(' '));
}
