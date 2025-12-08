'use client';
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';

export default function OpenTasksPage() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('All'); 
  const [expandedIds, setExpandedIds] = useState(new Set()); 

  // 1. Fetch Data
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

  // 2. Toggle Dropdown
  const toggleExpand = (customId) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(customId)) {
      newSet.delete(customId);
    } else {
      newSet.add(customId);
    }
    setExpandedIds(newSet);
  };

  // 3. Process & Sort Data
  const taskGroups = (() => {
    const openTickets = [];
    const childrenMap = {};

    logs.forEach(log => {
      // Find Parents (Open Tickets)
      if (log.type === 'Open' && log.customId) {
        let matchesCategory = true;
        if (filter === 'Work') matchesCategory = (log.categories && log.categories.includes('Work')) || log.category === 'Work' || log.category === 'Both';
        if (filter === 'Home') matchesCategory = (log.categories && log.categories.includes('Home')) || log.category === 'Home' || log.category === 'Both';
        
        if (matchesCategory) {
          openTickets.push(log);
          const key = log.customId.toString();
          if (!childrenMap[key]) childrenMap[key] = [];
        }
      }
      // Find Children (Done tasks)
      else if (log.type === 'Done' && log.taskRef) {
        const key = log.taskRef.toString();
        if (!childrenMap[key]) childrenMap[key] = [];
        childrenMap[key].push(log);
      }
    });

    // Sort: Open Tickets (Smallest ID at top) -> Children (Newest at top)
    return openTickets
      .sort((a, b) => (a.customId || 0) - (b.customId || 0))
      .map(ticket => {
        const key = ticket.customId.toString();
        const children = childrenMap[key] || [];
        
        return {
          ...ticket,
          children: children.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        };
      });
  })();

  const displayCats = (log) => {
    if (log.categories) return log.categories.join(' & ');
    return log.category || 'Work';
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Open Tasks</h1>
          <Link href="/" className="bg-gray-600 text-white px-4 py-2 rounded font-bold hover:bg-gray-700">
            ← Back
          </Link>
        </div>

        {/* Filter Selector */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Filter View</label>
          <div className="flex gap-2">
            <button onClick={() => setFilter('All')} className={`flex-1 py-2 rounded font-bold transition ${filter === 'All' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>All</button>
            <button onClick={() => setFilter('Work')} className={`flex-1 py-2 rounded font-bold transition ${filter === 'Work' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>Work</button>
            <button onClick={() => setFilter('Home')} className={`flex-1 py-2 rounded font-bold transition ${filter === 'Home' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>Home</button>
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-4">
          {taskGroups.length === 0 && <p className="text-center text-gray-500">No open tasks found.</p>}
          
          {taskGroups.map(ticket => (
            <div key={ticket.id} className="bg-white rounded-lg shadow border-l-4 border-blue-500 overflow-hidden">
              
              <div className="p-4 flex flex-col gap-4">
                {/* Header Row: Info + Dropdown Button */}
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-400 font-mono">#{ticket.customId}</span>
                      <span className="text-xs font-bold px-2 py-1 rounded border bg-gray-50 text-gray-600 border-gray-200">{displayCats(ticket)}</span>
                      <span className="text-xs text-gray-400">{ticket.dateString}</span>
                    </div>
                    {ticket.subject && <h3 className="font-bold text-gray-800 text-lg">{ticket.subject}</h3>}
                    <p className="text-gray-700 whitespace-pre-wrap">{ticket.entry}</p>
                    
                    {ticket.attachments && ticket.attachments.length > 0 && (
                       <div className="mt-2 text-xs text-blue-600 font-bold">
                         📎 {ticket.attachments.length} Attachment(s)
                       </div>
                    )}
                  </div>

                  <button 
                    onClick={() => toggleExpand(ticket.customId)}
                    className="ml-3 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition flex flex-col items-center min-w-[50px]"
                  >
                    <span className="text-xs font-bold text-gray-500 mb-1">{ticket.children.length}</span>
                    <svg className={`w-6 h-6 text-gray-600 transform transition-transform ${expandedIds.has(ticket.customId) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* --- THE QUICK UPDATE BUTTON --- */}
                <Link href={`/?taskId=${ticket.customId}`} className="w-full">
                  <button className="w-full bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700 transition text-sm flex items-center justify-center gap-2 shadow-sm">
                    <span className="text-lg leading-none font-bold">+</span> Log Update for #{ticket.customId}
                  </button>
                </Link>

              </div>

              {/* Children List */}
              {expandedIds.has(ticket.customId) && (
                <div className="bg-gray-50 border-t border-gray-100 p-4 space-y-3 animate-fade-in">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Progress History</h4>
                  
                  {ticket.children.length === 0 && <p className="text-sm text-gray-400 italic">No progress logged yet.</p>}

                  {ticket.children.map(child => (
                    <div key={child.id} className="bg-white p-3 rounded border border-gray-200 shadow-sm relative">
                      <div className="absolute -left-4 top-4 w-4 h-px bg-gray-300"></div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-800">Done</span>
                        <span className="text-xs text-gray-400">{child.dateString} {child.timestamp.split('T')[1]}</span>
                      </div>
                      <p className="text-sm text-gray-700">{child.entry}</p>
                      
                      {child.attachments && child.attachments.length > 0 && (
                         <div className="mt-2 flex flex-wrap gap-2">
                           {child.attachments.map((file, idx) => (
                             <a key={idx} href={file.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">📄 {file.name.substring(0, 10)}...</a>
                           ))}
                         </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

            </div>
          ))}
        </div>

      </div>
    </div>
  );
}