import React, { useState, useEffect, useRef } from 'react';
import { Employee } from '../types';
import { 
  drawNewJoinersCreative, 
  getDefaultLayoutForCount, 
  calculateNewJoinersMetrics 
} from '../lib/canvas';
import { 
  Download, 
  Maximize2, 
  Users, 
  X, 
  SlidersHorizontal, 
  RotateCcw, 
  Check, 
  Copy,
  Film,
  Video
} from 'lucide-react';

interface Props {
  key?: React.Key;
  joiners: Employee[];
  pageNumber: number;
  totalPages: number;
  initialGapX?: number;
  initialBalanceRows?: boolean;
  onUpdateSettings?: (pageIndex: number, settings: { customGapX: number; balanceRows: boolean }) => void;
  onApplyToAll?: (settings: { customGapX: number; balanceRows: boolean }) => void;
  onOpenGifModal?: (
    joiners: Employee[],
    partLabel: string,
    initialFormat?: 'mp4' | 'webm' | 'gif',
    initialMode?: 'slides' | 'carousel'
  ) => void;
}

export const NewJoinersPreview: React.FC<Props> = ({ 
  joiners, 
  pageNumber, 
  totalPages,
  initialGapX,
  initialBalanceRows = true,
  onUpdateSettings,
  onApplyToAll,
  onOpenGifModal
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);

  // Layout default configuration based on the count of joiners
  const defaultLayout = getDefaultLayoutForCount(joiners.length);

  // Custom gap state for this specific template
  const [customGapX, setCustomGapX] = useState<number>(
    initialGapX !== undefined ? initialGapX : defaultLayout.defaultGapX
  );
  const [balanceRows, setBalanceRows] = useState<boolean>(initialBalanceRows);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // Synchronize when initialGapX changes from parent (e.g. "Apply to all")
  useEffect(() => {
    if (initialGapX !== undefined && initialGapX !== customGapX) {
      setCustomGapX(initialGapX);
    }
  }, [initialGapX, customGapX]);

  useEffect(() => {
    if (initialBalanceRows !== undefined && initialBalanceRows !== balanceRows) {
      setBalanceRows(initialBalanceRows);
    }
  }, [initialBalanceRows, balanceRows]);

  // Report settings changes to parent when user modifies settings
  const prevSettingsRef = useRef({ customGapX, balanceRows });
  useEffect(() => {
    if (
      prevSettingsRef.current.customGapX !== customGapX ||
      prevSettingsRef.current.balanceRows !== balanceRows
    ) {
      prevSettingsRef.current = { customGapX, balanceRows };
      onUpdateSettings?.(pageNumber - 1, { customGapX, balanceRows });
    }
  }, [customGapX, balanceRows, pageNumber, onUpdateSettings]);

  // Current calculated metrics (side padding, total width, active gap)
  const metrics = calculateNewJoinersMetrics(joiners.length, customGapX, balanceRows);

  // Has uneven rows (e.g. 5 joiners is 3+2, 7 joiners is 4+3, 9 joiners is 5+4)
  const hasUnevenRows = defaultLayout.rows.length > 1 && 
    defaultLayout.rows.some(r => r !== defaultLayout.rows[0]);

  // Render creative on canvas
  useEffect(() => {
    let isMounted = true;

    const renderCreative = async () => {
      if (!canvasRef.current || joiners.length === 0) return;
      setIsLoading(true);

      try {
        await document.fonts.ready;
        await drawNewJoinersCreative(canvasRef.current, joiners, {
          pageNumber,
          totalPages,
          customGapX,
          balanceRows,
        });

        if (isMounted && canvasRef.current) {
          const url = canvasRef.current.toDataURL('image/jpeg', 0.92);
          setDataUrl(url);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error drawing new joiners creative:', err);
        if (isMounted) setIsLoading(false);
      }
    };

    renderCreative();

    return () => {
      isMounted = false;
    };
  }, [joiners, pageNumber, totalPages, customGapX, balanceRows]);

  const fileName = totalPages > 1 
    ? `Weekly_Updates_New_Joiners_Part_${pageNumber}.jpg`
    : `Weekly_Updates_New_Joiners.jpg`;

  const handleApplyToAll = () => {
    onApplyToAll?.({ customGapX, balanceRows });
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const handleResetToAuto = () => {
    setCustomGapX(defaultLayout.defaultGapX);
    setBalanceRows(true);
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col group transition-all hover:shadow-2xl hover:border-blue-100">
      {/* 16:9 Canvas & Preview */}
      <div className="aspect-video bg-slate-100 relative overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} className="hidden" />

        {dataUrl ? (
          <>
            <img
              src={dataUrl}
              alt={`Weekly Updates New Joiners Part ${pageNumber}`}
              className="w-full h-full object-contain cursor-pointer transition-transform duration-500 group-hover:scale-[1.01]"
              onClick={() => setShowModal(true)}
            />
            <button
              onClick={() => setShowModal(true)}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg backdrop-blur-sm"
              title="Expand full resolution"
            >
              <Maximize2 size={18} />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1eb259] rounded-full animate-spin mb-4" />
            <p className="font-semibold text-slate-600">Rendering 4K Creative...</p>
            <p className="text-xs text-slate-400 mt-1">
              Arranging {joiners.length} new joiners symmetrically
            </p>
          </div>
        )}
      </div>

      {/* Spacing & Padding Customization Toolbar */}
      <div className="bg-slate-50/80 border-t border-b border-slate-100 px-6 py-4 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-[#046eb6]" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#12284b]">
              Custom Horizontal Spacing & Padding
            </span>
            <span className="text-xs text-slate-400 font-medium">
              ({joiners.length} {joiners.length === 1 ? 'card' : 'cards'} layout)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Metrics Badges */}
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 shadow-xs">
              Gap: <strong className="text-[#046eb6]">{customGapX}px</strong>
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-800 shadow-xs">
              Side Padding: <strong className="text-[#1eb259]">{metrics.sidePadding}px</strong>
            </span>

            <button
              onClick={handleResetToAuto}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-md hover:bg-slate-200/60 transition-colors"
              title="Reset gap to balanced auto layout"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          </div>
        </div>

        {showControls && (
          <div className="space-y-4 pt-1">
            {/* Slider & Quick Presets */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Slider with Precision Controls */}
              <div className="md:col-span-7 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCustomGapX(prev => Math.max(defaultLayout.minGapX, prev - 10))}
                  disabled={customGapX <= defaultLayout.minGapX}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 flex items-center justify-center transition-colors shadow-xs"
                >
                  -
                </button>
                <div className="flex-1 flex flex-col gap-1">
                  <input
                    type="range"
                    min={defaultLayout.minGapX}
                    max={defaultLayout.maxGapX}
                    step={2}
                    value={customGapX}
                    onChange={(e) => setCustomGapX(Number(e.target.value))}
                    className="w-full accent-[#046eb6] cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium px-0.5">
                    <span>Compact ({defaultLayout.minGapX}px)</span>
                    <span>Auto ({defaultLayout.defaultGapX}px)</span>
                    <span>Wide ({defaultLayout.maxGapX}px)</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomGapX(prev => Math.min(defaultLayout.maxGapX, prev + 10))}
                  disabled={customGapX >= defaultLayout.maxGapX}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 flex items-center justify-center transition-colors shadow-xs"
                >
                  +
                </button>
              </div>

              {/* Preset Buttons */}
              <div className="md:col-span-5 flex flex-wrap items-center gap-1.5 justify-start md:justify-end">
                <button
                  onClick={() => setCustomGapX(Math.max(defaultLayout.minGapX, Math.round(defaultLayout.defaultGapX * 0.65)))}
                  className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                    customGapX < defaultLayout.defaultGapX - 15
                      ? 'bg-[#12284b] text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Compact
                </button>
                <button
                  onClick={() => setCustomGapX(defaultLayout.defaultGapX)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                    customGapX === defaultLayout.defaultGapX
                      ? 'bg-[#12284b] text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Balanced (Auto)
                </button>
                <button
                  onClick={() => setCustomGapX(Math.min(defaultLayout.maxGapX, Math.round(defaultLayout.defaultGapX * 1.35)))}
                  className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                    customGapX > defaultLayout.defaultGapX + 15
                      ? 'bg-[#12284b] text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Spacious
                </button>
              </div>
            </div>

            {/* Uneven Row Balancing & Multi-Creative Sync */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200/60 text-xs">
              {hasUnevenRows ? (
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={balanceRows}
                    onChange={(e) => setBalanceRows(e.target.checked)}
                    className="rounded text-[#046eb6] focus:ring-[#046eb6] h-4 w-4"
                  />
                  <span className="font-medium">
                    Auto-balance uneven row spacing{' '}
                    <span className="text-slate-400 font-normal">
                      ({defaultLayout.rows.join(' + ')} cards)
                    </span>
                  </span>
                </label>
              ) : (
                <span className="text-slate-400">
                  Even layout ({defaultLayout.rows.join(' + ')} cards per row)
                </span>
              )}

              {totalPages > 1 && onApplyToAll && (
                <button
                  onClick={handleApplyToAll}
                  className="inline-flex items-center gap-1.5 font-bold text-xs text-[#046eb6] hover:text-[#12284b] hover:bg-blue-50/80 px-3 py-1 rounded-lg transition-colors border border-blue-100"
                >
                  {copiedNotification ? (
                    <>
                      <Check size={14} className="text-emerald-600" />
                      <span className="text-emerald-600 font-bold">Applied to all {totalPages} creatives!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      Apply this gap to all {totalPages} creatives
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Info & Action Bar */}
      <div className="p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="font-black text-[#12284b] text-xl">
              {totalPages > 1 ? `Creative ${pageNumber} of ${totalPages}` : 'Weekly Updates Creative'}
            </h3>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-[#1eb259] border border-emerald-200">
              <Users size={14} />
              {joiners.length} {joiners.length === 1 ? 'Joiner' : 'Joiners'}
            </span>
          </div>

          {/* Scannable Joiners List */}
          <div className="flex flex-wrap gap-1.5 mt-2.5 max-w-xl">
            {joiners.map((emp) => (
              <span
                key={emp.id}
                className="text-xs text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md font-medium truncate max-w-[180px]"
                title={`${emp.name} (${emp.designation || 'Team Member'} - ${emp.location || 'Location'})`}
              >
                {emp.name}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-end sm:self-center">
          {onOpenGifModal && (
            <>
              <button
                onClick={() =>
                  onOpenGifModal(
                    joiners,
                    totalPages > 1 ? `Part ${pageNumber}` : 'New Joiners',
                    'mp4',
                    'slides'
                  )
                }
                className="inline-flex items-center gap-2 text-sm font-bold bg-blue-50 hover:bg-blue-100/80 text-[#046eb6] hover:text-[#12284b] border border-blue-200 px-4 py-3 rounded-xl transition-all shadow-xs group cursor-pointer"
                title="Export MP4 Video (H.264)"
              >
                <Video size={18} className="text-[#046eb6] group-hover:scale-110 transition-transform" />
                Export MP4
              </button>

              <button
                onClick={() =>
                  onOpenGifModal(
                    joiners,
                    totalPages > 1 ? `Part ${pageNumber}` : 'New Joiners',
                    'webm',
                    'slides'
                  )
                }
                className="inline-flex items-center gap-2 text-sm font-bold bg-emerald-50/90 hover:bg-emerald-100 text-[#0f766e] hover:text-[#12284b] border border-emerald-300 px-4 py-3 rounded-xl transition-all shadow-xs group cursor-pointer"
                title="Export WebM Video with VP9 codec — universally supported without AVC1"
              >
                <Video size={18} className="text-[#1eb259] group-hover:scale-110 transition-transform" />
                <span>Export WebM</span>
                <span className="text-[10px] font-bold bg-emerald-200/70 text-emerald-900 px-1.5 py-0.5 rounded-md">
                  No AVC1
                </span>
              </button>

              <button
                onClick={() =>
                  onOpenGifModal(
                    joiners,
                    totalPages > 1 ? `Part ${pageNumber}` : 'New Joiners',
                    'gif',
                    'slides'
                  )
                }
                className="inline-flex items-center gap-2 text-sm font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-[#12284b] border border-slate-200 px-4 py-3 rounded-xl transition-all shadow-xs group cursor-pointer"
              >
                <Film size={18} className="text-[#1eb259] group-hover:scale-110 transition-transform" />
                Export GIF
              </button>
            </>
          )}

          {dataUrl && (
            <a
              href={dataUrl}
              download={fileName}
              className="inline-flex items-center gap-2 text-sm font-bold bg-[#12284b] hover:bg-[#046eb6] text-white px-5 py-3 rounded-xl transition-all shadow-md shadow-blue-900/10 hover:shadow-lg cursor-pointer"
            >
              <Download size={18} />
              Download JPG
            </a>
          )}
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {showModal && dataUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col p-4 md:p-8 animate-in fade-in duration-200"
          onClick={() => setShowModal(false)}
        >
          <div className="flex items-center justify-between text-white mb-4">
            <div className="flex items-center gap-3">
              <h4 className="text-xl font-bold">
                {totalPages > 1 ? `Creative Part ${pageNumber} of ${totalPages}` : 'Weekly Updates – New Joiners'}
              </h4>
              <span className="text-sm font-medium text-slate-300">({joiners.length} employees)</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {onOpenGifModal && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowModal(false);
                      onOpenGifModal(
                        joiners,
                        totalPages > 1 ? `Part ${pageNumber}` : 'New Joiners',
                        'mp4',
                        'slides'
                      );
                    }}
                    className="inline-flex items-center gap-2 text-sm font-bold bg-[#046eb6] hover:bg-blue-600 border border-white/20 text-white px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    <Video size={16} /> Export MP4
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowModal(false);
                      onOpenGifModal(
                        joiners,
                        totalPages > 1 ? `Part ${pageNumber}` : 'New Joiners',
                        'webm',
                        'slides'
                      );
                    }}
                    className="inline-flex items-center gap-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 border border-white/20 text-white px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer"
                    title="Export WebM Video (VP9 - No AVC1)"
                  >
                    <Video size={16} /> Export WebM
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowModal(false);
                      onOpenGifModal(
                        joiners,
                        totalPages > 1 ? `Part ${pageNumber}` : 'New Joiners',
                        'gif',
                        'slides'
                      );
                    }}
                    className="inline-flex items-center gap-2 text-sm font-bold bg-[#12284b] hover:bg-[#046eb6] border border-white/20 text-white px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    <Film size={16} className="text-[#1eb259]" /> Export GIF
                  </button>
                </>
              )}
              <a
                href={dataUrl}
                download={fileName}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-2 text-sm font-bold bg-[#1eb259] hover:bg-green-600 text-white px-5 py-2 rounded-xl transition-all shadow-lg cursor-pointer"
              >
                <Download size={16} /> Save JPG
              </a>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-slate-300 bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <img
              src={dataUrl}
              alt="Full Preview"
              className="max-h-full max-w-full object-contain rounded-xl shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};
