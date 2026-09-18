'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '../ProjectContext';
import { Loader2, Type, Image as ImageIcon, Save, Video, MonitorPlay, MousePointer2, Play, Pause, Volume2, VolumeX, AlertTriangle, LayoutGrid } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthHeaders } from '../AuthContext';

const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8787' 
  : 'https://reelnexus-worker.devkiraa.workers.dev';

export default function WatermarkStudioPage() {
  const { activeChannel, fetchChannels } = useProject();
  
  const [isSaving, setIsSaving] = useState(false);
  const [pendingJobs, setPendingJobs] = useState<any[]>([]);
  const [selectedBackground, setSelectedBackground] = useState<string>('');

  // Watermark State
  const [wType, setWType] = useState('text');
  const [wText, setWText] = useState('');
  const [wX, setWX] = useState(0.5);
  const [wY, setWY] = useState(0.5);
  const [wFontSize, setWFontSize] = useState(36);
  const [wFontColor, setWFontColor] = useState('#FFFFFF');
  const [wBgEnabled, setWBgEnabled] = useState(false);
  const [wBgColor, setWBgColor] = useState('#000000');
  const [wBgOpacity, setWBgOpacity] = useState(0.40);
  const [wOpacity, setWOpacity] = useState(0.85);
  
  // New Typography State
  const [wFontFamily, setWFontFamily] = useState('Inter');
  const [wBorderRadius, setWBorderRadius] = useState(4);
  const [wPadding, setWPadding] = useState(4);

  // Playback State
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Dragging State
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnappedX, setIsSnappedX] = useState(false);
  const [isSnappedY, setIsSnappedY] = useState(false);

  useEffect(() => {
    if (activeChannel) {
      setWType(activeChannel.watermark_type || 'text');
      setWText(activeChannel.watermark_text || '');
      setWX(activeChannel.watermark_x ?? 0.065);
      setWY(activeChannel.watermark_y ?? 0.145);
      setWFontSize(activeChannel.watermark_font_size ?? 36);
      setWFontColor(activeChannel.watermark_font_color || '#FFFFFF');
      setWBgEnabled(activeChannel.watermark_bg_enabled === 1 || activeChannel.watermark_bg_enabled === true);
      setWBgColor(activeChannel.watermark_bg_color || '#000000');
      setWBgOpacity(activeChannel.watermark_bg_opacity ?? 0.4);
      setWOpacity(activeChannel.watermark_opacity ?? 0.85);
      setWFontFamily(activeChannel.watermark_font_family || 'Inter');
      setWBorderRadius(activeChannel.watermark_border_radius ?? 4);
      setWPadding(activeChannel.watermark_padding ?? 4);
      
      fetch(`${API_BASE}/api/jobs?channel_id=${activeChannel.id}&status=PENDING&limit=10`)
        .then(res => res.json())
        .then(data => {
          const arr = data.data || data || [];
          setPendingJobs(arr);
          if (arr.length > 0) setSelectedBackground(arr[0].source_url);
        })
        .catch(console.error);
    }
  }, [activeChannel]);

  const handleSave = async () => {
    if (!activeChannel) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/channels/${activeChannel.id}/watermark`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          watermark_type: wType,
          watermark_text: wText,
          watermark_x: wX,
          watermark_y: wY,
          watermark_font_size: wFontSize,
          watermark_font_color: wFontColor,
          watermark_bg_enabled: wBgEnabled ? 1 : 0,
          watermark_bg_color: wBgColor,
          watermark_bg_opacity: wBgOpacity,
          watermark_opacity: wOpacity,
          watermark_font_family: wFontFamily,
          watermark_border_radius: wBorderRadius,
          watermark_padding: wPadding
        })
      });
      if (!res.ok) throw new Error('Failed to save settings');
      toast.success('Watermark settings saved globally!');
      
      await fetchChannels();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const calculatePosition = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    // We treat the click as the center of the watermark
    let xPercent = (clientX - rect.left) / rect.width;
    let yPercent = (clientY - rect.top) / rect.height;

    // Clamp values between 2% and 98%
    xPercent = Math.max(0.02, Math.min(0.98, xPercent));
    yPercent = Math.max(0.02, Math.min(0.98, yPercent));

    // Magnetic Snapping (1.5% threshold)
    let snappedX = false;
    let snappedY = false;

    if (Math.abs(xPercent - 0.5) < 0.015) {
      xPercent = 0.5;
      snappedX = true;
    }
    if (Math.abs(yPercent - 0.5) < 0.015) {
      yPercent = 0.5;
      snappedY = true;
    }
    
    setIsSnappedX(snappedX);
    setIsSnappedY(snappedY);

    setWX(parseFloat(xPercent.toFixed(3)));
    setWY(parseFloat(yPercent.toFixed(3)));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    calculatePosition(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      calculatePosition(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setIsSnappedX(false);
    setIsSnappedY(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.02 : 0.005;
    if (e.key === 'ArrowLeft') setWX(w => Math.max(0.02, w - step));
    if (e.key === 'ArrowRight') setWX(w => Math.min(0.98, w + step));
    if (e.key === 'ArrowUp') setWY(w => Math.max(0.02, w - step));
    if (e.key === 'ArrowDown') setWY(w => Math.min(0.98, w + step));
  };

  const isUnsafe = wY > 0.76 || (wX > 0.84 && wY > 0.40) || wY < 0.12;

  if (!activeChannel) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-blue-50 p-6 rounded-full mb-6">
          <MonitorPlay className="w-12 h-12 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Select a Project</h1>
        <p className="text-gray-500 max-w-md mx-auto mb-8">
          You must select a project from the sidebar to configure its watermark.
        </p>
      </div>
    );
  }
  
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-[calc(100vh-2rem)] lg:h-[calc(100vh-2rem)] flex flex-col pb-24 lg:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
            <MonitorPlay className="w-7 h-7 sm:w-8 sm:h-8 mr-3 text-blue-600 shrink-0" />
            <span>Watermark Studio</span>
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1 sm:mt-2">Design and position your watermark for <strong className="text-gray-900">{activeChannel.channel_name}</strong> globally.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 text-white px-5 sm:px-6 py-2 sm:py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center transition-colors shadow-xs shrink-0"
        >
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {isSaving ? 'Saving...' : 'Save to Channel'}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 lg:gap-8">
        
        {/* Left Pane: Controls */}
        <div className="w-full lg:w-[420px] shrink-0 bg-white rounded-xl shadow-xs border border-gray-200 flex flex-col overflow-y-auto">
          <div className="p-4 sm:p-5 border-b border-gray-200">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">Style Parameters</h2>
          </div>
          
          <div className="p-5 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Watermark Type</label>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                  onClick={() => setWType('text')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center transition-all ${wType === 'text' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Type className="w-4 h-4 mr-2" /> Text
                </button>
                <button 
                  onClick={() => toast('Logo uploads coming soon!')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center transition-all ${wType === 'logo' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 opacity-50 cursor-not-allowed'}`}
                >
                  <ImageIcon className="w-4 h-4 mr-2" /> Logo
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Watermark Text</label>
              <input 
                type="text" 
                value={wText}
                onChange={e => setWText(e.target.value)}
                placeholder="@YourChannelHandle"
                className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Font Family</label>
              <select 
                value={wFontFamily}
                onChange={(e) => setWFontFamily(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
              >
                <option value="Inter">Inter</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Impact">Impact</option>
                <option value="Arial Black">Arial Black</option>
                <option value="Courier New">Courier New</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Font Size (px)</label>
                <input 
                  type="number" 
                  value={wFontSize || ''}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setWFontSize(isNaN(val) ? 0 : val);
                  }}
                  className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Overall Opacity (%)</label>
                <input 
                  type="number" 
                  value={isNaN(wOpacity) ? '' : Math.round(wOpacity * 100)}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setWOpacity(isNaN(val) ? 0 : val / 100);
                  }}
                  min="0" max="100"
                  className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Font Color</label>
                <div className="flex items-center space-x-2">
                  <input 
                    type="color" 
                    value={wFontColor}
                    onChange={e => setWFontColor(e.target.value)}
                    className="h-9 w-9 rounded cursor-pointer border-0 p-0"
                  />
                  <input type="text" value={wFontColor} onChange={e => setWFontColor(e.target.value)} className="flex-1 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bg Color</label>
                <div className="flex items-center space-x-2">
                  <input 
                    type="color" 
                    value={wBgColor}
                    onChange={e => setWBgColor(e.target.value)}
                    disabled={!wBgEnabled}
                    className="h-9 w-9 rounded cursor-pointer border-0 p-0 disabled:opacity-50"
                  />
                  <input type="text" value={wBgColor} onChange={e => setWBgColor(e.target.value)} disabled={!wBgEnabled} className="flex-1 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 disabled:opacity-50" />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Text Background</label>
                <button 
                  onClick={() => setWBgEnabled(!wBgEnabled)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${wBgEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${wBgEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              {wBgEnabled && (
                <div className="mt-4 space-y-4">
                  <div className="flex items-center space-x-4">
                    <span className="text-xs font-medium text-gray-500 w-24">Opacity: {isNaN(wBgOpacity) ? 0 : Math.round(wBgOpacity * 100)}%</span>
                    <input 
                      type="range" min="0" max="100" 
                      value={isNaN(wBgOpacity) ? 0 : wBgOpacity * 100} 
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        setWBgOpacity(isNaN(val) ? 0 : val / 100);
                      }}
                      className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-xs font-medium text-gray-500 w-24">Radius: {wBorderRadius}px</span>
                    <input 
                      type="range" min="0" max="24" 
                      value={wBorderRadius} 
                      onChange={e => setWBorderRadius(parseInt(e.target.value))}
                      className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-xs font-medium text-gray-500 w-24">Padding: {wPadding}px</span>
                    <input 
                      type="range" min="0" max="24" 
                      value={wPadding} 
                      onChange={e => setWPadding(parseInt(e.target.value))}
                      className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>
                </div>
              )}
            </div>

            <hr className="border-gray-200" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Background Preview Video</label>
              <select 
                value={selectedBackground}
                onChange={(e) => setSelectedBackground(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
              >
                <option value="">(None) Dark Gradient</option>
                {pendingJobs.map(j => (
                  <option key={j.id} value={j.source_url}>{j.file_name}</option>
                ))}
              </select>
            </div>
            
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider flex items-center mb-3">
                <LayoutGrid className="w-4 h-4 mr-2 text-gray-500" /> Quick Alignment
              </h3>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button onClick={() => { setWX(0.065); setWY(0.145); }} className="text-xs font-medium py-1.5 bg-white border border-gray-200 rounded hover:bg-gray-100">Top-L</button>
                <button onClick={() => { setWX(0.5); setWY(0.145); }} className="text-xs font-medium py-1.5 bg-white border border-gray-200 rounded hover:bg-gray-100">Top-C</button>
                <button onClick={() => { setWX(0.935); setWY(0.145); }} className="text-xs font-medium py-1.5 bg-white border border-gray-200 rounded hover:bg-gray-100">Top-R</button>
                <button onClick={() => { setWX(0.065); setWY(0.5); }} className="text-xs font-medium py-1.5 bg-white border border-gray-200 rounded hover:bg-gray-100">Mid-L</button>
                <button onClick={() => { setWX(0.5); setWY(0.5); }} className="text-xs font-medium py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100">Center</button>
                <button onClick={() => { setWX(0.935); setWY(0.5); }} className="text-xs font-medium py-1.5 bg-white border border-gray-200 rounded hover:bg-gray-100">Mid-R</button>
              </div>

              <div className="flex items-center justify-between text-xs font-medium text-gray-600 bg-white px-3 py-2 border border-gray-200 rounded-md">
                <span>X: {Math.round(wX * 100)}% ({Math.round(wX * 1080)}px)</span>
                <span>Y: {Math.round(wY * 100)}% ({Math.round(wY * 1920)}px)</span>
              </div>
            </div>

          </div>
        </div>

        {/* Right Pane: Interactive Canvas */}
        <div className="flex-1 bg-gray-100 rounded-xl border border-gray-200 overflow-hidden flex items-center justify-center p-4 sm:p-8 flex-col relative min-h-[480px]">
          
          {isUnsafe && (
            <div className="absolute top-4 bg-amber-100 text-amber-800 text-xs sm:text-sm font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-md flex items-center border border-amber-200 z-50">
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 shrink-0" />
              <span>Watermark overlaps YouTube UI safe zone</span>
            </div>
          )}

          <div 
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            className="relative bg-black shadow-2xl rounded-xl overflow-hidden cursor-crosshair ring-4 ring-gray-900/5 outline-none focus:ring-blue-500/30 w-full max-w-[320px] sm:max-w-[360px]"
            style={{ 
              aspectRatio: '9/16', 
              maxHeight: '760px',
              touchAction: 'none' // Prevent scrolling while dragging on touch devices
            }}
          >
            {/* Background Video Placeholder or Real Video */}
            {selectedBackground ? (
              <>
                <video
                  ref={videoRef}
                  src={
                    selectedBackground.includes('drive.google.com') 
                      ? `${API_BASE}/api/drive/proxy-video?fileId=${selectedBackground.match(/d\/([a-zA-Z0-9-_]+)/)?.[1] || ''}` 
                      : selectedBackground
                  }
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay={isPlaying}
                  muted={isMuted}
                  loop
                  playsInline
                />
                <div className="absolute top-4 right-4 flex space-x-2" style={{ zIndex: 30 }}>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (videoRef.current) {
                        if (isPlaying) videoRef.current.pause();
                        else videoRef.current.play();
                      }
                      setIsPlaying(!isPlaying); 
                    }}
                    className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-sm transition-colors shadow-lg"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                    className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-sm transition-colors shadow-lg"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center">
                 <Video className="w-12 h-12 text-white/20 mb-2" />
                 <span className="text-white/30 text-sm font-medium text-center max-w-[80%]">No Video Selected</span>
              </div>
            )}

            {/* YouTube Shorts Safe Zones Overlay */}
            <div className="absolute inset-0 pointer-events-none border border-white/10" style={{ zIndex: 10 }}>
              {/* Right Action Bar Mock */}
              <div className="absolute right-2 bottom-32 w-12 h-64 bg-black/20 rounded-full border border-white/10 flex flex-col items-center justify-evenly">
                <div className="w-8 h-8 rounded-full bg-white/30" />
                <div className="w-8 h-8 rounded-full bg-white/30" />
                <div className="w-8 h-8 rounded-full bg-white/30" />
                <div className="w-8 h-8 rounded-full bg-white/30" />
              </div>
              {/* Bottom Info Mock */}
              <div className="absolute left-4 bottom-8 right-16 h-24 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-2">
                <div className="w-3/4 h-4 bg-white/40 rounded mb-2" />
                <div className="w-1/2 h-3 bg-white/20 rounded" />
              </div>
              {/* Top gradient safe zone */}
              <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />
            </div>
            
            {/* Snap Guidelines */}
            <div 
              className={`absolute top-0 bottom-0 left-1/2 w-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] z-10 transition-opacity duration-200 pointer-events-none -translate-x-1/2 ${isSnappedX ? 'opacity-100' : 'opacity-0'}`} 
            />
            <div 
              className={`absolute left-0 right-0 top-1/2 h-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] z-10 transition-opacity duration-200 pointer-events-none -translate-y-1/2 ${isSnappedY ? 'opacity-100' : 'opacity-0'}`} 
            />

            {/* The Watermark */}
            <div 
              className={`absolute pointer-events-none transition-opacity duration-100 ease-out flex items-center justify-center whitespace-nowrap ${isUnsafe ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-black/20 rounded-md' : ''}`}
              style={{
                left: `${wX * 100}%`,
                top: `${wY * 100}%`,
                opacity: isNaN(wOpacity) ? 0 : wOpacity,
                transform: 'translate(-50%, -50%)', // Center on the click point
                zIndex: 20
              }}
            >
              {wType === 'text' && wText ? (
                <div 
                  style={{
                    fontFamily: wFontFamily,
                    fontSize: `${wFontSize / 2.5}px`, // Scaled down roughly for the browser preview vs 1080p rendering
                    color: wFontColor,
                    backgroundColor: wBgEnabled ? `${wBgColor}${Math.round(wBgOpacity * 255).toString(16).padStart(2, '0')}` : 'transparent',
                    padding: wBgEnabled ? `${wPadding / 2}px ${wPadding}px` : '0',
                    borderRadius: wBgEnabled ? `${wBorderRadius}px` : '0',
                    fontWeight: 700,
                    textShadow: wBgEnabled ? 'none' : '0 1px 3px rgba(0,0,0,0.8)'
                  }}
                >
                  {wText}
                </div>
              ) : (
                <div className="text-white/50 text-xs bg-black/40 px-2 py-1 rounded border border-white/20 backdrop-blur-sm">
                  {wType === 'text' ? 'Enter Watermark Text' : 'Watermark Logo'}
                </div>
              )}
            </div>
            
            {/* Safe zone helper lines */}
            <div className="absolute inset-y-0 right-[15%] border-r border-red-500/30 border-dashed pointer-events-none" />
            <div className="absolute inset-x-0 bottom-[20%] border-b border-red-500/30 border-dashed pointer-events-none" />

          </div>
          
          <p className="mt-4 text-sm text-gray-500 font-medium flex items-center">
            <MousePointer2 className="w-4 h-4 mr-2" />
            Drag the watermark, or use Arrow Keys to nudge.
          </p>
        </div>

      </div>
    </div>
  );
}
