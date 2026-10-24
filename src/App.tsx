import React, { useState, useCallback } from 'react';
import { Employee, EventType } from './types';
import { ExcelDropzone } from './components/ExcelDropzone';
import { PhotoMapper } from './components/PhotoMapper';
import { CreativePreview } from './components/CreativePreview';
import { NewJoinersPreview } from './components/NewJoinersPreview';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { 
  drawBirthdayCreative, 
  drawAnniversaryCreative, 
  drawNewJoinersCreative, 
  splitNewJoiners 
} from './lib/canvas';
import { Gift, ArrowLeft, Download, Sparkles, Cake, Award, UserPlus, Film, Video, LayoutGrid } from 'lucide-react';
import { NewJoinersGifModal } from './components/NewJoinersGifModal';

export default function App() {
  const [eventType, setEventType] = useState<EventType>('birthday');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isZipping, setIsZipping] = useState(false);
  const [templateSettings, setTemplateSettings] = useState<Record<number, { customGapX: number; balanceRows: boolean }>>({});
  const [gifModalState, setGifModalState] = useState<{
    isOpen: boolean;
    selectedJoiners?: Employee[];
    partLabel?: string;
    initialFormat?: 'mp4' | 'webm' | 'gif';
    initialMode?: 'slides' | 'carousel';
  }>({ isOpen: false });

  const handleOpenGifModal = (
    selected?: Employee[],
    partLabel?: string,
    initialFormat: 'mp4' | 'webm' | 'gif' = 'mp4',
    initialMode: 'slides' | 'carousel' = 'slides'
  ) => {
    setGifModalState({
      isOpen: true,
      selectedJoiners: selected,
      partLabel,
      initialFormat,
      initialMode,
    });
  };

  const handleCloseGifModal = () => {
    setGifModalState(prev => ({ ...prev, isOpen: false }));
  };

  const handleExcelLoaded = (loadedEmployees: Employee[]) => {
    setEmployees(loadedEmployees);
    setTemplateSettings({});
    setStep(2);
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to start over? All mapped photos will be lost.")) {
      setEmployees([]);
      setTemplateSettings({});
      setStep(1);
    }
  };

  const handleUpdateTemplateSettings = useCallback((pageIndex: number, settings: { customGapX: number; balanceRows: boolean }) => {
    setTemplateSettings(prev => {
      const existing = prev[pageIndex];
      if (
        existing &&
        existing.customGapX === settings.customGapX &&
        existing.balanceRows === settings.balanceRows
      ) {
        return prev;
      }
      return {
        ...prev,
        [pageIndex]: settings
      };
    });
  }, []);

  const handleApplySettingsToAll = (settings: { customGapX: number; balanceRows: boolean }) => {
    const chunks = splitNewJoiners(employees);
    const newMap: Record<number, { customGapX: number; balanceRows: boolean }> = {};
    for (let i = 0; i < chunks.length; i++) {
      newMap[i] = { ...settings };
    }
    setTemplateSettings(newMap);
  };

  const handleDownloadAll = async () => {
    setIsZipping(true);
    await document.fonts.ready;

    const zip = new JSZip();
    const canvas = document.createElement('canvas');

    if (eventType === 'new_joiners') {
      const chunks = splitNewJoiners(employees);
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const settings = templateSettings[i];
        await drawNewJoinersCreative(canvas, chunk, {
          pageNumber: i + 1,
          totalPages: chunks.length,
          customGapX: settings?.customGapX,
          balanceRows: settings?.balanceRows,
        });
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const base64Data = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, '');

        const fileName = chunks.length > 1
          ? `Weekly_Updates_New_Joiners_Part_${i + 1}.jpg`
          : `Weekly_Updates_New_Joiners.jpg`;

        zip.file(fileName, base64Data, { base64: true });
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'Weekly_Updates_New_Joiners.zip');
    } else {
      // Only process employees that have an image mapped
      const validEmployees = employees.filter(emp => emp.imageUrl);

      for (let i = 0; i < validEmployees.length; i++) {
        const emp = validEmployees[i];
        if (emp.imageUrl) {
          if (eventType === 'birthday') {
            await drawBirthdayCreative(canvas, emp, emp.imageUrl);
          } else {
            await drawAnniversaryCreative(canvas, emp, emp.imageUrl);
          }
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          const base64Data = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, "");

          const seqPart = emp.sequenceNumber !== undefined && emp.sequenceNumber !== 999 ? `${emp.sequenceNumber}. ` : '';
          const namePart = emp.name.trim();
          const dobPart = emp.dob && emp.dob !== 'UnknownDate' ? ` ${emp.dob}` : '';
          let fileName = `${seqPart}${namePart}${dobPart}`;
          fileName = `${fileName.replace(/[<>:"/\\|?*]+/g, '_')}.jpg`;

          zip.file(fileName, base64Data, { base64: true });
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, eventType === 'birthday' ? 'Birthday_Creatives.zip' : 'Work_Anniversary_Creatives.zip');
    }

    setIsZipping(false);
  };

  const validEmployees = employees.filter(e => e.imageUrl);
  const newJoinerChunks = eventType === 'new_joiners' ? splitNewJoiners(employees) : [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['Montserrat'] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-4 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-[#046eb6] to-[#12284b] p-3 rounded-2xl text-white shadow-lg shadow-blue-900/20">
              <Gift size={28} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#12284b]">Employee Post Maker</h1>
              <p className="text-slate-500 text-[10px] font-bold tracking-widest uppercase mt-0.5">Enterprise Generation Tool</p>
            </div>
          </div>
          
          {/* Stepper indicator */}
          <div className="hidden lg:flex items-center gap-3 bg-slate-50 px-6 py-3 rounded-full border border-slate-100">
             <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-[#046eb6] text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
                <span className={`text-xs font-bold uppercase tracking-wider ${step >= 1 ? 'text-[#12284b]' : 'text-slate-400'}`}>Data</span>
             </div>
             <div className="w-8 h-[2px] bg-slate-200" />
             <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-[#046eb6] text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
                <span className={`text-xs font-bold uppercase tracking-wider ${step >= 2 ? 'text-[#12284b]' : 'text-slate-400'}`}>Map</span>
             </div>
             <div className="w-8 h-[2px] bg-slate-200" />
             <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 3 ? 'bg-[#1eb259] text-white' : 'bg-slate-200 text-slate-500'}`}>3</div>
                <span className={`text-xs font-bold uppercase tracking-wider ${step >= 3 ? 'text-[#12284b]' : 'text-slate-400'}`}>Export</span>
             </div>
          </div>

          <div className="flex items-center gap-4">
            {step === 1 && (
              <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1 shadow-inner">
                 <button 
                   onClick={() => setEventType('birthday')}
                   className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${eventType === 'birthday' ? 'bg-white shadow-sm text-[#046eb6]' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   <Cake size={14} />
                   Birthday
                 </button>
                 <button 
                   onClick={() => setEventType('anniversary')}
                   className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${eventType === 'anniversary' ? 'bg-white shadow-sm text-[#1eb259]' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   <Award size={14} />
                   Anniversary
                 </button>
                 <button 
                   onClick={() => setEventType('new_joiners')}
                   className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${eventType === 'new_joiners' ? 'bg-white shadow-sm text-[#12284b]' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   <UserPlus size={14} />
                   New Joiners
                 </button>
              </div>
            )}

            {step > 1 && (
              <button 
                onClick={handleReset}
                className="text-slate-500 hover:text-red-600 flex items-center gap-1.5 text-sm font-bold transition-colors bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 px-5 py-2.5 rounded-xl shadow-sm"
              >
                <ArrowLeft size={16} /> Start Over
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full flex flex-col">
        {step === 1 && (
          <div className="flex-1 flex flex-col justify-center animate-in fade-in zoom-in-95 duration-500">
            <ExcelDropzone onDataLoaded={handleExcelLoaded} eventType={eventType} />
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 h-full">
             <PhotoMapper 
               employees={employees} 
               setEmployees={setEmployees} 
               onComplete={() => setStep(3)} 
               eventType={eventType}
             />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 gap-6">
              <div>
                <h2 className="text-4xl font-black text-[#12284b] tracking-tight flex items-center gap-4">
                  <Sparkles className="text-[#1eb259]" size={36} /> 
                  Your Creatives are Ready!
                </h2>
                <p className="text-slate-500 mt-3 text-lg font-medium">
                  {eventType === 'new_joiners' ? (
                    <>
                      Generated <span className="text-[#1eb259] font-bold">{newJoinerChunks.length} TV-format {newJoinerChunks.length === 1 ? 'creative' : 'creatives'}</span> for {employees.length} new joiners{' '}
                      {newJoinerChunks.length > 1 && (
                        <span className="text-slate-400 font-normal">
                          ({newJoinerChunks.map(c => c.length).join(' + ')} balanced split)
                        </span>
                      )}.
                    </>
                  ) : (
                    <>
                      Successfully generated <span className="text-[#1eb259] font-bold">{validEmployees.length} premium high-resolution</span> {eventType === 'birthday' ? 'birthday' : 'work anniversary'} posts.
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {eventType === 'new_joiners' && (
                  <>
                    <button 
                      onClick={() => handleOpenGifModal(employees, 'All Joiners', 'mp4', 'slides')}
                      disabled={employees.length === 0}
                      className="bg-white hover:bg-blue-50 text-[#12284b] hover:text-[#046eb6] border-2 border-blue-200 hover:border-blue-400 px-6 py-4.5 rounded-2xl font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-3.5 shadow-lg shadow-blue-900/5 text-base group cursor-pointer"
                      title="Animates current static creatives: multi-card slides with synchronized transitions"
                    >
                      <LayoutGrid size={22} className="text-[#046eb6] group-hover:scale-110 transition-transform" />
                      <div className="text-left">
                        <div className="leading-tight font-extrabold">Animate Static Creatives</div>
                        <div className="text-[11px] text-blue-600 font-semibold mt-0.5">Multi-Card Slides (MP4/GIF)</div>
                      </div>
                    </button>

                    <button 
                      onClick={() => handleOpenGifModal(employees, 'All Joiners', 'mp4', 'carousel')}
                      disabled={employees.length === 0}
                      className="bg-white hover:bg-emerald-50 text-[#12284b] hover:text-[#1eb259] border-2 border-emerald-200 hover:border-emerald-400 px-6 py-4.5 rounded-2xl font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-3.5 shadow-lg shadow-emerald-900/5 text-base group cursor-pointer"
                      title="Solo Joiner Spotlight Carousel: 1-by-1 sequential presentation cards"
                    >
                      <Film size={22} className="text-[#1eb259] group-hover:scale-110 transition-transform" />
                      <div className="text-left">
                        <div className="leading-tight font-extrabold">Solo Carousel</div>
                        <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">1-by-1 Spotlight (MP4/GIF)</div>
                      </div>
                    </button>
                  </>
                )}

                <button 
                  onClick={handleDownloadAll}
                  disabled={isZipping || (eventType === 'new_joiners' ? employees.length === 0 : validEmployees.length === 0)}
                  className="bg-[#1eb259] hover:bg-green-600 text-white px-9 py-5 rounded-2xl font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-4 shadow-xl shadow-green-900/20 text-lg group cursor-pointer"
                >
                  <Download size={26} className="group-hover:-translate-y-1 transition-transform" />
                  {isZipping ? 'Bundling ZIP...' : 'Download All as ZIP'}
                </button>
              </div>
            </div>

            {eventType === 'new_joiners' ? (
              <div className="space-y-10">
                {newJoinerChunks.map((chunk, idx) => (
                  <NewJoinersPreview
                    key={idx}
                    joiners={chunk}
                    pageNumber={idx + 1}
                    totalPages={newJoinerChunks.length}
                    initialGapX={templateSettings[idx]?.customGapX}
                    initialBalanceRows={templateSettings[idx]?.balanceRows}
                    onUpdateSettings={handleUpdateTemplateSettings}
                    onApplyToAll={handleApplySettingsToAll}
                    onOpenGifModal={handleOpenGifModal}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {validEmployees.map((emp) => (
                  <CreativePreview key={emp.id} employee={emp} eventType={eventType} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Video & Animated GIF Export Modal */}
      {eventType === 'new_joiners' && (
        <NewJoinersGifModal
          isOpen={gifModalState.isOpen}
          onClose={handleCloseGifModal}
          allJoiners={employees}
          initialSelectedJoiners={gifModalState.selectedJoiners}
          partLabel={gifModalState.partLabel}
          initialFormat={gifModalState.initialFormat}
          initialMode={gifModalState.initialMode}
        />
      )}
    </div>
  );
}

