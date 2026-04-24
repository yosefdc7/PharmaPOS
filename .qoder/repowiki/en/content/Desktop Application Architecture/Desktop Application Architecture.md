# Desktop Application Architecture

<cite>
**Referenced Files in This Document**
- [package.json](file://package.json)
- [forge.config.js](file://forge.config.js)
- [app.config.js](file://app.config.js)
- [start.js](file://start.js)
- [server.js](file://server.js)
- [installers/setupEvents.js](file://installers/setupEvents.js)
- [assets/js/native_menu/menu.js](file://assets/js/native_menu/menu.js)
- [assets/js/native_menu/menuController.js](file://assets/js/native_menu/menuController.js)
- [assets/js/utils.js](file://assets/js/utils.js)
- [renderer.js](file://renderer.js)
- [index.html](file://index.html)
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
10. [Appendices](#appendices)

## Introduction
This document describes the Electron desktop application architecture for the Point of Sale system. It covers main process initialization, BrowserWindow creation, native menu system, Squirrel installer event handling, IPC communication patterns, window management, focus handling, multi-window coordination, and security considerations including CSP and privilege separation.

## Project Structure
The application follows a conventional Electron layout:
- Main process entry initializes the app, creates the main BrowserWindow, sets up the native menu, and handles Squirrel installer events.
- Renderer process loads the UI via index.html and initializes POS-related scripts.
- A local Express server runs embedded within the app to serve API endpoints.
- Native menu and controller modules encapsulate menu construction and actions such as backups, updates, and navigation.

```mermaid
graph TB
subgraph "Main Process"
A["start.js"]
B["server.js"]
C["installers/setupEvents.js"]
D["assets/js/native_menu/menu.js"]
E["assets/js/native_menu/menuController.js"]
end
subgraph "Renderer Process"
R["renderer.js"]
H["index.html"]
U["assets/js/utils.js"]
end
A --> D
A --> E
A --> B
A --> C
R --> H
R --> U
E --> B
```

**Diagram sources**
- [start.js:1-107](file://start.js#L1-L107)
- [server.js:1-68](file://server.js#L1-L68)
- [installers/setupEvents.js:1-65](file://installers/setupEvents.js#L1-L65)
- [assets/js/native_menu/menu.js:1-153](file://assets/js/native_menu/menu.js#L1-L153)
- [assets/js/native_menu/menuController.js:1-346](file://assets/js/native_menu/menuController.js#L1-L346)
- [renderer.js:1-5](file://renderer.js#L1-L5)
- [index.html:1-884](file://index.html#L1-L884)
- [assets/js/utils.js:1-112](file://assets/js/utils.js#L1-L112)

**Section sources**
- [package.json:1-147](file://package.json#L1-L147)
- [forge.config.js:1-71](file://forge.config.js#L1-L71)
- [start.js:1-107](file://start.js#L1-L107)
- [server.js:1-68](file://server.js#L1-L68)
- [installers/setupEvents.js:1-65](file://installers/setupEvents.js#L1-L65)
- [assets/js/native_menu/menu.js:1-153](file://assets/js/native_menu/menu.js#L1-L153)
- [assets/js/native_menu/menuController.js:1-346](file://assets/js/native_menu/menuController.js#L1-L346)
- [renderer.js:1-5](file://renderer.js#L1-L5)
- [index.html:1-884](file://index.html#L1-L884)
- [assets/js/utils.js:1-112](file://assets/js/utils.js#L1-L112)

## Core Components
- Main process entry and lifecycle:
  - Initializes Electron Remote and renderer store, handles Squirrel startup, sets up native menu, creates BrowserWindow, registers IPC handlers, and enables context menu.
- Embedded HTTP server:
  - Express server with rate limiting and CORS middleware, serving API routes under /api/.
- Native menu system:
  - Platform-aware menu template with File/Edit/View/Help sections, actions wired to controller functions.
- Backup and restore:
  - ZIP-based backup/restore with integrity verification and safe extraction.
- Auto-updater:
  - Uses electron-updater with custom feed URL and user prompts.
- Renderer initialization:
  - Loads jQuery and POS scripts, sets CSP dynamically.

**Section sources**
- [start.js:1-107](file://start.js#L1-L107)
- [server.js:1-68](file://server.js#L1-L68)
- [assets/js/native_menu/menu.js:1-153](file://assets/js/native_menu/menu.js#L1-L153)
- [assets/js/native_menu/menuController.js:1-346](file://assets/js/native_menu/menuController.js#L1-L346)
- [assets/js/utils.js:1-112](file://assets/js/utils.js#L1-L112)
- [renderer.js:1-5](file://renderer.js#L1-L5)

## Architecture Overview
The system comprises a main process controlling the app lifecycle and UI, a renderer process rendering the UI and interacting with APIs, and an embedded server providing backend services. IPC bridges the main and renderer processes for OS-level actions and app control.

```mermaid
graph TB
MP["Main Process<br/>start.js"]
MW["BrowserWindow<br/>mainWindow"]
NM["Native Menu<br/>menu.js + menuController.js"]
SRV["Embedded Server<br/>server.js"]
IPC["IPC Channels<br/>ipcMain/ipcRenderer"]
RND["Renderer Process<br/>renderer.js + index.html"]
UTL["Security Utilities<br/>utils.js"]
MP --> MW
MP --> NM
MP --> SRV
MP <- --> IPC
RND --> IPC
RND --> UTL
NM --> SRV
```

**Diagram sources**
- [start.js:1-107](file://start.js#L1-L107)
- [assets/js/native_menu/menu.js:1-153](file://assets/js/native_menu/menu.js#L1-L153)
- [assets/js/native_menu/menuController.js:1-346](file://assets/js/native_menu/menuController.js#L1-L346)
- [server.js:1-68](file://server.js#L1-L68)
- [renderer.js:1-5](file://renderer.js#L1-L5)
- [index.html:1-884](file://index.html#L1-L884)
- [assets/js/utils.js:1-112](file://assets/js/utils.js#L1-L112)

## Detailed Component Analysis

### Main Process Initialization and Lifecycle
- Initialization:
  - Electron Remote initialization and renderer store initialization.
  - Squirrel event handling short-circuits the app if Squirrel events are detected.
  - Embedded server module is required and native menu is built and set.
- Window creation:
  - Creates a BrowserWindow sized to the primary display work area, maximized, and loads index.html.
  - Enables Remote module for created windows.
- IPC channels:
  - Handles quit/reload and app restart triggers.
- Development:
  - Live reload enabled when not packaged.

```mermaid
sequenceDiagram
participant App as "Electron App"
participant Main as "start.js"
participant Win as "BrowserWindow"
participant Menu as "Native Menu"
participant Srv as "server.js"
App->>Main : "require('@electron/remote/main').initialize()"
Main->>Main : "require('./installers/setupEvents')"
Main->>Main : "require('./server')"
Main->>Menu : "buildFromTemplate(template)"
Menu-->>App : "setApplicationMenu(Menu)"
Main->>Win : "new BrowserWindow(...)"
Win-->>Main : "loadURL(index.html)"
Main->>Srv : "embedded HTTP server"
```

**Diagram sources**
- [start.js:1-107](file://start.js#L1-L107)
- [assets/js/native_menu/menu.js:1-153](file://assets/js/native_menu/menu.js#L1-L153)
- [server.js:1-68](file://server.js#L1-L68)

**Section sources**
- [start.js:1-107](file://start.js#L1-L107)

### BrowserWindow Creation and Web Preferences
- Window sizing uses the primary display work area.
- Web preferences include nodeIntegration and disable Remote module, with contextIsolation disabled.
- Focus and multi-window behavior:
  - On activate, a new window is created if none exists.
  - On window-all-closed, quits except on macOS.

```mermaid
flowchart TD
Start(["App Ready"]) --> Create["Create BrowserWindow<br/>workAreaSize"]
Create --> Maximize["Maximize Window"]
Maximize --> Load["Load index.html"]
Load --> Focus["Focus Management"]
Focus --> Multi{"Multiple Windows?"}
Multi --> |Yes| Coord["Coordinate via IPC"]
Multi --> |No| Single["Single Window Behavior"]
Coord --> Quit{"Quit Condition"}
Single --> Quit
Quit --> |macOS| Keep["Keep in Dock"]
Quit --> |Other| Exit["app.quit()"]
```

**Diagram sources**
- [start.js:21-45](file://start.js#L21-L45)

**Section sources**
- [start.js:21-65](file://start.js#L21-L65)

### Native Menu System Implementation
- Template composition:
  - Mac-specific About/Services/HIDE sections.
  - File menu with New (Product/Category/Customer), Backup/Restore, Logout, Close/Quit.
  - Edit menu with undo/redo/cut/copy/paste and platform-specific speech options.
  - View menu with navigation targets (POS/Transactions/Products/Settings), Refresh, DevTools (non-packaged), zoom, fullscreen.
  - Help menu with Documentation, Update check, About panel.
- Controller actions:
  - About panel configuration and display.
  - Update checks against a generic provider URL with user prompts and download/install.
  - Backup/restore dialogs and operations with integrity verification and safe extraction.
  - Click routing to renderer via IPC.

```mermaid
classDiagram
class MenuBuilder {
+template
+Menu
}
class MenuController {
+showAbout()
+checkForUpdates()
+saveBackupDialog()
+restoreBackupDialog()
+initializeMainWindow(win)
+handleClick(elementId)
}
class AutoUpdater {
+setFeedURL(opts)
+checkForUpdates()
+downloadUpdate()
+quitAndInstall()
}
class BackupRestore {
+createBackup(db, uploads, path)
+restoreBackup(zip, db, uploads)
}
MenuBuilder --> MenuController : "exports actions"
MenuController --> AutoUpdater : "uses"
MenuController --> BackupRestore : "uses"
```

**Diagram sources**
- [assets/js/native_menu/menu.js:1-153](file://assets/js/native_menu/menu.js#L1-L153)
- [assets/js/native_menu/menuController.js:1-346](file://assets/js/native_menu/menuController.js#L1-L346)

**Section sources**
- [assets/js/native_menu/menu.js:1-153](file://assets/js/native_menu/menu.js#L1-L153)
- [assets/js/native_menu/menuController.js:1-346](file://assets/js/native_menu/menuController.js#L1-L346)

### Squirrel Installer Event Handling
- Detects Squirrel events via argv and spawns Update.exe with appropriate arguments.
- Creates/removes shortcuts on install/updated/uninstall.
- Quits after spawning the updater or marks obsolete.

```mermaid
flowchart TD
Squirrel["argv length == 1?"] --> |Yes| Exit["return false"]
Squirrel --> |No| Parse["Parse squirrelEvent"]
Parse --> Install{"--squirrel-install/--squirrel-updated"}
Install --> CreateShortcuts["spawn Update.exe --createShortcut"]
CreateShortcuts --> Delay["setTimeout(app.quit, 1000)"]
Parse --> Uninstall{"--squirrel-uninstall"}
Uninstall --> RemoveShortcuts["spawn Update.exe --removeShortcut"]
RemoveShortcuts --> DelayU["setTimeout(app.quit, 1000)"]
Parse --> Obsolete{"--squirrel-obsolete"}
Obsolete --> Quit["app.quit()"]
```

**Diagram sources**
- [installers/setupEvents.js:1-65](file://installers/setupEvents.js#L1-L65)

**Section sources**
- [installers/setupEvents.js:1-65](file://installers/setupEvents.js#L1-L65)

### System Tray Integration
- Not implemented in the analyzed files. The application focuses on native menu, BrowserWindow, and IPC.

[No sources needed since this section does not analyze specific files]

### Platform-Specific Features
- Menu roles and platform awareness:
  - Mac-specific roles (About, Services, Hide, Quit).
  - Close vs Quit depending on platform.
- Development vs production:
  - DevTools toggle visible only when not packaged.
  - Live reload enabled outside packaged builds.

**Section sources**
- [assets/js/native_menu/menu.js:15-32](file://assets/js/native_menu/menu.js#L15-L32)
- [assets/js/native_menu/menu.js:115-117](file://assets/js/native_menu/menu.js#L115-L117)
- [start.js:100-104](file://start.js#L100-L104)

### IPC Communication Patterns
- Channels:
  - Renderer sends clicks to main via webContents IPC channel.
  - Main listens for app-quit, app-reload, restart-app.
- Usage:
  - Menu controller sends click-element events to renderer for UI actions.
  - Main process reloads the window on demand.

```mermaid
sequenceDiagram
participant Menu as "menuController.js"
participant Main as "start.js"
participant Renderer as "renderer.js"
Menu->>Main : "webContents.send('click-element', id)"
Main->>Main : "ipcMain.on('click-element', handler)"
Renderer->>Renderer : "listen for 'click-element'"
Main->>Main : "ipcMain.on('app-reload', () => mainWindow.reload())"
Main->>Main : "ipcMain.on('restart-app', () => autoUpdater.quitAndInstall())"
```

**Diagram sources**
- [assets/js/native_menu/menuController.js:331-333](file://assets/js/native_menu/menuController.js#L331-L333)
- [start.js:75-85](file://start.js#L75-L85)

**Section sources**
- [assets/js/native_menu/menuController.js:331-333](file://assets/js/native_menu/menuController.js#L331-L333)
- [start.js:75-85](file://start.js#L75-L85)

### Window Management, Focus Handling, and Multi-Window Coordination
- Window creation and maximize on launch.
- Focus behavior on macOS via activate event.
- Multi-window coordination via IPC for centralized control.

```mermaid
stateDiagram-v2
[*] --> Created
Created --> Maximized : "maximize()"
Maximized --> Focused : "show()"
Focused --> Closed : "closed event"
Closed --> [*]
Focused --> Activated : "activate (macOS)"
Activated --> Created : "createWindow()"
```

**Diagram sources**
- [start.js:21-45](file://start.js#L21-L45)
- [start.js:61-65](file://start.js#L61-L65)

**Section sources**
- [start.js:21-45](file://start.js#L21-L45)
- [start.js:61-65](file://start.js#L61-L65)

### Security Considerations
- Content Security Policy (CSP):
  - Dynamically computed hashes for bundled JS/CSS injected as a meta tag.
  - Connects to localhost on the server port.
- Privilege separation:
  - nodeIntegration enabled with contextIsolation disabled in main process; renderer uses CSP and DOMPurify for sanitization.
- File integrity:
  - Backup/restore validates SHA256 and prevents directory traversal.

```mermaid
flowchart TD
CSP["Compute bundle hashes"] --> Meta["Inject CSP meta tag"]
Meta --> Render["Renderer loads with CSP"]
Render --> API["Connect to localhost:PORT"]
Backup["Backup/Restore"] --> Integrity["Verify SHA256"]
Integrity --> Extract["Safe extraction"]
```

**Diagram sources**
- [assets/js/utils.js:91-99](file://assets/js/utils.js#L91-L99)
- [start.js:29-33](file://start.js#L29-L33)
- [assets/js/native_menu/menuController.js:142-184](file://assets/js/native_menu/menuController.js#L142-L184)
- [assets/js/native_menu/menuController.js:195-251](file://assets/js/native_menu/menuController.js#L195-L251)

**Section sources**
- [assets/js/utils.js:91-99](file://assets/js/utils.js#L91-L99)
- [start.js:29-33](file://start.js#L29-L33)
- [assets/js/native_menu/menuController.js:142-184](file://assets/js/native_menu/menuController.js#L142-L184)
- [assets/js/native_menu/menuController.js:195-251](file://assets/js/native_menu/menuController.js#L195-L251)

## Dependency Analysis
- Build and packaging:
  - Electron Forge makers for Windows (Squirrel/WIX), Linux (DEB/RPM), macOS (DMG).
- Runtime dependencies:
  - Express server, rate limiting, body parser, socket.io, bcrypt, NeDB, archiver, unzipper, and others.
- Main-to-renderer coupling:
  - Renderer depends on jQuery and POS scripts; main process exposes IPC channels and native menu actions.

```mermaid
graph TB
P["package.json"]
F["forge.config.js"]
M["start.js"]
S["server.js"]
N["native_menu/*.js"]
R["renderer.js"]
U["utils.js"]
P --> F
M --> S
M --> N
R --> U
N --> S
```

**Diagram sources**
- [package.json:1-147](file://package.json#L1-L147)
- [forge.config.js:1-71](file://forge.config.js#L1-L71)
- [start.js:1-107](file://start.js#L1-L107)
- [server.js:1-68](file://server.js#L1-L68)
- [assets/js/native_menu/menu.js:1-153](file://assets/js/native_menu/menu.js#L1-L153)
- [assets/js/native_menu/menuController.js:1-346](file://assets/js/native_menu/menuController.js#L1-L346)
- [renderer.js:1-5](file://renderer.js#L1-L5)
- [assets/js/utils.js:1-112](file://assets/js/utils.js#L1-L112)

**Section sources**
- [package.json:1-147](file://package.json#L1-L147)
- [forge.config.js:1-71](file://forge.config.js#L1-L71)
- [start.js:1-107](file://start.js#L1-L107)
- [server.js:1-68](file://server.js#L1-L68)
- [assets/js/native_menu/menu.js:1-153](file://assets/js/native_menu/menu.js#L1-L153)
- [assets/js/native_menu/menuController.js:1-346](file://assets/js/native_menu/menuController.js#L1-L346)
- [renderer.js:1-5](file://renderer.js#L1-L5)
- [assets/js/utils.js:1-112](file://assets/js/utils.js#L1-L112)

## Performance Considerations
- Packaging:
  - ASAR enabled for builds to improve load times and protect resources.
- Server:
  - Rate limiting reduces API abuse; consider caching for static assets.
- Renderer:
  - Minimize DOM manipulation; batch updates and leverage virtualization for large lists.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Squirrel installer issues:
  - Verify Update.exe path and shortcut creation/removal commands.
- Auto-update failures:
  - Confirm feed URL and network connectivity; handle retry logic and error dialogs.
- Backup/restore errors:
  - Ensure ZIP integrity and directory traversal prevention; validate paths and permissions.
- IPC communication:
  - Ensure channels are registered in main and handled in renderer; verify event names.

**Section sources**
- [installers/setupEvents.js:1-65](file://installers/setupEvents.js#L1-L65)
- [assets/js/native_menu/menuController.js:52-132](file://assets/js/native_menu/menuController.js#L52-L132)
- [assets/js/native_menu/menuController.js:195-251](file://assets/js/native_menu/menuController.js#L195-L251)
- [start.js:75-85](file://start.js#L75-L85)

## Conclusion
The application employs a clear separation between main and renderer processes, with a robust embedded server, native menu system, and IPC-driven control. Security is addressed through CSP and integrity checks, while Squirrel integration ensures smooth installation and updates. The architecture supports multi-window coordination and platform-specific UX.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices
- Configuration references:
  - App configuration constants for update server and copyright year.
  - Forge makers and publishers for cross-platform distribution.

**Section sources**
- [app.config.js:1-8](file://app.config.js#L1-L8)
- [forge.config.js:21-51](file://forge.config.js#L21-L51)