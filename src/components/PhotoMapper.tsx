import React, { useState, useRef } from 'react';
import { Employee, EventType } from '../types';
import { UploadCloud, CheckCircle2, X, AlertCircle, ArrowRight, Upload } from 'lucide-react';

interface Props {
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  onComplete: () => void;
  eventType?: EventType;
}

/**
 * Calculates a match score between an uploaded photo file and an employee record.
 * 
 * Priorities:
 * 1. Exact Employee Code match (e.g. file is "RCPL0191.jpg" and code is "RCPL0191" or "RCPL 0191") -> Score 100
 * 2. Explicit imageName match (if defined in excel) -> Score 95
 * 3. Exact Employee Name match (e.g. file is "Nilesh Sanghvi.jpg") -> Score 90
 * 4. Substring / Embedded Code match (e.g. "RCPL0191_photo.jpg", "Photo RCPL0191.jpg", "1. RCPL0191.jpg") -> Score 80
 * 5. Substring / Embedded Name match (e.g. "2024_Nilesh_Sanghvi.jpg") -> Score 75
 * 6. Multi-word Name tokens match (all words in employee name appear in file name) -> Score 65
 * 7. Single distinctive name token match -> Score 50
 */
const calculateMatchScore = (file: File, emp: Employee): number => {
  // Strip file extension
  const rawBaseName = file.name.replace(/\.[^/.]+$/, '').trim();
  const lowerBaseName = rawBaseName.toLowerCase();
  const cleanBaseName = lowerBaseName.replace(/[^a-z0-9]/g, '');

  const rawCode = (emp.empCode || '').trim();
  const lowerCode = rawCode.toLowerCase();
  const cleanCode = lowerCode.replace(/[^a-z0-9]/g, '');

  const rawName = (emp.name || '').trim();
  const lowerName = rawName.toLowerCase();
  const cleanName = lowerName.replace(/[^a-z0-9]/g, '');

  const rawImgName = (emp.imageName || '').trim();
  const cleanImgName = rawImgName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Exact Employee Code Match (e.g. "RCPL0191.jpg" or "RCPL 0191.png" with code "RCPL0191")
  if (cleanCode && cleanBaseName === cleanCode) {
    return 100;
  }
  if (lowerCode && lowerBaseName === lowerCode) {
    return 100;
  }

  // 2. Explicit imageName Match
  if (cleanImgName && (cleanBaseName === cleanImgName || lowerBaseName === rawImgName.toLowerCase())) {
    return 95;
  }

  // 3. Exact Employee Name Match
  if (cleanName && cleanBaseName === cleanName) {
    return 90;
  }
  if (lowerName && lowerBaseName === lowerName) {
    return 90;
  }

  // 4. Embedded Code Match (e.g. file contains RCPL0191 as a distinct token or substring)
  if (cleanCode && cleanCode.length >= 3) {
    if (cleanBaseName.includes(cleanCode)) {
      return 80;
    }
  }
  if (lowerCode && lowerCode.length >= 3 && lowerBaseName.includes(lowerCode)) {
    return 80;
  }

  // 5. Embedded Full Name Match
  if (cleanName && cleanName.length >= 4) {
    if (cleanBaseName.includes(cleanName) || (cleanBaseName.length >= 4 && cleanName.includes(cleanBaseName))) {
      return 75;
    }
  }

  // 6. Name Parts / Tokens Match (e.g. "Nilesh Sanghvi" matched in "Nilesh_Kumar_Sanghvi.jpg")
  if (lowerName) {
    const parts = lowerName.split(/\s+/).filter(p => p.length >= 3);
    if (parts.length >= 2 && parts.every(p => lowerBaseName.includes(p))) {
      return 65;
    }
    if (parts.length === 1 && parts[0].length >= 4 && lowerBaseName.includes(parts[0])) {
      return 50;
    }
  }

  return 0;
};

export function PhotoMapper({ employees, setEmployees, onComplete, eventType }: Props) {
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mappedCount = employees.filter(e => e.imageUrl).length;
  const totalCount = employees.length;
  const progressPercentage = totalCount > 0 ? (mappedCount / totalCount) * 100 : 0;

  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingGlobal(true);
  };

  const handleGlobalDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingGlobal(false);
    }
  };

  const handleGlobalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingGlobal(false);
    const files = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.type.startsWith('image/'));
    processFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = (Array.from(e.target.files || []) as File[]).filter(f => f.type.startsWith('image/'));
    processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFiles = (files: File[]) => {
    setEmployees((prev) => {
      const next = [...prev];
      
      // Calculate scores for all unmapped employees and all uploaded files
      const matchCandidates: { fileIndex: number; empIndex: number; score: number }[] = [];

      files.forEach((file, fileIndex) => {
        next.forEach((emp, empIndex) => {
          if (emp.imageUrl) return; // Skip already mapped
          const score = calculateMatchScore(file, emp);
          if (score >= 50) {
            matchCandidates.push({ fileIndex, empIndex, score });
          }
        });
      });

      // Sort by score descending (highest confidence exact code/name matches mapped first)
      matchCandidates.sort((a, b) => b.score - a.score);

      const assignedFiles = new Set<number>();
      const assignedEmps = new Set<number>();

      matchCandidates.forEach(({ fileIndex, empIndex }) => {
        if (assignedFiles.has(fileIndex) || assignedEmps.has(empIndex)) return;
        if (next[empIndex].imageUrl) return;

        next[empIndex] = {
          ...next[empIndex],
          imageUrl: URL.createObjectURL(files[fileIndex]),
        };
        assignedFiles.add(fileIndex);
        assignedEmps.add(empIndex);
      });

      return next;
    });
  };

  const handleSinglePhotoUpload = (empId: string, file: File) => {
    if (!file.type.startsWith('image/')) return;
    setEmployees(prev => prev.map(emp => 
      emp.id === empId ? { ...emp, imageUrl: URL.createObjectURL(file) } : emp
    ));
  };

  const removePhoto = (empId: string) => {
    setEmployees(prev => prev.map(emp => 
      emp.id === empId ? { ...emp, imageUrl: undefined } : emp
    ));
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden w-full max-w-5xl mx-auto">
      {/* Header & Global Dropzone */}
      <div 
        onDragOver={handleGlobalDragOver}
        onDragLeave={handleGlobalDragLeave}
        onDrop={handleGlobalDrop}
        className={`p-10 border-b-2 transition-all duration-300 relative ${isDraggingGlobal ? 'border-[#046eb6] bg-blue-50/80' : 'border-slate-100 bg-slate-50/50'}`}
      >
        {isDraggingGlobal && (
          <div className="absolute inset-0 bg-[#046eb6]/10 backdrop-blur-[2px] z-10 flex items-center justify-center border-[4px] border-[#046eb6] border-dashed rounded-t-[2.5rem]">
            <div className="bg-white px-8 py-5 rounded-full shadow-2xl text-2xl font-bold text-[#046eb6] flex items-center gap-4 animate-bounce">
              <UploadCloud size={32} /> Drop photos to auto-match!
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black text-[#12284b] tracking-tight">Studio Roster</h2>
            <p className="text-slate-500 mt-2 text-base md:text-lg">
              Upload photos in bulk; images are automatically matched by <strong className="text-[#12284b]">Employee Code</strong> (e.g. <code className="bg-slate-200/80 px-1.5 py-0.5 rounded text-sm text-[#046eb6] font-mono">RCPL0191.jpg</code>) or <strong className="text-[#12284b]">Name</strong>.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-white border-2 border-slate-200 hover:border-[#046eb6] text-slate-700 hover:text-[#046eb6] px-6 py-3 rounded-2xl font-bold transition-all shadow-sm flex items-center gap-2"
            >
              <Upload size={20} /> Upload Folder / Photos
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-10 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-sm font-bold mb-3 uppercase tracking-wider">
            <span className="text-slate-500">Matching Progress</span>
            <span className={mappedCount === totalCount ? 'text-[#1eb259]' : 'text-[#046eb6]'}>
              {mappedCount} / {totalCount} Ready
            </span>
          </div>
          <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-700 ${mappedCount === totalCount ? 'bg-[#1eb259]' : 'bg-[#046eb6]'}`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Roster List */}
      <div className="flex-1 overflow-y-auto p-10 bg-[#F8FAFC] min-h-[400px]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map(emp => (
            <div key={emp.id} className={`bg-white rounded-2xl border-[2px] shadow-sm p-4 flex gap-5 items-center transition-all hover:shadow-lg ${emp.imageUrl ? 'border-transparent' : 'border-slate-200 hover:border-blue-300'}`}>
              {/* Photo Area */}
              <div className="w-[100px] h-[100px] rounded-xl flex-shrink-0 relative overflow-hidden group bg-slate-50">
                {emp.imageUrl ? (
                  <>
                    <img src={emp.imageUrl} alt={emp.name} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => removePhoto(emp.id)}
                      className="absolute inset-0 bg-black/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={28} />
                      <span className="text-xs mt-1 font-bold">Remove</span>
                    </button>
                    <div className="absolute top-1 right-1 bg-white rounded-full p-0.5 text-[#1eb259] shadow-md border border-white">
                      <CheckCircle2 size={18} />
                    </div>
                  </>
                ) : (
                  <label className="w-full h-full border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-[#046eb6] hover:text-[#046eb6] hover:bg-blue-50 cursor-pointer transition-colors">
                    <UploadCloud size={28} />
                    <span className="text-[10px] font-bold uppercase mt-2 text-center leading-tight">Add<br/>Photo</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleSinglePhotoUpload(emp.id, e.target.files[0]);
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Info Area */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-800 text-lg truncate" title={emp.name}>{emp.name}</h3>
                <p className="text-xs font-bold text-[#046eb6] mt-0.5">Code: {emp.empCode || 'N/A'}</p>
                {emp.designation && (
                  <p className="text-xs text-slate-500 truncate mt-0.5" title={emp.designation}>{emp.designation}</p>
                )}
                {emp.location && (
                  <p className="text-[11px] font-bold text-[#1eb259] uppercase tracking-wider mt-0.5">{emp.location}</p>
                )}
                
                <div className="mt-2.5 flex items-center gap-1.5">
                  {emp.imageUrl ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#1eb259] bg-green-50 px-2.5 py-1 rounded-md border border-green-200/50">
                      Matched
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/50">
                      <AlertCircle size={12} />
                      Missing
                    </span>
                  )}
                  {!emp.imageUrl && (
                    <span 
                      className="text-[10px] font-semibold text-slate-400 truncate pl-1 border-l border-slate-200"
                      title={emp.empCode ? `Accepts ${emp.empCode}.jpg or ${emp.name}.jpg` : `Accepts ${emp.name}.jpg`}
                    >
                      Needs: {emp.empCode ? `${emp.empCode}.jpg` : `${emp.name}.jpg`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Action */}
      <div className="p-8 border-t border-slate-100 bg-white flex justify-between items-center">
        <p className="text-slate-500 font-medium">Step 2 of 3</p>
        <button
          onClick={onComplete}
          disabled={eventType === 'new_joiners' ? totalCount === 0 : mappedCount === 0}
          className="bg-[#12284b] hover:bg-[#046eb6] text-white px-10 py-4 rounded-2xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-xl shadow-blue-900/20 text-lg"
        >
          {eventType === 'new_joiners' 
            ? `Proceed to Creatives (${mappedCount}/${totalCount} Photos)` 
            : `Generate ${mappedCount} Creatives`} <ArrowRight size={24} />
        </button>
      </div>
    </div>
  );
}
