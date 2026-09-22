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

  const dateString = time.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col items-end px-3 py-1.5 rounded-2xl bg-black/60 backdrop-blur-md border border-white/15 text-white shadow-lg select-none">
      <span className="text-xl font-black tracking-tight leading-none text-white drop-shadow-md">
        {timeString}
      </span>
      <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
        {dateString}
      </span>
    </div>
  );
};
