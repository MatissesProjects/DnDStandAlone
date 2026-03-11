import React, { useEffect, useState, useRef } from 'react';

interface FateSpinnerProps {
  options: string[];
  resultIndex: number;
  onFinished: () => void;
}

const FateSpinner: React.FC<FateSpinnerProps> = ({ options, resultIndex, onFinished }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const totalOptions = options.length;
  const arcSize = 360 / totalOptions;

  useEffect(() => {
    // Start spinning after a short delay to let the component mount
    const timer = setTimeout(() => {
      setIsSpinning(true);
      
      // Calculate final rotation
      // 5 full spins (1800 deg) + target segment offset
      // Segment offset is (360 - (index * arcSize) - arcSize/2)
      const extraSpins = 5 + Math.random() * 2; // Randomize number of spins slightly
      const baseRotation = extraSpins * 360;
      const targetOffset = 360 - (resultIndex * arcSize) - (arcSize / 2);
      const finalRotation = baseRotation + targetOffset;
      
      setRotation(finalRotation);
    }, 100);

    return () => clearTimeout(timer);
  }, [resultIndex, arcSize]);

  const handleTransitionEnd = () => {
    setIsSpinning(false);
    setTimeout(onFinished, 2000); // Hold result for 2 seconds
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
      <div className="relative flex flex-col items-center gap-12">
        <h2 className="text-2xl font-black italic uppercase tracking-[0.5em] text-indigo-400 animate-pulse">Consulting the Fates</h2>
        
        <div className="relative w-80 h-80 sm:w-96 sm:h-80 flex items-center justify-center">
          {/* The Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 z-10">
            <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-white drop-shadow-2xl"></div>
          </div>

          {/* The Wheel */}
          <div 
            className="w-full h-full rounded-full border-8 border-gray-800 shadow-[0_0_50px_rgba(99,102,241,0.3)] overflow-hidden relative"
            style={{ 
              transform: `rotate(${rotation}deg)`,
              transition: isSpinning ? 'transform 4s cubic-bezier(0.15, 0, 0.15, 1)' : 'none'
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
              {options.map((option, i) => {
                const startAngle = (i * arcSize) * (Math.PI / 180);
                const endAngle = ((i + 1) * arcSize) * (Math.PI / 180);
                const x1 = 50 + 50 * Math.cos(startAngle);
                const y1 = 50 + 50 * Math.sin(startAngle);
                const x2 = 50 + 50 * Math.cos(endAngle);
                const y2 = 50 + 50 * Math.sin(endAngle);
                
                const largeArcFlag = arcSize > 180 ? 1 : 0;
                const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
                
                // Fancy colors alternating
                const colors = ['#4f46e5', '#3730a3', '#312e81', '#1e1b4b'];
                const color = colors[i % colors.length];

                return (
                  <g key={i}>
                    <path d={pathData} fill={color} stroke="#1e1b4b" strokeWidth="0.5" />
                    {/* Text logic - very complex in SVG circles, simplified here */}
                    <text
                      x="75"
                      y="50"
                      transform={`rotate(${i * arcSize + arcSize/2}, 50, 50)`}
                      fill="white"
                      fontSize="3"
                      fontWeight="bold"
                      textAnchor="middle"
                      className="uppercase tracking-tighter"
                      style={{ pointerEvents: 'none' }}
                    >
                      {option.length > 15 ? option.substring(0, 12) + '...' : option}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          
          {/* Center Cap */}
          <div className="absolute inset-0 m-auto w-12 h-12 bg-gray-900 border-4 border-gray-800 rounded-full shadow-2xl flex items-center justify-center z-20">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></div>
          </div>
        </div>

        {!isSpinning && rotation > 0 && (
          <div className="animate-in zoom-in duration-500 flex flex-col items-center gap-2">
            <p className="text-gray-500 uppercase font-black text-[10px] tracking-[0.3em]">The Fates Have Spoken</p>
            <p className="text-4xl font-black uppercase text-white drop-shadow-lg shadow-indigo-500/50">{options[resultIndex]}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FateSpinner;
