import React, { useState, useEffect } from 'react';

interface ClockWidgetProps {
  militaryTime?: boolean;
}

export const ClockWidget: React.FC<ClockWidgetProps> = ({ militaryTime = false }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = time.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: !militaryTime,
  });

  const secondsString = String(time.getSeconds()).padStart(2, '0');

  const dateString = time.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col items-end px-3.5 py-2 rounded-2xl bg-black/65 backdrop-blur-md border border-white/20 text-white shadow-2xl select-none">
      <div className="flex items-baseline gap-1">
        <span className="text-3xl sm:text-4xl font-black tracking-tight leading-none text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          {timeString}
        </span>
        <span className="text-xs font-semibold text-slate-400 font-mono">
          :{secondsString}
        </span>
      </div>
      <span className="text-xs font-bold text-blue-300 uppercase tracking-widest mt-1 drop-shadow">
        {dateString}
      </span>
    </div>
  );
};
