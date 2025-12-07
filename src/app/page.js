'use client';
import { useState, useEffect } from 'react';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Link from 'next/link';

export default function Home() {
  // --- FORM STATE ---
  const [type, setType] = useState('Open');
  const [isWork, setIsWork] = useState(false);
  const [isHome, setIsHome] = useState(false);
  const [subject, setSubject] = useState('');
  const [entry, setEntry] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState('');
  
  // Task Reference
  const [taskNumber, setTaskNumber] = useState('');
  
  // --- MULTI-FILE STATE ---
  const [files, setFiles] = useState([]); // Stores the actual File objects

  useEffect(() => {
    const initDateTime = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      setDate(`${year}-${month}-${day}`);
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setTime(`${hours}:${minutes}`);
    };
    initDateTime();
  }, []);

  // --- FILE HANDLERS ---
  
  // 1. ADD Files (Don't replace)
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    
    // Check limit
    if (files.length + selected.length > 5) {
      alert("Maximum 5 files allowed total.");
      return;
    }

    // Add new files to existing list
    setFiles(prevFiles => [...prevFiles, ...selected]);
    
    // Reset the input so you can select the same file again if needed
    e.target.value = null; 
  };

  // 2. REMOVE File
  const removeFile = (indexToRemove) => {
    setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async () => {
    if (!entry) return; 
    
    const activeCategories = [];
    if (isWork) activeCategories.push('Work');
    if (isHome) activeCategories.push('Home');

    if (activeCategories.length === 0) {
      alert("Please check at least Work or Home.");
      return;
    }

    setStatus('Saving...');

    try {
      // 1. Upload Files from the State Array
      const uploadedAttachments = [];
      
      if (files.length > 0) {
        setStatus(`Uploading ${files.length} files...`);
        
        await Promise.all(files.map(async (file) => {
          const uniqueName = `${Date.now()}-${file.name}`;
          const storageRef = ref(storage, `uploads/${uniqueName}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          
          uploadedAttachments.push({
            name: file.name,
            url: url,
            type: file.type 
          });
        }));
      }

      // 2. Auto-Increment Logic
      let newCustomId = null;
      if (type === 'Open') {
        const q = query(collection(db, "logs"), orderBy("customId", "desc"), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const lastId = snapshot.docs[0].data().customId || 0;
          newCustomId = lastId + 1;
        } else {
          newCustomId = 1; 
        }
      }

      // 3. Save Log
      setStatus('Saving Log...');
      await addDoc(collection(db, "logs"), {
        type: type,
        categories: activeCategories,
        subject: subject,
        entry: entry,
        attachments: uploadedAttachments, 
        customId: newCustomId, 
        taskRef: (type === 'Done' && taskNumber) ? taskNumber : null,
        timestamp: `${date}T${time}`,
        dateString: date,
        createdAt: new Date()
      });

      setStatus('Saved!');
      setEntry(''); 
      setSubject('');
      setTaskNumber('');
      setFiles([]); // Clear the file list
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      console.error("Error: ", e);
      setStatus('Error saving.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        
        <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">Log Entry</h2>

        {/* Checkboxes */}
        <div className="flex justify-center gap-8 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={isWork} onChange={(e) => setIsWork(e.target.checked)} className="w-6 h-6 accent-blue-600 rounded"/>
            <span className="font-bold text-gray-700 text-lg">Work</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={isHome} onChange={(e) => setIsHome(e.target.checked)} className="w-6 h-6 accent-green-600 rounded"/>
            <span className="font-bold text-gray-700 text-lg">Home</span>
          </label>
        </div>

        {/* Type Selector */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full p-3 border border-gray-300 rounded text-black bg-gray-50">
            <option value="Open">Open (Ticket)</option>
            <option value="Done">Done (Task)</option>
            <option value="Note">Note</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

        {/* Conditional Task # */}
        {type === 'Done' && (
          <div className="mb-4 animate-fade-in">
            <label className="block text-sm font-bold text-gray-700 mb-1">Related Task # (Optional)</label>
            <input type="number" value={taskNumber} onChange={(e) => setTaskNumber(e.target.value)} className="w-full p-3 border border-blue-300 rounded text-black bg-blue-50 font-mono" placeholder="e.g. 42"/>
          </div>
        )}

        {/* Date & Time */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 border border-gray-300 rounded text-black bg-gray-50"/>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-bold text-gray-700 mb-1">Time</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full p-3 border border-gray-300 rounded text-black bg-gray-50"/>
          </div>
        </div>

        {/* Subject */}
        <div className="mb-2">
          <label className="block text-sm font-bold text-gray-700 mb-1">Subject</label>
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full p-3 border border-gray-300 rounded text-black font-bold placeholder-gray-400" placeholder="Subject Line..."/>
        </div>

        {/* Entry */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-1">Entry</label>
          <textarea value={entry} onChange={(e) => setEntry(e.target.value)} className="w-full p-3 border border-gray-300 rounded h-32 text-black bg-gray-50" placeholder="Log details..."></textarea>
        </div>

        {/* --- ACCUMULATIVE FILE UPLOAD --- */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-1">Attachments (Max 5)</label>
          <p className="text-xs text-gray-500 mb-2">Supported: Images, PDF, Word, Excel, Outlook</p>
          
          <div className="flex items-center gap-2 mb-3">
            <label className="cursor-pointer bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-bold hover:bg-blue-200 transition text-sm">
              + Add Files
              <input 
                type="file" 
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.msg,.eml"
                onChange={handleFileChange}
                className="hidden" // Hides the ugly default input
              />
            </label>
            <span className="text-xs text-gray-500">{files.length}/5 selected</span>
          </div>

          {/* --- SELECTED FILES LIST --- */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-200">
                  <span className="text-sm text-gray-700 truncate mr-2">📄 {file.name}</span>
                  <button 
                    onClick={() => removeFile(index)}
                    className="text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded hover:bg-red-50 transition"
                    title="Remove file"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={handleSubmit} className={`w-full py-4 rounded font-bold text-xl text-white transition-all shadow-md ${status === 'Saved!' ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {status ? status : "Submit Log"}
        </button>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <Link href="/history">
            <button className="w-full bg-gray-800 text-white py-3 px-4 rounded font-bold hover:bg-black transition">
              View History & Generate Reports
            </button>
          </Link>
        </div>

      </div>
    </div>
  );
}