import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, FileText, Download } from 'lucide-react';
import { Employee, EventType } from '../types';

interface Props {
  onDataLoaded: (employees: Employee[]) => void;
  eventType: EventType;
}

// Helper to extract a field from an Excel row with case-insensitive and punctuation-insensitive matching
const extractRowField = (row: any, aliases: string[]): string => {
  if (!row || typeof row !== 'object') return '';
  const rowKeys = Object.keys(row);

  // 1. Direct key match
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== '') {
      return String(row[alias]).trim();
    }
  }

  // 2. Case-insensitive key match
  for (const alias of aliases) {
    const aliasLower = alias.toLowerCase();
    const matchedKey = rowKeys.find(k => k.trim().toLowerCase() === aliasLower);
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && String(row[matchedKey]).trim() !== '') {
      return String(row[matchedKey]).trim();
    }
  }

  // 3. Normalized key match (strip spaces, underscores, dots, hyphens)
  for (const alias of aliases) {
    const aliasClean = alias.toLowerCase().replace(/[\s_\-.]+/g, '');
    const matchedKey = rowKeys.find(k => k.toLowerCase().replace(/[\s_\-.]+/g, '') === aliasClean);
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && String(row[matchedKey]).trim() !== '') {
      return String(row[matchedKey]).trim();
    }
  }

  return '';
};

// Aliases for common employee codes across various HRMS Excel exports
const EMP_CODE_ALIASES = [
  'Employee Code', 'Emp Code', 'EmpCode', 'EmployeeCode', 'Emp_Code', 'Employee_Code', 
  'Code', 'CODE', 'Emp ID', 'EmpId', 'Employee ID', 'EmployeeId', 'ID', 'Id',
  'Emp No', 'Employee No', 'EmpNo', 'EmployeeNumber', 'Staff Code', 'Staff ID', 'Personnel Number'
];

// Helper to reliably extract and format a date from various Excel inputs
const parseExcelDate = (raw: any): { month: number; day: number; formatted: string } | null => {
  if (!raw) return null;
  
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return { month: raw.getMonth() + 1, day: raw.getDate(), formatted: `${raw.getDate()}-${raw.getMonth() + 1}-${raw.getFullYear()}` };
  }

  const str = String(raw).trim();
  // Check for common manual formats like DD-MM-YYYY or DD/MM/YYYY
  const parts = str.split(/[-/.]/);
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
      // If user typed MM/DD/YYYY, swap them. Usually d is <= 31 and m <= 12. 
      if (m > 12 && d <= 12) {
        return { month: d, day: m, formatted: `${m}-${d}-${y}` };
      }
      return { month: m, day: d, formatted: `${d}-${m}-${y}` };
    }
  }

  // Fallback to JS standard parsing
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return { month: d.getMonth() + 1, day: d.getDate(), formatted: `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}` };
  }
  
  return null;
};

export function ExcelDropzone({ onDataLoaded, eventType }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseExcel(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseExcel(file);
  };

  const parseExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      // Use cellDates to attempt to parse Excel date serials natively
      const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      // 1. Parse Data
      const randomSentences = eventType === 'birthday' 
        ? [
            "Wishing you a year filled with joy!",
            "Wishing you a year of joy and success!",
            "Wishing you a year filled with happiness!",
            "Wishing you a year of happiness and growth!",
            "Wishing you a year of smiles and success!"
          ]
        : [
            "Wishing you another year of growth, success and new milestones!",
            "Thank you for being an essential part of our success.",
            "Happy Work Anniversary! Your dedication is truly appreciated.",
            "Cheers to another year of excellence and teamwork!",
            "Thank you for your hard work and commitment to excellence."
          ];

      if (eventType === 'new_joiners') {
        const joiners: Employee[] = data.map((row, index) => {
          const empCode = extractRowField(row, EMP_CODE_ALIASES);
          const name = extractRowField(row, ['Employee Name', 'Emp Name', 'Name', 'Full Name', 'Employee', 'Member Name']) || 'New Joiner';
          const designation = extractRowField(row, ['Designation', 'Role', 'Title', 'Position', 'Department', 'Job Title']) || 'Team Member';
          const location = extractRowField(row, ['Location', 'Branch', 'City', 'Place', 'Office', 'Base Location']) || 'Corporate';
          const imageName = extractRowField(row, ['ImageName', 'Image Name', 'Photo Name', 'PhotoName', 'Photo', 'Image']);

          return {
            id: `joiner-${index}-${Date.now()}`,
            name: String(name).trim(),
            sentence: 'Welcome to the team!',
            imageName: imageName ? String(imageName).trim() : '',
            empCode: String(empCode).trim(),
            designation: String(designation).trim(),
            location: String(location).trim(),
            sequenceNumber: index + 1,
          };
        });

        onDataLoaded(joiners);
        return;
      }

      let parsed = data.map((row, index) => {
        const rawDob = extractRowField(row, [
          'DOB', 'Date of Birth', 'BirthDate', 'Birth Date', 'Date', 
          'Joining Date', 'Anniversary', 'Date of Joining', 'DOJ', 'JoiningDate', 'Work Anniversary'
        ]);
        const dateInfo = parseExcelDate(rawDob);
        const defaultSentence = randomSentences[Math.floor(Math.random() * randomSentences.length)];
        const empCode = extractRowField(row, EMP_CODE_ALIASES);
        const name = extractRowField(row, ['Employee Name', 'Emp Name', 'Name', 'Full Name', 'Employee', 'Member Name']) || 'Unknown';
        const sentence = extractRowField(row, ['Sentence', 'sentence', 'Wish', 'Message', 'Greeting', 'Quote']) || defaultSentence;
        const imageName = extractRowField(row, ['ImageName', 'Image Name', 'Photo Name', 'PhotoName', 'Photo', 'Image']);
        const designation = extractRowField(row, ['Designation', 'Role', 'Title', 'Position', 'Department', 'Job Title']);
        const location = extractRowField(row, ['Location', 'Branch', 'City', 'Place', 'Office', 'Base Location']);
        
        return {
          id: `emp-${index}-${Date.now()}`,
          name: String(name).trim(),
          sentence: String(sentence).trim(),
          imageName: imageName ? String(imageName).trim() : '',
          empCode: String(empCode).trim(),
          designation: String(designation).trim(),
          location: String(location).trim(),
          _sortMonth: dateInfo ? dateInfo.month : 99,
          _sortDay: dateInfo ? dateInfo.day : 99,
          dob: dateInfo ? dateInfo.formatted : (rawDob ? String(rawDob) : 'UnknownDate'),
        };
      });

      // 2. Sort linearly by calendar year (Month -> Day)
      parsed.sort((a, b) => {
        if (a._sortMonth !== b._sortMonth) return a._sortMonth - b._sortMonth;
        return a._sortDay - b._sortDay;
      });

      // 3. Assign Sequence Numbers (grouped by shared Month-Day)
      let currentSeq = 0;
      let lastMonthDay = '';
      
      const finalEmployees: Employee[] = parsed.map(emp => {
        const currentMonthDay = `${emp._sortMonth}-${emp._sortDay}`;
        // Increment sequence only if the date changed (and it's a valid date)
        if (currentMonthDay !== lastMonthDay && emp._sortMonth !== 99) {
          currentSeq++;
          lastMonthDay = currentMonthDay;
        }
        
        return {
          id: emp.id,
          name: emp.name,
          sentence: emp.sentence,
          imageName: emp.imageName,
          empCode: String(emp.empCode),
          designation: emp.designation,
          location: emp.location,
          dob: emp.dob,
          sequenceNumber: emp._sortMonth !== 99 ? currentSeq : 999, // Un-dated go to the end without a sequence grouping
        };
      });

      onDataLoaded(finalEmployees);
    };
    reader.readAsBinaryString(file);
  };

  const generateTemplate = () => {
    if (eventType === 'new_joiners') {
      const ws = XLSX.utils.json_to_sheet([
        { 'Employee Code': 'EMP001', 'Employee Name': 'SANTOSH PILLAI', 'Designation': 'Senior Vice President - II | Collection', 'Location': 'AHMEDABAD' },
        { 'Employee Code': 'EMP002', 'Employee Name': 'PRIYA SHARMA', 'Designation': 'Associate Vice President | Operations', 'Location': 'MUMBAI' },
        { 'Employee Code': 'EMP003', 'Employee Name': 'ANKIT PATEL', 'Designation': 'Senior Manager | Business Development', 'Location': 'SURAT' },
        { 'Employee Code': 'EMP004', 'Employee Name': 'MEERA DESAI', 'Designation': 'Team Lead | Credit Underwriting', 'Location': 'VADODARA' },
        { 'Employee Code': 'EMP005', 'Employee Name': 'RAHUL VERMA', 'Designation': 'Assistant Manager | Risk & Compliance', 'Location': 'DELHI' },
        { 'Employee Code': 'EMP006', 'Employee Name': 'SNEHA NAIR', 'Designation': 'Manager | Human Resources', 'Location': 'BENGALURU' },
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'New Joiners');
      XLSX.writeFile(wb, 'Weekly_Updates_New_Joiners_Template.xlsx');
      return;
    }

    const ws = XLSX.utils.json_to_sheet([
      { 'Emp Code': 'EMP001', Name: 'Nilesh Sanghvi', Date: '1-1-1982', Sentence: eventType === 'birthday' ? 'Wishing you a wonderful birthday filled with joy!' : 'Thank you for your dedication!' },
      { 'Emp Code': 'EMP002', Name: 'Jane Smith', Date: '1-1-1990', Sentence: eventType === 'birthday' ? 'Have a fantastic birthday and a great year ahead.' : 'Cheers to another year of excellence!' },
      { 'Emp Code': 'EMP003', Name: 'Alice Johnson', Date: '15-2-1985', Sentence: eventType === 'birthday' ? 'May your special day be amazing!' : 'Happy Work Anniversary!' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${eventType === 'birthday' ? 'Birthday' : 'Anniversary'}_Template.xlsx`);
  };

  const getSubtitleText = () => {
    if (eventType === 'new_joiners') {
      return 'Upload your new joiners spreadsheet with Employee Code, Employee Name, Designation, and Location to generate TV-format weekly update creatives.';
    }
    return `Upload your employee data spreadsheet to begin generating personalized, high-resolution ${eventType === 'birthday' ? 'birthday' : 'work anniversary'} creatives in bulk.`;
  };

  const getColumnTip = () => {
    if (eventType === 'new_joiners') {
      return 'Make sure your sheet includes "Employee Code", "Employee Name", "Designation", and "Location" columns.';
    }
    return 'Make sure your sheet includes a "Date" or "DOB" column for proper sorting.';
  };

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-black text-[#12284b] tracking-tight mb-4">Let's get started.</h2>
        <p className="text-lg text-slate-500 max-w-xl mx-auto">{getSubtitleText()}</p>
      </div>

      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer border-4 border-dashed rounded-[2.5rem] p-16 flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm ${
          isDragging 
            ? 'border-[#046eb6] bg-blue-50 scale-[1.02] shadow-xl shadow-blue-900/10' 
            : 'border-slate-200 bg-white hover:border-[#046eb6] hover:bg-slate-50 hover:shadow-lg'
        }`}
      >
        <input 
          type="file" 
          accept=".xlsx, .xls, .csv" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileSelect} 
        />
        
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-colors duration-300 ${isDragging ? 'bg-[#046eb6] text-white' : 'bg-blue-50 text-[#046eb6]'}`}>
          <UploadCloud size={48} strokeWidth={1.5} />
        </div>
        
        <h3 className="text-2xl font-bold text-slate-800 mb-2">Drag & Drop your Excel file</h3>
        <p className="text-slate-500 text-lg mb-8">or click to browse from your computer</p>
        
        <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-100 px-4 py-2 rounded-full font-medium">
          <FileText size={16} />
          <span>Supports .xlsx, .xls, .csv</span>
        </div>
      </div>

      <div className="mt-10 text-center space-y-4">
        <p className="text-slate-500">{getColumnTip()}</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button 
            onClick={(e) => { e.stopPropagation(); generateTemplate(); }} 
            className="inline-flex items-center gap-2 text-[#046eb6] hover:text-[#12284b] font-semibold text-base transition-colors bg-white px-6 py-3 rounded-xl shadow-sm border border-slate-200 hover:shadow-md cursor-pointer"
          >
            <Download size={18} /> Download Template File
          </button>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (eventType === 'new_joiners') {
                onDataLoaded([
                  {
                    id: 'sample-1',
                    empCode: 'RCPL0191',
                    name: 'Aarav Sharma',
                    designation: 'Senior Financial Analyst',
                    location: 'Ahmedabad',
                    sentence: 'Excited to be part of the Ratnaafin growth journey!',
                    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
                  },
                  {
                    id: 'sample-2',
                    empCode: 'RCPL0192',
                    name: 'Priyanka Patel',
                    designation: 'Product Marketing Manager',
                    location: 'Mumbai',
                    sentence: 'Looking forward to creating meaningful customer experiences.',
                    imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
                  },
                  {
                    id: 'sample-3',
                    empCode: 'RCPL0193',
                    name: 'Rohan Verma',
                    designation: 'Lead DevOps Engineer',
                    location: 'Bangalore',
                    sentence: 'Building scalable infrastructure for next-gen fintech.',
                    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
                  },
                  {
                    id: 'sample-4',
                    empCode: 'RCPL0194',
                    name: 'Ananya Deshmukh',
                    designation: 'UX & Visual Designer',
                    location: 'Pune',
                    sentence: 'Passionate about crafting intuitive financial interfaces.',
                    imageUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=800&q=80',
                  },
                  {
                    id: 'sample-5',
                    empCode: 'RCPL0195',
                    name: 'Vikram Mehta',
                    designation: 'Wealth Relationship Manager',
                    location: 'Delhi',
                    sentence: 'Committed to empowering clients to achieve financial freedom.',
                    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
                  },
                ]);
              } else {
                onDataLoaded([
                  {
                    id: 'sample-b1',
                    empCode: 'EMP001',
                    name: 'Nilesh Sanghvi',
                    dob: '1-1-1982',
                    sentence: eventType === 'birthday' ? 'Wishing you a wonderful birthday filled with joy and success!' : 'Thank you for your immense dedication and leadership!',
                    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
                  },
                  {
                    id: 'sample-b2',
                    empCode: 'EMP002',
                    name: 'Jane Smith',
                    dob: '1-1-1990',
                    sentence: eventType === 'birthday' ? 'Have a fantastic birthday and a glorious year ahead!' : 'Cheers to another milestone year of excellence!',
                    imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
                  },
                ]);
              }
            }} 
            className="inline-flex items-center gap-2 text-white font-semibold text-base transition-all bg-[#12284b] hover:bg-[#046eb6] px-6 py-3 rounded-xl shadow-sm hover:shadow-md cursor-pointer"
          >
            ⚡ Load Demo {eventType === 'new_joiners' ? 'Joiners' : 'Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
