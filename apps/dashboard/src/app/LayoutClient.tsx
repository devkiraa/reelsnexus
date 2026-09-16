'use client';

import React, { useState, useEffect } from 'react';
import { ArrowUp, ChevronDown, Plus, Loader2, Info, PlaySquare, CheckCircle2 } from 'lucide-react';
import { useProject } from './ProjectContext';
import toast from 'react-hot-toast';

export function HeaderNav() {
  const [mounted, setMounted] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 flex justify-between items-center">
      {/* Breadcrumbs */}
      <nav className="text-sm font-medium text-gray-500">
        <ol className="flex space-x-2">
          <li><a href="/" className="hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 rounded">Home</a></li>
          <li>/</li>
          <li className="text-gray-900" aria-current="page">Dashboard</li>
        </ol>
      </nav>

      <div className="flex items-center space-x-4 relative">
        {/* Mock Mega Menu Toggle */}
        <button 
          onClick={() => setMegaMenuOpen(!megaMenuOpen)}
          className="flex items-center space-x-1 text-sm font-medium hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-2 py-1"
        >
          <span>Tools</span>
          <ChevronDown size={16} />
        </button>

        {/* Mega Menu Dropdown */}
        {megaMenuOpen && (
          <div className="absolute top-full right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-xl p-6 grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-bold text-gray-900 mb-2">Analytics</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li><a href="#" className="hover:text-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 rounded block">Performance</a></li>
                <li><a href="#" className="hover:text-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 rounded block">Audience</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-2">Settings</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li><a href="#" className="hover:text-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 rounded block">Billing</a></li>
                <li><a href="#" className="hover:text-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 rounded block">API Keys</a></li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Find the scrollable container (in layout it's the flex-1 div)
      const container = document.getElementById('main-scroll-container');
      if (container && container.scrollTop > 300) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };
    
    const container = document.getElementById('main-scroll-container');
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    const container = document.getElementById('main-scroll-container');
    container?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-8 right-8 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 z-50 animate-bounce"
      aria-label="Back to top"
    >
      <ArrowUp size={24} />
    </button>
  );
}

export function SidebarNav() {
  const { 
    channels, 
    activeChannel, 
    setActiveChannelId, 
    loading,
    isImportModalOpen,
    setIsImportModalOpen,
    discovering,
    discoveredChannels,
    handleNewOAuth,
    importProject,
    closeImportModal,
    refreshTokenString
  } = useProject();

  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Import Modal State
  const [selectedDiscovered, setSelectedDiscovered] = useState<any>(null);
  const [niche, setNiche] = useState('Entertainment');
  const [watermarkText, setWatermarkText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiscovered) return;
    setSubmitting(true);
    const success = await importProject(selectedDiscovered, niche, watermarkText, refreshTokenString);
    setSubmitting(false);
    if (success) {
      setSelectedDiscovered(null);
    }
  };

  return (
    <>
      <div className="w-64 bg-white border-r border-gray-200 text-gray-900 flex flex-col sticky top-0 h-screen shrink-0 transition-colors duration-200">
        <div className="p-6 font-bold text-2xl border-b border-gray-200 text-blue-600">
          ReelNexus
        </div>

        {/* Project Selector */}
        <div className="p-4 border-b border-gray-100 relative">
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 hover:border-blue-300 rounded-lg p-3 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 text-left"
          >
            <div className="flex items-center space-x-3 overflow-hidden">
              {activeChannel ? (
                <>
                  {activeChannel.avatar_url ? (
                    <img src={activeChannel.avatar_url} alt="" className="w-8 h-8 rounded-full border border-gray-200 shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0">
                      {activeChannel.channel_name.charAt(0)}
                    </div>
                  )}
                  <div className="truncate">
                    <p className="text-sm font-bold text-gray-900 truncate">{activeChannel.channel_name}</p>
                    <p className="text-xs text-gray-500 truncate">{activeChannel.niche}</p>
                  </div>
                </>
              ) : (
                <div className="text-sm font-medium text-gray-500">
                  {loading ? 'Loading...' : 'Select a Project'}
                </div>
              )}
            </div>
            <ChevronDown size={16} className="text-gray-400 shrink-0" />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-4 right-4 mt-2 bg-white border border-gray-200 shadow-xl rounded-lg z-50 py-2 max-h-64 overflow-y-auto">
              <div className="px-3 pb-2 mb-2 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Projects</p>
              </div>
              
              {/* All Projects Option */}
              <button
                onClick={() => {
                  setActiveChannelId(null);
                  setDropdownOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-3 hover:bg-gray-50 ${!activeChannel ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
              >
                <div className="w-6 h-6 rounded flex items-center justify-center bg-gray-100 border border-gray-200 text-gray-500">
                  <PlaySquare size={14} />
                </div>
                <span className="truncate flex-1 font-medium">All Projects Overview</span>
                {!activeChannel && <CheckCircle2 size={16} className="text-blue-600" />}
              </button>

              {channels.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => {
                    setActiveChannelId(channel.id);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-3 hover:bg-gray-50 ${activeChannel?.id === channel.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                >
                  {channel.avatar_url ? (
                    <img src={channel.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">{channel.channel_name.charAt(0)}</div>
                  )}
                  <span className="truncate flex-1">{channel.channel_name}</span>
                  {activeChannel?.id === channel.id && <CheckCircle2 size={16} className="text-blue-600" />}
                </button>
              ))}
              
              <div className="px-3 pt-2 mt-2 border-t border-gray-100">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    handleNewOAuth();
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-md transition-colors"
                >
                  <Plus size={16} />
                  <span>Import New Channel</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <a href="/" className="block px-4 py-2 rounded-md hover:bg-blue-50 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors">Dashboard</a>
          <a href="/queue" className="block px-4 py-2 rounded-md hover:bg-blue-50 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors">Queue</a>
          <a href="/ingest" className="block px-4 py-2 rounded-md hover:bg-blue-50 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors">Ingest</a>
          <a href="/watermark" className="block px-4 py-2 rounded-md hover:bg-blue-50 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors">Watermark Studio</a>
          <a href="/settings" className="block px-4 py-2 rounded-md hover:bg-blue-50 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors">Settings</a>
        </nav>
      </div>

      {/* Global Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 transform transition-all border border-gray-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Import YouTube Channel</h2>
            <p className="text-gray-500 text-sm mb-6">Select a channel to import as a ReelNexus Project.</p>
            
            {discovering ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-600">Discovering your channels...</p>
              </div>
            ) : discoveredChannels.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">No YouTube channels found on this account.</p>
                <button onClick={closeImportModal} className="text-blue-600 font-medium hover:underline">Close</button>
              </div>
            ) : (
              <form onSubmit={handleImportSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                  {discoveredChannels.map(channel => (
                    <div 
                      key={channel.id}
                      onClick={() => {
                        setSelectedDiscovered(channel);
                        setWatermarkText(channel.snippet.title);
                      }}
                      className={`relative border rounded-lg p-3 cursor-pointer transition-all ${
                        selectedDiscovered?.id === channel.id 
                          ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' 
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      {selectedDiscovered?.id === channel.id && <CheckCircle2 className="absolute top-2 right-2 text-blue-600 w-5 h-5" />}
                      <div className="flex flex-col items-center text-center">
                        <img src={channel.snippet.thumbnails?.default?.url} alt="" className="w-12 h-12 rounded-full mb-2 border border-gray-200" />
                        <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{channel.snippet.title}</h4>
                        <p className="text-xs text-gray-500">{channel.snippet.customUrl}</p>
                        <p className="text-xs font-medium text-blue-600 mt-1">
                          {parseInt(channel.statistics.subscriberCount || '0', 10).toLocaleString()} subs
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedDiscovered && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select Niche</label>
                      <input 
                        type="text" required list="niche-suggestions"
                        value={niche} onChange={e => setNiche(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. Luxury Lifestyle"
                      />
                      <datalist id="niche-suggestions">
                        <option value="Luxury Lifestyle & Wealth" />
                        <option value="Motivation & Mindset" />
                        <option value="Stoic Wisdom" />
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Watermark Text</label>
                      <input 
                        type="text" required
                        value={watermarkText} onChange={e => setWatermarkText(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 flex items-start">
                      <Info className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                      <p><strong>Safe-Zone Watermark Active:</strong> Shorts will automatically burn <strong>{watermarkText}</strong> to protect content.</p>
                    </div>
                  </>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                  <button type="button" onClick={closeImportModal} className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                  <button type="submit" disabled={submitting || !selectedDiscovered} className="flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {submitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Importing...</> : 'Import as Project'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
