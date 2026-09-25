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
import OnboardPage from './pages/OnboardPage';
import LoginPage from './pages/LoginPage';
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
          <Route path="/onboard" element={<OnboardPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function AppLayout() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  return (
    <div className={`app ${isLogin ? 'app--login' : ''}`}>
      {/* Living Ambient Backdrop */}
      <AmbientBackdrop />

      {!isLogin && <CommandPalette />}

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
      {!isLogin && <Sidebar />}
      {!isLogin && <TopBar />}

      {/* Main Content Area */}
      <main className={isLogin ? 'app__content--fullscreen' : 'app__content'}>
        <AnimatedRoutes />
      </main>
    </div>
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

  // Global mouse tracking for .glass-sheen elements (optimized with RAF & event targeting)
  useEffect(() => {
    if (reduceEffects) return;

    let rafId = null;
    const handlePointerMove = (e) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const target = e.target?.closest ? e.target.closest('.glass-sheen') : null;
        if (target) {
          const rect = target.getBoundingClientRect();
          target.style.setProperty('--mx', `${e.clientX - rect.left}px`);
          target.style.setProperty('--my', `${e.clientY - rect.top}px`);
        }
      });
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [reduceEffects]);

  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
