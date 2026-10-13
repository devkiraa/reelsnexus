'use client';

import React, { useState } from 'react';

const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8787' 
  : 'https://reelnexus-worker.devkiraa.workers.dev';

interface SafeAvatarProps {
  src?: string | null;
  name?: string;
  className?: string;
  textClassName?: string;
}

export function SafeAvatar({
  src,
  name,
  className = "w-8 h-8",
  textClassName = "text-xs"
}: SafeAvatarProps) {
  const [triedProxy, setTriedProxy] = useState(false);
  const [failed, setFailed] = useState(false);

  const initial = (name && name.trim() ? name.trim()[0] : 'C').toUpperCase();

  if (!src || failed) {
    return (
      <div className={`${className} rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold ${textClassName} shrink-0 select-none`}>
        {initial}
      </div>
    );
  }

  // If direct Google CDN failed (e.g. ERR_CERT_AUTHORITY_INVALID), route through worker proxy
  const currentSrc = triedProxy && src.startsWith('https://yt3.ggpht.com/')
    ? `${API_BASE}/api/avatar-proxy?url=${encodeURIComponent(src)}`
    : src;

  return (
    <img
      src={currentSrc}
      alt={name || ''}
      referrerPolicy="no-referrer"
      onError={() => {
        if (!triedProxy && src.startsWith('https://yt3.ggpht.com/')) {
          setTriedProxy(true);
        } else {
          setFailed(true);
        }
      }}
      className={`${className} rounded-full border border-gray-200 object-cover shrink-0`}
    />
  );
}
