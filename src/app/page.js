'use client';
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, limit, where, getDocs } from 'firebase/firestore';

export default function Home() {
  const [type, setType] = useState('Do');
  
  // Changed to independent booleans for checkboxes
  const [isWork, setIsWork] = useState(true);
  const [isHome, setIsHome] = useState(false);

  const [entry, setEntry] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState('');
  const [logs, setLogs] = useState([]);

  // 1. Set Default Date/Time (Fixed to use LOCAL time, not UTC)
  useEffect(() => {
    const now = new Date();
    
    // Manual formatting to ensure we get local Alabama time, not UTC
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const localDate = `${year}-${month}-${day}`;
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const localTime = `${hours}:${minutes}`;

    setDate(localDate);
    setTime(localTime);
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
    
    // Build the category list based on checkboxes
    const activeCategories = [];
    if (isWork) activeCategories.push('Work');
    if (isHome) activeCategories.push('Home');

    if (activeCategories.length === 0) {
      alert("Please select at least one category (Work or Home)");
      return;
    }

    setStatus('Saving...');
    try {
      await addDoc(collection(db, "logs"), {
        type: type,
        categories: activeCategories, // Save as a list: ['Work', 'Home']
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

  // 4. AI Report Generator
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

    // Filter Logic: Check if the log includes the category
    // (We also check 'l.category' to support your older log entries)
    const workLogs = dayLogs.filter(l => 
      (l.categories && l.categories.includes('Work')) || 
      l.category === 'Work' || l.category === 'Both'
    );
    
    const homeLogs = dayLogs.filter(l => 
      (l.categories && l.categories.includes('Home')) || 
      l.category === 'Home' || l.category === 'Both'
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

  const getBadgeColor = (type) => {
    switch(type) {
      case 'Do': return 'bg-blue-100 text-blue-800';
      case 'Done': return 'bg-green-100 text-green-800';
      case 'Note': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100';
    }
  };

  // Helper to display categories in the history list
  const displayCats = (log) => {
    if (log.categories) return log.categories.join(' & '); // New format
    return log.category || 'Work'; // Old format fallback
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md mb-8">
        
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Log Entry</h2>

        {/* --- CHECKBOXES FOR CATEGORIES --- */}
        <div className="flex justify-center gap-8 mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
          
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
      </div>

      {/* History List */}
      <div className="w-full max-w-md">
        <h3 className="text-xl font-bold text-gray-700 mb-4">Live Feed</h3>
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="bg-white p-4 rounded shadow border-l-4 border-blue-500">
              <div className="flex justify-between items-center mb-2">
                <div className="flex gap-2">
                  {/* Category Badge */}
                  <span className="text-xs font-bold px-2 py-1 rounded border bg-gray-50 text-gray-600 border-gray-200">
                    {displayCats(log)}
                  </span>
                  {/* Type Badge */}
                  <span className={`text-xs font-bold px-2 py-1 rounded ${getBadgeColor(log.type)}`}>{log.type}</span>
                </div>
                <span className="text-xs text-gray-500">{log.timestamp.replace('T', ' ')}</span>
              </div>
              <p className="text-gray-800">{log.entry}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}