'use client';
import { useState, useEffect, Suspense } from 'react';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function LogForm() {
  const searchParams = useSearchParams();
  
  const [type, setType] = useState('Open');
  const [isWork, setIsWork] = useState(false);
  const [isHome, setIsHome] = useState(false);
  const [subject, setSubject] = useState('');
  const [entry, setEntry] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState('');
  const [taskNumber, setTaskNumber] = useState('');
  
  // Attachments
  const [files, setFiles] = useState([]);
  
  // --- NEW: LINKS STATE ---
  const [links, setLinks] = useState([]);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

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

    const paramId = searchParams.get('taskId');
    if (paramId) {
      setType('Done');
      setTaskNumber(paramId);
    }
  }, [searchParams]);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    if (files.length + selected.length > 5) {
      alert("Maximum 5 files allowed total.");
      return;
    }
    setFiles(prevFiles => [...prevFiles, ...selected]);
    e.target.value = null; 
  };

  const removeFile = (index) => setFiles(prev => prev.filter((_, i) => i !== index));

  // --- LINK HANDLERS ---
  const addLink = () => {
    if (!linkTitle || !linkUrl) {
      alert("Please enter both a Title and a URL.");
      return;
    }
    setLinks([...links, { title: linkTitle, url: linkUrl }]);
    setLinkTitle('');
    setLinkUrl('');
  };

  const removeLink = (index) => setLinks(prev => prev.filter((_, i) => i !== index));

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
      const uploadedAttachments = [];
      if (files.length > 0) {
        setStatus(`Uploading ${files.length} files...`);
        await Promise.all(files.map(async (file) => {
          const uniqueName = `${Date.now()}-${file.name}`;
          const storageRef = ref(storage, `uploads/${uniqueName}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          uploadedAttachments.push({ name: file.name, url: url, type: file.type });
        }));
      }

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

      await addDoc(collection(db, "logs"), {
        type: type,
        categories: activeCategories,
        subject: subject,
        entry: entry,
        attachments: uploadedAttachments, 
        links: links, // SAVE LINKS TO DB
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
      setFiles([]); 
      setLinks([]); 
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      console.error("Error: ", e);
      setStatus('Error saving.');
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
      <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">Log Entry</h2>

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

      <div className="mb-4">
        <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full p-3 border border-gray-300 rounded text-black bg-gray-50">
          <option value="Open">Open (Ticket)</option>
          <option value="Done">Done (Task)</option>
          <option value="Note">Note</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      {type === 'Done' && (
        <div className="mb-4 animate-fade-in">
          <label className="block text-sm font-bold text-gray-700 mb-1">Related Task # (Optional)</label>
          <input type="number" value={taskNumber} onChange={(e) => setTaskNumber(e.target.value)} className="w-full p-3 border border-blue-300 rounded text-black bg-blue-50 font-mono" placeholder="e.g. 42"/>
        </div>
      )}

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

      <div className="mb-2">
        <label className="block text-sm font-bold text-gray-700 mb-1">Subject</label>
        <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full p-3 border border-gray-300 rounded text-black font-bold placeholder-gray-400" placeholder="Subject Line..."/>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-bold text-gray-700 mb-1">Entry</label>
        <textarea value={entry} onChange={(e) => setEntry(e.target.value)} className="w-full p-3 border border-gray-300 rounded h-32 text-black bg-gray-50" placeholder="Log details..."></textarea>
      </div>

      {/* --- FILES --- */}
      <div className="mb-4">
        <label className="block text-sm font-bold text-gray-700 mb-1">Attachments (Max 5)</label>
        <div className="flex items-center gap-2 mb-2">
          <label className="cursor-pointer bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-bold hover:bg-blue-200 transition text-sm">
            + Add Files
            <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.msg,.eml" onChange={handleFileChange} className="hidden" />
          </label>
          <span className="text-xs text-gray-500">{files.length}/5 selected</span>
        </div>
        {files.length > 0 && (
          <div className="space-y-1 mb-2">
            {files.map((file, index) => (
              <div key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-200">
                <span className="text-xs text-gray-700 truncate mr-2">📄 {file.name}</span>
                <button onClick={() => removeFile(index)} className="text-red-500 hover:text-red-700 font-bold px-2">X</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- NEW: LINKS INPUT SECTION --- */}
      <div className="mb-6 border-t border-gray-100 pt-4">
        <label className="block text-sm font-bold text-gray-700 mb-2">Cloud Links (Optional)</label>
        <div className="flex gap-2 mb-2">
          <input type="text" placeholder="Title (e.g. Budget)" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded text-black text-sm"/>
          <input type="text" placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded text-black text-sm"/>
          <button onClick={addLink} className="bg-gray-800 text-white px-3 rounded font-bold hover:bg-black text-sm">+</button>
        </div>
        {links.length > 0 && (
          <div className="space-y-1">
            {links.map((link, index) => (
              <div key={index} className="flex justify-between items-center bg-purple-50 p-2 rounded border border-purple-100">
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-700 underline truncate mr-2">{link.title}</a>
                <button onClick={() => removeLink(index)} className="text-red-500 hover:text-red-700 font-bold px-2">X</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={handleSubmit} className={`w-full py-4 rounded font-bold text-xl text-white transition-all shadow-md ${status === 'Saved!' ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
        {status ? status : "Submit Log"}
      </button>

      <div className="mt-8 pt-6 border-t border-gray-200 space-y-4">
        <Link href="/history">
          <button className="w-full bg-gray-800 text-white py-3 px-4 rounded font-bold hover:bg-black transition">
            View History & Generate Reports
          </button>
        </Link>
        <Link href="/open-tasks">
          <button className="w-full bg-blue-700 text-white py-3 px-4 rounded font-bold hover:bg-blue-800 transition">
            View Open Tasks
          </button>
        </Link>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center justify-center">
      <Suspense fallback={<div>Loading...</div>}>
        <LogForm />
      </Suspense>
    </div>
  );
}