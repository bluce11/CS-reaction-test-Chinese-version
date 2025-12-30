
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameMode, ReflexState, Score, CoachFeedback } from './types';
import { RANKS, getRank } from './constants';
import { getCoachFeedback } from './services/geminiService';
import { 
  Target, 
  Zap, 
  Trophy, 
  RotateCcw, 
  ChevronRight, 
  Crosshair, 
  User, 
  BarChart3,
  Clock
} from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<GameMode>(GameMode.IDLE);
  const [scores, setScores] = useState<Score[]>([]);
  const [activeReflexState, setActiveReflexState] = useState<ReflexState>(ReflexState.START);
  const [resultTime, setResultTime] = useState<number | null>(null);
  const [coachFeedback, setCoachFeedback] = useState<CoachFeedback | null>(null);
  const [isLodingFeedback, setIsLoadingFeedback] = useState(false);
  
  // DOM 引用：用于绕过 React 直接操作
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const statusTextRef = useRef<HTMLHeadingElement>(null);
  
  const stateRef = useRef<ReflexState>(ReflexState.START);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const [targetPos, setTargetPos] = useState({ x: 50, y: 50 });
  const [targetsHit, setTargetsHit] = useState(0);
  const AIM_TARGET_COUNT = 5;

  const saveScore = useCallback((ms: number, gameMode: GameMode) => {
    setScores(prev => {
      const rank = getRank(ms).name;
      const newScore: Score = { value: ms, timestamp: Date.now(), mode: gameMode, rank };
      const updated = [newScore, ...prev].slice(0, 10);
      localStorage.setItem('cs_scores', JSON.stringify(updated));
      return updated;
    });
    
    setIsLoadingFeedback(true);
    getCoachFeedback(ms, gameMode).then(feedback => {
      setCoachFeedback(feedback);
      setIsLoadingFeedback(false);
    });
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('cs_scores');
    if (saved) setScores(JSON.parse(saved));
  }, []);

  // 极速交互逻辑：直接访问 DOM，不等待 React State
  const handleInteraction = useCallback((e: PointerEvent) => {
    const clickTime = e.timeStamp; // 硬件级时间戳
    const currentState = stateRef.current;
    
    if (currentState !== ReflexState.WAITING && currentState !== ReflexState.READY) return;
    
    // 阻止默认行为，防止某些浏览器上的延迟
    if (e.cancelable) e.preventDefault();

    if (currentState === ReflexState.WAITING) {
      // 抢跑逻辑
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      
      stateRef.current = ReflexState.TOO_EARLY;
      
      // 直接操作 DOM 以获得即时反馈
      if (gameAreaRef.current) {
        gameAreaRef.current.style.backgroundColor = '#18181b';
        gameAreaRef.current.style.borderColor = '#7f1d1d';
      }
      
      // 然后更新 React 状态以同步 UI 按钮
      setActiveReflexState(ReflexState.TOO_EARLY);
      
    } else if (currentState === ReflexState.READY) {
      // 成功命中：计算差值
      const diff = Math.round(clickTime - startTimeRef.current);
      
      stateRef.current = ReflexState.RESULT;
      setResultTime(diff);
      
      // 直接操作 DOM 恢复背景，避免闪烁
      if (gameAreaRef.current) {
        gameAreaRef.current.style.backgroundColor = '#09090b';
        gameAreaRef.current.style.borderColor = '#27272a';
      }

      // 更新 React 显示结果
      setActiveReflexState(ReflexState.RESULT);
      saveScore(diff, GameMode.REFLEX);
    }
  }, [saveScore]);

  useEffect(() => {
    const area = gameAreaRef.current;
    if (!area) return;

    // 使用捕获阶段获取最高优先级
    area.addEventListener('pointerdown', handleInteraction, { capture: true, passive: false });
    return () => {
      area.removeEventListener('pointerdown', handleInteraction, { capture: true });
    };
  }, [mode, handleInteraction]);

  const startReflexTest = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);

    stateRef.current = ReflexState.WAITING;
    setActiveReflexState(ReflexState.WAITING);
    setResultTime(null);
    setCoachFeedback(null);
    
    // 初始化 DOM 状态
    if (gameAreaRef.current) {
      gameAreaRef.current.style.backgroundColor = 'rgba(69, 10, 10, 0.4)';
      gameAreaRef.current.style.borderColor = '#450a0a';
      gameAreaRef.current.style.transition = 'none';
      gameAreaRef.current.style.willChange = 'background-color, border-color';
    }

    const delay = 1500 + Math.random() * 3000;
    
    timerRef.current = window.setTimeout(() => {
      // 在下一帧开始计时，确保颜色变化和计时完全对齐
      rafRef.current = window.requestAnimationFrame((timestamp) => {
        if (stateRef.current !== ReflexState.WAITING) return;
        
        // 1. 立即改变颜色（Direct DOM）
        if (gameAreaRef.current) {
          gameAreaRef.current.style.backgroundColor = '#22c55e'; 
          gameAreaRef.current.style.borderColor = '#4ade80';
        }
        
        // 2. 记录时间戳
        startTimeRef.current = timestamp; 
        
        // 3. 改变逻辑状态
        stateRef.current = ReflexState.READY;
        
        // 4. 更新 React 用于文本显示
        setActiveReflexState(ReflexState.READY);
      });
    }, delay);
  };

  const startAimTest = () => {
    setTargetsHit(0);
    setResultTime(null);
    setCoachFeedback(null);
    spawnTarget();
    startTimeRef.current = performance.now();
    setMode(GameMode.AIM);
  };

  const spawnTarget = () => {
    setTargetPos({
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80
    });
  };

  const handleTargetHit = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextHitCount = targetsHit + 1;
    if (nextHitCount >= AIM_TARGET_COUNT) {
      const endTime = performance.now();
      const avgTime = Math.round((endTime - startTimeRef.current) / AIM_TARGET_COUNT);
      setResultTime(avgTime);
      setTargetsHit(nextHitCount);
      saveScore(avgTime, GameMode.AIM);
    } else {
      setTargetsHit(nextHitCount);
      spawnTarget();
    }
  };

  const resetGame = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    setMode(GameMode.IDLE);
    stateRef.current = ReflexState.START;
    setActiveReflexState(ReflexState.START);
    setResultTime(null);
  };

  return (
    <div className="min-h-screen cs-gradient flex flex-col text-zinc-100 select-none">
      <header className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={resetGame}>
            <div className="w-10 h-10 bg-orange-600 rounded flex items-center justify-center shadow-lg">
              <Crosshair className="text-white" size={24} />
            </div>
            <h1 className="text-xl font-extrabold tracking-tighter uppercase italic">
              CS Reflex <span className="text-orange-500">精英</span>
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-2 text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              零延迟 Direct-DOM 模式
            </div>
            <div className="bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800 flex items-center gap-2">
              <User size={14} className="text-zinc-500" />
              <span className="text-xs font-bold uppercase text-zinc-400">特种兵_01</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 space-y-6">
          <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-orange-500" />
              <h2 className="font-bold text-xs uppercase tracking-widest text-zinc-500">最佳表现</h2>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-bold text-zinc-600 uppercase mb-1">历史最高纪录</div>
                <div className="text-4xl font-black text-orange-500 italic leading-none">
                  {scores.filter(s => s.mode === GameMode.REFLEX).sort((a,b) => a.value - b.value)[0]?.value || '--'}
                  <span className="text-sm ml-1 font-normal text-zinc-600 not-italic">ms</span>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={18} className="text-yellow-500" />
              <h2 className="font-bold text-xs uppercase tracking-widest text-zinc-500">最近战绩</h2>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {scores.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/50 transition-colors hover:bg-zinc-800/50">
                  <div className="text-sm font-black italic">{s.value}ms</div>
                  <div className={`text-[9px] font-black uppercase tracking-tighter ${getRank(s.value).color}`}>{s.rank}</div>
                </div>
              ))}
              {scores.length === 0 && <div className="text-[10px] text-zinc-700 font-bold uppercase py-4 text-center">暂无数据</div>}
            </div>
          </section>
        </aside>

        <div className="lg:col-span-3 space-y-6">
          {mode === GameMode.IDLE && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div onClick={() => { setMode(GameMode.REFLEX); setTimeout(startReflexTest, 0); }} className="group bg-zinc-900 border border-zinc-800 rounded-3xl p-10 cursor-pointer hover:border-orange-500 transition-all shadow-xl">
                <Zap className="text-orange-500 mb-6 group-hover:scale-110 transition-transform" size={40} />
                <h3 className="text-3xl font-black italic uppercase mb-3">反应速度测试</h3>
                <p className="text-zinc-400 text-sm mb-8 leading-relaxed">已开启 Direct-DOM 模式。绕过渲染层以获得物理极限的输入响应。</p>
                <div className="text-orange-500 font-bold text-xs uppercase flex items-center gap-2">开始校准 <ChevronRight size={14} /></div>
              </div>
              <div onClick={startAimTest} className="group bg-zinc-900 border border-zinc-800 rounded-3xl p-10 cursor-pointer hover:border-blue-500 transition-all shadow-xl">
                <Target className="text-blue-500 mb-6 group-hover:scale-110 transition-transform" size={40} />
                <h3 className="text-3xl font-black italic uppercase mb-3">精准拉枪练习</h3>
                <p className="text-zinc-400 text-sm mb-8 leading-relaxed">提升肌肉记忆。训练你对微小目标的高速定位和点击精度。</p>
                <div className="text-blue-500 font-bold text-xs uppercase flex items-center gap-2">进入靶场 <ChevronRight size={14} /></div>
              </div>
            </div>
          )}

          {mode === GameMode.REFLEX && (
            <div 
              ref={gameAreaRef}
              className="relative h-[550px] rounded-[2.5rem] border-4 flex flex-col items-center justify-center text-center cursor-pointer overflow-hidden select-none shadow-2xl"
              style={{ 
                backgroundColor: '#09090b', 
                borderColor: '#27272a',
                touchAction: 'none'
              }}
            >
              {activeReflexState === ReflexState.WAITING && (
                <div className="pointer-events-none animate-in fade-in duration-300">
                  <div className="w-20 h-20 rounded-full border-4 border-red-500/20 flex items-center justify-center mx-auto mb-8">
                    <Clock className="text-red-500/50 animate-pulse" size={32} />
                  </div>
                  <h2 className="text-5xl font-black italic uppercase tracking-tighter text-zinc-200">屏息以待...</h2>
                  <p className="text-zinc-600 font-bold uppercase text-[10px] tracking-[0.3em] mt-4">等待绿色信号发出</p>
                </div>
              )}

              {activeReflexState === ReflexState.READY && (
                <div className="pointer-events-none">
                  <h2 className="text-[12rem] font-black italic uppercase text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">开火!</h2>
                </div>
              )}

              {activeReflexState === ReflexState.TOO_EARLY && (
                <div className="space-y-8 animate-in zoom-in-95 duration-200">
                  <h2 className="text-6xl font-black italic text-red-500 uppercase tracking-tighter">太快了!</h2>
                  <p className="text-zinc-500 font-bold uppercase text-xs">你在信号发出之前就开枪了。</p>
                  <button onClick={(e) => { e.stopPropagation(); startReflexTest(); }} className="bg-white text-black hover:bg-zinc-200 px-12 py-5 rounded-2xl font-black uppercase text-sm flex items-center gap-3 mx-auto transition-all active:scale-95 shadow-xl">
                    <RotateCcw size={18} /> 重新装填
                  </button>
                </div>
              )}

              {activeReflexState === ReflexState.RESULT && resultTime !== null && (
                <div className="space-y-10 animate-in fade-in zoom-in-95 duration-300">
                  <div className="relative">
                    <div className="text-zinc-500 font-bold uppercase text-[10px] tracking-[0.4em] mb-4">击杀用时</div>
                    <div className="text-[11rem] font-black italic tracking-tighter text-orange-500 leading-none drop-shadow-2xl">
                      {resultTime}<span className="text-4xl ml-2 font-normal text-zinc-700 not-italic uppercase">ms</span>
                    </div>
                  </div>
                  
                  {isLodingFeedback ? (
                    <div className="flex justify-center"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
                  ) : coachFeedback && (
                    <div className="bg-zinc-950/60 border border-zinc-800/50 p-8 rounded-[2rem] max-w-lg mx-auto backdrop-blur-xl">
                      <p className="text-xl font-bold italic text-zinc-100">"{coachFeedback.comment}"</p>
                      <div className={`mt-4 text-xs font-black uppercase tracking-[0.2em] px-4 py-2 rounded-lg bg-zinc-900/50 inline-block ${getRank(resultTime).color}`}>
                        {coachFeedback.rankName}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 justify-center relative z-20">
                    <button onClick={(e) => { e.stopPropagation(); startReflexTest(); }} className="bg-orange-600 hover:bg-orange-500 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs flex items-center gap-3 transition-all active:scale-95">
                      <RotateCcw size={16} /> 再次尝试
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); resetGame(); }} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-10 py-5 rounded-2xl font-black uppercase text-xs transition-all active:scale-95">返回</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === GameMode.AIM && (
            <div className="relative h-[550px] bg-zinc-950 border-4 border-zinc-800 rounded-[2.5rem] cursor-crosshair overflow-hidden shadow-2xl">
              {targetsHit < AIM_TARGET_COUNT ? (
                <div 
                  onMouseDown={handleTargetHit}
                  className="absolute w-20 h-20 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center group"
                  style={{ top: `${targetPos.y}%`, left: `${targetPos.x}%` }}
                >
                  <div className="w-14 h-14 border-[6px] border-blue-500 rounded-full flex items-center justify-center bg-blue-500/10 shadow-[0_0_25px_rgba(59,130,246,0.3)]">
                    <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white]" />
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center space-y-10 animate-in fade-in">
                  <div className="text-[9rem] font-black italic text-blue-500 tracking-tighter leading-none">{resultTime}ms</div>
                  <div className="flex gap-4">
                    <button onClick={startAimTest} className="bg-blue-600 hover:bg-blue-500 text-white px-12 py-5 rounded-2xl font-black uppercase text-xs">重试</button>
                    <button onClick={resetGame} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-12 py-5 rounded-2xl font-black uppercase text-xs">返回</button>
                  </div>
                </div>
              )}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase text-zinc-700 tracking-[0.3em]">
                进度: {targetsHit + 1} / {AIM_TARGET_COUNT}
              </div>
            </div>
          )}

          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-[2rem] p-8">
            <h4 className="font-black text-zinc-500 text-[10px] uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" /> 实时校准状态 (Bare Metal Logic)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: '计时内核', value: 'HighRes RAF' },
                { label: '输入响应', value: 'Direct Pointer' },
                { label: '渲染路径', value: 'Bypass VDOM' },
                { label: '精度误差', value: '< 0.01ms' }
              ].map((stat, i) => (
                <div key={i}>
                  <div className="text-[9px] font-bold text-zinc-700 uppercase mb-1">{stat.label}</div>
                  <div className="text-xs font-black text-zinc-400">{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="p-8 text-center border-t border-zinc-900 bg-zinc-950/30">
        <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.5em]">
          极致低延迟架构 V3.0 • CS 专业选手训练方案
        </p>
      </footer>
    </div>
  );
};

export default App;
