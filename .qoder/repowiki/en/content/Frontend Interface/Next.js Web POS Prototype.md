# Next.js Web POS Prototype

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [package.json](file://web-prototype/package.json)
- [next.config.ts](file://web-prototype/next.config.ts)
- [tsconfig.json](file://web-prototype/tsconfig.json)
- [vitest.config.ts](file://web-prototype/vitest.config.ts)
- [page.tsx](file://web-prototype/src/app/page.tsx)
- [pos-prototype.tsx](file://web-prototype/src/components/pos-prototype.tsx)
- [use-pos-store.ts](file://web-prototype/src/lib/use-pos-store.ts)
- [calculations.ts](file://web-prototype/src/lib/calculations.ts)
- [db.ts](file://web-prototype/src/lib/db.ts)
- [types.ts](file://web-prototype/src/lib/types.ts)
- [observability.ts](file://web-prototype/src/lib/observability.ts)
- [feature-flags.ts](file://web-prototype/src/lib/feature-flags.ts)
- [seed.ts](file://web-prototype/src/lib/seed.ts)
- [pos-prototype.test.tsx](file://web-prototype/src/components/pos-prototype.test.tsx)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
The Next.js Web POS Prototype is a comprehensive point-of-sale system built with React and Next.js, designed specifically for pharmacy environments. This prototype demonstrates a complete offline-first POS solution with real-time synchronization capabilities, inventory management, customer tracking, and advanced reporting features. The system is architected around a modern React pattern using custom hooks for state management and IndexedDB for persistent local storage.

The prototype showcases key pharmaceutical POS requirements including product expiry tracking, low stock alerts, customer database management, and transaction history with filtering capabilities. Built with TypeScript for type safety and Vitest for testing, the system provides a robust foundation for enterprise-scale pharmacy management applications.

## Project Structure
The project follows a modular Next.js architecture with clear separation of concerns across components, libraries, and data management layers.

```mermaid
graph TB
subgraph "Application Layer"
A[Next.js App Router]
B[Page Components]
C[UI Components]
end
subgraph "State Management"
D[Custom Hooks]
E[Store Factory]
F[Feature Flags]
end
subgraph "Data Layer"
G[IndexedDB]
H[Local Storage]
I[Seed Data]
end
subgraph "Business Logic"
J[Calculations]
K[Observability]
L[Types]
end
A --> B
B --> C
C --> D
D --> E
E --> G
E --> H
E --> I
D --> J
D --> K
D --> L
G --> J
G --> K
```

**Diagram sources**
- [page.tsx:1-6](file://web-prototype/src/app/page.tsx#L1-L6)
- [pos-prototype.tsx:58-427](file://web-prototype/src/components/pos-prototype.tsx#L58-L427)
- [use-pos-store.ts:51-433](file://web-prototype/src/lib/use-pos-store.ts#L51-L433)

**Section sources**
- [README.md:1-91](file://README.md#L1-L91)
- [package.json:1-34](file://web-prototype/package.json#L1-L34)

## Core Components

### POS Interface Component
The main POS interface serves as the primary user interaction layer, implementing a comprehensive sales workflow with product browsing, cart management, and payment processing.

Key features include:
- Multi-view navigation (POS, Products, Customers, Settings, Reports, Sync)
- Real-time product filtering and sorting
- Interactive cart with quantity adjustments
- Multi-payment method support (cash and external terminal)
- Order holding and resuming capabilities
- Receipt generation and printing

### State Management Hook
The custom `usePosStore` hook encapsulates all application state and business logic, providing a centralized data management solution with offline-first capabilities.

Core responsibilities:
- Local state management for products, customers, transactions
- Offline/online state detection and management
- Feature flag control for enabling/disabling functionality
- Sync queue management for offline data persistence
- Telemetry and observability event logging

### Data Persistence Layer
Built on IndexedDB for reliable offline data storage with automatic synchronization capabilities.

Supported entities:
- Products with expiry tracking and stock management
- Categories for product organization
- Customers with contact information
- Users with role-based permissions
- Transactions with payment details
- Settings for store configuration
- Sync queue for offline operations

**Section sources**
- [pos-prototype.tsx:58-427](file://web-prototype/src/components/pos-prototype.tsx#L58-L427)
- [use-pos-store.ts:51-433](file://web-prototype/src/lib/use-pos-store.ts#L51-L433)
- [db.ts:22-46](file://web-prototype/src/lib/db.ts#L22-L46)

## Architecture Overview

```mermaid
graph TB
subgraph "Client Application"
A[React Components]
B[Custom Hooks]
C[State Management]
end
subgraph "Data Layer"
D[IndexedDB]
E[Local Storage]
F[Seed Data]
end
subgraph "Business Logic"
G[Calculations]
H[Feature Flags]
I[Observability]
end
subgraph "External Services"
J[Network Detection]
K[Synchronization]
L[Print Services]
end
A --> B
B --> C
C --> D
C --> E
C --> F
C --> G
C --> H
C --> I
D --> J
D --> K
A --> L
```

**Diagram sources**
- [use-pos-store.ts:84-141](file://web-prototype/src/lib/use-pos-store.ts#L84-L141)
- [db.ts:99-115](file://web-prototype/src/lib/db.ts#L99-L115)
- [observability.ts:49-94](file://web-prototype/src/lib/observability.ts#L49-L94)

The architecture implements a clean separation between presentation, state management, and data persistence layers, enabling easy testing and maintenance while supporting offline-first operation.

## Detailed Component Analysis

### POS Interface Implementation

```mermaid
classDiagram
class PosPrototype {
+ViewKey view
+boolean navOpen
+string query
+string categoryFilter
+ProductSortKey productSort
+PaymentMethod paymentMethod
+string paymentReceived
+string paymentReference
+string holdReference
+usePosStore store
+formatCurrency(symbol, value)
+completeSale()
+holdCurrentOrder()
+setViewAndMaybeCloseNav()
}
class usePosStore {
+LoadState loadState
+Product[] products
+Category[] categories
+Customer[] customers
+User[] users
+Settings settings
+Transaction[] transactions
+HeldOrder[] heldOrders
+SyncQueueItem[] syncQueue
+CartItem[] cart
+number discount
+string remarks
+string customerId
+User currentUser
+boolean forcedOffline
+boolean browserOnline
+Transaction lastReceipt
+boolean syncing
+FeatureFlags featureFlags
+TelemetryEvent[] telemetryEvents
+calculateCartTotals()
+completeSale()
+holdOrder()
+resumeHeldOrder()
+saveEntity()
+removeEntity()
+syncNow()
+refundTransaction()
+resetData()
+login()
}
class Calculations {
+money(value)
+calculateCartTotals(items, settings, discount)
+calculateChange(total, paid)
+decrementStock(products, cart)
+isLowStock(product)
+isExpired(product)
+isNearExpiry(product, threshold)
+makeLocalNumber(prefix)
}
PosPrototype --> usePosStore : "uses"
usePosStore --> Calculations : "utilizes"
```

**Diagram sources**
- [pos-prototype.tsx:58-427](file://web-prototype/src/components/pos-prototype.tsx#L58-L427)
- [use-pos-store.ts:51-433](file://web-prototype/src/lib/use-pos-store.ts#L51-L433)
- [calculations.ts:3-78](file://web-prototype/src/lib/calculations.ts#L3-L78)

### Data Flow Architecture

```mermaid
sequenceDiagram
participant User as "User"
participant POS as "POS Interface"
participant Store as "usePosStore"
participant DB as "IndexedDB"
participant Calc as "Calculations"
participant Sync as "Sync Queue"
User->>POS : Select Product
POS->>Store : addToCart(product)
Store->>Calc : calculateCartTotals()
Calc-->>Store : CartTotals
Store->>DB : Update cart state
DB-->>Store : Confirmation
User->>POS : Complete Sale
POS->>Store : completeSale(input)
Store->>Calc : calculateCartTotals()
Calc-->>Store : Totals
Store->>DB : Save transaction
Store->>Sync : enqueueSync(transaction)
Sync-->>Store : Queued
Store-->>POS : Transaction complete
```

**Diagram sources**
- [pos-prototype.tsx:142-152](file://web-prototype/src/components/pos-prototype.tsx#L142-L152)
- [use-pos-store.ts:206-260](file://web-prototype/src/lib/use-pos-store.ts#L206-L260)
- [calculations.ts:7-24](file://web-prototype/src/lib/calculations.ts#L7-L24)

### State Management Flow

```mermaid
flowchart TD
Start([Component Mount]) --> Boot["Boot Database<br/>Load Seed Data"]
Boot --> Ready{"Database Ready?"}
Ready --> |Yes| SetReady["Set Load State: ready"]
Ready --> |No| SetError["Set Load State: error"]
SetReady --> InitUser["Initialize Current User"]
InitUser --> Render["Render POS Interface"]
SetError --> ShowError["Show Error Message"]
Render --> UserAction{"User Action"}
UserAction --> |Add to Cart| UpdateCart["Update Cart State"]
UserAction --> |Complete Sale| ProcessSale["Process Payment"]
UserAction --> |Hold Order| HoldOrder["Save Held Order"]
UserAction --> |Sync Now| TriggerSync["Trigger Manual Sync"]
UpdateCart --> Persist["Persist to IndexedDB"]
ProcessSale --> SaveTransaction["Save Transaction"]
HoldOrder --> SaveHeld["Save Held Order"]
TriggerSync --> FlushQueue["Flush Sync Queue"]
Persist --> Refresh["Refresh State"]
SaveTransaction --> Refresh
SaveHeld --> Refresh
FlushQueue --> Refresh
Refresh --> Render
```

**Diagram sources**
- [use-pos-store.ts:109-141](file://web-prototype/src/lib/use-pos-store.ts#L109-L141)
- [db.ts:217-230](file://web-prototype/src/lib/db.ts#L217-L230)

**Section sources**
- [pos-prototype.tsx:58-427](file://web-prototype/src/components/pos-prototype.tsx#L58-L427)
- [use-pos-store.ts:51-433](file://web-prototype/src/lib/use-pos-store.ts#L51-L433)

## Dependency Analysis

### Technology Stack Dependencies

```mermaid
graph LR
subgraph "Runtime Dependencies"
A[Next.js 14+]
B[React 18+]
C[TypeScript]
end
subgraph "Development Dependencies"
D[Vitest]
E[Testing Library]
F[ESLint]
G[Prettier]
end
subgraph "Database Layer"
H[IndexedDB]
I[fake-indexeddb]
end
subgraph "UI Components"
J[Bootstrap]
K[Chosen Select]
L[jQuery UI]
end
A --> B
A --> C
D --> E
F --> G
H --> I
B --> J
B --> K
B --> L
```

**Diagram sources**
- [package.json:18-32](file://web-prototype/package.json#L18-L32)
- [tsconfig.json:2-29](file://web-prototype/tsconfig.json#L2-L29)

### Module Dependencies

The system maintains clean module boundaries with clear import relationships:

- **Components** depend only on their internal logic and shared types
- **Libraries** provide reusable business logic without UI concerns  
- **Data Layer** abstracts database operations behind simple APIs
- **Tests** validate behavior through isolated unit and integration tests

**Section sources**
- [package.json:1-34](file://web-prototype/package.json#L1-L34)
- [tsconfig.json:25-29](file://web-prototype/tsconfig.json#L25-L29)

## Performance Considerations

### Offline-First Design
The prototype implements a sophisticated offline-first architecture that ensures continuous operation regardless of network connectivity:

- **Automatic State Persistence**: All user interactions are immediately persisted to IndexedDB
- **Background Sync Queue**: Operations are queued and automatically synced when connectivity returns
- **Conflict Resolution**: Last-write-wins strategy with optimistic updates
- **Data Consistency**: Atomic transactions ensure data integrity during concurrent operations

### Memory Management
The application employs several strategies to maintain optimal performance:

- **Lazy Loading**: Components are loaded on-demand based on user navigation
- **Memoization**: Complex calculations and derived state are memoized to prevent unnecessary recomputation
- **Pagination**: Large datasets are paginated to limit DOM rendering overhead
- **Efficient Sorting**: Custom sorting algorithms optimized for product data

### Network Optimization
- **Connection Monitoring**: Real-time detection of network state changes
- **Conditional Sync**: Synchronization only occurs when feature flags permit
- **Batch Operations**: Multiple changes are batched to reduce network overhead
- **Progressive Enhancement**: Core functionality remains available even with limited connectivity

## Troubleshooting Guide

### Common Issues and Solutions

**Database Initialization Failures**
- Verify IndexedDB is supported in the browser
- Check for storage quota limitations
- Ensure proper CORS configuration for development
- Review browser console for specific error messages

**Synchronization Problems**
- Confirm feature flags are properly configured
- Check network connectivity status
- Review sync queue for pending operations
- Monitor console logs for sync error details

**Performance Issues**
- Clear browser cache and IndexedDB storage
- Disable unnecessary browser extensions
- Check for memory leaks in long sessions
- Monitor network latency and response times

### Debugging Tools

The application includes comprehensive observability features:

- **Telemetry Events**: Structured logging for all significant operations
- **Trace Spans**: Performance monitoring with timing data
- **Alert System**: Automated notifications for system health issues
- **Snapshot Generation**: Real-time system health metrics

**Section sources**
- [observability.ts:49-94](file://web-prototype/src/lib/observability.ts#L49-L94)
- [use-pos-store.ts:143-158](file://web-prototype/src/lib/use-pos-store.ts#L143-L158)

## Conclusion

The Next.js Web POS Prototype represents a comprehensive solution for modern pharmacy management, combining cutting-edge web technologies with practical business requirements. The architecture successfully balances offline-first capabilities with real-time synchronization, providing a robust foundation for enterprise-scale deployment.

Key strengths of the implementation include:

- **Modular Architecture**: Clean separation of concerns enables easy maintenance and extension
- **Type Safety**: Comprehensive TypeScript coverage ensures reliability and developer productivity  
- **Offline-First Design**: Reliable operation in challenging network environments
- **Extensive Testing**: Comprehensive test suite covering unit, integration, and contract testing
- **Observability**: Built-in monitoring and alerting for operational excellence

The prototype demonstrates proven patterns for POS system development while maintaining flexibility for future enhancements. Its foundation supports scalable deployment across multiple pharmacy locations with centralized management capabilities.