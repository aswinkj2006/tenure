import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Lenis from 'lenis';
import { Toaster } from 'sonner';
import Sidebar from './components/Shell/Sidebar';
import TopBar from './components/Shell/TopBar';
import AmbientBackdrop from './components/AmbientBackdrop/AmbientBackdrop';
import CommandPalette from './components/CommandPalette/CommandPalette';
import Dashboard from './pages/Dashboard';
import MachinePage from './pages/MachinePage';
import LogsPage from './pages/LogsPage';
import useSensorStore from './stores/sensorStore';
import { pageTransitionVariants } from './utils/motion';
import './App.css';

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageTransitionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="page-motion-container"
      >
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/machine/:id" element={<MachinePage />} />
          <Route path="/logs" element={<LogsPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const reduceEffects = useSensorStore((s) => s.reduceEffects);

  // Initialize Lenis smooth inertial scrolling
  useEffect(() => {
    if (reduceEffects) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [reduceEffects]);

  // Global mouse tracking for .glass-sheen elements
  useEffect(() => {
    if (reduceEffects) return;

    const handlePointerMove = (e) => {
      const sheens = document.querySelectorAll('.glass-sheen');
      sheens.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        el.style.setProperty('--mx', `${x}px`);
        el.style.setProperty('--my', `${y}px`);
      });
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [reduceEffects]);

  return (
    <BrowserRouter>
      <div className="app">
        {/* Living Ambient Backdrop */}
        <AmbientBackdrop />

        {/* Global Command Palette */}
        <CommandPalette />

        {/* Toast notifications */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: 'glass-strong font-body',
            style: {
              background: 'rgba(255, 251, 245, 0.88)',
              color: '#332415',
              border: '1px solid rgba(226, 205, 178, 0.8)',
              borderRadius: '14px',
            },
          }}
        />

        {/* Shell Navigation */}
        <Sidebar />
        <TopBar />

        {/* Main Content Area */}
        <main className="app__content">
          <AnimatedRoutes />
        </main>
      </div>
    </BrowserRouter>
  );
}
