'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

const INSTAGRAM_URL = 'https://instagram.com/xan.switch';

export default function SiteHeader({
  musicUrl,
  musicName,
  whatsappContactUrl
}: {
  musicUrl: string | null;
  musicName: string | null;
  whatsappContactUrl: string | null;
}) {
  return (
    <div className="site-header">
      <div className="site-header-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="XAN Switch" />
      </div>

      <div className="site-header-center">
        {musicUrl && <MusicPlayer musicUrl={musicUrl} musicName={musicName} />}
      </div>

      <div className="site-header-icons">
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="social-icon"
          aria-label="Instagram"
          title="Instagram"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </a>
        {whatsappContactUrl && (
          <a
            href={whatsappContactUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
            aria-label="WhatsApp"
            title="WhatsApp"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3a9 9 0 0 0-7.75 13.5L3 21l4.5-1.25A9 9 0 1 0 12 3z" />
              <path
                d="M8.5 9.7c0 3.4 2.4 5.8 5.8 5.8.8 0 1-1.4.5-1.9s-1.1-.7-1.6-.3c-.4.4-.6.4-1 .1a4.7 4.7 0 0 1-2-2c-.3-.4-.3-.6.1-1 .5-.5.2-1.2-.3-1.7s-1.9-.3-1.9.5"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

function MusicPlayer({ musicUrl, musicName }: { musicUrl: string; musicName: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const nameBoxRef = useRef<HTMLDivElement>(null);
  const nameTextRef = useRef<HTMLSpanElement>(null);
  const [playing, setPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [marquee, setMarquee] = useState<{ shift: number; duration: number } | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.5;
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setAutoplayBlocked(true));
  }, [musicUrl]);

  // Pausing when the tab/window loses visibility also covers minimizing
  // the browser — most browsers fire visibilitychange in that case too.
  useEffect(() => {
    function handleVisibilityChange() {
      if (!document.hidden) return;
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        audio.pause();
        setPlaying(false);
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Only scroll the track name if it's actually wider than its box —
  // short names just sit still.
  useEffect(() => {
    function measure() {
      const box = nameBoxRef.current;
      const text = nameTextRef.current;
      if (!box || !text) return;
      const overflow = text.scrollWidth - box.clientWidth;
      if (overflow > 4) {
        setMarquee({ shift: overflow + 12, duration: 6 + overflow / 18 });
      } else {
        setMarquee(null);
      }
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [musicName]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio
        .play()
        .then(() => {
          setPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch(() => {});
    }
  }

  return (
    <div className="music-player">
      <audio ref={audioRef} src={musicUrl} loop />
      <button
        type="button"
        className={`music-toggle${autoplayBlocked ? ' attention' : ''}`}
        onClick={toggle}
        aria-label={playing ? 'Pausar música' : 'Tocar música'}
        title={playing ? 'Pausar' : 'Tocar'}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor" width={14} height={14}>
            <rect x="5" y="4" width="5" height="16" rx="1.5" />
            <rect x="14" y="4" width="5" height="16" rx="1.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" width={14} height={14}>
            <path d="M6 4.5v15l14-7.5-14-7.5z" />
          </svg>
        )}
      </button>
      <div className="music-info">
        <span className="music-label">Música do dia</span>
        <div className="music-name" ref={nameBoxRef}>
          <span
            ref={nameTextRef}
            className={`music-name-track${marquee ? ' scrolling' : ''}`}
            style={
              marquee
                ? ({
                    '--marquee-shift': `-${marquee.shift}px`,
                    animationDuration: `${marquee.duration}s`
                  } as CSSProperties)
                : undefined
            }
          >
            {musicName}
          </span>
        </div>
      </div>
    </div>
  );
}
