# PharmaSpot Rx/DD Classification & Prescription Log — User Stories

Legal basis: **RA 9165** (Comprehensive Dangerous Drugs Act of 2002),
**RA 10918** (Philippine Pharmacy Act, Sec. 37), **RA 9502** (Universally Accessible
Cheaper and Quality Medicines Act), **DOH AO No. 2024-0013**,
**DDB Board Regulation No. 3 s. 2013**.
Follows the same story conventions as `docs/PRD.md`.

---

## Drug Classification Reference (Embed in Dev Docs)

| Class | Full Name | Prescription Required | Prescription Type | Key Law |
|---|---|---|---|---|
| **DD, Rx** | Dangerous Drug | ✅ Yes | Special DOH Yellow Rx Form only | RA 9165 |
| **EDD, Rx** | Extended Dangerous Drug | ✅ Yes | Ordinary Rx with prescriber's S-2 license number | RA 9165 |
| **Rx** | Prescription Medicine | ✅ Yes | Any valid Rx from licensed physician | RA 10918 |
| **Pharmacist-Only OTC** | Pharmacist-supervised OTC | ❌ No Rx required | None — but pharmacist must supervise dispensing | DOH AO 2024-0013 |
| **Non-Rx / OTC** | Over-the-counter | ❌ No | None | RA 10918 |

> **RA 9165, Sec. 40(b):** No prescription once served by a drugstore or pharmacy
> shall be reused, nor any prescription once issued be refilled.

> **RA 10918, Sec. 37:** All prescriptions dispensed shall be recorded in a patient
> medication profile and kept for **not less than 2 years** after the last entry.
> Dangerous drug entries must also be in the **Dangerous Drugs Book**.

---

## RX Stories: Product Classification Setup

| ID | As a... | I want... | So that... |
|---|---|---|---|
| RX-1 | Admin / Pharmacist-in-Charge | Each product in the product master to have a mandatory **drug classification field** with exactly five options: `DD, Rx` / `EDD, Rx` / `Rx` / `Pharmacist-Only OTC` / `Non-Rx OTC` | Every product has a legally accurate dispensing class before it can be sold |
| RX-2 | Admin / Pharmacist-in-Charge | The classification field to be **required before a product can be saved** — no product should exist in the catalog without a class assigned | Classification gaps that cause wrong dispensing are prevented at data entry time |
| RX-3 | Admin / Pharmacist-in-Charge | Enter and store the following fields per product: **generic name**, **brand name**, **active ingredient / salt**, **dosage strength**, **dosage form** (tablet, capsule, syrup, etc.), and **FDA Certificate of Product Registration (CPR) number** | The product master carries the minimum information required for a valid prescription label and for FDA inspection |
| RX-4 | Admin | Apply a **"Behind Counter"** flag automatically to all products classified as `DD, Rx`, `EDD, Rx`, `Rx`, and `Pharmacist-Only OTC` | The system reflects the DOH AO 2024-0013 storage rule that prescription and pharmacist-only items must be stored out of public reach |
| RX-5 | Cashier / Pharmacist | The POS product search and product card to **prominently display the drug class badge** (e.g., a red "DD" tag, orange "EDD" tag, blue "Rx" tag) next to every product | The dispensing team immediately sees the classification level before adding to cart |
| RX-6 | Admin | **Bulk-import or bulk-update** product classifications via CSV, where each row maps a product SKU to its drug class and supporting fields | Large pharmacy catalogs can be classified without needing to edit every item manually |

---

## RX Stories: POS Dispensing Enforcement

| ID | As a... | I want... | So that... |
|---|---|---|---|
| RX-7 | System | When a cashier adds a **`Rx`, `EDD, Rx`, or `DD, Rx`** product to the cart, the system to **block the checkout step** and require prescription details to be entered before the sale can be completed | No prescription-only medicine is dispensed without a recorded prescription — as required by RA 10918 |
| RX-8 | System | When a cashier adds a **`Pharmacist-Only OTC`** product to the cart, display a **pharmacist acknowledgment prompt** requiring the dispensing pharmacist's name and PRC number to be logged before checkout — but not block the sale | RA 10918 pharmacist-supervised dispensing is captured without slowing down OTC sales unnecessarily |
| RX-9 | System | When a cashier adds a **`DD, Rx`** product specifically, display an additional warning: **"DANGEROUS DRUG — Special DOH Yellow Rx Form required. Verify S-2 license number and prescriber identity before dispensing."** requiring an explicit confirmation before proceeding | The most legally sensitive class triggers the highest-level checkpoint |
| RX-10 | System | When a cashier adds an **`EDD, Rx`** product, display a warning: **"Extended Dangerous Drug — Prescriber must have a valid S-2 license. Log S-2 number before dispensing."** | EDD-level verification is enforced separately from regular Rx |
| RX-11 | Cashier / Pharmacist | Remove a prescription-blocked item from the cart **without entering prescription details** if the customer cannot provide a valid prescription, with the removal logged against the session | Situations where a customer does not have a prescription are handled cleanly without voiding the rest of the sale |

---

## RX Stories: Prescription Data Capture

| ID | As a... | I want... | So that... |
|---|---|---|---|
| RX-12 | Pharmacist / Cashier | A **Prescription Entry drawer** to open when prescription details are required, capturing: prescription date, prescriber's full name, prescriber's PRC license number, prescriber's PTR number, clinic/hospital name and address, patient full name, patient address, drug generic name, dosage strength, quantity prescribed (in figures), and directions for use | All fields required by RA 10918 Sec. 37 patient medication profile are captured at point of dispensing |
| RX-13 | Pharmacist / Cashier | For **`DD, Rx`** products specifically, the Prescription Entry drawer to require two additional fields: **prescriber's S-2 license number** and a **Yellow Rx reference number** (the serial number printed on the DOH special prescription form) | RA 9165 DD prescription requirements are enforced at the field level, not just as a reminder |
| RX-14 | Pharmacist / Cashier | For **`EDD, Rx`** products, the drawer to require the **prescriber's S-2 license number** alongside the standard Rx fields | EDD-specific requirements are captured separately from standard Rx |
| RX-15 | Pharmacist / Cashier | Assign a **dispensing pharmacist** to each Rx/DD transaction by selecting from the registered pharmacist list (configured in Settings), with the selected pharmacist's name and PRC number recorded against the dispensing event | RA 10918 Sec. 37 requires pharmacist initials on every dispensed prescription record |
| RX-16 | System | After a prescription-gated sale is completed, **mark the prescription reference as "SERVED"** and prevent the same Yellow Rx reference number or prescription date+prescriber+patient combination from being used again in a new transaction | The RA 9165 no-refill and no-reuse rule is enforced by the system, not just by staff memory |
| RX-17 | Pharmacist | If a patient presents a **partial fill** scenario (dispensing less than the total quantity prescribed), record the quantity dispensed, quantity remaining, and set the prescription status to **"PARTIAL — OPEN"** so the balance can be fulfilled in a subsequent transaction | RA 10918 Sec. 33 partial filling is supported without allowing the prescription to be reused for more than the prescribed total |
| RX-18 | System | When the **final quantity completing a partial prescription** is dispensed, automatically set the prescription status to **"FULLY SERVED"** and lock it from further use | The pharmacist who completes the last fill is correctly recorded as the keeper of the prescription per RA 10918 |

---

## RX Stories: Patient Medication Profile (RA 10918, Sec. 37)

| ID | As a... | I want... | So that... |
|---|---|---|---|
| RX-19 | Pharmacist-in-Charge | A **Patient Medication Profile** automatically built for each customer who receives a prescription medicine, recording every dispensed Rx in chronological order: date, OR number, drug name, dosage, quantity dispensed, prescriber, and dispensing pharmacist | The electronic equivalent of the prescription book required by RA 10918 Sec. 37 is always current without manual transcription |
| RX-20 | Pharmacist-in-Charge | Search the Patient Medication Profile by **patient name, phone number, or customer ID** and view their full Rx history | I can quickly retrieve a patient's record during an FDA or PRC inspection |
| RX-21 | Pharmacist-in-Charge | The Patient Medication Profile to be **retained for a minimum of 10 years** in local storage (exceeding the 2-year minimum of RA 10918 to align with BIR retention) with no automatic purge | Regulatory retention requirements for both pharmacy law and BIR are met by a single data retention policy |
| RX-22 | Pharmacist-in-Charge | **Export a patient's full medication profile** as a PDF for a selected date range | I can provide a printed copy for FDA inspection or for transfer to another pharmacy |

---

## RX Stories: Dangerous Drugs Book (RA 9165)

| ID | As a... | I want... | So that... |
|---|---|---|---|
| RX-23 | Pharmacist-in-Charge | A dedicated **Dangerous Drugs (DD) Transaction Log** that separately records every `DD, Rx` and `EDD, Rx` dispensing event with: date and time, patient full name and address, drug name, dosage strength, quantity dispensed, Yellow Rx / S-2 reference number, prescriber name and S-2 number, dispensing pharmacist, and OR number | This serves as the electronic equivalent of the Dangerous Drugs Book required by RA 9165 and RA 10918 Sec. 37 |
| RX-24 | Pharmacist-in-Charge | The DD Log to also record **DD/EDD purchases and stock receipts** (supplier name, delivery date, purchase order reference, quantity received, and lot number) so that the log captures both the inventory-in and inventory-out sides | RA 9165 requires pharmacists to maintain original records of sales, purchases, acquisitions, and deliveries |
| RX-25 | Pharmacist-in-Charge | A **running balance column** in the DD Log showing the current on-hand quantity of each DD/EDD product after every dispensing or receiving event | Stock discrepancies for dangerous drugs can be detected immediately and reported to PDEA within the 48-hour window required by law |
| RX-26 | Pharmacist-in-Charge | **Export the DD Transaction Log** as a PDF or CSV for a selected date range, formatted as a register with sequential entry numbers | I can submit the log to PDEA or DOH during compliance audits without manual rewriting |
| RX-27 | Pharmacist-in-Charge | Receive a **stock discrepancy alert** if the system-calculated DD/EDD running balance does not match a manual count entered by the pharmacist | Unexplained losses of dangerous drugs are flagged immediately so PDEA can be notified within 48 hours per DDB Board Regulation No. 3 |

---

## RX Stories: Prescription Validation & Red Flag Detection

| ID | As a... | I want... | So that... |
|---|---|---|---|
| RX-28 | Pharmacist / Cashier | The system to **automatically flag suspicious prescription patterns** and display a yellow warning before completing the dispensing: (a) same patient receiving the same DD/EDD drug more than once within 30 days, (b) same prescriber issuing the same DD/EDD drug to 3 or more different patients within 7 days, (c) quantity prescribed significantly above standard therapeutic range | Common red flags for prescription fraud and drug diversion are surfaced without blocking the pharmacist's final judgment |
| RX-29 | Pharmacist | **Log a prescription refusal** when the pharmacist decides not to dispense a prescription-gated item, recording the reason (e.g., suspected forgery, missing S-2, altered quantities, prescriber unverifiable) and the pharmacist's name | Refusal events are documented for inspection and protection of the pharmacy's liability |
| RX-30 | Pharmacist | The system to **check if a Yellow Rx reference number has already been served** at any previous transaction before allowing a DD dispensing to proceed, and block it with a clear message if it has already been used | The RA 9165 no-reuse rule is enforced even if a different cashier or pharmacist is at the counter |

---

## RX Stories: Inventory Controls for DD/EDD

| ID | As a... | I want... | So that... |
|---|---|---|---|
| RX-31 | Pharmacist-in-Charge | DD and EDD products to display a **separate "DD Stock" indicator** on the inventory screen distinct from the general low-stock indicator, showing current quantity and last reconciliation date | I can monitor controlled substance stock at a glance without searching through the full catalog |
| RX-32 | Pharmacist-in-Charge | Perform a **DD stock reconciliation** from the inventory screen — entering physical count per DD/EDD product — and have the system record the reconciliation date, counted quantity, system quantity, and variance | I have a documented audit trail of every physical count event for PDEA inspection |
| RX-33 | Admin / Pharmacist-in-Charge | Receive a **low-stock alert** for DD/EDD products at a configurable threshold (separate from the general low-stock threshold) so that reordering is initiated early | Running out of a dangerous drug product creates a patient care risk that must be anticipated further in advance |

---

## RX Stories: Audit, Access & Inspection Readiness

| ID | As a... | I want... | So that... |
|---|---|---|---|
| RX-34 | Admin | Prescription entry, DD log access, and pharmacist assignment to be **restricted to Pharmacist and Admin roles only** — cashiers cannot complete a prescription-gated sale without a pharmacist confirming the entry | The RA 10918 requirement for pharmacist supervision of all Rx dispensing is enforced by role permissions |
| RX-35 | Pharmacist-in-Charge | All prescription-gated transactions, DD log entries, refusals, and stock reconciliations to be **logged in the system audit trail** with the user, timestamp, and action performed | The audit trail is ready for FDA or PDEA inspectors at any time the pharmacy is open, as required by RA 10918 Sec. 37 |
| RX-36 | Pharmacist-in-Charge | A dedicated **Inspection Dashboard** that surfaces in one screen: total Rx transactions today, total DD/EDD transactions today, any open partial fills, any prescription red flags triggered today, and DD running balances | When an FDA or PDEA inspector arrives, I can open a single view that answers the most common questions immediately |
| RX-37 | Admin / IT | All prescription records and DD logs to be **included in the backup/export routine** (P-7 roadmap) and excluded from any data purge or prototype reset (T-4), regardless of other settings | Prescription records and DD books are never accidentally deleted — loss of these records is a criminal liability under RA 9165 |

---

## Notes

- **DD vs EDD enforcement difference:** `DD, Rx` requires the Special DOH Yellow Rx Form (serial-numbered pads issued by DOH); `EDD, Rx` requires an ordinary prescription with the prescriber's S-2 license number. Both require S-2 verification. Implement as separate validation paths in RX-13 and RX-14.
- **No-refill rule (RA 9165 Sec. 40b):** A served DD prescription cannot be reused. RX-16 and RX-30 together enforce this. The Yellow Rx reference number is the primary deduplication key for DD transactions.
- **Pharmacist-Only OTC (new category):** As of DOH AO 2024-0013 (effective December 2024), this is now a formal regulated class. RX-8 handles this with a lighter-weight acknowledgment flow rather than a full prescription capture.
- **RA 10918 Sec. 37 retention:** Minimum 2 years from last entry. Stories RX-21 and RX-37 extend this to 10 years to align with BIR eJournal retention requirements and avoid managing two different retention policies.
- **PDEA 48-hour loss reporting:** RX-27 (discrepancy alert) is the system's trigger for this. The actual PDEA report is a manual submission — PharmaSpot generates the data, the pharmacist submits.
- **Integration points:** RX-19 to RX-22 (Patient Medication Profile) connect to the Customer stories (C-1, C-2) — a customer record must exist before a medication profile can be built. Walk-in customers without a profile should still have a prescription record attached to an anonymous entry.
- **T-4 (prototype reset) override:** RX-37 must be implemented as a hard block — prototype data reset must never touch the `prescriptions`, `dd_log`, or `patient_medication_profiles` tables even in demo mode.
- Stories RX-34 (role gating) integrate with the existing staff and permission stories (T-3, D-2) and the planned credentialed authentication work.
