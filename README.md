# 🎨  Realtime Whiteboard

A high-performance, real-time collaborative whiteboard designed for seamless brainstorming and design sessions. Built with a "Miro-style" focus on speed, precision, and space efficiency.

![Project Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Tech Stack](https://img.shields.io/badge/Stack-Next.js%20%7C%20Socket.io%20%7C%20MongoDB-blue)

## 🚀 Key Features

### 🌌 Infinite Canvas Engine
*   **Pan & Zoom:** Navigate a massive workspace with smooth mouse-wheel zoom and space-drag panning.
*   **Adaptive Grid:** A 3-tier dynamic grid system (minor, medium, major) that intelligently fades based on your zoom level.
*   **High Performance:** Optimized requestAnimationFrame rendering loop for smooth 60fps interaction.

### 🛠 Professional Tooling
*   **Compact Nested Toolbar:** A space-saving, professional interface that groups drawing and shape tools into logical categories.
*   **Advanced Shapes:** Precision-rendered Rectangles, Ellipses, Arrows, and Lines.
*   **True Object Eraser:** Mathematical hit-testing allows you to erase entire objects/strokes with a single click or drag.
*   **Discrete Presets:** Professional-grade brush thickness and curated color palettes.

### 👥 Real-Time Collaboration
*   **Live Cursors:** See exactly where your teammates are working with labeled, color-coded cursors.
*   **Instant Sync:** Socket.io powered synchronization for strokes, shapes, and deletions.
*   **Collaborative Chat:** Integrated floating chat system with message notifications.
*   **Room Persistence:** Durable storage of all board states in MongoDB Atlas.

### 💾 Export & Sharing
*   **High-Res Export:** Download your workspace as high-quality **PNG** or scalable **SVG**.
*   **Room Codes:** Simple, shareable 6-digit room IDs for instant team joining.

---

## 🎹 Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `V` | **Select / Pointer** |
| `H` | **Hand Tool (Pan)** |
| `Space` | **Hold to Pan** |
| `P` | **Pencil Tool** |
| `E` | **Eraser Tool** |
| `R` | **Rectangle Tool** |
| `C` | **Circle / Ellipse Tool** |
| `A` | **Arrow Tool** |
| `L` | **Line Tool** |
| `Ctrl + Z` | **Undo** |
| `Ctrl + Y` | **Redo** |

---

## 🛠 Tech Stack

*   **Frontend:** Next.js 14, Tailwind CSS, Lucide React
*   **Graphics:** HTML5 Canvas API (World-space Camera Model)
*   **Real-time:** Socket.io
*   **Backend:** Node.js (Custom Server)
*   **Database:** MongoDB Atlas (Mongoose)

---

## 🏁 Getting Started

### Prerequisites
*   Node.js 18+
*   MongoDB Atlas Account

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/piyushrav1/whiteboard-main.git
   cd whiteboard-main
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env.local` file in the root directory:
   ```env
   MONGODB_URI=your_mongodb_connection_string
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open in Browser:**
   Navigate to `http://localhost:3000`

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
