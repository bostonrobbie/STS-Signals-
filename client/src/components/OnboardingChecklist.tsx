import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, ArrowRight, Sparkles } from 'lucide-react';
import { useLocation } from 'wouter';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  href: string;
  completed: boolean;
}

interface OnboardingChecklistProps {
  items: ChecklistItem[];
  onDismiss?: () => void;
}

export default function OnboardingChecklist({ items, onDismiss }: OnboardingChecklistProps) {
  const [, setLocation] = useLocation();
  
  const completedCount = items.filter(item => item.completed).length;
  const totalCount = items.length;
  const progress = (completedCount / totalCount) * 100;
  const isComplete = completedCount === totalCount;
  
  if (isComplete && onDismiss) {
    return null; // Hide when all items are complete
  }
  
  return (
    <Card className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-emerald-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            <CardTitle className="text-lg text-white">Getting Started</CardTitle>
          </div>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-slate-400 hover:text-white"
            >
              Dismiss
            </Button>
          )}
        </div>
        <p className="text-sm text-slate-400">
          Complete these steps to get the most out of IntraDay Strategies
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">{completedCount} of {totalCount} completed</span>
            <span className="text-emerald-400">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        {/* Checklist items */}
        <div className="space-y-3">
          {items.map((item) => (
            <div 
              key={item.id}
              className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                item.completed 
                  ? 'bg-emerald-500/10 border border-emerald-500/20' 
                  : 'bg-slate-800/50 border border-slate-700/50 hover:border-emerald-500/30'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {item.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-500" />
                )}
              </div>
              <div className="flex-grow min-w-0">
                <h4 className={`font-medium ${item.completed ? 'text-emerald-400' : 'text-white'}`}>
                  {item.title}
                </h4>
                <p className="text-sm text-slate-400 mt-0.5">{item.description}</p>
              </div>
              {!item.completed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation(item.href)}
                  className="flex-shrink-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                >
                  Start
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
        
        {isComplete && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">All set! You're ready to trade.</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
