'use client';
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';

export default function HistoryPage() {
  const [logs, setLogs] = useState([]);
  
  // Filters
  const [searchText, setSearchText] = useState(''); 
  const [uiCategory, setUiCategory] = useState('All'); 
  const [uiDate, setUiDate] = useState('');
  const [uiShowContext, setUiShowContext] = useState(false);

  // Active Filters
  const [activeSearch, setActiveSearch] = useState(''); 
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeDate, setActiveDate] = useState('');
  const [activeShowContext, setActiveShowContext] = useState(false);

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

  const [status, setStatus] = useState('');
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

  // --- FILTERING ---
  const filteredLogs = logs.filter(log => {
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

    const createdOnDate = activeDate ? (log.dateString === activeDate) : true;
    const closedOnDate = activeDate ? (log.closedDate === activeDate) : false;
    const openTicketIds = new Set(logs.filter(l => l.type === 'Open' && l.customId).map(l => l.customId.toString()));

    if (activeShowContext) {
      if (createdOnDate) return true;
      if (closedOnDate) return true; 
      if (log.type === 'Open') return true; 
      if (log.type === 'Done' && log.taskRef && openTicketIds.has(log.taskRef.toString())) return true; 
      return false;
    }

    return matchesSearch && matchesCategory && (createdOnDate || closedOnDate);
  });

  // --- GROUPING ---
  const organizedLogs = (() => {
    const openTickets = [];
    const closedTickets = [];
    const childMap = {};
    const looseLogs = [];

    filteredLogs.forEach(log => {
      if (log.customId && (log.type === 'Open' || log.type === 'Closed')) {
        if (log.type === 'Open') {
            openTickets.push(log);
        } else {
            closedTickets.push(log);
        }
        childMap[log.customId] = [];
      } else {
        looseLogs.push(log);
      }
    });

    const trulyLooseLogs = [];
    looseLogs.forEach(log => {
      if (log.type === 'Done' && log.taskRef && childMap[log.taskRef]) {
        childMap[log.taskRef].push({ ...log, isChild: true });
      } else {
        trulyLooseLogs.push(log);
      }
    });

    const finalOrder = [];
    const addTicketWithChildren = (ticket) => {
        finalOrder.push(ticket);
        const children = childMap[ticket.customId].sort((a,b) => b.timestamp.localeCompare(a.timestamp));
        finalOrder.push(...children);
    };

    openTickets.forEach(addTicketWithChildren);
    closedTickets.forEach(addTicketWithChildren);
    finalOrder.push(...trulyLooseLogs);

    return finalOrder;
  })();

  const markAsClosed = async (id) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;

    const logRef = doc(db, "logs", id);
    await updateDoc(logRef, { 
      type: 'Closed',
      closedDate: todayString
    });
  };

  const generateBrief = () => {
    if (organizedLogs.length === 0) {
      alert("No logs visible to report on.");
      return;
    }
    setStatus('Generating...');

    const logText = organizedLogs.map(log => {
      const time = log.timestamp.split('T')[1];
      const cats = log.categories ? log.categories.join('/') : 'General';
      let typeLabel = log.type;
      if (log.type === 'Closed' && log.closedDate === activeDate) typeLabel = 'COMPLETED TODAY';

      const refInfo = log.customId ? `[TICKET #${log.customId}]` : (log.taskRef ? `[REF #${log.taskRef}]` : '');
      const subject = log.subject ? ` - SUBJECT: ${log.subject}` : '';
      const indent = log.isChild ? "   >>> " : "";
      
      // Add attachment info to AI
      const attachInfo = (log.attachments?.length > 0) ? ` [${log.attachments.length} ATTACHMENTS]` : '';
      
      return `${indent}[${log.dateString} ${time}] [${cats}] [${typeLabel}] ${refInfo}${subject}${attachInfo}: ${log.entry}`;
    }).join('\n');

    const prompt = `Act as my Executive Officer. Review these logs (${activeDate || 'All Time'}).

LOG DATA:
${logText}

REQUIREMENTS:
1. List [COMPLETED TODAY] items as Accomplishments.
2. Prioritize [Open] items for the Plan of the Day.
3. Summarize [Done] tasks.
`;

    navigator.clipboard.writeText(prompt);
    setStatus('Copied!');
    setTimeout(() => setStatus(''), 2000);
  };

  // Handlers
  const handleSearchClick = () => setActiveSearch(searchText);
  const handleFilterClick = () => { 
    setActiveCategory(uiCategory); 
    setActiveDate(uiDate); 
    setActiveShowContext(uiShowContext); 
  };

  const handleDelete = async (id) => {
    if (confirm("Permanently delete this log?")) {
      await deleteDoc(doc(db, "logs", id));
    }
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

  const getBadgeColor = (type, closedDate) => {
    if (type === 'Closed' && activeDate && closedDate === activeDate) {
      return 'bg-green-600 text-white border border-green-700 shadow-sm';
    }
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
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Date</label>
              <div className="flex items-center gap-2">
                <input type="date" value={uiDate} onChange={(e) => setUiDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-black"/>
                <label className="flex items-center cursor-pointer" title="Include Ticket History">
                  <input type="checkbox" checked={uiShowContext} onChange={(e) => setUiShowContext(e.target.checked)} className="w-5 h-5 accent-blue-600 cursor-pointer"/>
                  <span className="ml-2 text-xs font-bold text-blue-700 whitespace-nowrap">Show Context</span>
                </label>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button onClick={handleFilterClick} className="flex-1 bg-gray-800 text-white py-3 rounded font-bold hover:bg-black transition">Apply Filters</button>
            <button onClick={generateBrief} className="flex-1 bg-purple-600 text-white py-3 rounded font-bold hover:bg-purple-700 transition">{status || "Copy AI Brief"}</button>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-3">
          {organizedLogs.map((log) => (
            <div key={log.id} className={`bg-white p-4 rounded shadow border-l-4 border-gray-400 relative ${log.isChild ? 'ml-12 border-l-8 border-l-gray-300 bg-gray-50' : ''}`}>
              
              {log.isChild && <div className="absolute -left-6 top-6 w-6 h-8 border-b-2 border-l-2 border-gray-300 rounded-bl-lg"></div>}

              {editingId === log.id ? (
                // --- EDIT MODE ---
                <div className="flex flex-col gap-3 p-2 rounded">
                   <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editIsWork} onChange={(e) => setEditIsWork(e.target.checked)} className="accent-blue-600"/><span className="text-sm text-black">Work</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editIsHome} onChange={(e) => setEditIsHome(e.target.checked)} className="accent-green-600"/><span className="text-sm text-black">Home</span></label>
                  </div>
                  <div className="flex gap-2">
                    <select value={editType} onChange={(e) => setEditType(e.target.value)} className="p-1 border rounded text-black text-sm">
                        <option value="Open">Open</option><option value="Done">Done</option><option value="Closed">Closed</option><option value="Note">Note</option>
                    </select>
                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="p-1 border rounded text-black text-sm"/>
                    <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="p-1 border rounded text-black text-sm"/>
                  </div>
                  {editType === 'Done' && <input type="number" value={editTaskRef} onChange={(e) => setEditTaskRef(e.target.value)} className="w-full p-2 border border-blue-300 rounded text-black text-sm font-mono" placeholder="Related Task # (e.g. 42)"/>}
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
                        {log.customId ? `#${log.customId}` : ''} {log.taskRef && !log.isChild ? `(Ref: #${log.taskRef})` : ''} {log.dateString} {log.timestamp.split('T')[1]}
                      </span>
                      <span className="text-xs font-bold px-2 py-1 rounded border bg-gray-50 text-gray-600 border-gray-200">{displayCats(log)}</span>
                      <div className="flex items-center">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${getBadgeColor(log.type, log.closedDate)} flex items-center gap-1`}>
                          {log.type}
                          {log.type === 'Open' && <button onClick={() => markAsClosed(log.id)} className="w-3 h-3 rounded-full border border-blue-600 hover:bg-blue-600 ml-1 transition" title="Mark as Closed"></button>}
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
                  
                  {/* --- NEW: MULTI-FILE DISPLAY --- */}
                  {/* Backward Compatible for single ImageUrl */}
                  {log.imageUrl && !log.attachments && (
                    <div className="mt-3">
                      <img src={log.imageUrl} alt="Log attachment" onClick={() => setExpandedImage(log.imageUrl)} className="w-20 h-20 object-cover rounded-lg border border-gray-300 cursor-pointer hover:opacity-80 transition" />
                    </div>
                  )}

                  {/* New Array Attachments */}
                  {log.attachments && log.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {log.attachments.map((file, idx) => {
                        const isImage = file.type?.startsWith('image/');
                        return isImage ? (
                          <img 
                            key={idx} 
                            src={file.url} 
                            alt={file.name} 
                            onClick={() => setExpandedImage(file.url)} 
                            className="w-20 h-20 object-cover rounded-lg border border-gray-300 cursor-pointer hover:opacity-80 transition"
                          />
                        ) : (
                          <a 
                            key={idx} 
                            href={file.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded border border-gray-300 text-xs text-blue-600 font-bold hover:bg-gray-200 transition"
                          >
                            📄 {file.name.substring(0, 15)}...
                          </a>
                        );
                      })}
                    </div>
                  )}

                </>
              )}
            </div>
          ))}
          {organizedLogs.length === 0 && <p className="text-center text-gray-500 mt-8">No entries found.</p>}
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