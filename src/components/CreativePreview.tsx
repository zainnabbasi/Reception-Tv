import React, { useState, useEffect, useRef } from 'react';
import { Employee, EventType } from '../types';
import { drawBirthdayCreative, drawAnniversaryCreative } from '../lib/canvas';
import { Download } from 'lucide-react';

interface PreviewProps {
  key?: React.Key;
  employee: Employee;
  eventType: EventType;
}

export const CreativePreview: React.FC<PreviewProps> = ({ employee, eventType }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    const render = async () => {
      if (!canvasRef.current || !employee.imageUrl) return;
      
      await document.fonts.ready;
      const empData = {
        name: employee.name,
        sentence: employee.sentence || 'Wishing you a year filled with joy!',
      };
      if (eventType === 'birthday') {
        await drawBirthdayCreative(canvasRef.current, empData, employee.imageUrl);
      } else {
        await drawAnniversaryCreative(canvasRef.current, empData, employee.imageUrl);
      }
      setDataUrl(canvasRef.current.toDataURL('image/jpeg', 0.9));
    };
    render();
  }, [employee, eventType]);

  if (!employee.imageUrl) return null;

  const getFileName = () => {
    // Format: 1. Nilesh Sanghvi 1-1-1982
    const seqPart = employee.sequenceNumber !== undefined && employee.sequenceNumber !== 999 
      ? `${employee.sequenceNumber}. ` 
      : '';
    const namePart = employee.name.trim();
    const dobPart = employee.dob && employee.dob !== 'UnknownDate' ? ` ${employee.dob}` : '';
    
    // Sanitize for file system
    let rawName = `${seqPart}${namePart}${dobPart}`;
    return `${rawName.replace(/[<>:"/\\|?*]+/g, '_')}.jpg`;
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col group transition-all hover:shadow-2xl hover:border-blue-100">
      <div className="aspect-video bg-slate-100 relative overflow-hidden">
        <canvas ref={canvasRef} className="hidden" />
        {dataUrl ? (
          <img src={dataUrl} alt={`Creative for ${employee.name}`} className="w-full h-full object-contain transition-transform group-hover:scale-105 duration-700 ease-out" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-sm p-4 text-center">
             <div className="w-8 h-8 border-4 border-slate-200 border-t-[#046eb6] rounded-full animate-spin mb-3"></div>
             Generating Masterpiece...
          </div>
        )}
      </div>
      <div className="p-6 flex items-center justify-between bg-white border-t border-slate-100">
        <div>
          <h4 className="font-bold text-slate-800 text-lg truncate max-w-[200px]" title={employee.name}>{employee.name}</h4>
          <p className="text-xs font-semibold text-[#1eb259] uppercase tracking-wider mt-1">Rendered Successfully</p>
        </div>
        {dataUrl && (
          <a 
            href={dataUrl} 
            download={getFileName()}
            className="text-sm font-bold bg-slate-100 hover:bg-[#046eb6] hover:text-white text-slate-700 px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2"
          >
            <Download size={16}/> Save
          </a>
        )}
      </div>
    </div>
  );
}
