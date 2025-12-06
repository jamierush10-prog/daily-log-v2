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
  const [uiDate, setUiDate] = useState('');
  const [uiShowContext, setUiShowContext] = useState(false); // NEW: Context Toggle

  // --- ACTIVE FILTERS ---
  const [activeSearch, setActiveSearch] = useState(''); 
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeDate, setActiveDate] = useState('');
  const [activeShowContext, setActiveShowContext] = useState(false); // Active state for logic

  // Editing State
  const [editingId, setEditingId] = useState(null);
  const [editSubject, setEditSubject] = useState('');
  const [editText, setEditText] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editType, setEditType] = useState('Open');
  const [editIsWork, setEditIsWork] = useState(false);
  const [editIsHome, setEditIsHome] = useState(false);
  const [editTaskRef, setEditTaskRef] = useState('');

  const [expandedImage, setExpandedImage] = useState(null);

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

  // --- SMART FILTER LOGIC ---
  const filteredLogs = (() => {
    // 1. First, basic filtering (Search Text & Category)
    // We do this first because these apply to EVERYTHING
    const baseFiltered = logs.filter(log => {
      const term = activeSearch.toLowerCase();
      const entryMatch = log.entry.toLowerCase().includes(term);
      const subjectMatch = log.subject ? log.subject.toLowerCase().includes(term) : false;
      const matchesSearch = entryMatch || subjectMatch;
      
      let matchesCategory = true;
      if (activeCategory === 'Work') {
        matchesCategory = (log.categories && log.categories.includes('Work')) || log.category === 'Work' || log.category === 'Both';
      } else if (activeCategory === 'Home') {
        matchesCategory = (log.categories && log.categories.includes('Home')) || log.category === 'Home' || log.category === 'Both';
      }
      return matchesSearch && matchesCategory;
    });

    // 2. Identify "Open" IDs (We need this for the context logic)
    // We need to know which tickets are currently Open to find their children
    const openTicketIds = new Set(
      baseFiltered.filter(l => l.type === 'Open' && l.customId).map(l => l.customId.toString())
    );

    // 3. Final Filter (Date + Context)
    return baseFiltered.filter(log => {
      // Rule A: Matches the Date exactly
      const isDateMatch = activeDate ? (log.dateString === activeDate) : true;

      // Rule B: Context Mode Logic
      if (activeShowContext) {
        // Include if Date Matches OR...
        if (isDateMatch) return true;

        // ...It is an OPEN ticket
        if (log.type === 'Open') return true;

        // ...It is a DONE task linked to an Open Ticket
        if (log.type === 'Done' && log.taskRef && openTicketIds.has(log.taskRef.toString())) {
          return true;
        }
        
        return false;
      }

      // Default: Strict Date Match only
      return isDateMatch;
    });
  })();

  const handleSearchClick = () => setActiveSearch(searchText);
  
  const handleFilterClick = () => { 
    setActiveCategory(uiCategory); 
    setActiveDate(uiDate); 
    setActiveShowContext(uiShowContext); // Apply the toggle
  };

  const handleDelete = async (id) => {
    if (confirm("Permanently delete this log?")) {
      await deleteDoc(doc(db, "logs", id));
    }
  };

  const markAsClosed = async (id) => {
    const logRef = doc(db, "logs", id);
    await updateDoc(logRef, { type: 'Closed' });
  };

  const startEditing = (log) => {
    setEditingId(log.id);
    setEditSubject(log.subject || '');
    setEditText(log.entry);
    setEditType(log.type || 'Open');
    setEditTaskRef(log.taskRef || '');
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
    setEditTaskRef('');
  };

  const saveEdit = async (id) => {
    const activeCategories = [];
    if (editIsWork) activeCategories.push('Work');
    if (editIsHome) activeCategories.push('Home');

    const logRef = doc(db, "logs", id);
    await updateDoc(logRef, {
      subject: editSubject,
      entry: editText,
      type: editType,
      taskRef: (editType === 'Done' && editTaskRef) ? editTaskRef : null,
      categories: activeCategories,
      dateString: editDate,
      timestamp: `${editDate}T${editTime}`
    });
    setEditingId(null);
  };

  const getBadgeColor = (type) => {
    switch(type) {
      case 'Open':    return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'Done':    return 'bg-green-100 text-green-800 border border-green-200'; 
      case 'Closed':  return 'bg-gray-200 text-gray-800 border border-gray-300';
      case 'Note':    return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
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
        
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Archive</h1>
          <Link href="/" className="bg-gray-600 text-white px-4 py-2 rounded font-bold hover:bg-gray-700">
            ← Back to Log
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="mb-6 border-b pb-6 border-gray-100">
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Search Text</label>
            <div className="flex gap-2">
              <input type="text" placeholder="Type keywords..." value={searchText} onChange={(e) => setSearchText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()} className="flex-1 p-3 border border-gray-300 rounded text-black"/>
              <button onClick={handleSearchClick} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700">Search</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Category</label>
              <select value={uiCategory} onChange={(e) => setUiCategory(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-black">
                <option value="All">Show All</option>
                <option value="Work">Work Only</option>
                <option value="Home">Home Only</option>
              </select>
            </div>
            
            {/* DATE + TOGGLE ROW */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Date</label>
              <div className="flex items-center gap-2">
                <input type="date" value={uiDate} onChange={(e) => setUiDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-black"/>
                
                {/* --- NEW TOGGLE --- */}
                <label className="flex items-center cursor-pointer" title="Include Open Tickets & Related History">
                  <input 
                    type="checkbox" 
                    checked={uiShowContext} 
                    onChange={(e) => setUiShowContext(e.target.checked)} 
                    className="w-5 h-5 accent-blue-600 cursor-pointer"
                  />
                  <span className="ml-2 text-xs font-bold text-blue-700 whitespace-nowrap">
                    Show Open
                  </span>
                </label>
              </div>
            </div>
          </div>
          
          <button onClick={handleFilterClick} className="w-full bg-gray-800 text-white py-2 rounded font-bold hover:bg-black transition">Apply Filters</button>
        </div>

        {/* Results */}
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <div key={log.id} className="bg-white p-4 rounded shadow border-l-4 border-gray-400 relative">
              
              {editingId === log.id ? (
                // --- EDIT MODE ---
                <div className="flex flex-col gap-3 bg-blue-50 p-2 rounded">
                   <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editIsWork} onChange={(e) => setEditIsWork(e.target.checked)} className="accent-blue-600"/><span className="text-sm text-black">Work</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editIsHome} onChange={(e) => setEditIsHome(e.target.checked)} className="accent-green-600"/><span className="text-sm text-black">Home</span></label>
                  </div>
                  <div className="flex gap-2">
                    <select value={editType} onChange={(e) => setEditType(e.target.value)} className="p-1 border rounded text-black text-sm">
                        <option value="Open">Open</option>
                        <option value="Done">Done</option>
                        <option value="Closed">Closed</option>
                        <option value="Note">Note</option>
                    </select>
                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="p-1 border rounded text-black text-sm"/>
                    <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="p-1 border rounded text-black text-sm"/>
                  </div>
                  
                  {editType === 'Done' && (
                     <input type="number" value={editTaskRef} onChange={(e) => setEditTaskRef(e.target.value)} className="w-full p-2 border border-blue-300 rounded text-black text-sm font-mono" placeholder="Related Task # (e.g. 42)"/>
                  )}

                  <input type="text" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="w-full p-2 border border-blue-300 rounded text-black text-sm font-bold" placeholder="Subject..."/>
                  <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full p-2 border border-blue-300 rounded text-black text-sm" rows="3"></textarea>
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelEditing} className="text-xs bg-gray-300 text-black px-2 py-1 rounded">Cancel</button>
                    <button onClick={() => saveEdit(log.id)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded">Save</button>
                  </div>
                </div>
              ) : (
                // --- VIEW MODE ---
                <>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex gap-2 items-center">
                      
                      <span className="text-xs text-gray-400 font-mono mr-1">
                        {log.customId ? `#${log.customId}` : ''} 
                        {log.taskRef ? `(Ref: #${log.taskRef})` : ''} 
                        {' '}{log.dateString} {log.timestamp.split('T')[1]}
                      </span>

                      <span className="text-xs font-bold px-2 py-1 rounded border bg-gray-50 text-gray-600 border-gray-200">
                        {displayCats(log)}
                      </span>

                      <div className="flex items-center">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${getBadgeColor(log.type)} flex items-center gap-1`}>
                          {log.type}
                          {log.type === 'Open' && (
                            <button onClick={() => markAsClosed(log.id)} className="w-3 h-3 rounded-full border border-blue-600 hover:bg-blue-600 ml-1 transition" title="Mark as Closed"></button>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={() => startEditing(log)} className="text-blue-600 text-xs font-bold hover:underline">Edit</button>
                      <button onClick={() => handleDelete(log.id)} className="text-red-600 text-xs font-bold hover:underline">X</button>
                    </div>
                  </div>
                  
                  {log.subject && <h4 className="font-bold text-gray-900 mb-1">{log.subject}</h4>}
                  <p className="text-gray-800 whitespace-pre-wrap">{log.entry}</p>

                  {log.imageUrl && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-400 mb-1">Attachment:</p>
                      <img src={log.imageUrl} alt="Log attachment" onClick={() => setExpandedImage(log.imageUrl)} className="w-20 h-20 object-cover rounded-lg border border-gray-300 cursor-pointer hover:opacity-80 transition" />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {filteredLogs.length === 0 && <p className="text-center text-gray-500 mt-8">No entries found.</p>}
        </div>

        {expandedImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4" onClick={() => setExpandedImage(null)}>
            <div className="relative max-w-full max-h-full">
              <img src={expandedImage} alt="Full screen" className="max-w-full max-h-[90vh] rounded shadow-2xl"/>
              <button className="absolute -top-10 right-0 text-white text-xl font-bold bg-gray-800 px-3 py-1 rounded-full opacity-80">Close X</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}