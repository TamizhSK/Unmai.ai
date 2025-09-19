import { cn } from "@/lib/utils";
import './gemini-loader.css';

export function GeminiLoader({ className }: { className?: string }) {
  return (
    <div className={cn("gemini-loader", className)}>
        <div className="bar"></div>
        <div className="bar"></div>
        <div className="bar"></div>
    </div>
  );
}
