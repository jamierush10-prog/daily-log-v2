'use client';
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, limit, where, getDocs } from 'firebase/firestore';

export default function Home() {
  const [type, setType] = useState('Do');
  const [category, setCategory] = useState('Work'); // Default to Work
  const [entry, setEntry] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState('');
  const [logs, setLogs] = useState([]);

  // 1. Set Default Date/Time
  useEffect(() => {
    const now = new Date();
    setDate(now.toISOString().split('T')[0]);
    const timeString = now.toTimeString().split(' ')[0].substring(0, 5);
    setTime(timeString);
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

  // 3. Submit Handler (Now includes Category)
  const handleSubmit = async () => {
    if (!entry) return; 
    setStatus('Saving...');
    try {
      await addDoc(collection(db, "logs"), {
        type: type,
        category: category, // Save the new field
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

  // 4. AI Report Generator (Now splits Work vs Home)
  const generateReport = async () => {
    setStatus('Generating...');
    
    // Get logs for the date
    const q = query(collection(db, "logs"), where("dateString", "==", date));
    const querySnapshot = await getDocs(q);
    const dayLogs = querySnapshot.docs.map(doc => doc.data());

    if (dayLogs.length === 0) {
      alert("No logs found for this date!");
      setStatus('');
      return;
    }

    // Filter logs into two lists ("Both" goes into both lists)
    const workLogs = dayLogs.filter(l => l.category === 'Work' || l.category === 'Both');
    const homeLogs = dayLogs.filter(l => l.category === 'Home' || l.category === 'Both');

    // Helper to format text
    const formatLogs = (list) => list.map(l => `[${l.timestamp.split('T')[1]}] [${l.type}] ${l.entry}`).join('\n');

    // Create the Split AI Prompt
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

    // Copy to Clipboard
    navigator.clipboard.writeText(prompt);
    alert("Briefing copied to clipboard! Paste it into your AI.");
    setStatus('Copied!');
    setTimeout(() => setStatus(''), 2000);
  };

  // Helper for colors
  const getBadgeColor = (type) => {
    switch(type) {
      case 'Do': return 'bg-blue-100 text-blue-800';
      case 'Done': return 'bg-green-100 text-green-800';
      case 'Note': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md mb-8">
        
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Log Entry</h2>

        {/* --- NEW: CATEGORY RADIO BUTTONS --- */}
        <div className="flex justify-center gap-6 mb-6 p-2 bg-gray-50 rounded-lg border border-gray-200">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="radio" 
              name="cat" 
              value="Work" 
              checked={category === 'Work'} 
              onChange={(e) => setCategory(e.target.value)}
              className="w-5 h-5 accent-blue-600"
            />
            <span className="font-bold text-gray-700">Work</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="radio" 
              name="cat" 
              value="Home" 
              checked={category === 'Home'} 
              onChange={(e) => setCategory(e.target.value)}
              className="w-5 h-5 accent-green-600"
            />
            <span className="font-bold text-gray-700">Home</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="radio" 
              name="cat" 
              value="Both" 
              checked={category === 'Both'} 
              onChange={(e) => setCategory(e.target.value)}
              className="w-5 h-5 accent-purple-600"
            />
            <span className="font-bold text-gray-700">Both</span>
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
                  <span className={`text-xs font-bold px-2 py-1 rounded border 
                    ${log.category === 'Work' ? 'bg-blue-50 text-blue-800 border-blue-200' : 
                      log.category === 'Home' ? 'bg-green-50 text-green-800 border-green-200' : 
                      'bg-purple-50 text-purple-800 border-purple-200'}`}>
                    {log.category || 'Work'}
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