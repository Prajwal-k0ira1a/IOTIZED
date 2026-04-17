# PLOTTER_OS v1.0 (IOTIZED)

A highly responsive, web-based control interface designed for CNC machines, pen plotters, and digital fabrication units. Built with **React** and **Vite**, PLOTTER_OS offers an industrial-grade dark mode aesthetic and advanced manual motion control capabilities, designed to act as the primary operational dashboard for your hardware.

## 🚀 Features

- **Interactive Dashboard:** Real-time system statuses, active work coordinates, and a visualizer pane for live G-Code bounding box previews.
- **File Management Browser:** Navigate your G-Code library with dedicated visual previews, estimated completion times, and file validation status.
- **Manual Motion Control (Jog Interface):** Fully functional 8-way directional XY pad and Z-axis controls. Accompanied by real-time hardware telemetry graphs including Motor Temperature and Power Load.
- **Integrated Terminal Console:** Execute raw G-Code commands directly. Features auto-scrolling console logs with syntax-highlighted system states (Errors, Responses, Commands) and live buffer metrics.
- **Industrial Aesthetic:** Custom minimal design system using CSS, powered by `Inter`, `Space Grotesk`, and `JetBrains Mono` fonts to prioritize readability and operator awareness.

## 🛠️ Tech Stack

- **Framework:** React 19 + Vite
- **Styling:** Custom Vanilla CSS (Modular architecture)
- **Icons:** Lucide React & Custom SVG geometry

## 📦 Getting Started

First, ensure you have [Node.js](https://nodejs.org/) installed on your machine.

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

## 📐 Project Architecture

To keep the application highly modular and maintainable, the layout has been divided into self-contained components under `src/components/`:
- `DashboardView.jsx`
- `FilesView.jsx`
- `ControlsView.jsx`
- `TerminalView.jsx`

Global shell elements (Sidebar, Topbar, Status components) remain efficiently managed in `src/App.jsx`.

---
*Created as part of the IOTIZED repository.*
