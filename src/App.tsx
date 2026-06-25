import React, { useState, useEffect, useRef } from 'react';
import { processAuraCommand, scanImageWithGemini, type Task, type UserScheduleProfile, type CoachingTone } from './services/gemini';
import { 
  Menu, SquarePen, Plus, Mic, Send, X, History, Trash2, Settings, 
  ArrowLeft, Check, Clock, 
  Zap, Calendar, ListTodo, Sparkles
} from 'lucide-react';
import { AuraOrb } from './components/AuraOrb';
import './App.css';

export const App: React.FC = () => {
  const [appState, setAppState] = useState<'login' | 'transition' | 'chat_open' | 'chat_closed'>('login');
  const [loginUsername, setLoginUsername] = useState('ĀKHÌL');
  const [loginPassword, setLoginPassword] = useState('password');
  const [username, setUsername] = useState('ĀKHÌL');
  const [showSettings, setShowSettings] = useState(false);
  const [hasCompletedTransition, setHasCompletedTransition] = useState(false);
  
  const [inputCommand, setInputCommand] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [chatLog, setChatLog] = useState<{ sender: 'user' | 'aura'; text: string; tasks?: Task[] }[]>([]);
  
  const [archivedChats, setArchivedChats] = useState<{ id: string; date: string; log: any[] }[]>(() => {
    const saved = localStorage.getItem('aura_archived_chats');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeArchivedChat, setActiveArchivedChat] = useState<any[] | null>(null);

  // Active Screen Routing
  const [activeScreen, setActiveScreen] = useState<'chat' | 'timetable' | 'tasks' | 'schedule' | 'tips' | 'agents' | 'scanner'>('chat');

  // Timetable Schedule Profile
  const [timetableProfile, setTimetableProfile] = useState<UserScheduleProfile>(() => {
    const saved = localStorage.getItem('aura_timetable_profile');
    if (saved) return JSON.parse(saved);
    return {
      role: 'student',
      schoolTimingsStart: '07:30',
      schoolTimingsEnd: '15:00',
      hasTuition: true,
      tuitionTimingsStart: '16:00',
      tuitionTimingsEnd: '18:00',
      weekendLeisureHours: 2,
      customQA: [
        { question: 'When do you study best?', answer: 'Late evenings' }
      ],
      coachingTone: 'balanced'
    };
  });

  // Save profile to local storage on changes
  useEffect(() => {
    localStorage.setItem('aura_timetable_profile', JSON.stringify(timetableProfile));
  }, [timetableProfile]);

  // Tasks State
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('aura_tasks');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'task-initial-1',
        title: 'Math Assignment',
        dueDate: '27th May 2026',
        duration: '2 hours',
        urgency: 'high',
        category: 'study',
        completed: false,
        scheduledTime: 'Thursday 3:00 PM - 5:00 PM',
        studyGuide: '• Review rubric guidelines\n• Solve calculus exercises 3.4 & 3.5\n• Draft integration structural points.'
      },
      {
        id: 'task-initial-2',
        title: 'Physics Lab Report',
        dueDate: '29th May 2026',
        duration: '1.5 hours',
        urgency: 'medium',
        category: 'study',
        completed: false,
        scheduledTime: 'Friday 4:30 PM - 6:00 PM',
        studyGuide: '• Input measurement tables\n• Draw wiring diagram circuits\n• Write calculations and conclusions.'
      },
      {
        id: 'task-initial-3',
        title: 'Math Homework',
        dueDate: '23 May 2026',
        duration: '1 hour',
        urgency: 'low',
        category: 'study',
        completed: true,
        scheduledTime: 'May 23, 4:00 PM - 5:00 PM',
        studyGuide: '• Practice problems on page 45\n• Match answers with teacher key.'
      }
    ];
  });

  // Save tasks to local storage
  useEffect(() => {
    localStorage.setItem('aura_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // API Key state
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('aura_api_key') || '');
  useEffect(() => {
    localStorage.setItem('aura_api_key', apiKey);
  }, [apiKey]);



  // Photo scanner wizard states
  const [scannerPreviewUrl, setScannerPreviewUrl] = useState<string | null>(null);
  const [scannerState, setScannerState] = useState<'scanning' | 'ready'>('scanning');
  const [scannedTask, setScannedTask] = useState<{ title: string; dueDate: string; urgency: 'high' | 'medium' | 'low'; description: string }>({
    title: '',
    dueDate: '',
    urgency: 'high',
    description: ''
  });
  const [scannerComment, setScannerComment] = useState('');

  // Notification state
  const [notification, setNotification] = useState<{
    visible: boolean;
    title: string;
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mainInputRef = useRef<HTMLInputElement>(null);
  const activeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  useEffect(() => {
    localStorage.setItem('aura_archived_chats', JSON.stringify(archivedChats));
  }, [archivedChats]);

  // Listen to physical keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!keyboardOpen) return;
      
      // Let standard input focus handle normal typing if document active element is input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Backspace') {
        setInputCommand(prev => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        handleSendCommand();
      } else if (e.key === ' ') {
        setInputCommand(prev => prev + ' ');
      } else if (e.key.length === 1) {
        setInputCommand(prev => prev + e.key);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardOpen, inputCommand]);

  const handleLoginSubmit = () => {
    setAppState('transition');
    setUsername(loginUsername);
    setKeyboardOpen(true);
    setTimeout(() => {
      setAppState('chat_open');
      setHasCompletedTransition(true);
    }, 1500);
  };

  const handleInputClick = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (!keyboardOpen) {
      setKeyboardOpen(true);
      setAppState('chat_open');
    }
  };

  const handleBackgroundClick = () => {
    if (keyboardOpen) {
      setKeyboardOpen(false);
      setAppState('chat_closed');
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  };

  const handleNewChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (chatLog.length > 0) {
      const timestamp = new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const newArchiveEntry = {
        id: `session-${Date.now()}`,
        date: `Chat Session - ${timestamp}`,
        log: chatLog
      };
      setArchivedChats(prev => [newArchiveEntry, ...prev]);
    }
    setChatLog([]);
    setInputCommand('');
    setKeyboardOpen(true);
    setAppState('chat_open');
    setActiveScreen('chat');
  };



  // Parse chat command locally for DB querying or complete events
  const handleSendCommand = async () => {
    if (!inputCommand.trim()) return;

    const userText = inputCommand;
    setInputCommand('');
    setChatLog(prev => [...prev, { sender: 'user', text: userText }]);
    setIsThinking(true);

    const normText = userText.toLowerCase();

    // Page 2 Queries Mock database integrations
    if (normText.includes('when') || normText.includes('due') || normText.includes('any assignments') || normText.includes('task') || normText.includes('math')) {
      // Find math assignments or all tasks
      const matchingTasks = tasks.filter(t => t.title.toLowerCase().includes('math'));
      
      setTimeout(() => {
        let reply = `Ya ${username}, you have ${matchingTasks.length} math assignments:\n`;
        matchingTasks.forEach(t => {
          reply += `• **${t.dueDate}** - ${t.title} [${t.completed ? 'Completed' : 'Pending'}]\n`;
        });
        
        setChatLog(prev => [...prev, { 
          sender: 'aura', 
          text: reply.trim() 
        }]);
        setIsThinking(false);
      }, 800);
      return;
    }

    // Complete task command check
    if (normText.includes('completed') || normText.includes('done') || normText.includes('mark') || normText.includes('finish')) {
      // Check if user mentions 'math'
      const targetText = normText.includes('math') ? 'math' : '';
      let updatedCount = 0;
      
      const newTasks = tasks.map(t => {
        if (targetText && t.title.toLowerCase().includes(targetText)) {
          updatedCount++;
          return { ...t, completed: true };
        }
        return t;
      });

      if (updatedCount > 0) {
        setTasks(newTasks);
        setTimeout(() => {
          setChatLog(prev => [...prev, { 
            sender: 'aura', 
            text: `Awesome! I've marked your Math tasks as **Completed** in your schedule database.` 
          }]);
          setIsThinking(false);
        }, 800);
        return;
      }
    }

    // Regular Command (Gemini / Fallback)
    try {
      const response = await processAuraCommand(userText, apiKey, timetableProfile);
      setChatLog(prev => [...prev, {
        sender: 'aura',
        text: response.reply,
        tasks: response.newTasks
      }]);

      if (response.newTasks && response.newTasks.length > 0) {
        // Auto-insert scheduled study blocks for new tasks avoiding busy times
        setTasks(prev => [...response.newTasks, ...prev]);
      }
    } catch (err) {
      console.error(err);
      setChatLog(prev => [...prev, { sender: 'aura', text: "Something went wrong. Let me try that again." }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        setScannerPreviewUrl(reader.result as string);
        setScannerState('scanning');
        setScannerComment('');
        setActiveScreen('scanner');

        // Execute OCR Scan
        setTimeout(async () => {
          if (apiKey && apiKey.trim().length > 10) {
            try {
              const ocrResult = await scanImageWithGemini(base64Data, file.type, apiKey);
              setScannedTask({
                title: ocrResult.title,
                dueDate: ocrResult.dueDate,
                urgency: ocrResult.urgency,
                description: ocrResult.description
              });
              setScannerState('ready');
              return;
            } catch (err) {
              console.warn("Gemini multimodal failed, using high-fidelity mock parser");
            }
          }
          // Default mock parser fallback (Page 1 camera upload sketch details)
          setScannedTask({
            title: 'Math Assignment',
            dueDate: '27th May 2026',
            urgency: 'high',
            description: 'Integration and Calculus exercises due in 2 days.'
          });
          setScannerState('ready');
        }, 2200);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveScannerTask = () => {
    const newTask: Task = {
      id: `task-scan-${Date.now()}`,
      title: scannedTask.title,
      dueDate: scannedTask.dueDate,
      duration: '2 hours',
      urgency: scannedTask.urgency,
      category: 'study',
      completed: false,
      scheduledTime: 'Thursday 3:00 PM - 5:00 PM', // Squeezed into free slot
      studyGuide: `• Review: ${scannerComment || scannedTask.description}\n• Submit by deadline.`
    };

    setTasks(prev => [newTask, ...prev]);
    setActiveScreen('tasks');
    
    // Auto-trigger the banner notifications later
    setTimeout(() => {
      setNotification({
        visible: true,
        title: "Aura Reminder",
        message: `Hi ${username}, you have an assignment due: "${newTask.title}" on ${newTask.dueDate}. Have you completed it yet?`
      });
    }, 4000);
  };

  const handleNotificationAction = (action: 'yes' | 'snooze') => {
    setNotification(prev => prev ? { ...prev, visible: false } : null);
    
    if (action === 'yes') {
      setTasks(prev => prev.map(t => t.id.startsWith('task-scan-') ? { ...t, completed: true } : t));
      setChatLog(prev => [
        ...prev,
        { sender: 'user', text: "Yes, I completed it." },
        { sender: 'aura', text: "Awesome! I've marked it completed in your tasks calendar database." }
      ]);
    } else {
      setChatLog(prev => [
        ...prev,
        { sender: 'user', text: "Remind me later." },
        { sender: 'aura', text: "No worries! I have snoozed this and will alert you again in 2 hours." }
      ]);
    }
  };

  const handleVirtualKeyClick = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (key === '⌫') {
      setInputCommand(prev => prev.slice(0, -1));
    } else if (key === 'Space') {
      setInputCommand(prev => prev + ' ');
    } else if (key === 'Return') {
      handleSendCommand();
    } else if (key === 'Shift' || key === '123') {
      // Modifiers mock
    } else {
      setInputCommand(prev => prev + key);
    }

    // Keep correct input focused
    if (activeScreen === 'chat') {
      if (chatLog.length === 0) {
        mainInputRef.current?.focus();
      } else {
        activeInputRef.current?.focus();
      }
    }
  };

  const KEY_ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
    ['123', 'Space', 'Return']
  ];

  return (
    <div className="phone-screen" onClick={handleBackgroundClick}>
          {/* Radial Glow Layers */}
          <div className="absolute inset-0 z-0 bg-black pointer-events-none">
            {/* Blue Glow Layer */}
            <div 
              className={`absolute inset-0 bg-glow-blue transition-opacity duration-700 ${
                appState !== 'transition' ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {/* Red Glow Layer - only shows once during initial login transition */}
            <div 
              className={`absolute inset-0 bg-glow-red transition-all duration-700 ${
                !hasCompletedTransition && appState === 'transition' ? 'opacity-100 bg-glow-red-high' : 'opacity-0'
              }`}
            />
          </div>

          {/* Conditional Screen Rendering: Login OR App Dashboard */}
          {appState === 'login' ? (
            <div className="absolute inset-0 z-50 flex flex-col justify-center items-center px-6 bg-[#06030e]" onClick={(e) => e.stopPropagation()}>
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full blur-2xl bg-gradient-to-tr from-purple-500/40 to-cyan-500/40 animate-pulse"></div>
                <AuraOrb />
              </div>
              
              <h2 className="text-[32px] font-heading font-bold heading-gradient tracking-wide mb-1">
                AURA
              </h2>
              <p className="text-slate-400 text-[10px] tracking-widest mb-10 uppercase font-semibold">
                The Last-Minute Life Saver
              </p>
              
              <div className="w-full max-w-xs space-y-4">
                <div className="flex flex-col text-left">
                  <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 ml-1">Username</label>
                  <input 
                    type="text" 
                    value={loginUsername} 
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Enter username"
                    className="bg-white/5 border border-white/10 text-white rounded-xl py-3 px-4 text-xs font-semibold focus:border-purple-500 focus:outline-none transition-all"
                  />
                </div>
                
                <div className="flex flex-col text-left">
                  <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 ml-1">Password</label>
                  <input 
                    type="password" 
                    value={loginPassword} 
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password"
                    className="bg-white/5 border border-white/10 text-white rounded-xl py-3 px-4 text-xs font-semibold focus:border-purple-500 focus:outline-none transition-all"
                  />
                </div>
                
                <button 
                  onClick={handleLoginSubmit}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all transform active:scale-95 duration-200 mt-6"
                >
                  Sign In
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Banner notification */}
              {notification && (
                <div 
                  className={`absolute left-4 right-4 z-50 bg-[#1c1c1e] border border-white/10 rounded-2xl p-4 shadow-2xl transition-all duration-500 transform ${
                    notification.visible ? 'translate-y-12 opacity-100' : '-translate-y-36 opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0">
                      <span className="text-lg">🦖</span>
                    </div>
                    
                    <div className="flex-1 text-left">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-white">{notification.title}</span>
                        <span className="text-[9px] text-slate-500 font-medium">now</span>
                      </div>
                      <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                        {notification.message}
                      </p>
                      
                      <div className="flex gap-2 mt-3.5 justify-end">
                        <button
                          onClick={() => handleNotificationAction('yes')}
                          className="py-1 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold transition-all active:scale-95"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => handleNotificationAction('snooze')}
                          className="py-1 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-slate-300 text-[10px] font-semibold transition-all active:scale-95"
                        >
                          Remind later
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Header */}
              <header className="bg-transparent absolute top-2 left-0 w-full z-30 select-none">
                <div className="px-5 h-12 flex items-center justify-between">
                  {activeScreen === 'chat' ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(true); }}
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-colors"
                    >
                      <Menu size={18} />
                    </button>
                  ) : (
                    <button 
                      onClick={() => setActiveScreen('chat')}
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-colors flex items-center gap-1 text-[11px] font-bold"
                    >
                      <ArrowLeft size={16} />
                      <span>Back</span>
                    </button>
                  )}
                  <span 
                    onClick={() => setActiveScreen('chat')}
                    className="font-heading font-semibold text-sm tracking-wider text-white flex items-center gap-1 cursor-pointer"
                  >
                    Aura
                  </span>
                  <button
                    onClick={handleNewChat}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-colors"
                    title="Start New Chat"
                  >
                    <SquarePen size={18} />
                  </button>
                </div>
              </header>

              {/* MAIN SCREEN ROUTING */}

              {/* 1. CHAT SCREEN */}
              {activeScreen === 'chat' && (
                <div className="flex-1 flex flex-col justify-between relative min-h-0 pt-20 overflow-hidden">
                  {chatLog.length === 0 ? (
                    <div className="flex-grow flex flex-col justify-between p-4 relative z-10 min-h-0">
                      <div className="h-4" />
                      
                      <div className={`flex-grow flex flex-col items-center z-10 transition-all duration-300 ${
                        keyboardOpen ? 'justify-start pt-2' : 'justify-center'
                      }`}>
                        <div className={`transition-all duration-300 ${keyboardOpen ? 'scale-75' : 'scale-100'}`}>
                          <AuraOrb />
                        </div>
                        
                        <h1 className={`font-heading font-medium text-white tracking-wide text-center px-4 leading-tight select-none transition-all duration-300 ${
                          keyboardOpen ? 'text-[20px] mt-1' : 'text-[26px] mt-2'
                        }`}>
                          {keyboardOpen ? (
                            <>What's next, {username}?</>
                          ) : (
                            <>Hi {username}, what's on<br/>your mind?</>
                          )}
                        </h1>
                      </div>

                      {/* Input Pill */}
                      <div className="w-full relative flex justify-center items-end pb-8 z-20">
                        <div 
                          id="input-pill" 
                          onClick={(e) => {
                            e.stopPropagation();
                            mainInputRef.current?.focus();
                          }}
                          className="w-[92%] max-w-sm h-[72px] bg-[#161a2b] rounded-[36px] flex items-center px-5 justify-between border border-[#2a2d42] shadow-2xl transition-colors hover:bg-[#1a1f33]"
                        >
                          <div className="flex items-center gap-4 flex-grow h-full">
                            <Plus 
                              className="text-gray-300 w-7 h-7 font-light cursor-pointer hover:text-white shrink-0" 
                              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} 
                            />
                            <input
                              type="text"
                              ref={mainInputRef}
                              value={inputCommand}
                              onChange={(e) => setInputCommand(e.target.value)}
                              onFocus={handleInputClick}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Ask Aura"
                              className="flex-grow bg-transparent border-none outline-none text-white text-[18px] font-light placeholder-gray-400 p-0 h-full w-full focus:ring-0 focus:outline-none"
                            />
                          </div>
                          
                          <div className="flex items-center gap-4 shrink-0">
                            <Mic 
                              className="text-gray-300 w-7 h-7 font-light cursor-pointer hover:text-white" 
                              onClick={(e) => { e.stopPropagation(); setInputCommand("do I have any assignments to submit?"); }} 
                            />
                            <div 
                              className="w-9 h-9 rounded-full bg-blue-900/60 border border-blue-500/30 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                              onClick={(e) => { e.stopPropagation(); handleSendCommand(); }}
                            >
                              {inputCommand.trim() ? (
                                <Send size={14} className="text-blue-200" />
                              ) : (
                                <div className="flex gap-0.5 items-center justify-center">
                                  <span className="w-[1.5px] h-3 bg-blue-200 rounded animate-pulse" />
                                  <span className="w-[1.5px] h-4 bg-blue-100 rounded animate-pulse" />
                                  <span className="w-[1.5px] h-3 bg-blue-200 rounded animate-pulse" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Keyboard Height Spacer */}
                      {keyboardOpen && <div className="h-[290px] w-full shrink-0" />}
                    </div>
                  ) : (
                    <div className="flex-grow flex flex-col justify-between p-4 relative z-10 min-h-0">
                      <div 
                        className="flex-grow overflow-y-auto space-y-6 px-1 py-3 scrollbar pb-4"
                      >
                        {chatLog.map((log, idx) => (
                          <div 
                            key={idx} 
                            className={`flex flex-col ${log.sender === 'user' ? 'items-end' : 'items-start'}`}
                          >
                            {log.sender === 'user' ? (
                              <div className="max-w-[90%] bg-zinc-900 text-slate-100 rounded-3xl px-4.5 py-3 shadow-md border border-white/5 text-sm leading-relaxed text-left">
                                {log.text}
                              </div>
                            ) : (
                              <div className="flex flex-col w-full max-w-[95%] items-start text-left">
                                <div className="flex items-center gap-1.5 mb-1.5 text-xs text-slate-400 font-bold select-none">
                                  <span className="text-sm">🦖</span>
                                  <span className="font-heading uppercase tracking-wider text-[10px] text-purple-400">Aura</span>
                                </div>
                                
                                <div className="text-slate-100 text-[13px] leading-relaxed font-sans pl-1 whitespace-pre-line">
                                  {log.text}
                                </div>

                                {log.tasks && log.tasks.length > 0 && (
                                  <div className="mt-3 flex flex-col gap-2 w-full">
                                    {log.tasks.map((task) => (
                                      <div
                                        key={task.id}
                                        className="bg-zinc-950 border border-white/10 rounded-2xl p-3 flex flex-col text-left"
                                      >
                                        <div className="flex items-center justify-between mb-1.5">
                                          <span className="font-bold text-xs text-white truncate pr-2">{task.title}</span>
                                          <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                                            task.urgency === 'high' ? 'bg-red-950/40 text-red-400 border border-red-500/20' : 
                                            task.urgency === 'medium' ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20' : 
                                            'bg-zinc-900 text-slate-400 border border-white/5'
                                          }`}>
                                            {task.urgency}
                                          </span>
                                        </div>
                                        <div className="flex gap-2 items-center text-[10px] text-slate-400 mb-2">
                                          <span>📅 Due: {task.dueDate}</span>
                                          <span>⏱️ {task.duration}</span>
                                        </div>
                                        {task.studyGuide && (
                                          <div className="border-t border-white/5 pt-2 text-[10px] text-slate-300 whitespace-pre-line leading-relaxed font-light">
                                            {task.studyGuide}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {isThinking && (
                          <div className="flex items-center gap-1.5 pl-1 select-none">
                            <span className="text-sm">🦖</span>
                            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>

                      {/* Active Input Pill */}
                      <div className="mt-2 shrink-0">
                        <div 
                          id="active-input-pill" 
                          onClick={(e) => {
                            e.stopPropagation();
                            activeInputRef.current?.focus();
                          }}
                          className="relative flex items-center bg-[#161a2b] border border-[#2a2d42] rounded-full px-2.5 py-1.5 shadow-lg focus-within:border-purple-500/40 transition-all h-11"
                        >
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                          >
                            <Plus size={16} />
                          </button>
                          
                          <input
                            type="text"
                            ref={activeInputRef}
                            value={inputCommand}
                            onChange={(e) => setInputCommand(e.target.value)}
                            onFocus={handleInputClick}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Ask Aura"
                            className="flex-grow bg-transparent border-none outline-none text-slate-200 text-xs px-2 h-full w-full focus:ring-0 focus:outline-none"
                          />

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInputCommand("do I have any assignments to submit?");
                            }}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all mr-0.5"
                          >
                            <Mic size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSendCommand(); }}
                            className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-all active:scale-90"
                          >
                            <Send size={12} />
                          </button>
                        </div>
                      </div>
                      {/* Keyboard Height Spacer to push active input up naturally */}
                      {keyboardOpen && <div className="h-[290px] w-full shrink-0" />}
                    </div>
                  )}

                  {/* Virtual Keyboard */}
                  <div className={`keyboard-wrapper ${keyboardOpen ? 'translate-y-0' : 'translate-y-full'}`}>
                    <div className="flex justify-between px-6 mb-3 text-slate-400 text-xs font-semibold select-none">
                      <span>I</span>
                      <span>The</span>
                      <span>I'm</span>
                    </div>

                    <div className="flex flex-col gap-2.5 px-1 select-none">
                      {KEY_ROWS.map((row, rIdx) => (
                        <div key={rIdx} className="key-row">
                          {row.map((key) => {
                            const isSpecial = key === 'Shift' || key === '⌫' || key === '123' || key === 'Return' || key === 'Space';
                            let keyClass = "keyboard-key";
                            if (isSpecial) keyClass += " special";
                            if (key === 'Space') keyClass += " flex-[5]";

                            return (
                              <button
                                type="button"
                                key={key}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => handleVirtualKeyClick(key, e)}
                                className={keyClass}
                              >
                                {key}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. TIMETABLE SETUP SCREEN */}
              {activeScreen === 'timetable' && (
                <div className="flex-1 flex flex-col justify-start p-5 pt-16 overflow-y-auto text-left space-y-5 select-none relative z-10">
                  <h2 className="text-lg font-heading font-bold text-white flex items-center gap-1.5 mb-1">
                    <Clock size={18} className="text-purple-400" />
                    <span>Onboarding Timetable</span>
                  </h2>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4.5 space-y-4">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Select Role</label>
                      <select 
                        value={timetableProfile.role}
                        onChange={(e) => setTimetableProfile({ ...timetableProfile, role: e.target.value as any })}
                        className="bg-zinc-900 border border-white/10 text-white rounded-xl py-2.5 px-3 text-xs focus:ring-0 focus:outline-none"
                      >
                        <option value="student">Student</option>
                        <option value="employee">Professional / Employee</option>
                        <option value="other">Other / General</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Busy Start</label>
                        <input 
                          type="time" 
                          value={timetableProfile.schoolTimingsStart}
                          onChange={(e) => setTimetableProfile({ ...timetableProfile, schoolTimingsStart: e.target.value })}
                          className="bg-zinc-900 border border-white/10 text-white rounded-xl py-2 px-3 text-xs focus:ring-0 focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Busy End</label>
                        <input 
                          type="time" 
                          value={timetableProfile.schoolTimingsEnd}
                          onChange={(e) => setTimetableProfile({ ...timetableProfile, schoolTimingsEnd: e.target.value })}
                          className="bg-zinc-900 border border-white/10 text-white rounded-xl py-2 px-3 text-xs focus:ring-0 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">Tuitions / Recurring slots</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">Toggle extra tuition or meetings busy hours</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={timetableProfile.hasTuition}
                        onChange={(e) => setTimetableProfile({ ...timetableProfile, hasTuition: e.target.checked })}
                        className="checkbox-custom shrink-0"
                      />
                    </div>

                    {timetableProfile.hasTuition && (
                      <div className="grid grid-cols-2 gap-3 bg-black/40 p-3 rounded-xl border border-white/5 animate-fadeIn">
                        <div className="flex flex-col">
                          <label className="text-[9px] text-slate-400 font-bold uppercase mb-1">Start</label>
                          <input 
                            type="time" 
                            value={timetableProfile.tuitionTimingsStart}
                            onChange={(e) => setTimetableProfile({ ...timetableProfile, tuitionTimingsStart: e.target.value })}
                            className="bg-zinc-900 border border-white/10 text-white rounded-xl py-1.5 px-2.5 text-[11px] focus:ring-0 focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[9px] text-slate-400 font-bold uppercase mb-1">End</label>
                          <input 
                            type="time" 
                            value={timetableProfile.tuitionTimingsEnd}
                            onChange={(e) => setTimetableProfile({ ...timetableProfile, tuitionTimingsEnd: e.target.value })}
                            className="bg-zinc-900 border border-white/10 text-white rounded-xl py-1.5 px-2.5 text-[11px] focus:ring-0 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col border-t border-white/5 pt-3">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Weekend Leisure hours goal</label>
                        <span className="text-xs font-bold text-purple-400">{timetableProfile.weekendLeisureHours} hrs</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="8" 
                        value={timetableProfile.weekendLeisureHours}
                        onChange={(e) => setTimetableProfile({ ...timetableProfile, weekendLeisureHours: Number(e.target.value) })}
                        className="w-full accent-purple-500"
                      />
                    </div>
                  </div>

                  <button 
                    type="button"
                    onClick={() => {
                      alert("Timetable profile configured! Aura will fit study blocks avoiding these busy times.");
                      setActiveScreen('chat');
                    }}
                    className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5"
                  >
                    <Check size={14} />
                    <span>Save Timetable</span>
                  </button>
                </div>
              )}

              {/* 3. TASKS PRIORITIZATION SCREEN */}
              {activeScreen === 'tasks' && (
                <div className="flex-1 flex flex-col justify-start p-5 pt-16 overflow-hidden text-left select-none relative z-10">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-heading font-bold text-white flex items-center gap-1.5">
                      <ListTodo size={18} className="text-purple-400" />
                      <span>Task Prioritization</span>
                    </h2>
                    <span className="text-[10px] bg-purple-950/40 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/20 font-bold">
                      {tasks.filter(t => !t.completed).length} Pending
                    </span>
                  </div>

                  {/* Add task bar */}
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const input = form.elements.namedItem('taskTitle') as HTMLInputElement;
                    if (input && input.value.trim()) {
                      const newTask: Task = {
                        id: `task-manual-${Date.now()}`,
                        title: input.value,
                        dueDate: 'Tomorrow',
                        duration: '1 hour',
                        urgency: 'high',
                        category: 'study',
                        completed: false,
                        scheduledTime: 'Today 7:00 PM - 8:00 PM',
                        studyGuide: '• Review fundamentals\n• Dedicate 45 minutes of silent work.'
                      };
                      setTasks(prev => [newTask, ...prev]);
                      input.value = '';
                    }
                  }} className="mb-4 flex gap-2 shrink-0">
                    <input 
                      type="text" 
                      name="taskTitle"
                      placeholder="Add task..." 
                      className="flex-grow bg-zinc-900 border border-white/10 text-white rounded-xl py-2 px-3 text-xs focus:ring-0 focus:outline-none"
                    />
                    <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-4 text-xs font-bold">
                      Add
                    </button>
                  </form>

                  {/* Tasks List */}
                  <div className="flex-grow overflow-y-auto space-y-2.5 pr-0.5">
                    {tasks.map(task => (
                      <div 
                        key={task.id}
                        className={`p-3 rounded-2xl border transition-all ${
                          task.completed 
                            ? 'bg-zinc-950/40 border-white/5 opacity-55' 
                            : task.urgency === 'high' 
                            ? 'bg-[#1a0c13] border-red-500/20 hover:border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.05)]' 
                            : task.urgency === 'medium'
                            ? 'bg-[#1a130c] border-amber-500/20 hover:border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                            : 'bg-[#0c151a] border-cyan-500/20 hover:border-cyan-500/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={task.completed}
                            onChange={() => {
                              setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
                            }}
                            className="checkbox-custom shrink-0"
                          />
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-1.5 justify-between">
                              <span className={`text-xs font-bold truncate pr-1 ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                {task.title}
                              </span>
                              <span className={`text-[8px] font-extrabold uppercase shrink-0 px-1.5 py-0.5 rounded ${
                                task.completed ? 'bg-zinc-900 text-slate-500' :
                                task.urgency === 'high' ? 'bg-red-950/60 text-red-400 border border-red-500/20' :
                                task.urgency === 'medium' ? 'bg-amber-950/60 text-amber-400 border border-amber-500/20' :
                                'bg-cyan-950/60 text-cyan-400 border border-cyan-500/20'
                              }`}>
                                {task.completed ? 'Completed' : task.urgency}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-slate-500 mt-1">
                              <span>📅 {task.dueDate}</span>
                              <span>⏱️ {task.duration}</span>
                            </div>
                            
                            {!task.completed && task.scheduledTime && (
                              <div className="mt-2 text-[9px] bg-purple-950/15 border border-purple-500/10 text-purple-400 rounded-lg py-1 px-2.5 flex items-center gap-1 font-semibold">
                                <Clock size={10} />
                                <span>Auto-Scheduled: {task.scheduledTime}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. AI CALENDAR / SCHEDULING ASSISTANT SCREEN */}
              {activeScreen === 'schedule' && (
                <div className="flex-1 flex flex-col justify-start p-5 pt-16 overflow-hidden text-left select-none relative z-10">
                  <h2 className="text-lg font-heading font-bold text-white flex items-center gap-1.5 mb-1 shrink-0">
                    <Calendar size={18} className="text-purple-400" />
                    <span>AI Schedule Grid</span>
                  </h2>
                  <p className="text-[10px] text-slate-500 mb-4 shrink-0">Study blocks allocated around busy slots</p>

                  {/* Timeline Container */}
                  <div className="flex-grow overflow-y-auto space-y-1.5 pr-0.5">
                    {/* 07:30 - 15:00 School busy block */}
                    <div className="border border-white/5 bg-zinc-900/40 rounded-xl p-3 flex gap-3.5">
                      <div className="text-[10px] font-bold text-slate-500 w-12 shrink-0">07:30 AM</div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-slate-400">Classroom / School Timetable</div>
                        <div className="text-[9px] text-slate-600 mt-0.5">Locked Busy Slot (No task assignments placed)</div>
                      </div>
                    </div>

                    {/* Squeezed task block */}
                    {tasks.filter(t => !t.completed && t.scheduledTime?.includes('3:00 PM')).map(t => (
                      <div key={t.id} className="border border-purple-500/20 bg-purple-950/15 rounded-xl p-3 flex gap-3.5 shadow-[0_0_15px_rgba(139,92,246,0.05)]">
                        <div className="text-[10px] font-bold text-purple-400 w-12 shrink-0">03:00 PM</div>
                        <div className="flex-1">
                          <div className="text-xs font-bold text-slate-200">{t.title}</div>
                          <div className="text-[9px] text-purple-300 mt-0.5">Aura Auto-Allocated Study Session • {t.duration}</div>
                        </div>
                      </div>
                    ))}

                    {/* 16:00 - 18:00 Tuition busy block */}
                    {timetableProfile.hasTuition && (
                      <div className="border border-white/5 bg-zinc-900/40 rounded-xl p-3 flex gap-3.5">
                        <div className="text-[10px] font-bold text-slate-500 w-12 shrink-0">04:00 PM</div>
                        <div className="flex-1">
                          <div className="text-xs font-bold text-slate-400">Extra Tuition Class / Commitments</div>
                          <div className="text-[9px] text-slate-600 mt-0.5">Locked Busy Slot</div>
                        </div>
                      </div>
                    )}

                    {/* Squeezed task block late evening */}
                    <div className="border border-purple-500/20 bg-purple-950/15 rounded-xl p-3 flex gap-3.5">
                      <div className="text-[10px] font-bold text-purple-400 w-12 shrink-0">06:30 PM</div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-slate-200">Physics Lab Outline & Formulas</div>
                        <div className="text-[9px] text-purple-300 mt-0.5">Aura Auto-Allocated Study Session • 1.5 hours</div>
                      </div>
                    </div>

                    {/* Free space */}
                    <div className="border border-cyan-500/10 bg-cyan-950/5 rounded-xl p-3 flex gap-3.5">
                      <div className="text-[10px] font-bold text-cyan-500 w-12 shrink-0">08:00 PM</div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-slate-400">Open Free Time</div>
                        <div className="text-[9px] text-cyan-600 mt-0.5">Available for rest, exercise or family</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. PERSONALIZED TIPS SCREEN */}
              {activeScreen === 'tips' && (
                <div className="flex-1 flex flex-col justify-start p-5 pt-16 overflow-y-auto text-left select-none relative z-10 space-y-4">
                  <h2 className="text-lg font-heading font-bold text-white flex items-center gap-1.5 mb-1">
                    <Sparkles size={18} className="text-purple-400" />
                    <span>Productivity Tips</span>
                  </h2>

                  <div className="bg-gradient-to-tr from-purple-950/30 to-indigo-950/30 border border-purple-500/15 rounded-2xl p-4 flex gap-3 items-center">
                    <span className="text-2xl animate-bounce">🔥</span>
                    <div>
                      <div className="text-xs font-bold text-white">Focus Streak Active!</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">Completed 4 assignments on time. Keep it up!</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <span className="text-[10px] bg-red-950/50 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-extrabold uppercase">
                        Overload Alert
                      </span>
                      <p className="text-xs text-slate-200 mt-2 leading-relaxed">
                        You have 3 tasks due tomorrow. We shifted your Math prep block to tonight at 7 PM.
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <span className="text-[10px] bg-cyan-950/50 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded font-extrabold uppercase">
                        Study Pattern
                      </span>
                      <p className="text-xs text-slate-200 mt-2 leading-relaxed">
                        Your best window for focused work is 6:30 PM - 8:30 PM. Focus is 30% higher during this time slot.
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <span className="text-[10px] bg-amber-950/50 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-extrabold uppercase">
                        Habit Suggestion
                      </span>
                      <p className="text-xs text-slate-200 mt-2 leading-relaxed">
                        You study best in late evenings. We scheduled your science lab outline for 8:00 PM tonight.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 6. AUTONOMOUS AGENTS SCREEN */}
              {activeScreen === 'agents' && (
                <div className="flex-1 flex flex-col justify-start p-5 pt-16 overflow-y-auto text-left select-none relative z-10 space-y-4">
                  <h2 className="text-lg font-heading font-bold text-white flex items-center gap-1.5 mb-1">
                    <Zap size={18} className="text-purple-400" />
                    <span>Autonomous Agents</span>
                  </h2>

                  <div className="space-y-4">
                    {/* Agent 1 */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                          <span>WhatsApp Scan Agent</span>
                        </span>
                        <span className="text-[8px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase">
                          Active
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Agent scans incoming WhatsApp screenshots to identify assignments. Last scan: 5 minutes ago.
                      </p>
                    </div>

                    {/* Agent 2 */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          <span>Google Classroom Retriever</span>
                        </span>
                        <span className="text-[8px] bg-amber-950/40 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-bold uppercase">
                          Declined
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Classroom retrieval permissions were declined. Toggle classroom authorization in main settings.
                      </p>
                    </div>

                    {/* Agent 3 */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                          <span>Calendar Optimizer</span>
                        </span>
                        <span className="text-[8px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase">
                          Optimized
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Analyzes task checklists and busy intervals to fit study blocks. Successfully synchronized study plan.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 7. PHOTO SCANNER SCREEN */}
              {activeScreen === 'scanner' && (
                <div className="flex-1 flex flex-col justify-between p-5 pt-16 overflow-y-auto text-left select-none relative z-10">
                  <div>
                    <h2 className="text-lg font-heading font-bold text-white flex items-center gap-1.5 mb-3">
                      <Sparkles size={18} className="text-purple-400" />
                      <span>Scan Assignment Photo</span>
                    </h2>

                    {/* Image Preview Container */}
                    <div className="relative w-full h-[180px] bg-black border border-white/10 rounded-2xl overflow-hidden mb-4 flex items-center justify-center">
                      {scannerPreviewUrl ? (
                        <>
                          <img src={scannerPreviewUrl} alt="uploaded" className="object-cover w-full h-full" />
                          {scannerState === 'scanning' && (
                            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-purple-500 to-cyan-500 animate-scanline" />
                          )}
                        </>
                      ) : (
                        <div className="text-slate-500 text-xs">No image uploaded</div>
                      )}
                    </div>

                    {scannerState === 'scanning' ? (
                      <div className="text-center py-6">
                        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <span className="text-xs text-purple-400 font-semibold">Analyzing screenshot contents...</span>
                      </div>
                    ) : (
                      <div className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-4.5">
                        <div className="flex justify-between items-start border-b border-white/5 pb-2">
                          <div>
                            <span className="text-[8px] text-slate-500 uppercase font-extrabold tracking-wider">Identified Title</span>
                            <div className="text-xs font-bold text-white">{scannedTask.title}</div>
                          </div>
                          <span className="bg-red-950/60 text-red-400 border border-red-500/20 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded">
                            {scannedTask.urgency}
                          </span>
                        </div>

                        <div className="border-b border-white/5 pb-2">
                          <span className="text-[8px] text-slate-500 uppercase font-extrabold tracking-wider">Due Date Detected</span>
                          <div className="text-xs font-bold text-white">{scannedTask.dueDate}</div>
                        </div>

                        <div>
                          <span className="text-[8px] text-slate-500 uppercase font-extrabold tracking-wider">Additional details</span>
                          <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">{scannedTask.description}</p>
                        </div>

                        <div className="flex flex-col border-t border-white/5 pt-3">
                          <label className="text-[9px] text-slate-500 uppercase font-extrabold tracking-wider mb-1">
                            Describe about this for better analysis?
                          </label>
                          <input 
                            type="text" 
                            value={scannerComment}
                            onChange={(e) => setScannerComment(e.target.value)}
                            placeholder="e.g. this is a math assignment to submit by 27th"
                            className="bg-zinc-900 border border-white/10 text-white rounded-xl py-2 px-3 text-[11px] focus:ring-0 focus:outline-none w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {scannerState === 'ready' && (
                    <button
                      onClick={handleSaveScannerTask}
                      className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 mt-4"
                    >
                      <Check size={14} />
                      <span>Save Reminder</span>
                    </button>
                  )}
                </div>
              )}

              {/* Sidebar Drawer */}
              {isSidebarOpen && (
                <div className="absolute inset-0 z-50 flex">
                  <div 
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                    onClick={() => setIsSidebarOpen(false)}
                  />
                  <div className="relative w-[280px] bg-zinc-950 border-r border-white/10 flex flex-col justify-between p-5 z-10 shadow-2xl text-left">
                    <div>
                      <div className="flex justify-between items-center mb-8">
                        <span className="font-bold text-xl text-white tracking-wide">Aura</span>
                        <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                          <X size={18} />
                        </button>
                      </div>
                      <div className="space-y-6">
                        <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 border-b border-white/5 pb-2">
                          Features
                        </h4>
                        <ul className="space-y-[22px] text-[13px] text-slate-300 font-semibold select-none">
                          <li 
                            onClick={() => { setActiveScreen('tasks'); setIsSidebarOpen(false); }}
                            className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
                          >
                            • Intelligent task prioritization
                          </li>
                          <li 
                            onClick={() => { setActiveScreen('schedule'); setIsSidebarOpen(false); }}
                            className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
                          >
                            • AI scheduling assistant
                          </li>
                          <li 
                            onClick={() => { setActiveScreen('tips'); setIsSidebarOpen(false); }}
                            className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
                          >
                            • Personalized productivity tips
                          </li>
                          <li 
                            onClick={() => { setActiveScreen('agents'); setIsSidebarOpen(false); }}
                            className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
                          >
                            • Autonomous task planning and execution
                          </li>
                          <li 
                            onClick={() => { setActiveScreen('timetable'); setIsSidebarOpen(false); }}
                            className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
                          >
                            • Set up timetable
                          </li>
                          
                          <li 
                            onClick={() => {
                              setShowHistory(true);
                              setIsSidebarOpen(false);
                            }}
                            className="cursor-pointer text-purple-400 hover:text-purple-300 font-bold transition-colors flex items-center gap-1.5 mt-6 pt-4 border-t border-white/5"
                          >
                            <History size={14} />
                            <span>Chat History</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                    
                    {/* Drawer Footer */}
                    <div className="border-t border-white/10 pt-4 flex items-center justify-between">
                      <div className="flex flex-col text-left">
                        <span className="text-slate-200 text-xs font-bold leading-tight">{username}</span>
                        <span className="text-slate-500 text-[10px] font-medium leading-none mt-1">
                          {username.toLowerCase().replace(/\s+/g, '')}@gmail.com
                        </span>
                      </div>
                      
                      <button
                        onClick={() => {
                          setShowSettings(true);
                          setIsSidebarOpen(false);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all"
                      >
                        <Settings size={14} />
                        <span>Settings</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Chat History Modal */}
              {showHistory && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                  <div className="relative w-full max-w-sm bg-zinc-950 border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col max-h-[80%]">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-white font-bold text-sm">Archived Sessions</h3>
                      <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white">
                        <X size={16} />
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-left select-none">
                      {activeArchivedChat ? (
                        <div>
                          <button 
                            onClick={() => setActiveArchivedChat(null)}
                            className="text-purple-400 text-[11px] font-semibold mb-3 block"
                          >
                            &larr; Back to list
                          </button>
                          <div className="space-y-3 bg-black/40 p-3 rounded-xl border border-white/5">
                            {activeArchivedChat.map((logItem, idx) => (
                              <div key={idx} className={`text-[11px] leading-relaxed ${logItem.sender === 'user' ? 'text-slate-200 text-right' : 'text-slate-300 text-left'}`}>
                                <span className="font-bold text-[9px] uppercase block text-slate-500 mb-0.5">
                                  {logItem.sender}
                                </span>
                                {logItem.text}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          {archivedChats.length === 0 ? (
                            <div className="text-center text-slate-500 py-8 text-xs">
                              No archived chats. Use the Pen icon to archive and start a new chat!
                            </div>
                          ) : (
                            archivedChats.map((chat) => (
                              <div 
                                key={chat.id}
                                onClick={() => setActiveArchivedChat(chat.log)}
                                className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 hover:border-purple-500/20 cursor-pointer flex items-center justify-between"
                              >
                                <div className="truncate flex-1 pr-2">
                                  <div className="text-xs font-bold text-slate-200 truncate">{chat.date}</div>
                                  <div className="text-[9px] text-slate-500 truncate mt-0.5">
                                    Last: {chat.log[chat.log.length - 1]?.text}
                                  </div>
                                </div>
                                <span className="text-[10px] text-purple-400 shrink-0 font-semibold">Open &rarr;</span>
                              </div>
                            ))
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Settings Modal */}
              {showSettings && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
                  <div className="relative w-full max-w-sm bg-zinc-950 border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col text-left" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-5 border-b border-white/5 pb-3 select-none">
                      <h3 className="text-white font-bold text-sm flex items-center gap-1.5">
                        <Settings size={16} className="text-purple-400" />
                        <span>Aura Settings</span>
                      </h3>
                      <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                        <X size={16} />
                      </button>
                    </div>
                    
                    <div className="space-y-4.5 text-xs text-slate-300">
                      <div className="flex justify-between items-center select-none">
                        <span>Default User Name</span>
                        <input 
                          type="text" 
                          value={username} 
                          onChange={(e) => setUsername(e.target.value)}
                          className="bg-zinc-900 border border-white/10 text-white rounded-lg py-1 px-2.5 text-[11px] max-w-[120px] focus:ring-0 focus:outline-none"
                        />
                      </div>

                      <div className="flex justify-between items-center select-none">
                        <span>Gemini AI API Key</span>
                        <input 
                          type="password" 
                          value={apiKey} 
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Paste key (sk-...)"
                          className="bg-zinc-900 border border-white/10 text-white rounded-lg py-1 px-2.5 text-[11px] max-w-[120px] focus:ring-0 focus:outline-none"
                        />
                      </div>

                      <div className="flex justify-between items-center select-none">
                        <span>Coaching Style Tone</span>
                        <select
                          value={timetableProfile.coachingTone}
                          onChange={(e) => setTimetableProfile({ ...timetableProfile, coachingTone: e.target.value as CoachingTone })}
                          className="bg-zinc-900 border border-white/10 text-white rounded-lg py-1.5 px-3 text-[11px] focus:ring-0 focus:outline-none"
                        >
                          <option value="balanced">Balanced / Calm</option>
                          <option value="encouraging">Warm / Encouraging</option>
                          <option value="aggressive">Aggressive / Snarky 🦖</option>
                        </select>
                      </div>
                      
                      <div className="border-t border-white/5 pt-4 mt-2 select-none">
                        <button
                          onClick={() => {
                            if (confirm("Reset application data?")) {
                              localStorage.clear();
                              window.location.reload();
                            }
                          }}
                          className="w-full py-2 px-3 rounded-lg border border-red-500/20 bg-red-950/15 text-red-400 hover:bg-red-900/20 text-[10px] flex items-center justify-center gap-1.5 transition-all animate-pulse"
                        >
                          <Trash2 size={12} />
                          <span>Reset Application Data</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Hidden File Input */}
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
              />
            </>
          )}

          {/* Bottom Screen Bar */}
          <div className="h-4 bg-black flex items-center justify-center shrink-0 w-full select-none">
            <div className="w-28 h-1 bg-zinc-700/80 rounded-full" />
          </div>

        </div>
      );
};

export default App;
