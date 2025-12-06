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
  
  // Image State
  const [imageFile, setImageFile] = useState(null);

  // 1. Set Default Date/Time (Local Time)
  useEffect(() => {
    const initDateTime = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const localDate = `${year}-${month}-${day}`;
      
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const localTime = `${hours}:${minutes}`;

      setDate(localDate);
      setTime(localTime);
    };
    initDateTime();
  }, []);

  // 2. Submit Handler
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
      let imageUrl = null;

      // Upload Image if exists
      if (imageFile) {
        setStatus('Uploading Image...');
        const uniqueName = `${Date.now()}-${imageFile.name}`;
        const storageRef = ref(storage, `uploads/${uniqueName}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      // --- AUTO-INCREMENT LOGIC (Only for "Open" type) ---
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

      // Save Log
      setStatus('Saving Log...');
      await addDoc(collection(db, "logs"), {
        type: type,
        categories: activeCategories,
        subject: subject,
        entry: entry,
        imageUrl: imageUrl,
        customId: newCustomId, // Will be null for "Done" or "Note"
        timestamp: `${date}T${time}`,
        dateString: date,
        createdAt: new Date()
      });

      setStatus('Saved!');
      setEntry(''); 
      setSubject('');
      setImageFile(null);
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

        {/* Type Selector (Added "Done" back) */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full p-3 border border-gray-300 rounded text-black bg-gray-50">
            <option value="Open">Open (Ticket)</option>
            <option value="Done">Done (Task)</option>
            <option value="Note">Note</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

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

        {/* Image Upload */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-1">Attach Photo (Optional)</label>
          <input 
            type="file" 
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files[0])}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
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