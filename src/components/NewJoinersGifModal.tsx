import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Employee } from '../types';
import {
  ExportFormat,
  AnimationMode,
  GifExportOptions,
  GifPace,
  GifResolution,
  GifLayout,
  GifProgressState,
  getPaceConfig,
  getSlidePaceConfig,
  renderJoinerFrame,
  renderStaticSlideFrame,
  preloadJoinerImages,
  generateNewJoinersGif,
  generateNewJoinersMp4,
  generateNewJoinersWebm,
} from '../lib/newJoinersGif';
import { splitNewJoiners } from '../lib/canvas';
import { saveAs } from 'file-saver';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  Film,
  Video,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Layers,
  LayoutGrid,
  Clock,
  Monitor,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  allJoiners: Employee[];
  initialSelectedJoiners?: Employee[];
  partLabel?: string;
  initialFormat?: ExportFormat;
  initialMode?: AnimationMode;
}

export const NewJoinersGifModal: React.FC<Props> = ({
  isOpen,
  onClose,
  allJoiners,
  initialSelectedJoiners,
  partLabel,
  initialFormat = 'mp4',
  initialMode = 'slides',
}) => {
  const [format, setFormat] = useState<ExportFormat>(initialFormat);
  const [animationMode, setAnimationMode] = useState<AnimationMode>(initialMode);
  const [scope, setScope] = useState<'current' | 'all'>(
    initialSelectedJoiners && initialSelectedJoiners.length < allJoiners.length
      ? 'current'
      : 'all'
  );
  const [pace, setPace] = useState<GifPace>('balanced');
  const [resolution, setResolution] = useState<GifResolution>(
    initialFormat === 'mp4' ? 'fullhd' : 'hd'
  );
  const [layout, setLayout] = useState<GifLayout>('split');

  // Synchronize initialFormat & initialMode if changed when opened
  useEffect(() => {
    if (isOpen) {
      if (initialFormat) {
        setFormat((prev) => {
          if (prev !== initialFormat) {
            if (initialFormat === 'mp4') {
              setResolution('fullhd');
            }
            return initialFormat;
          }
          return prev;
        });
      }
      if (initialMode) {
        setAnimationMode(initialMode);
      }
    }
  }, [initialFormat, initialMode, isOpen]);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [imagesLoaded, setImagesLoaded] = useState<boolean>(false);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<GifProgressState | null>(null);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const abortControllerRef = useRef<{ aborted: boolean }>({ aborted: false });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const currentFrameRef = useRef<number>(0);

  // Determine active joiners list based on scope
  const activeJoiners = useMemo(() => {
    return scope === 'current' && initialSelectedJoiners && initialSelectedJoiners.length > 0
      ? initialSelectedJoiners
      : allJoiners;
  }, [scope, initialSelectedJoiners, allJoiners]);

  // Slides configuration for static multi-card creative mode
  const allPagesCount = useMemo(() => splitNewJoiners(allJoiners).length, [allJoiners]);
  const slides = useMemo(() => {
    if (scope === 'current' && initialSelectedJoiners && initialSelectedJoiners.length > 0) {
      return [initialSelectedJoiners];
    }
    return splitNewJoiners(allJoiners);
  }, [scope, initialSelectedJoiners, allJoiners]);

  // Pace timings
  const slideTiming = useMemo(() => getSlidePaceConfig(pace, 24), [pace]);
  const paceConfig = useMemo(() => getPaceConfig(pace), [pace]);

  const totalSlideFrames = Math.max(1, slides.length * slideTiming.totalFramesPerSlide);
  const totalFramesPerJoiner = paceConfig.holdFrames + paceConfig.transFrames;
  const totalCarouselFrames = Math.max(1, activeJoiners.length * totalFramesPerJoiner);

  const totalFrames = animationMode === 'slides' ? totalSlideFrames : totalCarouselFrames;

  // Preload images whenever active joiners change
  useEffect(() => {
    let isMounted = true;
    setImagesLoaded(false);

    preloadJoinerImages(activeJoiners).then((map) => {
      if (isMounted) {
        imagesRef.current = map;
        setImagesLoaded(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeJoiners]);

  // Reset frame index on key changes
  useEffect(() => {
    setCurrentFrame(0);
    currentFrameRef.current = 0;
  }, [activeJoiners.length, animationMode, pace, layout, scope]);

  // Clean up generated object URL
  useEffect(() => {
    return () => {
      if (generatedUrl) {
        URL.revokeObjectURL(generatedUrl);
      }
    };
  }, [generatedUrl]);

  // Live Animation Loop on interactive canvas
  useEffect(() => {
    if (!isOpen || !imagesLoaded || !canvasRef.current || activeJoiners.length === 0) return;

    const canvas = canvasRef.current;
    canvas.width = 960;
    canvas.height = 540;

    let localFrame = currentFrameRef.current;
    const fps = animationMode === 'slides' ? slideTiming.fps : paceConfig.fps;
    const frameInterval = 1000 / fps;
    lastTimeRef.current = 0;

    const animate = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = time - lastTimeRef.current;

      if (isPlaying && delta >= frameInterval) {
        localFrame = (localFrame + 1) % totalFrames;
        currentFrameRef.current = localFrame;
        setCurrentFrame(localFrame);
        lastTimeRef.current = time - (delta % frameInterval);
      }

      // Draw current frame based on active animation mode
      if (animationMode === 'slides') {
        const pageOffset =
          scope === 'current' && partLabel
            ? (parseInt(partLabel.replace(/\D/g, '')) || 1) - 1
            : 0;

        renderStaticSlideFrame(canvas, slides, imagesRef.current, localFrame, slideTiming, {
          totalSlidesCount: allPagesCount,
          pageOffset,
        });
      } else {
        renderJoinerFrame(
          canvas,
          activeJoiners,
          imagesRef.current,
          localFrame,
          paceConfig,
          layout
        );
      }

      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    animationFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [
    isOpen,
    imagesLoaded,
    isPlaying,
    animationMode,
    slides,
    slideTiming,
    activeJoiners,
    paceConfig,
    layout,
    totalFrames,
    allPagesCount,
    scope,
    partLabel,
  ]);

  // Render single frame when paused or scrubbing
  useEffect(() => {
    if (!isOpen || !imagesLoaded || !canvasRef.current || activeJoiners.length === 0 || isPlaying) return;
    const canvas = canvasRef.current;
    if (animationMode === 'slides') {
      const pageOffset =
        scope === 'current' && partLabel
          ? (parseInt(partLabel.replace(/\D/g, '')) || 1) - 1
          : 0;

      renderStaticSlideFrame(canvas, slides, imagesRef.current, currentFrame, slideTiming, {
        totalSlidesCount: allPagesCount,
        pageOffset,
      });
    } else {
      renderJoinerFrame(
        canvas,
        activeJoiners,
        imagesRef.current,
        currentFrame,
        paceConfig,
        layout
      );
    }
  }, [
    currentFrame,
    isPlaying,
    isOpen,
    imagesLoaded,
    animationMode,
    slides,
    activeJoiners,
    slideTiming,
    paceConfig,
    layout,
    allPagesCount,
    scope,
    partLabel,
  ]);

  if (!isOpen) return null;

  // Active indices for navigation and badges
  const currentSlideIdx =
    Math.floor(currentFrame / slideTiming.totalFramesPerSlide) % Math.max(1, slides.length);
  const currentSlideJoiners = slides[currentSlideIdx] || [];

  const currentJoinerIdx =
    Math.floor(currentFrame / totalFramesPerJoiner) % Math.max(1, activeJoiners.length);
  const currentJoiner = activeJoiners[currentJoinerIdx];

  const handlePrev = () => {
    if (animationMode === 'slides') {
      const prevIdx = (currentSlideIdx - 1 + slides.length) % slides.length;
      setCurrentFrame(prevIdx * slideTiming.totalFramesPerSlide);
      currentFrameRef.current = prevIdx * slideTiming.totalFramesPerSlide;
    } else {
      const prevIdx = (currentJoinerIdx - 1 + activeJoiners.length) % activeJoiners.length;
      setCurrentFrame(prevIdx * totalFramesPerJoiner);
      currentFrameRef.current = prevIdx * totalFramesPerJoiner;
    }
  };

  const handleNext = () => {
    if (animationMode === 'slides') {
      const nextIdx = (currentSlideIdx + 1) % slides.length;
      setCurrentFrame(nextIdx * slideTiming.totalFramesPerSlide);
      currentFrameRef.current = nextIdx * slideTiming.totalFramesPerSlide;
    } else {
      const nextIdx = (currentJoinerIdx + 1) % activeJoiners.length;
      setCurrentFrame(nextIdx * totalFramesPerJoiner);
      currentFrameRef.current = nextIdx * totalFramesPerJoiner;
    }
  };

  const handleStartGeneration = async () => {
    if (activeJoiners.length === 0) return;

    setIsGenerating(true);
    setProgress({
      currentFrame: 0,
      totalFrames,
      percentage: 0,
      phase: 'loading',
    });
    abortControllerRef.current = { aborted: false };

    try {
      const pageOffset =
        scope === 'current' && partLabel
          ? (parseInt(partLabel.replace(/\D/g, '')) || 1) - 1
          : 0;

      const options: GifExportOptions = {
        format,
        animationMode,
        resolution,
        pace,
        layout,
        fps: format === 'mp4' ? 24 : animationMode === 'slides' ? 12 : paceConfig.fps,
        loop: true,
        pageOffset,
        totalSlidesCount: allPagesCount,
      };

      const blob =
        format === 'mp4'
          ? await generateNewJoinersMp4(
              activeJoiners,
              options,
              (p) => setProgress(p),
              abortControllerRef.current
            )
          : format === 'webm'
          ? await generateNewJoinersWebm(
              activeJoiners,
              options,
              (p) => setProgress(p),
              abortControllerRef.current
            )
          : await generateNewJoinersGif(
              activeJoiners,
              options,
              (p) => setProgress(p),
              abortControllerRef.current
            );

      setGeneratedBlob(blob);
      if (generatedUrl) URL.revokeObjectURL(generatedUrl);
      const url = URL.createObjectURL(blob);
      setGeneratedUrl(url);

      // Trigger download
      const extension = format === 'mp4' ? 'mp4' : format === 'webm' ? 'webm' : 'gif';
      const modeSuffix = animationMode === 'slides' ? 'Slides' : 'Carousel';
      const typeSuffix =
        format === 'mp4' ? 'Video' : format === 'webm' ? 'Video_VP9' : 'Animated';
      const fileName =
        scope === 'current' && partLabel
          ? `Weekly_Updates_New_Joiners_${partLabel.replace(/\s+/g, '_')}_${modeSuffix}_${typeSuffix}.${extension}`
          : `Weekly_Updates_New_Joiners_${modeSuffix}_${typeSuffix}.${extension}`;

      saveAs(blob, fileName);
    } catch (err: any) {
      if (
        err?.message !== 'GIF generation cancelled' &&
        err?.message !== 'MP4 generation cancelled' &&
        err?.message !== 'WebM generation cancelled'
      ) {
        console.error(`Error creating ${format.toUpperCase()}:`, err);
        alert(`Failed to generate ${format.toUpperCase()}: ` + (err?.message || 'Unknown error'));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancelGeneration = () => {
    abortControllerRef.current.aborted = true;
    setIsGenerating(false);
    setProgress(null);
  };

  const activeFps = animationMode === 'slides' ? slideTiming.fps : paceConfig.fps;
  const currentTimeSeconds = (currentFrame / activeFps).toFixed(1);
  const totalDurationSeconds = (totalFrames / activeFps).toFixed(1);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-6xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#12284b] text-white px-8 py-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1eb259] to-[#046eb6] flex items-center justify-center text-white shadow-lg shadow-green-900/30">
              {format === 'mp4' ? (
                <Video size={22} strokeWidth={2.5} />
              ) : (
                <Film size={22} strokeWidth={2.5} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black tracking-tight text-white">
                  {format === 'mp4' ? 'Export MP4 Video' : 'Export Animated GIF'}
                </h3>
                <span className="text-[11px] font-bold uppercase tracking-wider bg-[#1eb259]/20 text-[#1eb259] border border-[#1eb259]/30 px-2.5 py-0.5 rounded-full">
                  {animationMode === 'slides' ? 'Multi-Card Slides' : 'Solo Carousel'}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider bg-white/10 text-slate-300 border border-white/20 px-2 py-0.5 rounded-full">
                  {format === 'mp4' ? 'H.264 Video' : 'GIF Loop'}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                {animationMode === 'slides'
                  ? 'Animates the multi-card creative layout slide-by-slide with synchronized slide-out and slide-in motion'
                  : 'Animates each new joiner individually in sequential full-screen presentation cards'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Live Canvas Preview & Player */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
              <span className="flex items-center gap-1.5 text-[#12284b]">
                <Monitor size={14} className="text-[#046eb6]" />
                Live Preview (16:9 • {resolution.toUpperCase()})
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                {currentTimeSeconds}s / {totalDurationSeconds}s ({totalFrames} frames)
              </span>
            </div>

            {/* Video Canvas Box */}
            <div className="aspect-video bg-slate-900 rounded-3xl overflow-hidden shadow-xl border border-slate-200 relative group flex items-center justify-center">
              <canvas ref={canvasRef} className="w-full h-full object-contain" />

              {!imagesLoaded && (
                <div className="absolute inset-0 bg-[#12284b]/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                  <div className="w-10 h-10 border-4 border-white/20 border-t-[#1eb259] rounded-full animate-spin mb-3" />
                  <p className="font-bold text-sm">Preparing Creative Assets...</p>
                </div>
              )}

              {/* Top overlay badge */}
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-md">
                <span className="w-2 h-2 rounded-full bg-[#1eb259] animate-pulse" />
                {animationMode === 'slides' ? (
                  <span>
                    Slide {currentSlideIdx + 1} of {slides.length}{' '}
                    <span className="text-slate-300 font-normal">
                      ({currentSlideJoiners.length} employees)
                    </span>
                  </span>
                ) : (
                  <span>
                    {currentJoiner ? currentJoiner.name : 'Joiner'}{' '}
                    <span className="text-slate-300 font-normal">
                      ({currentJoinerIdx + 1} of {activeJoiners.length})
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Playback Controls & Scrubber */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-3">
              {/* Scrubber slider */}
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, totalFrames - 1)}
                  value={currentFrame}
                  onChange={(e) => {
                    setIsPlaying(false);
                    const val = Number(e.target.value);
                    setCurrentFrame(val);
                    currentFrameRef.current = val;
                  }}
                  className="flex-1 accent-[#046eb6] cursor-pointer h-2 bg-slate-200 rounded-lg"
                />
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrev}
                    className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"
                    title={animationMode === 'slides' ? 'Previous Slide' : 'Previous Joiner'}
                  >
                    <SkipBack size={16} />
                  </button>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-4 py-2 rounded-xl bg-[#12284b] hover:bg-[#046eb6] text-white font-bold text-xs flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
                  >
                    {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                    {isPlaying ? 'Pause' : 'Play Animation'}
                  </button>
                  <button
                    onClick={handleNext}
                    className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"
                    title={animationMode === 'slides' ? 'Next Slide' : 'Next Joiner'}
                  >
                    <SkipForward size={16} />
                  </button>
                </div>

                {/* Progress Indicators */}
                {animationMode === 'slides' ? (
                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-[260px] py-1">
                    {slides.map((sl, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setIsPlaying(false);
                          const f = i * slideTiming.totalFramesPerSlide;
                          setCurrentFrame(f);
                          currentFrameRef.current = f;
                        }}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          i === currentSlideIdx
                            ? 'bg-[#12284b] text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                        title={`Slide ${i + 1} (${sl.length} joiners)`}
                      >
                        Slide {i + 1} ({sl.length})
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-[200px] py-1">
                    {activeJoiners.map((emp, i) => (
                      <button
                        key={emp.id || i}
                        onClick={() => {
                          setIsPlaying(false);
                          const f = i * totalFramesPerJoiner;
                          setCurrentFrame(f);
                          currentFrameRef.current = f;
                        }}
                        className={`h-2.5 rounded-full transition-all cursor-pointer ${
                          i === currentJoinerIdx
                            ? 'w-6 bg-[#1eb259]'
                            : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                        }`}
                        title={`Go to ${emp.name}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Settings & Export Controls */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Format Selection Toggle: MP4 vs WebM vs GIF */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-[#12284b] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Video size={14} className="text-[#046eb6]" />
                  Export Format
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Choose format</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setFormat('mp4');
                    if (resolution === 'standard' || resolution === 'hd') {
                      setResolution('fullhd');
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    format === 'mp4'
                      ? 'bg-white text-[#12284b] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Video size={15} className={format === 'mp4' ? 'text-[#046eb6]' : 'text-slate-400'} />
                    <span>MP4 Video</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">H.264 / AVC</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormat('webm');
                    if (resolution === 'standard' || resolution === 'hd') {
                      setResolution('fullhd');
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer relative ${
                    format === 'webm'
                      ? 'bg-white text-[#12284b] shadow-sm ring-2 ring-emerald-500/20'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Video size={15} className={format === 'webm' ? 'text-[#1eb259]' : 'text-slate-400'} />
                    <span>WebM Video</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-full">
                    VP9 (No AVC1)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('gif')}
                  className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    format === 'gif'
                      ? 'bg-white text-[#12284b] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Film size={15} className={format === 'gif' ? 'text-[#1eb259]' : 'text-slate-400'} />
                    <span>Animated GIF</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">Looping Image</span>
                </button>
              </div>

              {/* Codec compatibility note */}
              {format === 'webm' && (
                <div className="text-[11px] leading-relaxed text-emerald-800 bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-2.5 flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Royalty-Free Open Standard:</strong> WebM uses the VP9 codec and does not require AVC1. Ideal if your video player or platform reported <em>"avc1 format is not supported"</em>.
                  </span>
                </div>
              )}
              {format === 'mp4' && (
                <div className="text-[11px] leading-relaxed text-blue-800 bg-blue-50/90 border border-blue-200/80 rounded-xl p-2.5 flex items-start gap-2">
                  <Video size={15} className="text-[#046eb6] shrink-0 mt-0.5" />
                  <span>
                    <strong>Universal H.264 Baseline:</strong> Standard MP4 container with Baseline Profile H.264 and AVCC configuration for QuickTime, Windows, Apple Keynote, and PowerPoint.
                  </span>
                </div>
              )}
            </div>

            {/* Animation Style Selector: Multi-Card Slides vs Solo Carousel */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-[#12284b] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[#1eb259]" />
                  Animation Style
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Choose layout style</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAnimationMode('slides');
                    setCurrentFrame(0);
                    currentFrameRef.current = 0;
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    animationMode === 'slides'
                      ? 'border-[#046eb6] bg-blue-50/70 text-[#12284b] shadow-xs ring-2 ring-[#046eb6]/30'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <LayoutGrid
                      size={16}
                      className={animationMode === 'slides' ? 'text-[#046eb6]' : 'text-slate-400'}
                    />
                    <span className="text-xs font-black">Multi-Card Slides</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-snug">
                    Animates existing static creatives (e.g. 8 + 7 + 7 cards) with synchronized slide transitions.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAnimationMode('carousel');
                    setCurrentFrame(0);
                    currentFrameRef.current = 0;
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    animationMode === 'carousel'
                      ? 'border-[#1eb259] bg-emerald-50/70 text-[#12284b] shadow-xs ring-2 ring-[#1eb259]/30'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Film
                      size={16}
                      className={animationMode === 'carousel' ? 'text-[#1eb259]' : 'text-slate-400'}
                    />
                    <span className="text-xs font-black">Solo Carousel</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-snug">
                    Spotlights 1 employee at a time in full sequential presentation cards.
                  </div>
                </button>
              </div>
            </div>

            {/* Scope Selection */}
            {initialSelectedJoiners && allJoiners.length > initialSelectedJoiners.length && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-[#12284b] flex items-center gap-1.5">
                  <Layers size={14} className="text-[#046eb6]" />
                  Include in {format === 'mp4' ? 'Video' : 'GIF'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setScope('current')}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-left cursor-pointer ${
                      scope === 'current'
                        ? 'border-[#046eb6] bg-blue-50/60 text-[#046eb6] shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div>{partLabel || 'Current Creative'}</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {initialSelectedJoiners.length} employees (1 slide)
                    </div>
                  </button>
                  <button
                    onClick={() => setScope('all')}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-left cursor-pointer ${
                      scope === 'all'
                        ? 'border-[#046eb6] bg-blue-50/60 text-[#046eb6] shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div>All Creatives</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {allJoiners.length} employees ({allPagesCount} slides)
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Carousel Layout Mode (only visible in solo carousel mode) */}
            {animationMode === 'carousel' && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-[#12284b] flex items-center gap-1.5">
                  <Sliders size={14} className="text-[#046eb6]" />
                  Carousel Layout
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLayout('split')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      layout === 'split'
                        ? 'border-[#1eb259] bg-emerald-50/40 text-[#12284b] shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-extrabold">Executive Split</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Portrait Photo on Left, Information Card on Right
                    </div>
                  </button>
                  <button
                    onClick={() => setLayout('hero')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      layout === 'hero'
                        ? 'border-[#1eb259] bg-emerald-50/40 text-[#12284b] shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-extrabold">Broadcast Hero</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Hero Center Card with Lower-Third Dock
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Animation Pace / Hold Time */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-[#12284b] flex items-center gap-1.5">
                <Clock size={14} className="text-[#046eb6]" />
                {animationMode === 'slides' ? 'Display Pace per Slide' : 'Display Pace per Joiner'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['brisk', 'balanced', 'relaxed'] as GifPace[]).map((p) => {
                  const slideLabels = {
                    brisk: { title: 'Brisk', time: '2.2s hold' },
                    balanced: { title: 'Balanced', time: '3.2s hold' },
                    relaxed: { title: 'Relaxed', time: '4.5s hold' },
                  };
                  const carouselLabels = {
                    brisk: { title: 'Brisk', time: '1.6s' },
                    balanced: { title: 'Balanced', time: '2.2s' },
                    relaxed: { title: 'Relaxed', time: '3.0s' },
                  };
                  const labels = animationMode === 'slides' ? slideLabels : carouselLabels;
                  return (
                    <button
                      key={p}
                      onClick={() => setPace(p)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        pace === p
                          ? 'border-[#046eb6] bg-blue-50 text-[#12284b] font-bold shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <div className="text-xs">{labels[p].title}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{labels[p].time}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resolution / Quality */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-[#12284b] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Monitor size={14} className="text-[#046eb6]" />
                  Resolution Preset
                </span>
                {format === 'mp4' && (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    1080p Recommended
                  </span>
                )}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['standard', 'hd', 'hd720', 'fullhd'] as GifResolution[]).map((res) => {
                  const configs = {
                    standard: {
                      title: 'Standard',
                      res: '720×405',
                      size: format === 'mp4' ? '~1-2 MB' : format === 'webm' ? '~1-2 MB' : '~2-3 MB',
                    },
                    hd: {
                      title: 'HD 540p',
                      res: '960×540',
                      size: format === 'mp4' ? '~2-4 MB' : format === 'webm' ? '~2-3 MB' : '~4-6 MB',
                    },
                    hd720: {
                      title: 'HD 720p',
                      res: '1280×720',
                      size: format === 'mp4' ? '~4-6 MB' : format === 'webm' ? '~3-5 MB' : '~6-9 MB',
                    },
                    fullhd: {
                      title: 'Full HD 1080p',
                      res: '1920×1080',
                      size: format === 'mp4' ? '~7-11 MB (Best)' : format === 'webm' ? '~6-9 MB' : '~8-12 MB',
                    },
                  };
                  return (
                    <button
                      key={res}
                      onClick={() => setResolution(res)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        resolution === res
                          ? 'border-[#046eb6] bg-blue-50 text-[#12284b] font-bold shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <div className="text-xs">{configs[res].title}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{configs[res].res}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Animation Features Note */}
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3">
              <Sparkles size={18} className="text-[#1eb259] shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-950">
                <p className="font-bold">
                  {animationMode === 'slides'
                    ? 'Synchronized Multi-Card Slide Motion'
                    : 'Seamless Joiner Carousel'}
                </p>
                <p className="text-slate-600 mt-0.5 leading-relaxed">
                  {animationMode === 'slides'
                    ? 'All cards for each slide slide in together from right, hold clearly for comfortable reading, then slide out together to the left before the next set slides in.'
                    : 'Photos and name cards slide in with smooth cubic easing, display clearly, then slide out before transitioning to the next creative in a continuous loop.'}
                </p>
              </div>
            </div>

            {/* Progress & Export Action */}
            <div className="pt-2">
              {isGenerating ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[#12284b]">
                    <span className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-[#1eb259] rounded-full animate-spin" />
                      {progress?.phase === 'loading'
                        ? 'Loading images...'
                        : progress?.phase === 'rendering'
                        ? `Rendering frame ${progress.currentFrame} of ${progress.totalFrames}...`
                        : `Encoding ${format.toUpperCase()}...`}
                    </span>
                    <span className="text-[#1eb259] font-mono font-black">
                      {progress?.percentage || 0}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#1eb259] to-[#046eb6] h-full transition-all duration-150"
                      style={{ width: `${progress?.percentage || 0}%` }}
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleCancelGeneration}
                      className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleStartGeneration}
                    disabled={activeJoiners.length === 0}
                    className="w-full bg-[#1eb259] hover:bg-green-600 text-white font-extrabold text-base py-4 px-6 rounded-2xl transition-all shadow-xl shadow-green-900/20 hover:shadow-2xl flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Download
                      size={20}
                      className="group-hover:translate-y-0.5 transition-transform"
                    />
                    Generate & Download{' '}
                    {format === 'mp4'
                      ? 'MP4 Video'
                      : format === 'webm'
                      ? 'WebM Video (VP9)'
                      : 'Animated GIF'}
                  </button>

                  {generatedUrl && (
                    <div className="flex items-center justify-between text-xs px-2 py-1">
                      <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                        <CheckCircle2 size={16} /> {format.toUpperCase()} successfully generated!
                      </span>
                      <a
                        href={generatedUrl}
                        download={`Weekly_Updates_New_Joiners_${animationMode === 'slides' ? 'Slides' : 'Carousel'}_${format === 'mp4' ? 'Video.mp4' : format === 'webm' ? 'Video_VP9.webm' : 'Animated.gif'}`}
                        className="font-bold text-[#046eb6] hover:underline"
                      >
                        Download Again
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
