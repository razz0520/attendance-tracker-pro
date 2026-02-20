# Attendance Pro // Advance Student Dashboard

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?logo=supabase)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deployment-Vercel-000000?logo=vercel)](https://vercel.com/)

**Attendance Pro** is an engineering-first academic management system built for high-performance tracking and predictive consistency. It features an **Anti-Gravity UI** designed to deliver deep analytical insights with zero latency.



## 🛰️ Architectural Core

The application is built on the principle of **Optimistic UI Updates** and **Derived State**. By calculating metrics in real-time from raw logs rather than storing redundant totals, we ensure a **Single Source of Truth** across all views.

### Key Engineering Implementations
* **Zero-Latency Interactions**: Implemented through **Optimistic State Updates**, allowing the UI to reflect attendance changes in **0ms** while database synchronization happens asynchronously in the background.
* **Anti-Gravity Design System**: A high-fidelity Glassmorphism interface utilizing `backdrop-blur-xl`, nested glow borders, and GPU-accelerated transitions for a weightless, futuristic feel.
* **Real-time Synchronization**: Leverages **Supabase Postgres Changes** (WebSockets) to instantly sync data across mobile and desktop devices without manual refreshes.
* **Intelligent Denominator Logic**: Advanced statistical utility that automatically excludes "Holidays" and "Sundays" from the active denominator to prevent artificial percentage deflation.

## 🛠️ Technical Stack

| Layer | Technology | Implementation Detail |
| :--- | :--- | :--- |
| **Frontend** | React 18 (Vite) | Optimized with `useMemo` and `useCallback` for $O(1)$ rendering performance. |
| **Styling** | Tailwind CSS v4 | Custom JIT engine integration for complex glass-morphic utilities. |
| **Backend** | Supabase (Postgres) | Real-time database with Row Level Security (RLS) and Auth integration. |
| **Analytics** | Recharts | D3-based visualization of subject-wise performance and historical trends. |

## 📈 Data Science Perspective & Roadmap

Current development focuses on behavioral consistency tracking. Future iterations will integrate:

1. **Safety Buffer Analysis**: Using a "Consecutive Attendance" formula to predict how many classes a student can afford to miss before hitting critical thresholds:
   $$B = \frac{P - (T \times H)}{T}$$
   *(Where P = Present, T = Target %, H = Total Held)*
2. **Predictive Forecasting**: A Python/Flask-based model to forecast final semester results based on historical attendance velocity and "lazy" period identification.

## 🚀 Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone [https://github.com/your-username/attendance-tracker-pro.git](https://github.com/your-username/attendance-tracker-pro.git)
   cd attendance-tracker-pro
