import React, { useEffect, useRef, useState } from 'react';
import useSensorStore from '../../stores/sensorStore';
import './AmbientBackdrop.css';

export default function AmbientBackdrop() {
  const canvasRef = useRef(null);
  const gearRef = useRef(null);
  const anomalyActive = useSensorStore((s) => s.anomalyActive);
  const reduceEffects = useSensorStore((s) => s.reduceEffects);

  // Parallax gear on mouse move (RAF-throttled)
  useEffect(() => {
    if (reduceEffects) return;

    let rafId = null;
    const handleMouseMove = (e) => {
      if (rafId || !gearRef.current) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!gearRef.current) return;
        const xRatio = (e.clientX / window.innerWidth - 0.5) * 2;
        const yRatio = (e.clientY / window.innerHeight - 0.5) * 2;
        gearRef.current.style.transform = `translate(${xRatio * 12}px, ${yRatio * 12}px)`;
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [reduceEffects]);

  // Subtle floating dust motes canvas
  useEffect(() => {
    if (reduceEffects) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const PARTICLES_COUNT = 28;
    const particles = Array.from({ length: PARTICLES_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.6 + 0.8,
      speedY: Math.random() * 0.25 + 0.1,
      speedX: (Math.random() - 0.5) * 0.15,
      opacity: Math.random() * 0.35 + 0.15,
    }));

    let isVisible = true;
    const handleVisibility = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const render = () => {
      if (isVisible) {
        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < PARTICLES_COUNT; i++) {
          const p = particles[i];
          p.y -= p.speedY;
          p.x += p.speedX;

          if (p.y < -10) p.y = height + 10;
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(184, 114, 59, ${p.opacity})`;
          ctx.fill();
        }
      }
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      cancelAnimationFrame(animId);
    };
  }, [reduceEffects]);

  const tintClass = anomalyActive ? 'backdrop--critical' : 'backdrop--healthy';

  return (
    <div className={`ambient-backdrop ${tintClass} ${reduceEffects ? 'reduced' : ''}`}>
      {/* Living animated color mesh blobs */}
      <div className="mesh-blob blob-1" />
      <div className="mesh-blob blob-2" />
      <div className="mesh-blob blob-3" />
      <div className="mesh-blob blob-4" />

      {/* Rotating watermark gear with parallax */}
      <svg
        ref={gearRef}
        className="backdrop-watermark-gear"
        viewBox="0 0 400 400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="200" cy="200" r="140" strokeDasharray="6 8" />
        <circle cx="200" cy="200" r="90" />
        <circle cx="200" cy="200" r="40" fill="currentColor" opacity="0.08" />
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const x1 = 200 + Math.cos(angle) * 140;
          const y1 = 200 + Math.sin(angle) * 140;
          const x2 = 200 + Math.cos(angle) * 165;
          const y2 = 200 + Math.sin(angle) * 165;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="3" />;
        })}
      </svg>

      {/* Faint floating dust motes */}
      {!reduceEffects && <canvas ref={canvasRef} className="dust-canvas" />}

      {/* Faint film grain noise texture */}
      <div className="film-grain-layer" />
    </div>
  );
}
