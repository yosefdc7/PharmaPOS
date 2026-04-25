"use client";

import { useMemo, useState } from "react";
import type {
  CartItem,
  Customer,
  DispenseCheckpoint,
  Product,
  PrescriptionDraft,
  PrescriptionRefusal,
  RxInspectionSnapshot,
  RxPharmacist,
  RxRedFlag,
  RxSettings
} from "@/lib/types";
import { DdStockReconciliationPanel } from "./dd-stock-reconciliation";
import { DdTransactionLogPanel } from "./dd-transaction-log";
import { InspectionDashboardPanel } from "./inspection-dashboard";
import { PatientMedicationProfilePanel } from "./patient-medication-profile";
import { PrescriptionEntryDrawer } from "./prescription-entry-drawer";
import { RxClassificationPanel } from "./rx-classification-panel";
import { RxDispensingPanel } from "./rx-dispensing-panel";
import { RxRedFlagPanel } from "./rx-red-flag-panel";

type RxTab =
  | "classification"
  | "dispensing"
  | "profiles"
  | "dd-log"
  | "validation"
  | "dd-inventory"
  | "inspection";

type RxWorkspaceProps = {
  products: Product[];
  cart: CartItem[];
  customers: Customer[];
  pharmacists: RxPharmacist[];
  prescriptionDrafts: PrescriptionDraft[];
  redFlags: RxRedFlag[];
  refusals: PrescriptionRefusal[];
  inspection: RxInspectionSnapshot;
  settings: RxSettings;
  onSavePrescription: (draft: PrescriptionDraft) => void;
  onLogRefusal: (refusal: PrescriptionRefusal) => void;
  onClearFlag: (id: string) => void;
};

const tabs: { key: RxTab; label: string }[] = [
  { key: "classification", label: "Classification" },
  { key: "dispensing", label: "Dispensing" },
  { key: "profiles", label: "Patient Profiles" },
  { key: "dd-log", label: "DD Log" },
  { key: "validation", label: "Validation & Refusals" },
  { key: "dd-inventory", label: "DD Inventory Control" },
  { key: "inspection", label: "Inspection Dashboard" }
];

function buildCheckpoint(product: Product): DispenseCheckpoint {
  const classAtDispense = product.drugClassification ?? "Non-Rx OTC";
  const requiresPrescription = classAtDispense === "DD, Rx" || classAtDispense === "EDD, Rx" || classAtDispense === "Rx";
  const requiresS2 = classAtDispense === "DD, Rx" || classAtDispense === "EDD, Rx";
  const requiresYellowForm = classAtDispense === "DD, Rx";
  const requiresPharmacistAck = classAtDispense === "Pharmacist-Only OTC";
  let warning = "No special dispensing warning.";
  if (classAtDispense === "DD, Rx") {
    warning = "DANGEROUS DRUG — Special DOH Yellow Rx Form required.";
  } else if (classAtDispense === "EDD, Rx") {
    warning = "Extended Dangerous Drug — Prescriber must have a valid S-2 license.";
  } else if (classAtDispense === "Rx") {
    warning = "Prescription medicine — valid physician Rx required.";
  } else if (classAtDispense === "Pharmacist-Only OTC") {
    warning = "Pharmacist acknowledgment required before checkout.";
  }

  return {
    id: `${product.id}-checkpoint`,
    productId: product.id,
    productName: product.name,
    classAtDispense,
    requiresPrescription,
    requiresS2,
    requiresYellowForm,
    requiresPharmacistAck,
    warning,
    blocked: requiresPrescription
  };
}

export function RxWorkspace({
  products,
  cart,
  customers,
  pharmacists,
  prescriptionDrafts,
  redFlags,
  refusals,
  inspection,
  settings,
  onSavePrescription,
  onLogRefusal,
  onClearFlag
}: RxWorkspaceProps) {
  const [tab, setTab] = useState<RxTab>("classification");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<DispenseCheckpoint | null>(null);

  const checkpoints = useMemo(() => {
    const cartProducts = cart
      .map((line) => products.find((product) => product.id === line.productId))
      .filter((value): value is Product => Boolean(value));
    return cartProducts.map(buildCheckpoint);
  }, [cart, products]);

  const blockedCheckpoints = checkpoints.filter((item) => item.blocked);

  return (
    <section className="rx-page">
      <div className="settings-tabs">
        <div className="segmented rx-segmented">
          {tabs.map((entry) => (
            <button key={entry.key} type="button" className={tab === entry.key ? "active" : ""} onClick={() => setTab(entry.key)}>
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "classification" ? <RxClassificationPanel products={products} /> : null}
      {tab === "dispensing" ? (
        <RxDispensingPanel
          checkpoints={checkpoints}
          onOpenPrescription={(checkpoint) => {
            setSelectedCheckpoint(checkpoint);
            setDrawerOpen(true);
          }}
          onLogRefusal={onLogRefusal}
        />
      ) : null}
      {tab === "profiles" ? (
        <PatientMedicationProfilePanel drafts={prescriptionDrafts} customers={customers} />
      ) : null}
      {tab === "dd-log" ? <DdTransactionLogPanel drafts={prescriptionDrafts} /> : null}
      {tab === "validation" ? (
        <RxRedFlagPanel flags={redFlags} refusals={refusals} onClearFlag={onClearFlag} />
      ) : null}
      {tab === "dd-inventory" ? <DdStockReconciliationPanel products={products} settings={settings} /> : null}
      {tab === "inspection" ? (
        <InspectionDashboardPanel inspection={inspection} redFlags={redFlags} blockedCount={blockedCheckpoints.length} />
      ) : null}

      {drawerOpen && selectedCheckpoint ? (
        <PrescriptionEntryDrawer
          checkpoint={selectedCheckpoint}
          pharmacists={pharmacists}
          onClose={() => setDrawerOpen(false)}
          onSave={(draft) => {
            onSavePrescription(draft);
            setDrawerOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}
