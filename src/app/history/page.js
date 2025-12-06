'use client';
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';

export default function HistoryPage() {
  const [logs, setLogs] = useState([]);
  
  // --- UI STATE ---
  const [searchText, setSearchText] = useState(''); 
  const [uiCategory, setUiCategory] = useState('All'); 
  const [uiDate, setUiDate] = useState(''); // Renamed for clarity

  // --- ACTIVE FILTERS ---
  const [activeSearch, setActiveSearch] = useState(''); 
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeDate, setActiveDate] = useState('');

  // Editing State
  const [editingId, setEditingId] = useState(null);
  const [editSubject, setEditSubject] = useState('');
  const [editText, setEditText] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editType, setEditType] = useState('Do');
  const [editIsWork, setEditIsWork] = useState(false);
  const [editIsHome, setEditIsHome] = useState(false);

  // 1. Fetch ALL logs
  useEffect(() => {
    const q = query(collection(db, "logs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(logsData);
    });
    return () => unsubscribe();
  }, []);

  // 2. Filter Logic (EXACT DATE MATCH)
  const filteredLogs = logs.filter(log => {
    // A. Text Search
    const term = activeSearch.toLowerCase();
    const entryMatch = log.entry.toLowerCase().includes(term);
    const subjectMatch = log.subject ? log.subject.toLowerCase().includes(term) : false;
    const matchesSearch = entryMatch || subjectMatch;
    
    // B. Category Filter
    let matchesCategory = true;
    if (activeCategory === 'Work') {
      matchesCategory = (log.categories && log.categories.includes('Work')) || log.category === 'Work' || log.category === 'Both';
    } else if (activeCategory === 'Home') {
      matchesCategory = (log.categories && log.categories.includes('Home')) || log.category === 'Home' || log.category === 'Both';
    }

    // C. Date Filter (EXACT MATCH)
    let matchesDate = true;
    if (activeDate) {
      matchesDate = (log.dateString === activeDate);
    }

    return matchesSearch && matchesCategory && matchesDate;
  });

  // --- BUTTON HANDLERS ---
  const handleSearchClick = () => {
    setActiveSearch(searchText);
  };

  const handleFilterClick = () => {
    setActiveCategory(uiCategory);
    setActiveDate(uiDate);
  };

  // --- ACTIONS (Delete/Edit) ---
  const handleDelete = async (id) => {
    if (confirm("Permanently delete this log?")) {
      await deleteDoc(doc(db, "logs", id));
    }
  };

  const startEditing = (log) => {
    setEditingId(log.id);
    setEditSubject(log.subject || '');
    setEditText(log.entry);
    setEditType(log.type);
    
    const parts = log.timestamp.split('T');
    setEditDate(parts[0]);
    setEditTime(parts[1]);
    
    const cats = log.categories || [];
    setEditIsWork(cats.includes('Work') || log.category === 'Work');
    setEditIsHome(cats.includes('Home') || log.category === 'Home');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditSubject('');
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

    const logRef = doc(db, "logs", id);
    await updateDoc(logRef, {
      subject: editSubject,
      entry: editText,
      type: editType,
      categories: activeCategories,
      dateString: editDate,
      timestamp: `${editDate}T${editTime}`
    });
    setEditingId(null);
  };

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
      <div className="w-full max-w-2xl">
        
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Archive</h1>
          <Link href="/" className="bg-gray-600 text-white px-4 py-2 rounded font-bold hover:bg-gray-700">
            ← Back to Log
          </Link>
        </div>

        {/* --- FILTERS CARD --- */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          
          {/* 1. Text Search Row */}
          <div className="mb-6 border-b pb-6 border-gray-100">
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Search Text</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Type keywords..." 
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()} 
                className="flex-1 p-3 border border-gray-300 rounded text-black"
              />
              <button 
                onClick={handleSearchClick}
                className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700"
              >
                Search
              </button>
            </div>
          </div>

          {/* 2. Category & Date Row */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Category</label>
              <select 
                value={uiCategory} 
                onChange={(e) => setUiCategory(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-black"
              >
                <option value="All">Show All</option>
                <option value="Work">Work Only</option>
                <option value="Home">Home Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Date</label>
              <input 
                type="date" 
                value={uiDate}
                onChange={(e) => setUiDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-black"
              />
            </div>
          </div>

          {/* Filter Button */}
          <button 
            onClick={handleFilterClick}
            className="w-full bg-gray-800 text-white py-2 rounded font-bold hover:bg-black transition"
          >
            Apply Filters
          </button>

        </div>

        {/* --- RESULTS LIST --- */}
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <div key={log.id} className="bg-white p-4 rounded shadow border-l-4 border-gray-400">
              
              {editingId === log.id ? (
                // EDIT MODE
                <div className="flex flex-col gap-3 bg-blue-50 p-2 rounded">
                   <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editIsWork} onChange={(e) => setEditIsWork(e.target.checked)} className="accent-blue-600"/><span className="text-sm text-black">Work</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editIsHome} onChange={(e) => setEditIsHome(e.target.checked)} className="accent-green-600"/><span className="text-sm text-black">Home</span></label>
                  </div>
                  
                  <div className="flex gap-2">
                    <select value={editType} onChange={(e) => setEditType(e.target.value)} className="p-1 border rounded text-black text-sm">
                        <option value="Do">Do</option><option value="Done">Done</option><option value="Note">Note</option>
                    </select>
                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="p-1 border rounded text-black text-sm"/>
                    <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="p-1 border rounded text-black text-sm"/>
                  </div>
                  
                  <input 
                    type="text" 
                    value={editSubject} 
                    onChange={(e) => setEditSubject(e.target.value)} 
                    className="w-full p-2 border border-blue-300 rounded text-black text-sm font-bold"
                    placeholder="Subject..."
                  />

                  <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full p-2 border border-blue-300 rounded text-black text-sm" rows="3"></textarea>
                  
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelEditing} className="text-xs bg-gray-300 text-black px-2 py-1 rounded">Cancel</button>
                    <button onClick={() => saveEdit(log.id)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded">Save</button>
                  </div>
                </div>
              ) : (
                // VIEW MODE
                <>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex gap-2">
                      <span className="text-xs font-bold px-2 py-1 rounded border bg-gray-50 text-gray-600 border-gray-200">{displayCats(log)}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${getBadgeColor(log.type)}`}>{log.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 mr-2">{log.dateString} {log.timestamp.split('T')[1]}</span>
                      <button onClick={() => startEditing(log)} className="text-blue-600 text-xs font-bold hover:underline">Edit</button>
                      <button onClick={() => handleDelete(log.id)} className="text-red-600 text-xs font-bold hover:underline">X</button>
                    </div>
                  </div>
                  
                  {log.subject && <h4 className="font-bold text-gray-900 mb-1">{log.subject}</h4>}
                  <p className="text-gray-800 whitespace-pre-wrap">{log.entry}</p>
                </>
              )}
            </div>
          ))}
          
          {filteredLogs.length === 0 && (
            <p className="text-center text-gray-500 mt-8">No entries found matching your filters.</p>
          )}
        </div>

      </div>
    </div>
  );
}