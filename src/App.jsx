import React, { useState, useEffect } from 'react';
import { Briefcase, BrainCircuit, Plus, Trash2, ChevronLeft, ChevronRight, CalendarDays, Cloud, CloudOff } from 'lucide-react';
import { supabase } from './supabase';
import './index.css';

// Format as YYYY-MM-DD for storage keys
const formatDateString = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getDisplayDate = (dateString) => {
  const [yyyy, mm, dd] = dateString.split('-');
  const date = new Date(yyyy, mm - 1, dd);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

function App() {
  const todayStr = formatDateString(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(todayStr);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from LocalStorage first for instant load
  const [daysData, setDaysData] = useState(() => {
    const savedData = localStorage.getItem('tracker_days_data');
    if (savedData) return JSON.parse(savedData);
    
    return {
      [todayStr]: { office: [], study: [] }
    };
  });

  const [officeInput, setOfficeInput] = useState('');
  const [studyInput, setStudyInput] = useState('');

  // 1. Fetch from Supabase on Load
  useEffect(() => {
    const fetchFromCloud = async () => {
      if (!supabase) {
        setIsLoading(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('daily_tasks')
          .select('*');
          
        if (error) throw error;
        
        if (data) {
          if (data.length > 0) {
            const cloudData = {};
            data.forEach(row => {
              cloudData[row.date] = row.data;
            });
            
            setDaysData(prev => ({
              ...prev,
              ...cloudData
            }));
          }
          setIsCloudSynced(true);
        }
      } catch (err) {
        console.error("Supabase sync error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchFromCloud();
  }, []);

  // 2. Save to LocalStorage & Supabase whenever daysData changes
  useEffect(() => {
    localStorage.setItem('tracker_days_data', JSON.stringify(daysData));
  }, [daysData]);

  // Helper to update state and optionally sync to cloud
  const updateDataAndSync = async (newDaysData, dateStr) => {
    setDaysData(newDaysData);
    
    // Sync to Supabase
    if (supabase) {
      try {
        const { error } = await supabase
          .from('daily_tasks')
          .upsert({
            date: dateStr,
            data: newDaysData[dateStr]
          });
          
        if (error) {
          console.error("Cloud save failed:", error);
          setIsCloudSynced(false);
        } else {
          setIsCloudSynced(true);
        }
      } catch (err) {
        console.error("Cloud save failed:", err);
      }
    }
  };

  const currentTasks = daysData[selectedDateStr] || { office: [], study: [] };

  const handleDateChange = (offset) => {
    const [yyyy, mm, dd] = selectedDateStr.split('-');
    const d = new Date(yyyy, mm - 1, dd);
    d.setDate(d.getDate() + offset);
    setSelectedDateStr(formatDateString(d));
  };
  
  const jumpToToday = () => setSelectedDateStr(todayStr);

  const addTask = (type, text, setText) => {
    if (!text.trim()) return;
    
    const newTask = { id: Date.now().toString(), text: text.trim(), completed: false };
    
    const dayTasks = daysData[selectedDateStr] || { office: [], study: [] };
    const newDaysData = {
      ...daysData,
      [selectedDateStr]: {
        ...dayTasks,
        [type]: [...dayTasks[type], newTask]
      }
    };
    
    updateDataAndSync(newDaysData, selectedDateStr);
    setText('');
  };

  const toggleTask = (type, id) => {
    const dayTasks = daysData[selectedDateStr] || { office: [], study: [] };
    const newDaysData = {
      ...daysData,
      [selectedDateStr]: {
        ...dayTasks,
        [type]: dayTasks[type].map(t => t.id === id ? { ...t, completed: !t.completed } : t)
      }
    };
    updateDataAndSync(newDaysData, selectedDateStr);
  };

  const deleteTask = (type, id) => {
    const dayTasks = daysData[selectedDateStr] || { office: [], study: [] };
    const newDaysData = {
      ...daysData,
      [selectedDateStr]: {
        ...dayTasks,
        [type]: dayTasks[type].filter(t => t.id !== id)
      }
    };
    updateDataAndSync(newDaysData, selectedDateStr);
  };

  const totalOffice = currentTasks.office?.length || 0;
  const completedOffice = currentTasks.office?.filter(t => t.completed).length || 0;
  const totalStudy = currentTasks.study?.length || 0;
  const completedStudy = currentTasks.study?.filter(t => t.completed).length || 0;
  
  const totalTasks = totalOffice + totalStudy;
  const totalCompleted = completedOffice + completedStudy;
  const progressPercentage = totalTasks === 0 ? 0 : Math.round((totalCompleted / totalTasks) * 100);

  return (
    <>
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>
      
      <header className="glass-panel">
        <div className="header-container">
          <div className="title-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <h1>Daily Catalyst</h1>
              {/* Cloud Sync Status Indicator */}
              <div title={supabase ? (isCloudSynced ? "Synced to cloud" : "Syncing...") : "Cloud Sync Disabled (Check .env)"} 
                   style={{ color: supabase ? (isCloudSynced ? 'var(--success)' : 'var(--text-muted)') : 'var(--danger)', marginTop: '-0.5rem' }}>
                {supabase ? <Cloud size={24} /> : <CloudOff size={24} />}
              </div>
            </div>
            <p>Tracking your journey from Office to AI Engineering</p>
            
            <div className="date-navigator">
              <button className="date-btn" onClick={() => handleDateChange(-1)}><ChevronLeft size={20} /></button>
              <div className="date-display"><CalendarDays size={18} /><span>{getDisplayDate(selectedDateStr)}</span></div>
              <button className="date-btn" onClick={() => handleDateChange(1)}><ChevronRight size={20} /></button>
              {selectedDateStr !== todayStr && <button className="today-btn" onClick={jumpToToday}>Today</button>}
            </div>
          </div>
          
          <div className="progress-section">
            <div className="progress-label">
              <span>Day Progress</span>
              <span>{progressPercentage}%</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${progressPercentage}%` }}></div>
            </div>
            <p style={{ marginTop: '0.8rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {totalCompleted} of {totalTasks} tasks completed
            </p>
          </div>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="glass-panel">
          <div className="category-header">
            <div className="category-icon office-icon"><Briefcase size={24} /></div>
            <div><h2>Office Hours</h2><p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>9:00 AM - 5:30 PM</p></div>
          </div>
          <form className="task-form" onSubmit={(e) => { e.preventDefault(); addTask('office', officeInput, setOfficeInput); }}>
            <input type="text" className="task-input" placeholder="Add an office task..." value={officeInput} onChange={(e) => setOfficeInput(e.target.value)} />
            <button type="submit" className="add-btn"><Plus size={24} /></button>
          </form>
          <div className="task-list">
            {!currentTasks.office || currentTasks.office.length === 0 ? (
              <div className="empty-state">No office tasks for this day.</div>
            ) : (
              currentTasks.office.map(task => (
                <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                  <label className="checkbox-container">
                    <input type="checkbox" checked={task.completed} onChange={() => toggleTask('office', task.id)} />
                    <span className="checkmark"></span>
                  </label>
                  <span className="task-content">{task.text}</span>
                  <button className="delete-btn" onClick={() => deleteTask('office', task.id)}><Trash2 size={18} /></button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="glass-panel">
          <div className="category-header">
            <div className="category-icon study-icon"><BrainCircuit size={24} /></div>
            <div><h2>AI Engineering Study</h2><p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>After 5:30 PM</p></div>
          </div>
          <form className="task-form" onSubmit={(e) => { e.preventDefault(); addTask('study', studyInput, setStudyInput); }}>
            <input type="text" className="task-input" placeholder="Add a study topic..." value={studyInput} onChange={(e) => setStudyInput(e.target.value)} />
            <button type="submit" className="add-btn" style={{ background: 'var(--accent-study)' }}><Plus size={24} /></button>
          </form>
          <div className="task-list">
            {!currentTasks.study || currentTasks.study.length === 0 ? (
              <div className="empty-state">No study topics for this day.</div>
            ) : (
              currentTasks.study.map(task => (
                <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                  <label className="checkbox-container">
                    <input type="checkbox" checked={task.completed} onChange={() => toggleTask('study', task.id)} />
                    <span className="checkmark"></span>
                  </label>
                  <span className="task-content">{task.text}</span>
                  <button className="delete-btn" onClick={() => deleteTask('study', task.id)}><Trash2 size={18} /></button>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </>
  );
}

export default App;
