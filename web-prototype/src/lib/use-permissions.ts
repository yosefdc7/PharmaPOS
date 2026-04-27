"use client";

import { useCallback } from "react";
import type { PermissionKey, User } from "./types";

export function buildUserPermissions(role: User["role"]): User["permissions"] {
  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";
  const isPharmacist = role === "pharmacist";

  return {
    products: isAdmin,
    categories: isAdmin,
    customers: true,
    transactions: true,
    rx: isAdmin || isPharmacist,
    controlTower: isAdmin,
    users: isAdmin,
    settings: isAdmin,
    reports: isAdmin || isSupervisor,
    sync: isAdmin,
    void: isAdmin || isSupervisor,
    refund: isAdmin || isSupervisor,
    override: isAdmin || isSupervisor,
    xReading: isAdmin || isSupervisor,
    zReadingGenerate: isAdmin,
    zReadingView: isAdmin || isSupervisor,
    admin: isAdmin,
  };
}

export function canUserAccessView(user: User | null, view: import("./types").AppViewKey): boolean {
  if (!user) return false;
  const viewToPermission: Record<import("./types").AppViewKey, PermissionKey> = {
    pos: "transactions",
    products: "products",
    customers: "customers",
    rx: "rx",
    "control-tower": "controlTower",
    settings: "settings",
    reports: "reports",
    sync: "sync",
  };
  return !!user.permissions[viewToPermission[view]];
}

export function getAvailableViews(user: User | null): import("./types").AppViewKey[] {
  const allViews: import("./types").AppViewKey[] = [
    "pos", "products", "customers", "rx", "control-tower", "settings", "reports", "sync",
  ];
  return allViews.filter((view) => canUserAccessView(user, view));
}

export function resolveAccessibleView(
  requestedView: import("./types").AppViewKey,
  user: User | null,
): import("./types").AppViewKey {
  if (canUserAccessView(user, requestedView)) return requestedView;
  const available = getAvailableViews(user);
  return available[0] ?? "pos";
}

export function usePermissions(user: User | null) {
  const can = useCallback(
    (action: PermissionKey) => {
      if (!user) return false;
      return !!user.permissions[action];
    },
    [user],
  );

  return {
    can,
    role: user?.role ?? "cashier",
    user,
  };
}
