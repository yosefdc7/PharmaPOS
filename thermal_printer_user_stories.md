

\# PharmaSpot BIR Accreditation \& Reporting — User Stories



Derived from BIR RR 10-2015, RMO 10-2005, and common PH pharmacy POS compliance requirements.

Follows the same story conventions as `docs/PRD.md`.



Compatible thermal printer hardware: Epson TM-T82III, Epson TM-T88VII,

Star Micronics TSP143, Xprinter XP-58, Sunmi Cloud Printer.



\---



\## BIR Stories: Accreditation Configuration



| ID | As a... | I want... | So that... |

|---|---|---|---|

| B-1 | Admin | A dedicated BIR Settings section where I can enter and save the store's \*\*TIN, registered business name, registered address, VAT registration status, Permit to Use (PTU) number, POS machine serial number, and BIR accreditation number\*\* | All generated BIR reports and receipts carry the legally required header fields |

| B-2 | Admin | The BIR accreditation number, PTU number, and machine serial number to be \*\*validated for format\*\* before saving (e.g., PTU follows `AAANNNNNNN` pattern) | We catch configuration errors before they appear on official documents |

| B-3 | Admin | A clear \*\*BIR compliance status indicator\*\* in the Settings view that shows whether the required fields are complete or incomplete | I can verify at a glance that the system is configured for compliant operation before go-live |



\---



\## BIR Stories: Official Receipt (OR)



| ID | As a... | I want... | So that... |

|---|---|---|---|

| B-4 | Cashier | Every completed sale to generate an \*\*Official Receipt (OR)\*\* containing: registered name, address, TIN, PTU number, accreditation number, sequential OR number, transaction date and time, itemized line items with unit price and quantity, VATable sales, VAT-exempt sales, VAT amount (12%), total due, payment method, and cashier name | The receipt is legally valid as proof of purchase under BIR rules |

| B-5 | Admin | OR numbers to be \*\*system-assigned, strictly sequential, and non-reusable\*\* — gaps flagged in the audit log | OR sequence integrity is preserved and any skipped numbers are traceable |

| B-6 | Admin | Configure the \*\*OR series range\*\* (beginning number, ending number) in BIR Settings, matching the range approved in the Permit to Use | The system stays within the BIR-approved OR series and alerts me when nearing the last 100 numbers |

| B-7 | Cashier | A \*\*voided transaction\*\* to generate a VOID notation on the OR record (not deleted) and carry the original OR number with a void timestamp and authorizing user | Voided transactions remain in the audit trail as required by BIR |



\---



\## BIR Stories: X-Reading (Mid-Day Snapshot)



| ID | As a... | I want... | So that... |

|---|---|---|---|

| B-8 | Cashier / Supervisor | Generate an \*\*X-Reading report\*\* at any point during the trading day without resetting any counters | I can verify running sales totals mid-shift without disrupting end-of-day figures |

| B-9 | Cashier / Supervisor | The X-Reading to display: report date and time, machine serial number, beginning OR number for the day, last OR number issued, gross sales, total VATable sales, total VAT-exempt sales, VAT amount, total discounts (itemized: SC, PWD, promotional), total voids and returns, and net sales | I have a complete mid-day snapshot that mirrors the Z-Reading structure for easy reconciliation |

| B-10 | Supervisor | X-Reading generation to be \*\*permission-gated\*\* (cashier and above) and logged with the requesting user and timestamp | There is an audit trail of every snapshot taken during the day |



\---



\## BIR Stories: Z-Reading (End-of-Day Reset Report)



| ID | As a... | I want... | So that... |

|---|---|---|---|

| B-11 | Supervisor / Admin | Generate a \*\*Z-Reading\*\* at end of trading day that produces the daily sales summary and \*\*resets the day's running accumulators\*\* to zero | The system correctly separates each day's sales as required by BIR |

| B-12 | Supervisor / Admin | The Z-Reading report to contain: store name, TIN, PTU number, machine serial number, report date, beginning OR number, ending OR number, transaction count, gross sales, VATable sales (net of VAT), output VAT (12%), zero-rated sales, VAT-exempt sales, total SC discount amount, total PWD discount amount, total other discounts, total voids (count and amount), total returns/refunds (count and amount), and net sales for the day | The report satisfies BIR's required Z-Reading format and can be presented during a BIR audit |

| B-13 | System | \*\*Block a second Z-Reading\*\* for the same calendar day once one has been generated, and require supervisor override with a logged reason if a correction re-run is needed | Accidental double-resets are prevented and any override is fully auditable |

| B-14 | Supervisor / Admin | Z-Reading to be \*\*automatically printed to the thermal receipt printer and saved\*\* as a PDF to local storage upon generation, named by date and machine serial number | A physical and digital record is always available for compliance and filing |

| B-15 | Admin | View a \*\*Z-Reading history log\*\* showing all past Z-Readings with date, generated-by user, and a link to the saved PDF | I can retrieve any past day's report quickly during a BIR audit without manual filing |



\---



\## BIR Stories: eJournal (Electronic Sales Journal)



| ID | As a... | I want... | So that... |

|---|---|---|---|

| B-16 | Admin / Operations | Generate an \*\*eJournal export\*\* for a selected date range (daily, weekly, or custom) in the BIR-prescribed tab-delimited text format (`.txt`) | The file can be submitted to BIR manually or loaded into BIR's offline tools without reformatting |

| B-17 | Admin / Operations | The eJournal file to include one row per transaction with: OR number, transaction date and time, cashier ID, gross amount, VATable amount, VAT amount, VAT-exempt amount, zero-rated amount, SC discount, PWD discount, other discounts, void flag, payment method, and net amount | Every transaction detail required by RR 10-2015 is present in the output file |

| B-18 | Admin / Operations | Voided and refunded transactions to appear in the eJournal as \*\*separate rows with a VOID or RETURN type flag\*\* rather than being removed | The journal is a complete, unaltered record of all POS activity as BIR requires |

| B-19 | Admin / Operations | The system to \*\*validate the eJournal file on generation\*\* — checking that OR sequence has no unexplained gaps and that daily totals match the corresponding Z-Readings — and surface any discrepancies before export | I submit a clean, internally consistent file and can investigate issues before they reach BIR |

| B-20 | Admin | Generated eJournal files to be \*\*saved to a designated local folder\*\* with a filename convention of `MMDDYYYY\_\[machine serial]\_eJournal.txt` and retained for at least 10 years as required by BIR | Regulatory retention requirements are met without manual file management |



\---



\## BIR Stories: eSales Report (Monthly Electronic Submission)



| ID | As a... | I want... | So that... |

|---|---|---|---|

| B-21 | Admin / Owner | Generate a \*\*monthly eSales Report\*\* for a selected month in the BIR-prescribed CSV format | The file can be submitted to BIR's eSales portal or submitted manually as required |

| B-22 | Admin / Owner | The eSales Report to contain one summary row per trading day with: date, beginning OR, ending OR, gross sales, VATable sales, VAT amount, VAT-exempt sales, zero-rated sales, total discounts, voids, and net sales — plus a monthly grand total row | The monthly aggregate view matches the sum of all Z-Readings for that month and satisfies BIR's eSales format |

| B-23 | Admin / Owner | A \*\*monthly eSales summary card\*\* in the Reports view showing total gross sales, total VAT collected, total exemptions, and total voids for the current and previous month | I can review the figures before generating the file and catch anomalies early |

| B-24 | Admin | Generated eSales files to be \*\*saved locally\*\* using the convention `YYYY-MM\_\[TIN]\_eSales.csv` and retained alongside the corresponding Z-Readings and eJournals | All BIR submission artifacts for a given month are stored together and traceable |



\---



\## BIR Stories: VAT \& Sales Classification



| ID | As a... | I want... | So that... |

|---|---|---|---|

| B-25 | Admin | Configure whether the store is \*\*VAT-registered or Non-VAT\*\* in BIR Settings, with the selection locking the applicable receipt template and tax computation logic | The system issues the correct receipt type (VAT OR vs. Non-VAT OR) and computes tax accurately |

| B-26 | System | Each sale line item to be automatically \*\*classified as VATable, VAT-exempt, or zero-rated\*\* based on the product's tax flag set in the product master | Tax breakdowns on receipts and BIR reports are computed correctly at line-item level without cashier intervention |

| B-27 | Cashier | When an SC or PWD discount is applied to a sale, the system to \*\*automatically compute the 20% discount and remove VAT\*\* from the discounted lines, and display both figures separately on the receipt | The transaction is compliant with RA 9994 and the VAT-exempt treatment is correctly reflected in BIR reports |



\---



\## BIR Stories: Audit, Access \& Integrity



| ID | As a... | I want... | So that... |

|---|---|---|---|

| B-28 | Admin | All BIR report generation events (X-Reading, Z-Reading, eJournal export, eSales export) to be \*\*logged in the audit trail\*\* with the generating user, timestamp, and report parameters | Every report can be traced to an accountable user during a BIR inspection |

| B-29 | Admin | BIR report generation and export to be \*\*restricted to Admin role only\*\*, with Supervisor role limited to X-Reading and Z-Reading | Sensitive compliance actions are protected from unauthorized use |

| B-30 | Admin / IT | The system to \*\*detect and alert\*\* if the current date's Z-Reading has not been generated by a configurable cut-off time (e.g., 11:59 PM) | Missed Z-Readings — a common BIR audit finding — are flagged before they become a compliance gap |



\---



\## Printer Stories: Setup \& Configuration



| ID | As a... | I want... | So that... |

|---|---|---|---|

| PR-1 | Admin | A \*\*Printer Settings section\*\* where I can add a receipt printer by selecting its connection type (USB, Bluetooth, or LAN/Network), entering its name or IP address, and assigning it a label (e.g., "Counter 1 Printer") | The system knows which physical device to send print jobs to |

| PR-2 | Admin | Select the \*\*paper width\*\* (58mm or 80mm) and \*\*character set\*\* (UTF-8 / ESC/POS standard) matching the loaded paper roll | Receipts print correctly without text cutoff or encoding errors |

| PR-3 | Admin | Configure \*\*receipt layout options\*\*: store logo (uploaded image), header lines, footer lines (e.g., "Thank you! Come again"), and whether to auto-cut paper after printing | The printed receipt matches the pharmacy's branding and paper setup |

| PR-4 | Admin | Run a \*\*test print\*\* directly from Printer Settings that outputs a sample receipt with all configured fields | I can verify alignment, encoding, and paper cut before going live |

| PR-5 | Admin | \*\*Save multiple printer profiles\*\* and assign each one a role: OR Printer, Report Printer, or Both | A pharmacy with two counters can route POS receipts and BIR reports to the correct device |

| PR-6 | IT / Admin | The system to \*\*auto-detect USB-connected printers\*\* on startup and highlight them in Printer Settings | Cashiers don't have to manually identify device ports during setup |



\---



\## Printer Stories: Connection \& Status



| ID | As a... | I want... | So that... |

|---|---|---|---|

| PR-7 | Cashier | A \*\*printer status indicator\*\* (Online / Offline / Paper Low / Error) visible on the POS screen at all times | I know before completing a sale whether printing will succeed |

| PR-8 | System | Automatically \*\*attempt reconnection\*\* to a LAN or Bluetooth printer every 30 seconds when it goes offline, and update the status indicator without requiring a page reload | Temporary disconnections recover silently without disrupting the cashier |

| PR-9 | Cashier | Receive a \*\*clear on-screen alert\*\* if the printer is offline or out of paper when I attempt to complete a sale | I can resolve the issue before the customer is left waiting |

| PR-10 | Cashier | The system to \*\*queue the print job\*\* for up to 5 minutes if the printer is temporarily unreachable and auto-print once reconnected | A brief disconnect does not lose the receipt permanently |



\---



\## Printer Stories: Official Receipt Printing



| ID | As a... | I want... | So that... |

|---|---|---|---|

| PR-11 | Cashier | The thermal printer to \*\*automatically print the BIR Official Receipt\*\* immediately upon sale completion without any extra button press | Checkout flow stays fast and the customer receives proof of purchase instantly |

| PR-12 | Cashier | The printed OR to include: store name, registered address, TIN, PTU number, BIR accreditation number, sequential OR number, date and time, itemized products with quantity and unit price, VATable sales, VAT-exempt sales, VAT amount, total amount due, payment method and amount tendered, change given, cashier name, and the configured receipt footer | The receipt is complete, BIR-compliant, and useful to the customer |

| PR-13 | Cashier | \*\*Reprint the last OR\*\* from a dedicated reprint button on the completed sale screen (admin or supervisor approval required for reprints older than the current session) | A customer who lost their receipt can get a copy without voiding or re-entering the sale |

| PR-14 | Cashier | The reprinted receipt to be clearly marked \*\*"REPRINT — NOT AN ORIGINAL OR"\*\* with the reprint timestamp and the name of the user who authorized it | Reprints are never mistaken for original ORs during a BIR audit |

| PR-15 | Cashier | A \*\*void receipt\*\* to print automatically when a transaction is voided, showing the original OR number, void reason, void timestamp, and authorizing user | The paper trail for every voided transaction is complete |

| PR-16 | Cashier | When an \*\*SC or PWD discount\*\* is applied, the printed receipt to show the customer's SC/PWD ID number, the discount amount, and the VAT-exempt breakdown as a separate line | The receipt meets RA 9994 documentation requirements |



\---



\## Printer Stories: Report Printing



| ID | As a... | I want... | So that... |

|---|---|---|---|

| PR-17 | Supervisor / Admin | Print an \*\*X-Reading report\*\* directly to the thermal printer from the Reports view with one button | I have a physical record of the mid-day snapshot for shift handover without needing a separate printer |

| PR-18 | Supervisor / Admin | Print a \*\*Z-Reading report\*\* to the thermal printer immediately after generation, with automatic paper cut | The end-of-day report is physically filed the moment it is produced |

| PR-19 | Admin | Print a \*\*daily sales summary\*\* (condensed single-page format optimized for 80mm roll) from the Reports view | I have a compact daily report suitable for filing without wasting paper |

| PR-20 | Admin | Printed BIR reports (X-Reading, Z-Reading) to carry a \*\*report header\*\* distinct from OR headers — showing "X-READING REPORT" or "Z-READING REPORT" prominently — and the report generation timestamp | Reports are never confused with customer receipts when filing |



\---



\## Printer Stories: Offline \& Fallback



| ID | As a... | I want... | So that... |

|---|---|---|---|

| PR-21 | Cashier | If the printer is offline at the moment of sale completion, to be offered two options: \*\*Wait and Retry\*\* (holds the completed sale screen) or \*\*Skip Print and Send Digital Receipt\*\* | I can still close the transaction even if the printer is temporarily unavailable |

| PR-22 | Cashier | The system to automatically offer a \*\*digital receipt\*\* (displayed as a QR code on-screen or sent via SMS/email if customer details are on file) whenever printing fails | Customers always get a copy of their OR regardless of printer status |

| PR-23 | Cashier | All sales where printing was skipped to appear in a \*\*Reprint Queue\*\* accessible from the POS home screen | No receipt is permanently lost — I can print all pending ORs once the printer is back online |

| PR-24 | System | The Reprint Queue to \*\*auto-clear printed items\*\* and retain failed items with their failure reason (e.g., "Printer offline", "Out of paper") | I can triage unresolved print failures quickly during or after a shift |



\---



\## Printer Stories: Paper \& Hardware Management



| ID | As a... | I want... | So that... |

|---|---|---|---|

| PR-25 | Cashier | Receive a \*\*"Paper Low" warning\*\* on-screen when the printer detects low paper (supported by Epson TM-T82/T88 and Star TSP143 via ESC/POS status polling) | I can replace the roll before it runs out mid-receipt |

| PR-26 | Admin | Configure a \*\*maximum receipt length\*\* (e.g., 40 lines) and enable automatic \*\*font size reduction or line condensing\*\* when an order exceeds the limit | Long receipts with many line items still print on a single roll without cutting off |

| PR-27 | Admin | Toggle \*\*auto-cut\*\* on or off per printer profile, and configure a \*\*partial cut\*\* option for printers that support it | The paper handling matches the physical printer model in use |

| PR-28 | IT / Admin | Access a \*\*printer activity log\*\* showing each print job — OR number, job type, timestamp, printer used, success/failure status, and failure reason | I can diagnose recurring printer issues and identify any ORs that were never physically printed |



\---



\## Notes



\- All BIR report formats follow \*\*RR 10-2015\*\* (eSales) and \*\*RMO 10-2005\*\* (eJournal) as the baseline; verify against the latest BIR issuances before implementation.

\- Stories B-1 through B-30 are \*\*prerequisites for BIR accreditation application\*\*; no production pharmacy deployment should go live without at minimum B-1 to B-7, B-11, B-16, and B-21.

\- SC/PWD discount computation in B-27 and PR-16 should be implemented in coordination with the planned \*\*Senior Citizen / PWD user stories\*\* to avoid duplicated logic.

\- The `eJournal` and `eSales` exports are currently \*\*manual submission\*\* flows (no direct BIR API integration); stories are scoped accordingly.

\- All thermal print commands should use the \*\*ESC/POS command standard\*\*, which is supported by Epson, Star Micronics, Xprinter, and most Sunmi devices natively. This avoids vendor lock-in.

\- For \*\*desktop (Electron)\*\* builds: use Node.js `node-thermal-printer` or `escpos` library for direct USB/LAN printing without a print driver.

\- For \*\*web prototype\*\* builds: use the \*\*Web Serial API\*\* (Chrome/Edge, USB) or \*\*Web Bluetooth API\*\* for Bluetooth printers. LAN printers may require a lightweight local print bridge service.

\- PR-7 through PR-10 (status polling) requires ESC/POS \*\*DLE EOT status\*\* commands — confirm support per target printer model before implementing.

\- PR-21 and PR-22 (fallback/digital receipt) should be designed in coordination with the customer profile stories (C-1, C-2) so that SMS/email can be pre-populated from stored contact details.

\- Stories PR-13 and PR-14 (reprint) integrate with the \*\*BIR audit trail\*\* in B-28 so every reprint is logged.

\- B-14 (Z-Reading auto-print) links directly to PR-18 — implement as a single triggered action: generate Z-Reading → save PDF → send to thermal printer.



