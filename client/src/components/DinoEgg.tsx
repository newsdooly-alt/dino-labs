import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DinoEggProps {
  level: number;
  className?: string;
}

export function DinoEgg({ level, className }: DinoEggProps) {
  const isHatched = level >= 10;
  
  // Progress within the egg stage (0 to 1)
  const crackProgress = Math.min(level / 10, 1);
  
  return (
    <div className={cn("relative flex items-center justify-center p-4", className)}>
      <div className="relative w-32 h-40">
        <AnimatePresence mode="wait">
          {!isHatched ? (
            <motion.div
              key="egg"
              initial={{ scale: 0.8 }}
              animate={{ 
                scale: 1,
                rotate: [0, -2, 2, -2, 0],
              }}
              transition={{ 
                rotate: { repeat: Infinity, duration: 4, ease: "easeInOut" }
              }}
              className="relative w-full h-full"
            >
              {/* Egg Shape */}
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-100 to-emerald-200 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] border-4 border-emerald-300 shadow-xl overflow-hidden">
                {/* Speckles */}
                <div className="absolute top-4 left-6 w-2 h-2 bg-emerald-400 rounded-full opacity-40" />
                <div className="absolute top-12 right-8 w-3 h-3 bg-emerald-400 rounded-full opacity-30" />
                <div className="absolute bottom-10 left-10 w-2 h-2 bg-emerald-400 rounded-full opacity-50" />
                
                {/* Cracks based on level */}
                {level >= 3 && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="absolute top-1/4 left-1/2 w-px h-12 bg-emerald-600/40 -translate-x-1/2 rotate-12" 
                  />
                )}
                {level >= 6 && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="absolute top-1/3 left-1/3 w-12 h-px bg-emerald-600/40 rotate-45" 
                  />
                )}
                {level >= 8 && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="absolute top-1/2 right-1/4 w-8 h-px bg-emerald-600/40 -rotate-12" 
                  />
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dino"
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative flex flex-col items-center"
            >
              <div className="w-32 h-32 bg-primary/20 rounded-full flex items-center justify-center text-primary animate-bounce-slow">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-20 h-20">
                  <path d="M16 16c0-4.4-3.6-8-8-8s-8 3.6-8 8" />
                  <path d="M2 16h12" />
                  <path d="M7 8V5a3 3 0 0 1 6 0v3" />
                  <path d="M12 8c4.4 0 8 3.6 8 8" />
                  <path d="M22 16h-2" />
                  <path d="M17 13l3-3 3 3" />
                </svg>
              </div>
              <div className="mt-4 px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full uppercase tracking-wider">
                Baby Dino Hatched!
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

import { AnimatePresence } from "framer-motion";
