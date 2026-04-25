# PharmaSpot SC/PWD Discount — User Stories

Legal basis: **RA 9994** (Expanded Senior Citizens Act of 2010), **RA 10754**
(Expanded Benefits and Privileges of PWD), **BIR RR No. 7-2010**,
**BIR RR No. 16-2018**, **DOH AO No. 2010-0032**, **FDA Circular No. 2025-005**.
Follows the same story conventions as `docs/PRD.md`.

---

## Computation Reference (Embed in Dev Docs)

| Store Type | Formula | Example (₱100 item) |
|---|---|---|
| **VAT-registered** | `(Price ÷ 1.12) × 0.80` | ₱100 ÷ 1.12 = ₱89.29 → × 0.80 = **₱71.43** |
| **Non-VAT / VAT-exempt** (most medicines) | `Price × 0.80` | ₱100 × 0.80 = **₱80.00** |

> BIR RR 7-2010: The selling price charged to SC/PWD must be **net of VAT** because
> the sale is VAT-exempt. The 20% discount is applied on the VAT-excluded amount.

---

## SD Stories: Settings & Product Eligibility

| ID | As a... | I want... | So that... |
|---|---|---|---|
| SD-1 | Admin | A **SC/PWD Discount Settings** section where I can enable or disable the SC/PWD discount feature, confirm the configured discount rate (fixed at 20% per RA 9994 / RA 10754), and select the store's VAT registration status (VAT-registered or Non-VAT) | The system applies the correct computation formula for our pharmacy's tax classification |
| SD-2 | Admin | Tag each product in the product master as **SC/PWD-eligible (Yes / No)** so that the discount is automatically restricted to qualifying items only | Non-covered items (e.g., cosmetics, alcohol-based products) are never discounted in error |
| SD-3 | Admin | Set the **default eligibility** for new products to "SC/PWD-eligible: Yes" for medicine categories and "No" for non-medicine categories, with the ability to override per item | Most medicines are correctly tagged without needing manual setup for every SKU |
| SD-4 | Admin | View a **filtered product list** showing all items with their SC/PWD eligibility status, sortable and searchable | I can audit and correct eligibility tags across the full catalog quickly |

---

## SD Stories: Applying the Discount at POS

| ID | As a... | I want... | So that... |
|---|---|---|---|
| SD-5 | Cashier | A dedicated **"SC / PWD Discount" button** on the POS payment screen that opens an ID entry modal before proceeding to payment | The discount flow is always intentional and never applied accidentally |
| SD-6 | Cashier | The ID entry modal to let me select the **discount type** (Senior Citizen or PWD), enter the **ID number** (OSCA ID No. for SC; PWD ID No. for PWD), enter the **customer's full name**, and optionally enter their **TIN** (required on the OR per BIR RR 16-2018) | All fields mandated by BIR RR 16-2018 are captured before the transaction is closed |
| SD-7 | Cashier | After entering the SC/PWD details, the system to **automatically recompute the cart total** — removing VAT from eligible line items, then applying the 20% discount — and display a clear breakdown: Original Price, VAT Removed, Discount (20%), and Final Price Payable | The cashier and customer can both verify the computation before payment |
| SD-8 | Cashier | The system to **only apply the discount to SC/PWD-eligible line items** in the cart, leaving non-eligible items at their original VAT-inclusive price | Mixed carts (e.g., medicine + non-covered item) are computed correctly without manual splitting |
| SD-9 | Cashier | If the cart already has a **promotional or manual discount** applied to an item, the system to display a warning: "SC/PWD discount cannot be combined with existing discounts. Remove the existing discount or apply the SC/PWD discount instead." | The no-double-discount rule per RA 9994 is enforced automatically |
| SD-10 | Cashier | If a customer presents **both an SC ID and a PWD ID**, the system to prompt: "Customer qualifies for both discounts. Only one may be applied per transaction. Please choose: Senior Citizen or PWD." | The law's single-discount-per-transaction rule is enforced with a clear user action |
| SD-11 | Cashier | Remove the SC/PWD discount from the current cart with a **supervisor-level confirmation** if it was applied in error | Mistakes can be corrected without voiding the entire transaction |

---

## SD Stories: Dispensing Limits & Eligibility Checks

| ID | As a... | I want... | So that... |
|---|---|---|---|
| SD-12 | Cashier | The system to **warn the cashier** if a prescription medicine line item quantity exceeds a **30-day supply** (as required by DOH AO 2010-0032) when an SC/PWD discount is applied | We do not dispense more than the legally allowed supply in a single SC/PWD transaction |
| SD-13 | Cashier | The system to **warn the cashier** if an OTC medicine line item quantity exceeds a **7-day supply** when an SC/PWD discount is applied | OTC dispensing limits under SC/PWD transactions are respected |
| SD-14 | Cashier | Log a **proxy purchase flag** when the cashier indicates the purchase is made by an authorized representative on behalf of the SC/PWD | The record reflects the correct legal basis for granting the discount to a non-SC/PWD buyer |

---

## SD Stories: SC/PWD Record Log

| ID | As a... | I want... | So that... |
|---|---|---|---|
| SD-15 | System | Every SC/PWD-discounted transaction to be **automatically recorded in a dedicated SC/PWD Transaction Log** containing: OR number, date and time, customer name, ID type (SC/PWD), ID number, TIN (if provided), items purchased with original price and discounted price, total discount amount, total VAT exempted, cashier name, and proxy flag if applicable | A complete, auditable record exists for BIR tax deduction claims and FDA/DOH inspections |
| SD-16 | Admin | View and search the **SC/PWD Transaction Log** by date range, ID number, or customer name from the Reports section | I can retrieve records for a specific customer or period during an audit |
| SD-17 | Admin | **Export the SC/PWD Transaction Log** as a CSV file for a selected date range | I can submit the log to BIR or DOH during inspections without manual transcription |
| SD-18 | Admin | View a **monthly SC/PWD summary card** in Reports showing: total SC transactions, total PWD transactions, total discount amount granted, total VAT exempted, and total amount deductible from gross income | I can quickly prepare the figures needed for the income tax deduction claim |

---

## SD Stories: Computation Engine

| ID | As a... | I want... | So that... |
|---|---|---|---|
| SD-19 | System | For **VAT-registered stores**, compute the SC/PWD discount per eligible line item as: `VAT-exempt amount = Line Price ÷ 1.12` → `Discount = VAT-exempt amount × 0.20` → `Final = VAT-exempt amount − Discount` | The computation follows BIR RR 7-2010 and DOH AO 2010-0032 precisely |
| SD-20 | System | For **Non-VAT stores** (or items already VAT-exempt such as most medicines), compute the SC/PWD discount per eligible line item as: `Discount = Line Price × 0.20` → `Final = Line Price × 0.80` | The simpler formula is applied correctly when no VAT was ever embedded in the price |
| SD-21 | System | The computation to be applied **per line item**, not on the cart total, so that mixed carts with eligible and non-eligible items are always computed correctly | There is no possibility of incorrectly discounting non-covered items through a blanket cart-level calculation |
| SD-22 | System | Round all SC/PWD discount amounts to **two decimal places** using standard rounding (0.005 rounds up) and display both the per-item and cart-total discount figures | Computation is consistent with how BIR and OSCA expect amounts to be shown on receipts |

---

## SD Stories: Receipt Output (BIR RR 16-2018)

| ID | As a... | I want... | So that... |
|---|---|---|---|
| SD-23 | Cashier | The **printed Official Receipt** for SC/PWD transactions to include all standard OR fields plus: customer name, ID type (SC or PWD), ID number (OSCA ID / PWD ID), customer TIN (if available), per-item breakdown showing original price → VAT-exempt price → SC/PWD discount → final price, total discount granted, total VAT exempted, and a **signature line** for the SC/PWD or authorized representative | The receipt satisfies all BIR RR 16-2018 mandatory fields for SC/PWD transactions |
| SD-24 | Cashier | The receipt to clearly print **"VAT-EXEMPT SALE"** and **"SC DISCOUNT" or "PWD DISCOUNT"** as distinct line labels — not merged into a single generic "discount" line | The BIR-mandated breakdown is unambiguous for the customer and for audit |
| SD-25 | Cashier | If the purchase was made by a **proxy**, the receipt to include the representative's name and their relationship to the SC/PWD in the notes section | The documentation requirement for authorized representatives is met |

---

## SD Stories: BIR Tax Deduction Reporting

| ID | As a... | I want... | So that... |
|---|---|---|---|
| SD-26 | Admin / Owner | The Z-Reading and monthly eSales Report to **separately itemize**: total SC discount amount, total PWD discount amount, and total VAT-exempt sales arising from SC/PWD transactions | The figures needed for the BIR gross income deduction claim are already pre-computed and consistent with daily reports |
| SD-27 | Admin / Owner | The eJournal export to **flag each SC/PWD transaction** with the ID type, ID number, and a VAT-exempt indicator on the corresponding row | The electronic journal contains sufficient detail to justify VAT-exempt treatment during a BIR audit |
| SD-28 | Admin / Owner | A dedicated **"SC/PWD Deductibles Report"** showing the total cost of discounts granted (i.e., the deductible expense amount per BIR RR 7-2010) for a selected period, broken down by SC and PWD | Our accountant or bookkeeper can directly use this figure when preparing the income tax return |

---

## SD Stories: Enforcement & Audit Controls

| ID | As a... | I want... | So that... |
|---|---|---|---|
| SD-29 | Admin | The SC/PWD discount to require **cashier authentication** (password or PIN) before being applied, separate from the ID entry step | Only authorized staff can grant the discount, reducing abuse |
| SD-30 | Admin | All SC/PWD discount applications and removals to be **logged in the system audit trail** with: OR number, cashier who applied it, SC/PWD ID entered, timestamp, and whether it was subsequently removed and by whom | Every instance of the discount is traceable from application to final receipt |
| SD-31 | Admin | Receive a **daily summary alert** (on the Reports dashboard) if the total number of SC/PWD discounted transactions in a day exceeds a configurable threshold (e.g., 20 transactions) | Unusually high SC/PWD discount volumes — a common sign of abuse — are flagged for review |
| SD-32 | Admin | The system to **prevent the same SC/PWD ID number from being used more than once within the same calendar day** at the same terminal, and surface a warning requiring supervisor override if it recurs | Repeat use of a single ID for multiple transactions in one day is controlled and logged |

---

## Notes

- **Computation order matters**: VAT removal must happen before the 20% discount is applied, not after. Implement and unit-test both the VAT-registered and Non-VAT formulas independently before integration.
- **Medicine VAT status**: Most medicines sold in PH pharmacies are already VAT-exempt under NIRC Sec. 109. If the product master's tax flag is set to VAT-exempt, use the Non-VAT formula (SD-20), not the VAT-registered formula (SD-19), even in a VAT-registered store.
- **No purchase booklet for OTC (as of 2025)**: Per FDA Circular No. 2025-005, OTC medicines no longer require a purchase booklet from SC/PWD customers. Remove any requirement for booklet scanning from the POS flow.
- **Prescription medicines**: Still require a doctor's prescription. SD-12 dispensing limit (30-day supply) aligns with this.
- **BIR RR 16-2018 receipt fields**: SC/PWD TIN, ID number, and signature line are mandatory on the OR. The signature line on a thermal receipt is a blank space with "Signature of SC/PWD:" label — cashier must get a physical signature on the printed receipt.
- **Tax deduction mechanics**: Per BIR RR 7-2010, the discount is a **deduction from gross income** (not from VAT output). The full undiscounted amount is still reported as gross sales in the eSales and eJournal — the discount appears separately as an expense. SD-26 through SD-28 support this accounting treatment.
- Stories SD-23 to SD-25 (receipt) must be implemented in coordination with **PR-12 and PR-16** in the thermal printer story set to avoid duplicated receipt template logic.
- Stories SD-15 to SD-18 (SC/PWD log) must feed into **B-17 and B-27** in the BIR story set so VAT-exempt sales from SC/PWD transactions are correctly excluded from VATable sales totals.
