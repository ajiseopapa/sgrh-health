'use client'

import { useEffect, useState } from 'react'

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadingOut(true), 1400)
    const doneTimer = setTimeout(onFinish, 1700)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [onFinish])

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-brand-50 transition-opacity duration-300 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <style>{`
        @keyframes splash-hop {
          0%   { transform: translateY(0) scaleX(1) scaleY(1); }
          20%  { transform: translateY(2px) scaleX(1.05) scaleY(0.92); }
          55%  { transform: translateY(-16px) scaleX(0.96) scaleY(1.06); }
          80%  { transform: translateY(0) scaleX(1) scaleY(1); }
          100% { transform: translateY(0) scaleX(1) scaleY(1); }
        }
        @keyframes splash-shadow {
          0%,100% { transform: scaleX(1); opacity: 0.35; }
          55% { transform: scaleX(0.75); opacity: 0.2; }
        }
        @keyframes splash-dot {
          0%,80%,100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        .splash-dino-img {
          width: 180px;
          animation: splash-hop 0.62s cubic-bezier(.36,0,.64,1) infinite;
          transform-origin: 50% 90%;
          filter: drop-shadow(0 2px 2px rgba(0,0,0,0.08));
        }
        .splash-dino-shadow {
          width: 118px;
          height: 14px;
          background: #B9DDC5;
          border-radius: 50%;
          margin-top: -6px;
          animation: splash-shadow 0.62s ease-in-out infinite;
        }
        .splash-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #1F9B7D;
          display: inline-block;
          margin: 0 2px;
          animation: splash-dot 1s ease-in-out infinite;
        }
      `}</style>
      <img className="splash-dino-img" src="/dino-runner.png" alt="달리는 초록 공룡" />
      <div className="splash-dino-shadow" />
      <div className="mt-4 flex items-center gap-1.5">
        <span className="text-sm font-semibold text-brand-700">로딩 중</span>
        <span className="splash-dot" style={{ animationDelay: '0s' }} />
        <span className="splash-dot" style={{ animationDelay: '0.15s' }} />
        <span className="splash-dot" style={{ animationDelay: '0.3s' }} />
      </div>
    </div>
  )
}
