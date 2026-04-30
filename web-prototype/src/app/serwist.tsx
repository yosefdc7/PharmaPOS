"use client";

import type { ReactNode } from "react";

type SerwistProviderProps = {
    children: ReactNode;
    swUrl?: string;
};

/**
 * Lightweight fallback provider for local preview.
 * Keeps the layout API compatible even when Serwist package exports are unavailable.
 */
export function SerwistProvider({ children }: SerwistProviderProps) {
    return children;
}
