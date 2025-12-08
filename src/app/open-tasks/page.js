'use client';
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore'; 
import Link from 'next/link';

export default function OpenTasksPage() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('All'); 
  const [expandedIds, setExpandedIds] = useState(new Set()); 

  // Editing State
  const [editingChildId, setEditingChildId] = useState(null);
  const [editChildText, setEditChildText] = useState('');

  useEffect(() => {
    const q = query(collection(db, "logs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(logsData);
    });
    return () => unsubscribe();
  }, []);

  const toggleExpand = (customId) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(customId)) newSet.delete(customId);
    else newSet.add(customId);
    setExpandedIds(newSet);
  };

  const startEditingChild = (child) => {
    setEditingChildId(child.id);
    setEditChildText(child.entry);
  };

  const cancelEditingChild = () => {
    setEditingChildId(null);
    setEditChildText('');
  };

  const saveChildEdit = async (id) => {
    const logRef = doc(db, "logs", id);
    await updateDoc(logRef, { entry: editChildText });
    setEditingChildId(null);
  };

  const taskGroups = (() => {
    const openTickets = [];
    const childrenMap = {};

    logs.forEach(log => {
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
      else if (log.type === 'Done' && log.taskRef) {
        const key = log.taskRef.toString();
        if (!childrenMap[key]) childrenMap[key] = [];
        childrenMap[key].push(log);
      }
    });

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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Open Tasks</h1>
          <Link href="/" className="bg-gray-600 text-white px-4 py-2 rounded font-bold hover:bg-gray-700">← Back</Link>
        </div>

        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Filter View</label>
          <div className="flex gap-2">
            <button onClick={() => setFilter('All')} className={`flex-1 py-2 rounded font-bold transition ${filter === 'All' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>All</button>
            <button onClick={() => setFilter('Work')} className={`flex-1 py-2 rounded font-bold transition ${filter === 'Work' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>Work</button>
            <button onClick={() => setFilter('Home')} className={`flex-1 py-2 rounded font-bold transition ${filter === 'Home' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>Home</button>
          </div>
        </div>

        <div className="space-y-4">
          {taskGroups.length === 0 && <p className="text-center text-gray-500">No open tasks found.</p>}
          
          {taskGroups.map(ticket => (
            <div key={ticket.id} className="bg-white rounded-lg shadow border-l-4 border-blue-500 overflow-hidden">
              
              {/* HEADER (Collapsed) */}
              <div 
                onClick={() => toggleExpand(ticket.customId)}
                className="p-4 cursor-pointer hover:bg-gray-50 transition flex justify-between items-start"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-400 font-mono">#{ticket.customId}</span>
                    <span className="text-xs font-bold px-2 py-1 rounded border bg-gray-50 text-gray-600 border-gray-200">{displayCats(ticket)}</span>
                    <span className="text-xs text-gray-400">{ticket.dateString}</span>
                    {ticket.attachments?.length > 0 && <span className="text-xs">📎</span>}
                    {ticket.links?.length > 0 && <span className="text-xs">🔗</span>}
                  </div>
                  <h3 className="font-bold text-gray-800 text-lg">{ticket.subject || '(No Subject)'}</h3>
                </div>
                <div className="ml-3 p-1 text-gray-400">
                  <svg className={`w-6 h-6 transform transition-transform duration-200 ${expandedIds.has(ticket.customId) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>

              {/* EXPANDED SECTION */}
              {expandedIds.has(ticket.customId) && (
                <div className="px-4 pb-4 animate-fade-in border-t border-gray-100 pt-4">
                  
                  {/* Parent Description */}
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Description</label>
                    <p className="text-gray-700 whitespace-pre-wrap">{ticket.entry}</p>
                  </div>

                  {/* Parent Files/Links */}
                  {(ticket.attachments?.length > 0 || ticket.links?.length > 0) && (
                     <div className="mb-4">
                       <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Files & Links</label>
                       <div className="flex flex-wrap gap-2">
                         {ticket.attachments?.map((file, idx) => (
                           <a key={idx} href={file.url} target="_blank" rel="noopener noreferrer" className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100 flex items-center gap-1">
                             {file.type?.startsWith('image/') ? '🖼️' : '📄'} {file.name}
                           </a>
                         ))}
                         {ticket.links?.map((link, idx) => (
                           <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-200 hover:bg-purple-100 flex items-center gap-1">
                             🔗 {link.title}
                           </a>
                         ))}
                       </div>
                     </div>
                  )}

                  {/* Log Update Button */}
                  <Link href={`/?taskId=${ticket.customId}`}>
                    <button className="w-full bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700 transition text-sm flex items-center justify-center gap-2 shadow-sm mb-4">
                      <span className="text-lg leading-none font-bold">+</span> Log Update
                    </button>
                  </Link>

                  {/* PROGRESS HISTORY */}
                  <div className="bg-gray-50 border-t border-gray-200 -mx-4 -mb-4 p-4 space-y-3">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Progress History ({ticket.children.length})</h4>
                    
                    {ticket.children.length === 0 && <p className="text-sm text-gray-400 italic">No updates logged yet.</p>}

                    {ticket.children.map(child => (
                      <div key={child.id} className="bg-white p-3 rounded border border-gray-200 shadow-sm relative">
                        <div className="absolute -left-4 top-4 w-4 h-px bg-gray-300"></div>
                        
                        {/* Child Header */}
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-800">Done</span>
                          <span className="text-xs text-gray-400">{child.dateString} {child.timestamp.split('T')[1]}</span>
                          {editingChildId !== child.id && (
                            <button onClick={() => startEditingChild(child)} className="text-xs text-blue-600 font-bold hover:underline ml-auto">Edit</button>
                          )}
                        </div>

                        {/* Child Edit or View */}
                        {editingChildId === child.id ? (
                          <div className="mt-2">
                            <textarea value={editChildText} onChange={(e) => setEditChildText(e.target.value)} className="w-full p-2 border border-blue-300 rounded text-sm mb-2 text-black" rows="3"></textarea>
                            <div className="flex justify-end gap-2">
                              <button onClick={cancelEditingChild} className="text-xs bg-gray-300 text-black px-2 py-1 rounded">Cancel</button>
                              <button onClick={() => saveChildEdit(child.id)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Save</button>
                            </div>
                          </div>
                        ) : (
                          // VIEW MODE: Show Subject and Entry
                          <div>
                            {child.subject && <h5 className="font-bold text-gray-800 text-sm mb-1">{child.subject}</h5>}
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{child.entry}</p>
                          </div>
                        )}
                        
                        {/* Child Links/Files */}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {child.attachments?.map((file, idx) => (
                             <a key={idx} href={file.url} target="_blank" rel="noopener noreferrer" className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100 flex items-center gap-1">📄 {file.name.substring(0, 10)}...</a>
                          ))}
                          {child.links?.map((link, idx) => (
                             <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-200 hover:bg-purple-100 flex items-center gap-1">🔗 {link.title}</a>
                          ))}
                        </div>

                      </div>
                    ))}
                  </div>

                </div>
              )}

            </div>
          ))}
        </div>

      </div>
    </div>
  );
}