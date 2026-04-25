# Shared Memory Coordination Protocol

<cite>
**Referenced Files in This Document**
- [README.md](file://shared-memory/README.md)
- [state.md](file://shared-memory/state.md)
- [open-items.md](file://shared-memory/open-items.md)
- [activity-log.ndjson](file://shared-memory/activity-log.ndjson)
- [use-pos-store.ts](file://web-prototype/src/lib/use-pos-store.ts)
- [db.ts](file://web-prototype/src/lib/db.ts)
- [types.ts](file://web-prototype/src/lib/types.ts)
- [observability.ts](file://web-prototype/src/lib/observability.ts)
- [feature-flags.ts](file://web-prototype/src/lib/feature-flags.ts)
- [seed.ts](file://web-prototype/src/lib/seed.ts)
- [calculations.ts](file://web-prototype/src/lib/calculations.ts)
- [pos-prototype.tsx](file://web-prototype/src/components/pos-prototype.tsx)
- [sync-backlog.md](file://web-prototype/docs/runbooks/sync-backlog.md)
- [terminal-mismatch.md](file://web-prototype/docs/runbooks/terminal-mismatch.md)
- [register-outage.md](file://web-prototype/docs/runbooks/register-outage.md)
- [rollback.md](file://web-prototype/docs/runbooks/rollback.md)
- [observability.md](file://web-prototype/docs/observability.md)
- [rollout-strategy.md](file://web-prototype/docs/rollout-strategy.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Protocol Overview](#protocol-overview)
3. [Shared Memory Files](#shared-memory-files)
4. [Web POS Integration](#web-pos-integration)
5. [Observability and Monitoring](#observability-and-monitoring)
6. [Runbook Procedures](#runbook-procedures)
7. [Deployment Strategy](#deployment-strategy)
8. [Conflict Resolution](#conflict-resolution)
9. [Recovery Procedures](#recovery-procedures)
10. [Best Practices](#best-practices)

## Introduction

The Shared Memory Coordination Protocol is a file-based coordination system designed to enable multiple AI agents (Codex, Antigravity, Gemini, Claude, Cursor, Qoder) to work collaboratively on the same codebase without losing context or stepping on each other's work. This protocol establishes a standardized way for agents to share state, track work items, and coordinate their activities through a simple, human-readable file system interface.

The system operates on the principle of explicit file sharing where each agent reads and writes to designated files that serve as the single source of truth for coordination. This approach ensures transparency, auditability, and easy recovery mechanisms while maintaining simplicity for both human and AI agents to understand and interact with.

## Protocol Overview

The Shared Memory Coordination Protocol consists of four primary files that work together to maintain shared understanding and coordinate agent activities:

```mermaid
graph TB
subgraph "Shared Memory Files"
SM1[state.md<br/>Current Truth]
SM2[open-items.md<br/>Work Items]
SM3[changelog.md<br/>Change History]
SM4[activity-log.ndjson<br/>Operational Log]
end
subgraph "Agent Workflows"
A1[Reading State]
A2[Claiming Items]
A3[Executing Tasks]
A4[Updating Records]
end
subgraph "Validation Layer"
V1[Conflict Detection]
V2[Reconciliation]
V3[Recovery Mechanisms]
end
SM1 --> A1
SM2 --> A2
SM3 --> A4
SM4 --> A4
A1 --> A2
A2 --> A3
A3 --> A4
A4 --> V1
V1 --> V2
V2 --> V3
```

**Diagram sources**
- [README.md:7-13](file://shared-memory/README.md#L7-L13)
- [README.md:15-26](file://shared-memory/README.md#L15-L26)

The protocol follows a strict workflow pattern where agents must read the current state before starting work, claim specific items from the open-items list, execute their tasks, and then update all relevant coordination files upon completion. This ensures that no agent works on items that are already being processed by another agent.

## Shared Memory Files

### State Management (`state.md`)

The `state.md` file serves as the current truth repository, containing all essential information that agents need to understand the project's current status and direction. It follows a structured format with specific sections that must always be present:

```mermaid
flowchart TD
Start([Agent Reads State]) --> Context[Read Context Section]
Context --> Preferences[Review User Preferences]
Preferences --> Decisions[Examine Active Decisions]
Decisions --> Blockers[Check for Blockers]
Blockers --> NextAction[Determine Next Action]
NextAction --> End([Ready to Claim Work])
Context --> Distill[Distill Context if Too Long]
Distill --> End
Decisions --> Distill
Blockers --> Distill
```

**Diagram sources**
- [README.md:30-41](file://shared-memory/README.md#L30-L41)

The state file maintains four critical sections:
- **Context**: Current project situation and immediate priorities
- **User Preferences**: User-defined constraints and guidelines
- **Active Decisions**: Finalized project decisions and agreements
- **Blockers**: Current obstacles and their causes
- **Next Action**: Specific tasks for the next agent to pick up

### Work Item Tracking (`open-items.md`)

The `open-items.md` file maintains a comprehensive list of all work items, their status, and ownership. Each item follows a specific format with status indicators and metadata:

```mermaid
classDiagram
class OpenItem {
+string status
+string description
+string owner
+string priority
+string claimedBy
+string claimedAt
+string completedBy
+string completedAt
}
class StatusIndicator {
+string unclaimed "[ ]"
+string inProgress "[~]"
+string completed "[x]"
}
class PriorityLevel {
+string high
+string medium
+string low
}
OpenItem --> StatusIndicator
OpenItem --> PriorityLevel
```

**Diagram sources**
- [README.md:64-75](file://shared-memory/README.md#L64-L75)

Item statuses include:
- `[ ]` Unclaimed items available for pickup
- `[~]` In-progress items currently being worked on
- `[x]` Completed items with completion metadata

### Change History (`changelog.md`)

The `changelog.md` file maintains a chronological record of significant changes to the shared understanding, providing historical context for decision-making and conflict resolution:

```mermaid
sequenceDiagram
participant Agent as Agent
participant State as state.md
participant Changelog as changelog.md
participant Activity as activity-log.ndjson
Agent->>State : Update shared understanding
Agent->>Changelog : Add dated entry
Agent->>Activity : Append operational log entry
Agent->>Agent : Commit with agent-tagged message
```

**Diagram sources**
- [README.md:42-50](file://shared-memory/README.md#L42-L50)

Each entry includes:
- Date and agent identifier
- Type of change (Added/Changed/Fixed/Removed)
- Brief description of the change
- Reason for the change

### Operational Logging (`activity-log.ndjson`)

The `activity-log.ndjson` file provides an append-only operational log of all meaningful actions taken by agents, serving as an audit trail and recovery mechanism:

```mermaid
erDiagram
ACTIVITY_LOG {
string ts
string agent
string action
string target
string summary
array refs
}
TELEMETRY_EVENT {
string ts
string type
json details
}
SYNC_QUEUE_ITEM {
string id
string entity
string operation
json payload
string createdAt
string status
number retryCount
string lastError
}
ACTIVITY_LOG ||--o{ TELEMETRY_EVENT : "records"
ACTIVITY_LOG ||--o{ SYNC_QUEUE_ITEM : "references"
```

**Diagram sources**
- [README.md:52-62](file://shared-memory/README.md#L52-L62)

The log format includes:
- UTC ISO-8601 timestamps
- Agent identification
- Action types and targets
- Summary descriptions
- Reference pointers to related items

**Section sources**
- [README.md:1-85](file://shared-memory/README.md#L1-L85)

## Web POS Integration

The Shared Memory Protocol integrates seamlessly with the Web POS prototype through several key components that demonstrate practical application of the coordination principles:

### POS Store Architecture

The POS store implementation showcases how the shared memory concepts translate into real-world state management:

```mermaid
classDiagram
class PosStore {
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
+boolean online
+boolean syncing
+FeatureFlags featureFlags
+TelemetryEvent[] telemetryEvents
+addToCart()
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
class DatabaseLayer {
+getAll()
+getOne()
+putOne()
+putMany()
+deleteOne()
+enqueueSync()
+markPendingSyncAsSynced()
+seedIfNeeded()
+resetPrototypeData()
}
class ObservabilityLayer {
+recordEvent()
+logStructured()
+traced()
+buildSnapshot()
+evaluateAlerts()
}
PosStore --> DatabaseLayer : "uses"
PosStore --> ObservabilityLayer : "integrates"
```

**Diagram sources**
- [use-pos-store.ts:51-432](file://web-prototype/src/lib/use-pos-store.ts#L51-L432)
- [db.ts:99-240](file://web-prototype/src/lib/db.ts#L99-L240)

### Real-time State Synchronization

The POS system demonstrates real-time state synchronization through its IndexedDB-backed architecture:

```mermaid
sequenceDiagram
participant UI as POS UI
participant Store as usePosStore
participant DB as IndexedDB
participant Sync as SyncQueue
participant Observability as Observability
UI->>Store : User Action
Store->>DB : Write Local Changes
Store->>Sync : Enqueue Sync Item
Store->>Observability : Record Telemetry
Store->>UI : Update State
Note over Store,DB : Local IndexedDB Persistence
Store->>Sync : Periodic Sync Flush
Sync->>DB : Mark Synced
Store->>UI : Reflect Sync Status
```

**Diagram sources**
- [use-pos-store.ts:206-260](file://web-prototype/src/lib/use-pos-store.ts#L206-L260)
- [db.ts:186-215](file://web-prototype/src/lib/db.ts#L186-L215)

### Feature Flag Management

The system implements a sophisticated feature flag system that aligns with the shared memory coordination principles:

```mermaid
flowchart LR
subgraph "Feature Flags"
FF1[sync: false]
FF2[payments: false]
FF3[refunds: false]
end
subgraph "Runtime Control"
RC1[Meta Store]
RC2[Default Values]
RC3[Merge Logic]
end
subgraph "Environment Gates"
EG1[Development]
EG2[Staging]
EG3[Production]
end
FF1 --> RC1
FF2 --> RC1
FF3 --> RC1
RC1 --> RC2
RC2 --> RC3
RC3 --> EG1
RC3 --> EG2
RC3 --> EG3
```

**Diagram sources**
- [feature-flags.ts:1-17](file://web-prototype/src/lib/feature-flags.ts#L1-L17)
- [db.ts:175-184](file://web-prototype/src/lib/db.ts#L175-L184)

**Section sources**
- [use-pos-store.ts:1-434](file://web-prototype/src/lib/use-pos-store.ts#L1-L434)
- [db.ts:1-241](file://web-prototype/src/lib/db.ts#L1-L241)
- [types.ts:1-126](file://web-prototype/src/lib/types.ts#L1-L126)
- [feature-flags.ts:1-17](file://web-prototype/src/lib/feature-flags.ts#L1-L17)

## Observability and Monitoring

The Web POS prototype implements comprehensive observability that complements the shared memory coordination system:

### Telemetry Event System

The observability layer captures structured telemetry for all critical operations:

```mermaid
classDiagram
class TelemetryEvent {
+string ts
+string type
+Record~string,unknown~ details
}
class EventTypes {
+string sync_enqueued
+string sync_completed
+string sync_failed
+string mutation_failed
+string payment_attempt
+string network_state
+string order_completed
}
class ObservabilitySnapshot {
+string capturedAt
+number syncLagSeconds
+number queueDepth
+number failedMutations15m
+number paymentFailureRate15m
+number offlineDurationSeconds
+number orderThroughputPerHour
}
class Alert {
+string id
+string severity
+string summary
+string runbook
}
TelemetryEvent --> EventTypes
ObservabilitySnapshot --> TelemetryEvent
Alert --> ObservabilitySnapshot
```

**Diagram sources**
- [observability.ts:3-40](file://web-prototype/src/lib/observability.ts#L3-L40)

### SLO-Based Alerting

The system implements Service Level Objective (SLO) based alerting that triggers runbook procedures:

```mermaid
flowchart TD
subgraph "SLO Targets"
S1[Sync Lag ≤ 300s]
S2[Queue Depth ≤ 25]
S3[Failed Mutations ≤ 5/15m]
S4[Payment Failure ≤ 5%]
S5[Offline Duration ≤ 900s]
S6[Throughput ≥ 12/hr]
end
subgraph "Alert Generation"
A1[Sync Backlog]
A2[Payment Spike]
A3[Mutation Failures]
A4[Offline Duration]
A5[Throughput Drop]
end
subgraph "Runbook Execution"
R1[Sync Backlog Runbook]
R2[Terminal Mismatch Runbook]
R3[Register Outage Runbook]
R4[Rollback Runbook]
end
S1 --> A1
S2 --> A1
S3 --> A3
S4 --> A2
S5 --> A4
S6 --> A5
A1 --> R1
A2 --> R2
A3 --> R3
A4 --> R3
A5 --> R3
```

**Diagram sources**
- [observability.ts:96-103](file://web-prototype/src/lib/observability.ts#L96-L103)
- [observability.ts:146-195](file://web-prototype/src/lib/observability.ts#L146-L195)

**Section sources**
- [observability.ts:1-196](file://web-prototype/src/lib/observability.ts#L1-L196)
- [observability.md:1-35](file://web-prototype/docs/observability.md#L1-L35)

## Runbook Procedures

The system includes comprehensive runbooks for incident response and recovery:

### Sync Backlog Management

When the sync queue grows beyond acceptable limits, the sync-backlog runbook provides structured response procedures:

```mermaid
flowchart TD
Start([Sync Backlog Alert]) --> Verify[Verify Connectivity]
Verify --> Online{Online?}
Online --> |Yes| ForceSync[Force Sync Now]
Online --> |No| CheckNetwork[Check Network Status]
ForceSync --> Monitor[Monitor Queue Progress]
CheckNetwork --> CheckLogs[Check Console Logs]
Monitor --> Identify[Identify Problem Type]
CheckLogs --> Identify
Identify --> Decision{Backlog Growing?}
Decision --> |Yes| Freeze[Freeze Non-essential Edits]
Decision --> |No| Validate[Validate Recovery]
Freeze --> Escalate[Escalate if Needed]
Validate --> End([Backlog Recovered])
Escalate --> End
```

**Diagram sources**
- [sync-backlog.md:12-24](file://web-prototype/docs/runbooks/sync-backlog.md#L12-L24)

### Terminal Mismatch Resolution

For payment-related issues, the terminal-mismatch runbook provides systematic troubleshooting:

```mermaid
flowchart TD
Start([Payment Spike Alert]) --> Compare[Compare POS References]
Compare --> Validate[Validate Terminal Profile]
Validate --> Fallback[Route to Cash Fallback]
Fallback --> Test[Test Terminal Transaction]
Test --> Decision{Mismatch Persists?}
Decision --> |Yes| Capture[Capture Sample References]
Decision --> |No| Validate[Validate Recovery]
Capture --> Escalate[Escalate to Payments Support]
Validate --> End([Issue Resolved])
Escalate --> End
```

**Diagram sources**
- [terminal-mismatch.md:12-24](file://web-prototype/docs/runbooks/terminal-mismatch.md#L12-L24)

### Register Outage Response

For critical system failures, the register-outage runbook provides emergency procedures:

```mermaid
flowchart TD
Start([Critical Alert]) --> Single{Single Register?}
Single --> Multi{Multi-register?}
Single --> Offline[Switch to Offline Mode]
Multi --> Offline
Offline --> Restart[Restart POS Session]
Restart --> Test[Test Sale]
Test --> Decision{Resolved?}
Decision --> |Yes| Validate[Validate Recovery]
Decision --> |No| Failover[Failover to Backup Register]
Failover --> Escalate[Escalate to Engineering]
Validate --> End([System Restored])
Escalate --> End
```

**Diagram sources**
- [register-outage.md:12-24](file://web-prototype/docs/runbooks/register-outage.md#L12-L24)

**Section sources**
- [sync-backlog.md:1-25](file://web-prototype/docs/runbooks/sync-backlog.md#L1-L25)
- [terminal-mismatch.md:1-25](file://web-prototype/docs/runbooks/terminal-mismatch.md#L1-L25)
- [register-outage.md:1-25](file://web-prototype/docs/runbooks/register-outage.md#L1-L25)
- [rollback.md:1-25](file://web-prototype/docs/runbooks/rollback.md#L1-L25)

## Deployment Strategy

The rollout strategy ensures safe deployment of changes while maintaining system stability:

```mermaid
flowchart LR
subgraph "Deployment Pipeline"
P1[Preview Environment]
P2[Staging Environment]
P3[Production Environment]
end
subgraph "Quality Gates"
G1[Type Checking]
G2[Unit Tests]
G3[Integration Tests]
G4[Contract Tests]
G5[Security Scans]
end
subgraph "Rollback Verification"
R1[Feature Flag Testing]
R2[Smoke Testing]
R3[Regression Testing]
end
P1 --> G1
G1 --> P2
G2 --> P2
G3 --> P2
G4 --> P2
G5 --> P2
P2 --> R1
R1 --> P3
R2 --> P3
R3 --> P3
```

**Diagram sources**
- [rollout-strategy.md:3-22](file://web-prototype/docs/rollout-strategy.md#L3-L22)

The strategy emphasizes:
- **Three-tier deployment**: Preview → Staging → Production
- **Additive migrations**: Expand capabilities before reducing
- **Feature flag control**: Safe incremental feature activation
- **Rollback verification**: Automated testing of rollback procedures

**Section sources**
- [rollout-strategy.md:1-23](file://web-prototype/docs/rollout-strategy.md#L1-L23)

## Conflict Resolution

The protocol includes robust mechanisms for detecting and resolving conflicts between concurrent agents:

### Conflict Detection

Conflicts are detected through multiple validation mechanisms:

```mermaid
flowchart TD
Start([Agent Attempts Work]) --> ReadState[Read Current State]
ReadState --> CheckItem[Check Item Status]
CheckItem --> Status{Item Status}
Status --> |In Progress| Wait[Wait for Completion]
Status --> |Completed| Validate[Validate Context]
Status --> |Unclaimed| Claim[Claim Item]
Claim --> Execute[Execute Task]
Execute --> UpdateFiles[Update Coordination Files]
UpdateFiles --> End([Task Complete])
Wait --> Monitor[Monitor Progress]
Monitor --> Status
```

**Diagram sources**
- [README.md:76-81](file://shared-memory/README.md#L76-L81)

### Recovery Mechanisms

When conflicts occur, the system provides multiple recovery pathways:

1. **State Reconciliation**: Agents can reconcile state by examining recent activity logs and changelog entries
2. **Manual Intervention**: Human oversight can override automated processes when necessary
3. **Rollback Procedures**: Feature flags and deployment strategies enable safe rollbacks
4. **Audit Trails**: Comprehensive logging enables forensic analysis of conflicts

**Section sources**
- [README.md:82-85](file://shared-memory/README.md#L82-L85)

## Recovery Procedures

The system implements comprehensive recovery procedures for various failure scenarios:

### State File Recovery

When `state.md` becomes inconsistent, recovery follows a systematic approach:

```mermaid
flowchart TD
Start([State File Stale]) --> Examine[Examine Recent Activity]
Examine --> Review[Review Changelog Entries]
Review --> Reconcile[Reconcile State Changes]
Reconcile --> Update[Update State File]
Update --> Document[Document Recovery]
Document --> Validate[Validate Recovery]
Validate --> End([System Stable])
```

**Diagram sources**
- [README.md:82-85](file://shared-memory/README.md#L82-L85)

### Data Integrity Validation

The system validates data integrity through multiple checkpoints:

1. **Consistency Checks**: Cross-reference between state, open-items, and activity logs
2. **Transaction Validation**: Verify sync queue completeness and accuracy
3. **Audit Verification**: Confirm all changes have appropriate activity log entries
4. **Historical Review**: Validate changes against documented decision history

### Emergency Procedures

For critical system failures, emergency procedures ensure rapid recovery:

```mermaid
flowchart TD
Critical[Critical Failure] --> Isolate[Isolate Affected Systems]
Isolate --> Assess[Assess Damage Scope]
Assess --> Restore[Restore from Known Good State]
Restore --> Validate[Validate System Integrity]
Validate --> Monitor[Monitor Recovery Progress]
Monitor --> Resume[Resume Normal Operations]
```

**Section sources**
- [README.md:82-85](file://shared-memory/README.md#L82-L85)

## Best Practices

### Agent Development Guidelines

Agents working with the Shared Memory Protocol should follow these best practices:

1. **Always Read Before Write**: Agents must read current state files before attempting any modifications
2. **Explicit Claims**: Items must be explicitly claimed before work begins
3. **Atomic Updates**: Changes to coordination files should be atomic to prevent corruption
4. **Clear Documentation**: All changes should include clear, concise summaries
5. **Minimal Impact**: Changes should be scoped to minimize disruption to other agents

### File Format Standards

The protocol maintains strict standards for file formatting:

- **Markdown Consistency**: State and open-items files use consistent markdown formatting
- **JSON Structure**: Activity logs follow strict JSON formatting with required fields
- **Timestamp Precision**: All timestamps use UTC ISO-8601 format with millisecond precision
- **Agent Tagging**: All commits include explicit agent identification

### Communication Protocols

Agents should communicate through the shared memory system:

- **Public Discussions**: Major decisions are documented in state.md
- **Private Notes**: Agent-specific notes can be added as comments
- **Status Updates**: Regular updates to open-items.md reflect current progress
- **Emergency Alerts**: Critical issues trigger immediate notifications

### Quality Assurance

The system includes built-in quality assurance mechanisms:

- **Automated Validation**: Schema validation for all coordination files
- **Cross-Reference Checks**: Consistency validation between related files
- **Audit Trail**: Complete history of all changes for accountability
- **Recovery Testing**: Regular testing of recovery procedures and rollback scenarios

**Section sources**
- [README.md:28-85](file://shared-memory/README.md#L28-L85)