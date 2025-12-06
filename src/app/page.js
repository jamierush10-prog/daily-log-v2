'use client';
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, limit, where, getDocs, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import Link from 'next/link';

export default function Home() {
  // Main Form State
  const [type, setType] = useState('Do');
  
  // Checkboxes default to FALSE (Empty)
  const [isWork, setIsWork] = useState(false);
  const [isHome, setIsHome] = useState(false);

  const [entry, setEntry] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState('');
  const [logs, setLogs] = useState([]);

  // --- EDITING STATE ---
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editType, setEditType] = useState('Do'); 
  const [editIsWork, setEditIsWork] = useState(false);
  const [editIsHome, setEditIsHome] = useState(false);

  // 1. Set Default Date/Time (Local Time Fix)
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

  // 2. Live Feed Subscription
  useEffect(() => {
    const q = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(logsData);
    });
    return () => unsubscribe();
  }, []);

  // 3. Submit Handler
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
      await addDoc(collection(db, "logs"), {
        type: type,
        categories: activeCategories,
        entry: entry,
        timestamp: `${date}T${time}`,
        dateString: date,
        createdAt: new Date()
      });
      setStatus('Saved!');
      setEntry(''); 
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      console.error("Error: ", e);
      setStatus('Error saving.');
    }
  };

  // 4. Delete Function
  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this log?")) {
      try {
        await deleteDoc(doc(db, "logs", id));
      } catch (e) {
        alert("Error deleting: " + e.message);
      }
    }
  };

  // 5. --- EXPANDED EDIT FUNCTIONS ---
  const startEditing = (log) => {
    setEditingId(log.id);
    setEditText(log.entry);
    setEditType(log.type); // Load current type
    
    // Split timestamp
    const parts = log.timestamp.split('T');
    setEditDate(parts[0]);
    setEditTime(parts[1]);

    // Set checkboxes based on saved data
    const cats = log.categories || [];
    setEditIsWork(cats.includes('Work') || log.category === 'Work');
    setEditIsHome(cats.includes('Home') || log.category === 'Home');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = async (id) => {
    const activeCategories = [];
    if (editIsWork) activeCategories.push('Work');
    if (editIsHome) activeCategories.push('Home');

    if (activeCategories.length === 0) {
      alert("Please check at least one category.");
      return;
    }

    try {
      const logRef = doc(db, "logs", id);
      await updateDoc(logRef, {
        entry: editText,
        type: editType,
        categories: activeCategories,
        dateString: editDate,
        timestamp: `${editDate}T${editTime}`
      });
      setEditingId(null);
    } catch (e) {
      alert("Error updating: " + e.message);
    }
  };

  // 6. AI Report Generator
  const generateReport = async () => {
    setStatus('Generating...');
    
    const q = query(collection(db, "logs"), where("dateString", "==", date));
    const querySnapshot = await getDocs(q);
    const dayLogs = querySnapshot.docs.map(doc => doc.data());

    if (dayLogs.length === 0) {
      alert("No logs found for this date!");
      setStatus('');
      return;
    }
    
    const workLogs = dayLogs.filter(l => 
      (l.categories && l.categories.includes('Work')) || l.category === 'Work' || l.category === 'Both'
    );
    
    const homeLogs = dayLogs.filter(l => 
      (l.categories && l.categories.includes('Home')) || l.category === 'Home' || l.category === 'Both'
    );

    const formatLogs = (list) => list.map(l => `[${l.timestamp.split('T')[1]}] [${l.type}] ${l.entry}`).join('\n');

    const prompt = `Act as my Executive Officer. Here are my logs for ${date}.
Please generate TWO SEPARATE REPORTS based on the data below.

=========================================
REPORT 1: WORK MISSION
=========================================
LOG DATA:
${formatLogs(workLogs)}

REQUIREMENTS:
1. Work After Action Report (AAR).
2. Work Plan of the Day (POD).

=========================================
REPORT 2: HOME FRONT
=========================================
LOG DATA:
${formatLogs(homeLogs)}

REQUIREMENTS:
1. Home After Action Report (AAR).
2. Home Plan of the Day (POD).
`;

    navigator.clipboard.writeText(prompt);
    alert("Briefing copied to clipboard!");
    setStatus('Copied!');
    setTimeout(() => setStatus(''), 2000);
  };

  // Helpers
  const getBadgeColor = (type) => {
    switch(type) {
      case 'Do': return 'bg-blue-100 text-blue-800';
      case 'Done': return 'bg-green-100 text-green-800';
      case 'Note': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100';
    }
  };

  const displayCats = (log) => {
    if (log.categories) return log.categories.join(' & ');
    return log.category || 'Work';
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md mb-8">
        
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Log Entry</h2>

        {/* Checkboxes */}
        <div className="flex justify-center gap-8 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={isWork}
              onChange={(e) => setIsWork(e.target.checked)}
              className="w-6 h-6 accent-blue-600 rounded"
            />
            <span className="font-bold text-gray-700 text-lg">Work</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={isHome}
              onChange={(e) => setIsHome(e.target.checked)}
              className="w-6 h-6 accent-green-600 rounded"
            />
            <span className="font-bold text-gray-700 text-lg">Home</span>
          </label>
        </div>

        {/* Inputs */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full p-3 border border-gray-300 rounded text-black bg-gray-50">
            <option value="Do">Do</option>
            <option value="Done">Done</option>
            <option value="Note">Note</option>
          </select>
        </div>

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

        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-1">Entry</label>
          <textarea value={entry} onChange={(e) => setEntry(e.target.value)} className="w-full p-3 border border-gray-300 rounded h-32 text-black bg-gray-50" placeholder="Log activity..."></textarea>
        </div>

        <div className="flex gap-2">
          <button onClick={handleSubmit} className="flex-1 bg-blue-600 text-white py-3 px-4 rounded hover:bg-blue-700 font-bold">
            Submit
          </button>
          <button onClick={generateReport} className="flex-1 bg-purple-600 text-white py-3 px-4 rounded hover:bg-purple-700 font-bold">
            Copy Brief
          </button>
        </div>
        <p className="text-center text-xs text-gray-500 mt-2">{status}</p>

        {/* --- LINK TO ARCHIVE PAGE --- */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <Link href="/history">
            <button className="w-full bg-gray-800 text-white py-3 px-4 rounded font-bold hover:bg-black transition">
              View Full Archive & Search
            </button>
          </Link>
        </div>

      </div>

      {/* History List */}
      <div className="w-full max-w-md">
        <h3 className="text-xl font-bold text-gray-700 mb-4">Live Feed</h3>
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="bg-white p-4 rounded shadow border-l-4 border-blue-500">
              
              {editingId === log.id ? (
                // --- EDIT MODE VIEW ---
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-bold text-blue-600 mb-1">Editing Entry...</p>
                  
                  {/* Edit Categories */}
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editIsWork} onChange={(e) => setEditIsWork(e.target.checked)} className="accent-blue-600"/>
                      <span className="text-sm text-black">Work</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editIsHome} onChange={(e) => setEditIsHome(e.target.checked)} className="accent-green-600"/>
                      <span className="text-sm text-black">Home</span>
                    </label>
                  </div>

                  {/* Edit Type */}
                  <select value={editType} onChange={(e) => setEditType(e.target.value)} className="w-full p-2 border border-blue-300 rounded text-black text-sm">
                    <option value="Do">Do</option>
                    <option value="Done">Done</option>
                    <option value="Note">Note</option>
                  </select>

                  {/* Edit Date/Time */}
                  <div className="flex gap-2">
                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="flex-1 p-2 border rounded text-black text-sm"/>
                    <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="flex-1 p-2 border rounded text-black text-sm"/>
                  </div>

                  {/* Edit Text */}
                  <textarea 
                    value={editText} 
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full p-2 border border-blue-300 rounded text-black text-sm"
                    rows="3"
                  ></textarea>

                  {/* Save/Cancel Buttons */}
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelEditing} className="text-xs text-gray-500 font-bold px-2 py-1 bg-gray-100 rounded">Cancel</button>
                    <button onClick={() => saveEdit(log.id)} className="text-xs bg-blue-600 text-white font-bold px-3 py-1 rounded">Save Changes</button>
                  </div>
                </div>
              ) : (
                // --- NORMAL VIEW ---
                <>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex gap-2">
                      <span className="text-xs font-bold px-2 py-1 rounded border bg-gray-50 text-gray-600 border-gray-200">
                        {displayCats(log)}
                      </span>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${getBadgeColor(log.type)}`}>{log.type}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 mr-1">{log.timestamp.replace('T', ' ')}</span>
                      <button onClick={() => startEditing(log)} className="text-blue-600 text-xs font-bold hover:underline">Edit</button>
                      <button onClick={() => handleDelete(log.id)} className="text-red-600 text-xs font-bold hover:underline">X</button>
                    </div>
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap">{log.entry}</p>
                </>
              )}

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}