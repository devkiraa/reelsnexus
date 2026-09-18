'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import { ArrowUp, ChevronDown, Plus, Loader2, Info, PlaySquare, CheckCircle2, LogOut, Menu, X } from 'lucide-react';
import { useProject } from './ProjectContext';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

interface LayoutContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType>({
  sidebarOpen: false,
  setSidebarOpen: () => {}
});

export const useLayout = () => useContext(LayoutContext);

export function HeaderNav() {
  const { user } = useAuth();
  const { setSidebarOpen } = useLayout();
  const [mounted, setMounted] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 flex justify-between items-center gap-3">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Toggle Button */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-2 -ml-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumbs */}
        <nav className="text-xs sm:text-sm font-medium text-gray-500 min-w-0">
          <ol className="flex items-center space-x-1.5 sm:space-x-2">
            <li className="hidden sm:inline"><a href="/" className="hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 rounded">Home</a></li>
            <li className="hidden sm:inline text-gray-400">/</li>
            <li className="text-gray-900 font-semibold truncate" aria-current="page">Dashboard</li>
          </ol>
        </nav>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4 relative shrink-0">
        {user && (
          <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1 bg-gray-50 border border-gray-200 rounded-full text-xs">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name || 'User'}
                className="w-5 h-5 rounded-full object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </div>
            )}
            <span className="font-medium text-gray-700 max-w-[80px] sm:max-w-[140px] truncate">{user.name || user.email.split('@')[0]}</span>
          </div>
        )}

        {/* Tools Menu Toggle */}
        <button 
          onClick={() => setMegaMenuOpen(!megaMenuOpen)}
          className="flex items-center space-x-1 text-xs sm:text-sm font-medium text-gray-700 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-2 py-1"
        >
          <span className="hidden sm:inline">Tools</span>
          <ChevronDown size={14} className="sm:w-4 sm:h-4" />
        </button>

        {/* Tools Dropdown */}
        {megaMenuOpen && (
          <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 bg-white border border-gray-200 rounded-xl shadow-xl p-4 sm:p-5 grid grid-cols-2 gap-4 z-50 animate-in fade-in zoom-in-95">
            <div>
              <h3 className="font-bold text-gray-900 mb-2 text-xs sm:text-sm">Analytics</h3>
              <ul className="space-y-1.5 text-xs text-gray-600">
                <li><a href="#" className="hover:text-blue-500 block">Performance</a></li>
                <li><a href="#" className="hover:text-blue-500 block">Audience</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-2 text-xs sm:text-sm">Settings</h3>
              <ul className="space-y-1.5 text-xs text-gray-600">
                <li><a href="/settings" className="hover:text-blue-500 block">Preferences</a></li>
                <li><a href="/watermark" className="hover:text-blue-500 block">Watermark</a></li>
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

export function SidebarInner({ onClose }: { onClose?: () => void }) {
  const { user, logout } = useAuth();
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
  const [reviewCount, setReviewCount] = useState<number>(0);

  useEffect(() => {
    if (!activeChannel) {
      setReviewCount(0);
      return;
    }
    const checkReviews = async () => {
      try {
        const apiBase = process.env.NODE_ENV === 'development' 
          ? 'http://localhost:8787' 
          : 'https://reelnexus-worker.devkiraa.workers.dev';
        const res = await fetch(`${apiBase}/api/jobs?channel_id=${activeChannel.id}&status=READY_FOR_REVIEW&limit=1`);
        if (res.ok) {
          const data = await res.json();
          setReviewCount(data.total || 0);
        }
      } catch (err) {
        // ignore
      }
    };
    checkReviews();
    const timer = setInterval(checkReviews, 15000);
    return () => clearInterval(timer);
  }, [activeChannel]);

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
    <div className="flex flex-col h-full w-full bg-white text-gray-900">
      {/* Brand & Close */}
      <div className="p-5 sm:p-6 font-bold text-2xl border-b border-gray-200 text-blue-600 flex items-center justify-between">
        <span>ReelNexus</span>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
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
                  <img src={activeChannel.avatar_url} alt="" className="w-8 h-8 rounded-full border border-gray-200 shrink-0 object-cover" />
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
                if (onClose) onClose();
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
                  if (onClose) onClose();
                }}
                className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-3 hover:bg-gray-50 ${activeChannel?.id === channel.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
              >
                {channel.avatar_url ? (
                  <img src={channel.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
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
                  if (onClose) onClose();
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

      <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
        <a 
          href="/" 
          onClick={onClose}
          className="block px-4 py-2.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors font-medium text-sm text-gray-700"
        >
          Dashboard
        </a>
        <a 
          href="/queue" 
          onClick={onClose}
          className="block px-4 py-2.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors font-medium text-sm text-gray-700"
        >
          Queue
        </a>
        <a 
          href="/review" 
          onClick={onClose}
          className="flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-orange-50 hover:text-orange-600 focus-visible:ring-2 focus-visible:ring-orange-500 transition-colors font-medium text-sm text-gray-700"
        >
          <span>Review & Schedule</span>
          {reviewCount > 0 && (
            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-xs">
              {reviewCount}
            </span>
          )}
        </a>
        <a 
          href="/ingest" 
          onClick={onClose}
          className="block px-4 py-2.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors font-medium text-sm text-gray-700"
        >
          Ingest
        </a>
        <a 
          href="/watermark" 
          onClick={onClose}
          className="block px-4 py-2.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors font-medium text-sm text-gray-700"
        >
          Watermark Studio
        </a>
        <a 
          href="/settings" 
          onClick={onClose}
          className="block px-4 py-2.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors font-medium text-sm text-gray-700"
        >
          Settings
        </a>
      </nav>

      {/* User Profile & Sign Out Footer */}
      {user && (
        <div className="p-3.5 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name || 'User'}
                className="w-8 h-8 rounded-full border border-gray-200 shrink-0 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-900 truncate">
                {user.name || user.email.split('@')[0]}
              </p>
              <p className="text-[10px] text-gray-400 truncate">
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}

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
    </div>
  );
}

export function SidebarNav() {
  const { sidebarOpen, setSidebarOpen } = useLayout();

  return (
    <>
      {/* Desktop Persistent Sidebar (Large Screens) */}
      <aside className="hidden lg:flex w-64 border-r border-gray-200 sticky top-0 h-screen shrink-0 z-20">
        <SidebarInner />
      </aside>

      {/* Mobile Drawer (Small & Tablet Screens) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex" role="dialog" aria-modal="true">
          {/* Dark Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-out Drawer Panel */}
          <aside className="relative w-72 max-w-[85vw] bg-white flex flex-col h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <SidebarInner onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <LayoutContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
      <div className="flex h-screen w-full overflow-hidden bg-gray-50/20">
        {/* Skip Link */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 z-50 rounded-md">
          Skip to main content
        </a>

        {/* Responsive Sidebar (Desktop bar + Mobile drawer) */}
        <SidebarNav />

        {/* Main Content Area */}
        <div id="main-scroll-container" className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col min-w-0">
          <HeaderNav />
          <main id="main-content" className="flex-1 outline-none min-w-0" tabIndex={-1}>
            {children}
          </main>
          <BackToTop />
        </div>
      </div>
    </LayoutContext.Provider>
  );
}
