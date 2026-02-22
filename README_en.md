# Fubako (フバコ)

Static Site Management Tool - Electron + Vue 3 + Zola

## Overview

Fubako is a desktop application for managing Zola-based static sites via a GUI.
It provides a "blog-like" interface that allows even non-engineers to easily update content.

## Main Features

- **Project Management** — Open and manage Zola project folders. Quick access from history.
- **Content Editing** — Dynamic form generation compatible with Markdown front matter. Manage content by types such as News, Case Studies, Services, and Static Pages.
- **Image Management** — Upload (UUID + Year/Month folders), resizing (Sharp integration), and dummy image generation.
- **Live Preview** — Real-time preview integrated with Zola's `serve` command. Multi-language (Japanese) build error display.
- **Site Settings** — GUI editing of `config.toml` based on `site-config.yml`.
- **Slug Collision Detection** — Pre-detect and automatically fix Zola path collisions.
- **Git/GitHub Integration** — Save (Commit), Sync (Push/Pull), GitHub Device Flow authentication, and automatic generation of GitHub Pages deployment settings.

## Preparation

### Placing the Zola Binary

To run Fubako in a development environment, you need the Zola binary.

1. Download it from the [Zola official website](https://www.getzola.org/documentation/getting-started/installation/).
2. Place it in the `bin/` directory:
   - Windows: `bin/zola.exe`
   - macOS/Linux: `bin/zola`

## Development Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

This will launch both:
- Vite development server (http://localhost:5173)
- Electron app

### 3. Production Build

```bash
npm run build
```

### 4. Open Sample Project

After launching the app, click the "Open Project" button and select the `sample-site` folder.
This sample project represents a corporate site with three content types (News, Case Studies, Services) and fixed pages (About, Careers, Privacy Policy).

## Architecture

```
Electron Main Process (CommonJS)
  ├── electron/main.cjs            # Window creation, IPC registration, Zola process management
  ├── electron/preload.cjs         # Exposes electronAPI via contextBridge
  ├── electron/contentManager.cjs  # Markdown R/W, Front matter parsing
  ├── electron/imageManager.cjs    # Image upload, resizing, dummy generation
  └── electron/configManager.cjs   # config.toml (TOML) R/W

Renderer Process (Vue 3, ES Modules)
  ├── src/App.vue                  # Root component
  ├── src/stores/project.js        # Pinia store (Project state, preview control)
  ├── src/router/index.js          # Routing definitions
  ├── src/views/
  │   ├── HomeView.vue             # Dashboard
  │   ├── ProjectView.vue          # Project management
  │   ├── ContentsListView.vue     # Content list
  │   ├── EditView.vue             # Content creation/editing
  │   └── SettingsView.vue         # Site settings
  └── src/components/
      ├── PreviewPanel.vue         # Preview iframe
      └── PreviewStatus.vue        # Preview status display
```

### IPC Communication

Communication between Main and Renderer processes is exposed as `window.electronAPI` via `preload.cjs` using `contextBridge`. Node Integration is disabled (`contextIsolation=true`).

### Data Flow

1. **Project Loading**: Folder selection → `site-config.yml` parsing → Save to Pinia store.
2. **Content Editing**: Load Markdown → YAML Front matter to Form → Edit → File write.
3. **Preview**: Spawn `zola serve` → Monitor stderr → Display in iframe.
4. **Image Upload**: File selection → UUID generation → Copy to `static/uploads/YYYY/MM/`.

## Project Structure

```
Fubako/
├── electron/            # Electron main process (.cjs = CommonJS)
├── src/                 # Vue application (ES Modules)
│   ├── views/           # Page components
│   ├── components/      # Common components
│   ├── stores/          # Pinia stores
│   └── router/          # Vue Router configuration
├── sample-site/         # Sample Zola project
│   ├── site-config.yml  # Fubako configuration file
│   ├── config.toml      # Zola configuration file
│   ├── content/         # Content (Markdown)
│   ├── templates/       # Tera templates
│   └── sass/            # Stylesheets
├── bin/                 # Zola binary location
└── docs/                # Design documents
```

## site-config.yml

The `site-config.yml` in each Zola project defines how Fubako behaves.
It includes content types, form field definitions, list column definitions, and site settings groups.

Supported field types: `text`, `textarea`, `date`, `toggle`, `select`, `image`, `gallery`, `list`, `markdown`.

## Roadmap

### Phase 1 (MVP) — Core Features ✅ Completed

| # | Feature | Status | Description |
| --- | ------ | ------ | ------ |
| 1 | Markdown R/W | ✅ Done | YAML Front matter parsing and saving. Handled by `contentManager.cjs`. |
| 2 | Image Management | ✅ Done | UUID + Year/Month management, resizing (Sharp), dummy image generation. |
| 3 | Preview Feature | ✅ Done | `zola serve` integration, stderr error parsing (Japanese), iframe display. |
| 4 | Content list/edit | ✅ Done | Dynamic form generation via `site-config.yml`, sorting, filtering. |
| 5 | Slug Collision | ✅ Done | Pre-detect and batch-correct duplicate slugs to prevent build errors. |
| 6 | Site Settings GUI | ✅ Done | Edit major `config.toml` items via GUI. |

### Phase 2 — Operations & Deployment ✅ Completed

| # | Feature | Status | Description |
| --- | ------ | ------ | ------ |
| 7 | GitHub Integration | ✅ Done | Device Flow auth, repo initialization, intuitive Commit & Push. |
| 8 | Deployment Config | ✅ Done | Automatic generation of deployment pipelines (GitHub Actions) for GitHub Pages. |
| 9 | Conflict Resolution | ✅ Done | Simple GUI-based conflict resolution (Ours vs. Theirs). |
| 10 | Site Export | ✅ Done | Export static build results as a ZIP file. |

### Phase 3 — Quality Improvements 🚧 In Progress

| # | Feature | Status | Description |
| --- | ------ | ------ | ------ |
| 11 | SEO Settings UI | ⏳ To Do | GUI settings for meta tags and OGP. |
| 12 | Media Library | ⏳ Pending | UI for listing, searching, and reusing uploaded images. |
| 13 | Taxonomies | 🚧 Developing | GUI management for categories and tags. |
| 14 | Packaging | ⏳ Planned | Installer distribution via electron-builder (Win/Mac). |

## Tech Stack

- **Electron** 28.x — Desktop app framework
- **Vue 3** — Frontend framework
- **Vite** (rolldown-vite) — Build tool
- **Pinia** — State management
- **Vue Router** — Routing
- **Zola** — Static site generator
- **Sharp** — Image resizing
- **js-yaml** — YAML parser
- **@iarna/toml** — TOML parser

## Documentation

For detailed design documents, please refer to the `docs/` directory:

- `ARCHITECTURE.md` — Architecture and functional design
- `CONFIG.md` — site-config.yml specification
- `DATA_SCHEMA.md` — Data structure definition
- `fubako_designDoc.md` — Basic design
- `theme.md` — Theme creation guide
- `IMAGE_REQUIREMENTS.md` — Image functional requirements

## License

MIT
