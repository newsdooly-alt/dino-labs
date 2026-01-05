import { useQuests } from "@/hooks/use-quests";
import { QuestCard } from "@/components/quests/QuestCard";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

export default function Quests() {
  const { data: quests, isLoading } = useQuests();
  
  // Calculate completion
  const completedCount = quests?.filter(q => q.isCompleted).length || 0;
  const totalCount = quests?.length || 0;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto min-h-screen">
      <div className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">Daily Quests</h1>
        <p className="text-muted-foreground text-lg max-w-lg mx-auto">
          Sharpen your skills and earn XP by completing today's market challenges.
        </p>
      </div>

      {/* Progress Header */}
      <div className="mb-12 bg-card border border-border rounded-3xl p-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center text-secondary">
                 <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Daily Progress</h2>
                <p className="text-muted-foreground">{completedCount} of {totalCount} completed</p>
              </div>
           </div>
           
           <div className="w-full md:w-64">
              <div className="h-4 bg-background rounded-full overflow-hidden shadow-inner">
                 <div 
                   className="h-full bg-gradient-to-r from-secondary to-purple-500 transition-all duration-1000"
                   style={{ width: `${progress}%` }}
                 />
              </div>
           </div>
        </div>
        
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-secondary/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {isLoading ? (
        <div className="space-y-4">
           {[1, 2, 3].map(i => (
             <div key={i} className="h-40 bg-card/50 rounded-3xl animate-pulse" />
           ))}
        </div>
      ) : (
        <div className="space-y-6">
          {quests?.map((quest, idx) => (
            <motion.div
              key={quest.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.15 }}
            >
              <QuestCard quest={quest} />
            </motion.div>
          ))}
          
          {quests?.length === 0 && (
            <div className="text-center py-20">
               <p className="text-2xl font-bold text-muted-foreground">No quests available.</p>
               <button 
                 onClick={() => window.location.reload()}
                 className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90"
               >
                 Refresh
               </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
