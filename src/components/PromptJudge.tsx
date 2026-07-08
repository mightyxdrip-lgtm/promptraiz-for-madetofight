import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'motion/react';
import { analyzePrompt, optimizePrompt, imageToPrompt, enhancePrompt, AnalysisResult, OptimizationResult, SecurityResult, ImageToPromptResult, EnhancementResult } from '@/src/lib/gemini';
import { scanPromptSecurity } from '@/src/lib/heuristics';
import { Button, buttonVariants } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sparkles, ShieldAlert, CheckCircle2, ArrowRight, Loader2, Copy, RefreshCw, Wand2, Sun, Moon, Info, Monitor, Code2, Cpu, Layers, Zap, BookOpen, UserCircle, GitBranch, ListChecks, MessageSquare, ShieldCheck, AlertTriangle, XCircle, Plus, FileText, Trash2, Image as ImageIcon, Upload, Eye } from 'lucide-react';

const PROMPT_RECIPES = [
  {
    id: 'persona',
    name: 'Persona Pattern',
    icon: <UserCircle className="h-5 w-5" />,
    description: 'Assign a specific role to the AI.',
    template: (input: string) => `Act as an expert [Role]. Your task is to: ${input}\n\nPlease provide a professional and detailed response.`
  },
  {
    id: 'cot',
    name: 'Chain of Thought',
    icon: <GitBranch className="h-5 w-5" />,
    description: 'Encourage step-by-step reasoning.',
    template: (input: string) => `Please solve the following task by thinking step-by-step. \n\nTask: ${input}\n\nLet's think through this logically:`
  },
  {
    id: 'fewshot',
    name: 'Few-Shot',
    icon: <MessageSquare className="h-5 w-5" />,
    description: 'Provide examples for better alignment.',
    template: (input: string) => `Here are a few examples of how to perform this task:\nExample 1: [Input] -> [Output]\nExample 2: [Input] -> [Output]\n\nNow, perform the task for this input: ${input}`
  },
  {
    id: 'stepbystep',
    name: 'Step-by-Step',
    icon: <ListChecks className="h-5 w-5" />,
    description: 'Break tasks into numbered steps.',
    template: (input: string) => `Break down the following task into a clear, numbered sequence of steps: ${input}`
  }
];

const CRITERIA_DESCRIPTIONS: Record<keyof AnalysisResult['criteria'], string> = {
  clarity: "Measures how unambiguous and easy to understand the core task is. High clarity prevents AI confusion.",
  context: "Evaluates the background information provided. Good context helps the AI understand the 'why' behind the request.",
  constraints: "Checks for explicit boundaries and negative constraints. Tells the AI exactly what to avoid.",
  persona: "Analyzes if a specific expert role or character is assigned to the AI to guide its perspective.",
  tone: "Assesses the specification of output style, format (like Markdown/JSON), and emotional quality."
};

type Theme = 'dark' | 'light' | 'classic';

const GlitchPixels = () => {
  const [pixels, setPixels] = useState<{ id: string; x: number; y: number; size: number }[]>([]);
  const lastPos = React.useRef({ x: 0, y: 0 });

  useEffect(() => {
    let rafId: number;
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX: x, clientY: y } = e;
      const dist = Math.hypot(x - lastPos.current.x, y - lastPos.current.y);
      
      if (dist > 20) {
        const newPixel = {
          id: `${Date.now()}-${Math.random()}`,
          x: x + (Math.random() - 0.5) * 30,
          y: y + (Math.random() - 0.5) * 30,
          size: Math.random() * 3 + 1
        };
        
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          setPixels(prev => [...prev.slice(-8), newPixel]);
          lastPos.current = { x, y };
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9998] overflow-hidden">
      <AnimatePresence>
        {pixels.map(pixel => (
          <motion.div
            key={pixel.id}
            initial={{ opacity: 0.6, scale: 1, x: pixel.x, y: pixel.y }}
            animate={{ 
              opacity: 0, 
              scale: 0,
              x: pixel.x + (Math.random() - 0.5) * 15,
              y: pixel.y + (Math.random() - 0.5) * 15
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute bg-emerald-500"
            style={{
              left: 0,
              top: 0,
              width: pixel.size,
              height: pixel.size,
              boxShadow: '0 0 8px #10b981'
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ShieldBadge = ({ score }: { score: number }) => (
  <div className="relative group">
    <div className="absolute -inset-1 bg-emerald-500/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity" />
    <ShieldCheck className={cn(
      "h-4 w-4 relative z-10",
      score >= 90 ? "text-emerald-400" : score >= 70 ? "text-amber-400" : "text-red-400"
    )} />
  </div>
);

const Tilt = ({ children }: { children: React.ReactNode }) => {
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const ref = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current?.getBoundingClientRect() || { left: 0, top: 0, width: 0, height: 0 };
    const x = (clientY - (top + height / 2)) / (height / 2);
    const y = (clientX - (left + width / 2)) / (width / 2);
    setRotate({ x: x * -5, y: y * 5 });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateX: rotate.x, rotateY: rotate.y }}
      transition={{ type: "spring", damping: 20, stiffness: 150 }}
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
    </motion.div>
  );
};

const Magnetic = ({ children }: { children: React.ReactNode }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const ref = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current?.getBoundingClientRect() || { left: 0, top: 0, width: 0, height: 0 };
    const x = clientX - (left + width / 2);
    const y = clientY - (top + height / 2);
    setPosition({ x: x * 0.3, y: y * 0.3 });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", damping: 15, stiffness: 150, mass: 0.1 }}
    >
      {children}
    </motion.div>
  );
};

export default function PromptJudge() {
  const [prompt, setPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [optimizedResult, setOptimizedResult] = useState<OptimizationResult | null>(null);
  const [originalPromptAtOptimization, setOriginalPromptAtOptimization] = useState('');
  const [theme, setTheme] = useState<Theme>('dark');
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; message: string; solution: string } | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string }[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Image-to-Prompt State
  const [activeTab, setActiveTab] = useState('audit');
  const [selectedImage, setSelectedImage] = useState<{ base64: string; preview: string; mimeType: string } | null>(null);
  const [isGeneratingFromImage, setIsGeneratingFromImage] = useState(false);
  const [imageToPromptResult, setImageToPromptResult] = useState<ImageToPromptResult | null>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  // Enhance State
  const [enhanceInput, setEnhanceInput] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementResult, setEnhancementResult] = useState<EnhancementResult | null>(null);

  // Drag-and-Drop State
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = React.useRef(0);

  // High-performance motion values for cursor
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  // Trail springs — tuned for responsive tracking at high speed
  const s1x = useSpring(mouseX, { damping: 25, stiffness: 300, mass: 0.2 });
  const s1y = useSpring(mouseY, { damping: 25, stiffness: 300, mass: 0.2 });
  const s2x = useSpring(mouseX, { damping: 30, stiffness: 250, mass: 0.3 });
  const s2y = useSpring(mouseY, { damping: 30, stiffness: 250, mass: 0.3 });
  const s3x = useSpring(mouseX, { damping: 35, stiffness: 200, mass: 0.4 });
  const s3y = useSpring(mouseY, { damping: 35, stiffness: 200, mass: 0.4 });

  const trailLayers = useMemo(() => [
    { x: s1x, y: s1y },
    { x: s2x, y: s2y },
    { x: s3x, y: s3y },
  ], [s1x, s1y, s2x, s2y, s3x, s3y]);

  const spotlightBackground = useTransform(
    [mouseX, mouseY],
    ([x, y]) => `radial-gradient(600px circle at ${x}px ${y}px, rgba(var(--primary-rgb), 0.15), transparent 80%)`
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [mouseX, mouseY]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark', 'light', 'classic');
    root.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'dark') return 'light';
      if (prev === 'light') return 'classic';
      return 'dark';
    });
  };

  const handleAnalyze = async () => {
    const trimmedPrompt = prompt.trim();
    
    // Combine prompt with file contents for analysis
    const fullContext = attachedFiles.length > 0 
      ? `${trimmedPrompt}\n\n[Attached Files Content]:\n${attachedFiles.map(f => `--- File: ${f.name} ---\n${f.content}`).join('\n\n')}`
      : trimmedPrompt;

    // Pre-analysis Security Check
    const securityCheck = scanPromptSecurity(fullContext);
    if (!securityCheck.isSecure && securityCheck.securityScore <= 50) {
      setErrorDialog({
        open: true,
        title: "Security Violation Blocked",
        message: `This prompt or attached files contain high-risk patterns: ${securityCheck.warnings.join(", ")}.`,
        solution: "Please remove any requests for malicious activities, private data extraction, or hacking. This tool is for professional prompt engineering only."
      });
      return;
    }

    // One-word validation (only if no files are attached)
    if (attachedFiles.length === 0 && trimmedPrompt.split(/\s+/).length <= 1 && trimmedPrompt.length > 0) {
      setErrorDialog({
        open: true,
        title: "Invalid Prompt Depth",
        message: "Your prompt is too short to be effectively audited.",
        solution: "Try adding more context, a specific task, or a persona. For example: 'Write a professional email about...' instead of just 'Email'."
      });
      return;
    }

    if (!trimmedPrompt && attachedFiles.length === 0) return;
    setIsAnalyzing(true);
    setOptimizedResult(null);
    setStatus("Running security check...");
    try {
      const data = await analyzePrompt(fullContext);
      
      if (data.policyViolation) {
        setErrorDialog({
          open: true,
          title: "Policy Violation Detected",
          message: data.feedback[0] || "This prompt violates standard AI safety guidelines regarding harmful content, illegal acts, or privacy.",
          solution: "Please rephrase your prompt to focus on ethical and safe use cases. Avoid requests for hacking, PII, or harmful activities."
        });
        setIsAnalyzing(false);
        return;
      }

      setResult(data);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
      setStatus(null);
    }
  };

  const handleOptimize = async () => {
    if ((!prompt.trim() && attachedFiles.length === 0) || !result) return;
    setIsOptimizing(true);
    setOriginalPromptAtOptimization(prompt);
    setStatus("Optimizing prompt structure...");
    
    const fullContext = attachedFiles.length > 0 
      ? `${prompt}\n\n[Attached Files Content]:\n${attachedFiles.map(f => `--- File: ${f.name} ---\n${f.content}`).join('\n\n')}`
      : prompt;

    try {
      const optimized = await optimizePrompt(fullContext, result);
      setOptimizedResult(optimized);
    } catch (error) {
      console.error('Optimization failed:', error);
    } finally {
      setIsOptimizing(false);
      setStatus(null);
    }
  };

  const handleEnhance = async () => {
    const trimmed = enhanceInput.trim();
    if (!trimmed) return;
    setIsEnhancing(true);
    setEnhancementResult(null);
    setStatus("Enhancing prompt...");
    try {
      const result = await enhancePrompt(trimmed);
      setEnhancementResult(result);
    } catch (error) {
      console.error('Enhancement failed:', error);
    } finally {
      setIsEnhancing(false);
      setStatus(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setAttachedFiles(prev => [...prev, { name: file.name, content }]);
      };
      reader.readAsText(file);
    });
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

  const processDroppedFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (IMAGE_TYPES.includes(file.type)) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = (event.target?.result as string).split(',')[1];
          const preview = event.target?.result as string;
          setSelectedImage({ base64, preview, mimeType: file.type });
          setImageToPromptResult(null);
          setActiveTab('image');
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          setAttachedFiles(prev => [...prev, { name: file.name, content }]);
        };
        reader.readAsText(file);
      }
    });
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processDroppedFiles(e.dataTransfer.files);
    }
  };

  // Global drag listeners for cross-area drops
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes('Files')) {
        dragCounter.current++;
        setIsDragging(true);
      }
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragging(false);
      }
    };
    const onDragOver = (e: DragEvent) => { e.preventDefault(); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      if (e.dataTransfer?.files.length) {
        processDroppedFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      const preview = event.target?.result as string;
      setSelectedImage({ base64, preview, mimeType: file.type });
      setImageToPromptResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleImageToPrompt = async () => {
    if (!selectedImage) return;
    setIsGeneratingFromImage(true);
    try {
      const result = await imageToPrompt(selectedImage.base64, selectedImage.mimeType);
      
      if (result.policyViolation) {
        setErrorDialog({
          open: true,
          title: "Image Safety Violation",
          message: result.violationReason || "This image contains inappropriate content that violates our safety guidelines.",
          solution: "Please upload a different image that follows professional standards and AI safety policies."
        });
        setImageToPromptResult(null);
        setSelectedImage(null);
        return;
      }
      
      setImageToPromptResult(result);
    } catch (error) {
      console.error('Image to prompt failed:', error);
      setErrorDialog({
        open: true,
        title: "Image Analysis Failed",
        message: "The AI model could not process this image. It may not support image inputs or the image format is incompatible.",
        solution: "Try a different image format (PNG, JPG, WEBP) or check your OpenRouter API key has access to vision-capable models."
      });
    } finally {
      setIsGeneratingFromImage(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen relative overflow-hidden cursor-none">
        {/* Custom Cursor Follower with Motion Blur Trail */}
        <GlitchPixels />
        
        {/* Trail Layers (Optimized Motion Blur) */}
        {trailLayers.map((trail, i) => (
          <motion.div
            key={`trail-${i}`}
            className="fixed top-0 left-0 w-8 h-8 rounded-full border border-primary/20 pointer-events-none z-[9998] mix-blend-difference hidden md:block will-change-transform"
            style={{
              x: trail.x,
              y: trail.y,
              translateX: "-50%",
              translateY: "-50%",
              scale: (isAnalyzing || isOptimizing ? 1.5 : 1) * (1 - i * 0.12),
              opacity: 0.5 - i * 0.12,
              filter: `blur(${i * 1.5}px)`
            }}
          />
        ))}

        <motion.div
          className="fixed top-0 left-0 w-8 h-8 rounded-full border border-primary/30 pointer-events-none z-[9999] mix-blend-difference hidden md:block will-change-transform"
          style={{
            x: mouseX,
            y: mouseY,
            translateX: "-50%",
            translateY: "-50%",
            scale: isAnalyzing || isOptimizing ? 1.5 : 1,
          }}
        />
        <motion.div
          className="fixed top-0 left-0 w-1.5 h-1.5 bg-primary rounded-full pointer-events-none z-[9999] hidden md:block will-change-transform"
          style={{
            x: mouseX,
            y: mouseY,
            translateX: "-50%",
            translateY: "-50%",
          }}
        />

        {/* Error Dialog */}
        <Dialog open={!!errorDialog?.open} onOpenChange={(open) => setErrorDialog(prev => prev ? { ...prev, open } : null)}>
          <DialogContent className="glass-card premium-border border-red-500/20 max-w-md">
            <DialogHeader className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                <XCircle className="h-6 w-6 text-red-500" />
              </div>
              <DialogTitle className="text-center text-xl font-light tracking-tight">{errorDialog?.title}</DialogTitle>
              <DialogDescription className="text-center text-foreground/60 leading-relaxed">
                {errorDialog?.message}
              </DialogDescription>
            </DialogHeader>
            <div className="bg-foreground/5 p-4 rounded-xl border border-foreground/5 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-primary font-mono font-bold">Recommended Solution</p>
              <p className="text-sm text-foreground/80 leading-relaxed italic">
                {errorDialog?.solution}
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setErrorDialog(null)} className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-full">
                Got it
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="noise" />
        {/* Cinematic 8K Video Background */}
        <div className="absolute top-0 left-0 w-full h-screen overflow-hidden z-0">
          {/* Interactive Spotlight (Optimized) */}
          <motion.div
            className="absolute inset-0 z-10 pointer-events-none opacity-40"
            style={{
              background: spotlightBackground
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background z-10" />
          <div className="absolute inset-0 bg-black/10 z-0" />
          {/* Grain/Grid Overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-20" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          {/* Scanlines */}
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none z-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] animate-pulse" />
          <motion.video
            autoPlay
            loop
            muted
            playsInline
            initial={{ scale: 1.1 }}
            animate={{ scale: 1.05 }}
            transition={{ duration: 20, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            style={{ 
              filter: theme === 'dark' 
                ? 'brightness(0.5) contrast(1.3) saturate(1.1) blur(1px)' 
                : theme === 'classic'
                ? 'brightness(0.6) contrast(1.2) saturate(1.5) hue-rotate(20deg) blur(1px)'
                : 'brightness(0.9) contrast(1.1) saturate(0.8) blur(2px)'
            }}
          >
            <source src="https://cdn.pixabay.com/video/2023/11/04/187761-881223945_large.mp4" type="video/mp4" />
          </motion.video>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-12 space-y-12 relative z-20">
          {/* Hero Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-8 py-12 relative"
          >
            <div className="flex items-center justify-center gap-4 relative">
              <Badge variant="outline" className="px-5 py-1.5 border-primary/30 text-primary font-mono tracking-[0.2em] uppercase text-[10px] backdrop-blur-md bg-primary/5 rich-glow">
                Professional Grade Analysis
              </Badge>
              
              {/* Theme Toggle - Now aligned with Badge */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2">
                <Tooltip>
                  <TooltipTrigger
                    onClick={toggleTheme}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon" }),
                      "rounded-full w-10 h-10 bg-foreground/5 hover:bg-foreground/10 text-foreground transition-all border border-foreground/10 backdrop-blur-md hover:scale-110 active:scale-95"
                    )}
                  >
                    {theme === 'dark' && <Sun className="h-4 w-4" />}
                    {theme === 'light' && <Moon className="h-4 w-4" />}
                    {theme === 'classic' && <Monitor className="h-4 w-4" />}
                  </TooltipTrigger>
                  <TooltipContent>
                    Switch to {theme === 'dark' ? 'Light' : theme === 'light' ? 'Classic' : 'Dark'} Theme
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-8xl md:text-[10rem] font-light tracking-tighter text-foreground text-glow leading-none select-none">
                Promp<span className="font-serif italic opacity-80">traitz</span>
              </h1>
              <p className="text-foreground/70 max-w-2xl mx-auto text-xl font-light leading-relaxed backdrop-blur-sm rounded-2xl p-6 border border-foreground/5 shadow-2xl">
                The premium standard for AI command engineering. Judge, refine, and perfect your prompts with <span className="text-primary font-medium">surgical precision</span>.
              </p>
              <div className="pt-4">
                <Button 
                  variant="ghost" 
                  className="text-foreground/40 hover:text-primary transition-colors group"
                  onClick={() => document.getElementById('engineering-showcase')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Learn about our Engineering
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Tabs Navigation */}
          <div className="flex justify-center mb-8">
            <Tabs value={activeTab} onValueChange={(val) => {
              setActiveTab(val);
              if (val === 'image') {
                setImageToPromptResult(null);
                setSelectedImage(null);
              }
              if (val === 'enhance') {
                setEnhancementResult(null);
              }
            }} className="w-full max-w-lg">
              <TabsList className="grid grid-cols-3 bg-foreground/5 p-1 rounded-full border border-foreground/10 backdrop-blur-md">
                <TabsTrigger value="audit" className="rounded-full data-active:bg-primary data-active:text-primary-foreground transition-all duration-300">
                  <Zap className="h-4 w-4 mr-2" />
                  Audit & Optimize
                </TabsTrigger>
                <TabsTrigger value="enhance" className="rounded-full data-active:bg-primary data-active:text-primary-foreground transition-all duration-300">
                  <Wand2 className="h-4 w-4 mr-2" />
                  Enhance
                </TabsTrigger>
                <TabsTrigger value="image" className="rounded-full data-active:bg-primary data-active:text-primary-foreground transition-all duration-300">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Image-to-Prompt
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Tabs value={activeTab} className="w-full">
            <TabsContent value="audit">
              {/* Input Section */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="relative group"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <Tilt>
                  <Card 
                    className={cn(
                      "glass-card premium-border overflow-hidden relative transition-all duration-500",
                      isAnalyzing && "ring-2 ring-primary/20 shadow-[0_0_50px_-12px_rgba(var(--primary),0.3)]"
                    )}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <CardContent className="p-0">
                    <div className="relative">
                      {isAnalyzing && (
                        <motion.div 
                          initial={{ top: "-10%" }}
                          animate={{ top: "110%" }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent z-20 opacity-50 blur-[1px]"
                        />
                      )}

                      {/* Drag Overlay */}
                      <AnimatePresence>
                        {isDragging && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary/40 rounded-xl"
                          >
                            <Upload className="h-12 w-12 text-primary mb-3 animate-bounce" />
                            <p className="text-lg font-medium text-primary">Drop files here</p>
                            <p className="text-sm text-foreground/50 mt-1">Images → Image-to-Prompt | Text → Attach</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      {/* Attached Files List */}
                      {attachedFiles.length > 0 && (
                        <div className="px-8 pt-6 flex flex-wrap gap-2">
                          <AnimatePresence>
                            {attachedFiles.map((file, idx) => (
                              <motion.div
                                key={`${file.name}-${idx}`}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 group/file"
                              >
                                <FileText className="h-3.5 w-3.5 text-primary" />
                                <span className="text-xs font-medium text-foreground/80 max-w-[150px] truncate">{file.name}</span>
                                <button 
                                  onClick={() => removeFile(idx)}
                                  className="opacity-0 group-hover/file:opacity-100 transition-opacity p-0.5 hover:bg-red-500/20 rounded"
                                >
                                  <Trash2 className="h-3 w-3 text-red-500" />
                                </button>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      )}

                      <Textarea
                        placeholder="Paste your prompt here for a professional audit..."
                        className={cn(
                          "min-h-[200px] bg-transparent border-none text-xl p-8 focus-visible:ring-0 resize-none placeholder:text-foreground/10 text-foreground/90 leading-relaxed",
                          attachedFiles.length > 0 && "pt-4"
                        )}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />
                      
                      <div className="absolute bottom-6 left-6">
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileUpload} 
                          className="hidden" 
                          multiple
                        />
                        <Tooltip>
                          <TooltipTrigger
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "icon" }),
                              "rounded-full w-10 h-10 bg-foreground/5 hover:bg-foreground/10 text-foreground transition-all border border-foreground/10 backdrop-blur-md hover:scale-110 active:scale-95"
                            )}
                          >
                            <Plus className="h-5 w-5" />
                          </TooltipTrigger>
                          <TooltipContent>Attach Files</TooltipContent>
                        </Tooltip>
                      </div>

                      <div className="absolute bottom-6 right-6 flex items-center gap-4">
                      <Magnetic>
                        <Button 
                          onClick={handleAnalyze} 
                          disabled={isAnalyzing || (!prompt.trim() && attachedFiles.length === 0)}
                          className="bg-foreground text-background hover:bg-foreground/90 px-8 py-6 rounded-full text-md font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                        >
                          {isAnalyzing ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              {status || "Auditing..."}
                            </>
                          ) : (
                            <>
                              Analyze Prompt
                              <ArrowRight className="ml-2 h-5 w-5" />
                            </>
                          )}
                        </Button>
                      </Magnetic>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Tilt>
            </motion.div>
          </TabsContent>

          <TabsContent value="enhance">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="relative group"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Tilt>
                <Card className={cn(
                  "glass-card premium-border overflow-hidden relative transition-all duration-500",
                  isEnhancing && "ring-2 ring-primary/20 shadow-[0_0_50px_-12px_rgba(var(--primary),0.3)]"
                )}>
                  <CardContent className="p-0">
                    <div className="relative">
                      {isEnhancing && (
                        <motion.div 
                          initial={{ top: "-10%" }}
                          animate={{ top: "110%" }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent z-20 opacity-50 blur-[1px]"
                        />
                      )}
                      <Textarea
                        placeholder="Paste your rough prompt here to transform it into a production-grade prompt..."
                        className="min-h-[200px] bg-transparent border-none text-xl p-8 focus-visible:ring-0 resize-none placeholder:text-foreground/10 text-foreground/90 leading-relaxed"
                        value={enhanceInput}
                        onChange={(e) => setEnhanceInput(e.target.value)}
                      />
                      <div className="absolute bottom-6 right-6">
                        <Magnetic>
                          <Button 
                            onClick={handleEnhance} 
                            disabled={isEnhancing || !enhanceInput.trim()}
                            className="bg-foreground text-background hover:bg-foreground/90 px-8 py-6 rounded-full text-md font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                          >
                          {isEnhancing ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              {status || "Enhancing..."}
                            </>
                          ) : (
                            <>
                              <Wand2 className="mr-2 h-5 w-5" />
                              Enhance Prompt
                            </>
                          )}
                          </Button>
                        </Magnetic>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Tilt>
            </motion.div>

            {/* Enhancement Results */}
            <AnimatePresence>
              {enhancementResult && !isEnhancing && (
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-12 space-y-8"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                      <Card className="glass-card premium-border overflow-hidden">
                        <CardHeader className="border-b border-foreground/5 bg-foreground/5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Wand2 className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <CardTitle className="text-lg font-light tracking-tight">Enhanced Prompt</CardTitle>
                                <p className="text-xs text-foreground/40 uppercase tracking-widest font-mono">Production-Ready</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase tracking-widest border-primary/20 text-primary/60 font-mono">
                                {enhancementResult.category}
                              </Badge>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => copyToClipboard(enhancementResult.enhancedPrompt)}
                                className="rounded-full hover:bg-primary/10 hover:text-primary"
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-8">
                          <p className="text-lg text-foreground/90 leading-relaxed font-light whitespace-pre-wrap">
                            {enhancementResult.enhancedPrompt}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="lg:col-span-1 space-y-6">
                      <Card className="glass-card premium-border">
                        <CardHeader>
                          <CardTitle className="text-foreground/60 text-xs uppercase tracking-widest font-mono">Improvements</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {enhancementResult.improvements.map((point, idx) => (
                            <div key={idx} className="flex items-start gap-3 p-4 rounded-xl bg-foreground/5 border border-foreground/5">
                              <div className="mt-1">
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              </div>
                              <p className="text-sm text-foreground/80 leading-relaxed">{point}</p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      <Button 
                        onClick={() => {
                          setEnhanceInput(enhancementResult.enhancedPrompt);
                          setEnhancementResult(null);
                        }}
                        className="w-full bg-foreground/10 text-foreground hover:bg-foreground/20 rounded-full"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Re-Enhance
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="image">
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative group"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <Tilt>
                  <Card className={cn(
                    "glass-card premium-border overflow-hidden relative transition-all duration-500 min-h-[400px] flex flex-col",
                    isGeneratingFromImage && "ring-2 ring-primary/20 shadow-[0_0_50px_-12px_rgba(var(--primary),0.3)]"
                  )}>
                    <CardContent className="p-8 flex-1 flex flex-col items-center justify-center space-y-6">
                      <input 
                        type="file" 
                        ref={imageInputRef} 
                        onChange={handleImageUpload} 
                        accept="image/*"
                        className="hidden" 
                      />
                      
                      {!selectedImage ? (
                        <motion.div 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => imageInputRef.current?.click()}
                          className="w-full max-w-md aspect-video rounded-2xl border-2 border-dashed border-foreground/10 bg-foreground/5 flex flex-col items-center justify-center cursor-pointer hover:bg-foreground/10 hover:border-primary/30 transition-all group/upload"
                        >
                          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover/upload:scale-110 transition-transform">
                            <Upload className="h-8 w-8 text-primary" />
                          </div>
                          <p className="text-lg font-light text-foreground/60">Drop your image here or <span className="text-primary font-medium">browse</span></p>
                          <p className="text-xs text-foreground/30 mt-2 uppercase tracking-widest">Supports PNG, JPG, WEBP</p>
                        </motion.div>
                      ) : (
                        <div className="w-full space-y-6">
                          <div className="relative w-full max-w-2xl mx-auto aspect-video rounded-2xl overflow-hidden border border-foreground/10 shadow-2xl group/preview">
                            <img src={selectedImage.preview} alt="Selected" className="w-full h-full object-contain bg-black/20" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center gap-4">
                              <Button variant="secondary" size="sm" onClick={() => imageInputRef.current?.click()} className="rounded-full">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Change Image
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => setSelectedImage(null)} className="rounded-full">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove
                              </Button>
                            </div>
                          </div>

                          <div className="flex justify-center">
                            <Button 
                              onClick={handleImageToPrompt}
                              disabled={isGeneratingFromImage}
                              className="bg-primary text-primary-foreground hover:bg-primary/90 px-12 py-7 rounded-full text-lg font-medium shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            >
                              {isGeneratingFromImage ? (
                                <>
                                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                                  Analyzing Visuals...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="mr-2 h-6 w-6" />
                                  Reverse Engineer Prompt
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Tilt>
              </motion.div>

              {/* Image-to-Prompt Results */}
              <AnimatePresence>
                {imageToPromptResult && !isGeneratingFromImage && (
                  <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-12 space-y-8"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="lg:col-span-2 space-y-6">
                        <Card className="glass-card premium-border overflow-hidden">
                          <CardHeader className="border-b border-foreground/5 bg-foreground/5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                  <Code2 className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <CardTitle className="text-lg font-light tracking-tight">Generated Prompt</CardTitle>
                                  <p className="text-xs text-foreground/40 uppercase tracking-widest font-mono">Visual Reconstruction</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {imageToPromptResult.confidence && (
                                  <Badge variant="outline" className={cn(
                                    "text-[10px] uppercase tracking-widest font-mono",
                                    imageToPromptResult.confidence === "Very High" || imageToPromptResult.confidence === "High" 
                                      ? "border-emerald-500/20 text-emerald-500" 
                                      : imageToPromptResult.confidence === "Medium" 
                                        ? "border-amber-500/20 text-amber-500"
                                        : "border-red-500/20 text-red-500"
                                  )}>
                                    {imageToPromptResult.confidence}
                                  </Badge>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => copyToClipboard(imageToPromptResult.generatedPrompt)}
                                  className="rounded-full hover:bg-primary/10 hover:text-primary"
                                >
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copy
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-8 space-y-6">
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-primary font-mono font-bold mb-2">Main Prompt</p>
                              <p className="text-lg text-foreground/90 leading-relaxed font-light whitespace-pre-wrap">
                                {imageToPromptResult.generatedPrompt}
                              </p>
                            </div>
                            {imageToPromptResult.negativePrompt && (
                              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                                <p className="text-[10px] uppercase tracking-widest text-red-400 font-mono font-bold mb-2">Negative Prompt</p>
                                <p className="text-sm text-foreground/70 leading-relaxed font-light">
                                  {imageToPromptResult.negativePrompt}
                                </p>
                              </div>
                            )}
                            <div className="flex gap-4 flex-wrap">
                              <Button 
                                onClick={() => {
                                  setPrompt(imageToPromptResult.generatedPrompt);
                                  setActiveTab('audit');
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="bg-foreground/10 text-foreground hover:bg-foreground/20 rounded-full"
                              >
                                <Zap className="h-4 w-4 mr-2" />
                                Audit this Prompt
                              </Button>
                              <Button 
                                onClick={() => {
                                  setEnhanceInput(imageToPromptResult.generatedPrompt);
                                  setActiveTab('enhance');
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="bg-foreground/10 text-foreground hover:bg-foreground/20 rounded-full"
                              >
                                <Wand2 className="h-4 w-4 mr-2" />
                                Enhance this Prompt
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="lg:col-span-1 space-y-6">
                        <Card className="glass-card premium-border">
                          <CardHeader>
                            <CardTitle className="text-foreground/60 text-xs uppercase tracking-widest font-mono">Visual Analysis</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {imageToPromptResult.visualAnalysis.map((point, idx) => (
                              <div key={idx} className="flex items-start gap-3 p-4 rounded-xl bg-foreground/5 border border-foreground/5">
                                <div className="mt-1">
                                  <Eye className="h-4 w-4 text-primary" />
                                </div>
                                <p className="text-sm text-foreground/80 leading-relaxed">{point}</p>
                              </div>
                            ))}
                          </CardContent>
                        </Card>

                        {(imageToPromptResult.style || imageToPromptResult.camera || imageToPromptResult.lighting || imageToPromptResult.colorPalette) && (
                          <Card className="glass-card premium-border">
                            <CardHeader>
                              <CardTitle className="text-foreground/60 text-xs uppercase tracking-widest font-mono">Technical Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {imageToPromptResult.style && (
                                <div className="p-3 rounded-lg bg-foreground/5">
                                  <p className="text-[10px] uppercase tracking-widest text-primary font-mono mb-1">Style</p>
                                  <p className="text-sm text-foreground/80">{imageToPromptResult.style}</p>
                                </div>
                              )}
                              {imageToPromptResult.camera && (
                                <div className="p-3 rounded-lg bg-foreground/5">
                                  <p className="text-[10px] uppercase tracking-widest text-primary font-mono mb-1">Camera</p>
                                  <p className="text-sm text-foreground/80">{imageToPromptResult.camera}</p>
                                </div>
                              )}
                              {imageToPromptResult.lighting && (
                                <div className="p-3 rounded-lg bg-foreground/5">
                                  <p className="text-[10px] uppercase tracking-widest text-primary font-mono mb-1">Lighting</p>
                                  <p className="text-sm text-foreground/80">{imageToPromptResult.lighting}</p>
                                </div>
                              )}
                              {imageToPromptResult.colorPalette && imageToPromptResult.colorPalette.length > 0 && (
                                <div className="p-3 rounded-lg bg-foreground/5">
                                  <p className="text-[10px] uppercase tracking-widest text-primary font-mono mb-2">Color Palette</p>
                                  <div className="flex flex-wrap gap-2">
                                    {imageToPromptResult.colorPalette.map((color, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs border-foreground/10">
                                        {color}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>
          </Tabs>

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {activeTab === 'audit' && result && !isAnalyzing && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Left Column: Scores */}
              <div className="lg:col-span-1 space-y-6">
                <Tilt>
                  <Card className="glass-card premium-border">
                    <CardHeader>
                      <CardTitle className="text-foreground/60 text-xs uppercase tracking-widest font-mono">Overall Rating</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center pb-8 relative overflow-hidden">
                      <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full -translate-y-1/2" />
                      <div className="text-8xl font-light text-foreground mb-2 relative z-10 text-glow">
                        {result.overallScore}<span className="text-foreground/20 text-4xl">/100</span>
                      </div>
                      <Progress value={result.overallScore} className="h-1.5 bg-foreground/5 relative z-10" />
                    </CardContent>
                  </Card>
                </Tilt>

                <Tilt>
                  <Card className="glass-card premium-border">
                    <CardHeader>
                      <CardTitle className="text-foreground/60 text-xs uppercase tracking-widest font-mono">Criteria Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {(Object.entries(result.criteria) as [keyof AnalysisResult['criteria'], number][]).map(([key, value]) => (
                        <div key={key} className="space-y-2">
                          <div className="flex justify-between items-center text-xs uppercase tracking-wider text-foreground/40">
                            <Tooltip>
                              <TooltipTrigger className="flex items-center gap-1 cursor-help hover:text-foreground/60 transition-colors">
                                <span>{key}</span>
                                <Info className="h-3 w-3" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[200px] bg-foreground text-background border-none p-3 text-xs leading-relaxed">
                                {CRITERIA_DESCRIPTIONS[key]}
                              </TooltipContent>
                            </Tooltip>
                            <span className="text-foreground">{value}/10</span>
                          </div>
                          <Progress value={value * 10} className="h-1 bg-foreground/5" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </Tilt>

                {result.security && (
                  <Tilt>
                    <Card className={cn(
                      "glass-card premium-border transition-all duration-500",
                      !result.security.isSecure ? "border-red-500/20 shadow-[0_0_30px_-12px_rgba(239,68,68,0.2)]" : "border-emerald-500/20 shadow-[0_0_30px_-12px_rgba(16,185,129,0.2)]"
                    )}>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-foreground/60 text-xs uppercase tracking-widest font-mono">Security Audit</CardTitle>
                        {result.security.isSecure ? (
                          <ShieldBadge score={result.security.securityScore} />
                        ) : (
                          <ShieldAlert className="h-4 w-4 text-red-500 animate-pulse" />
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex justify-between items-end">
                          <span className="text-3xl font-light text-foreground">{result.security.securityScore}<span className="text-xs text-foreground/30 ml-1">/100</span></span>
                          <span className={cn(
                            "text-[10px] uppercase tracking-tighter font-bold px-2 py-0.5 rounded-full",
                            result.security.isSecure ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                          )}>
                            {result.security.isSecure ? "Protected" : "Vulnerable"}
                          </span>
                        </div>
                        <Progress 
                          value={result.security.securityScore} 
                          className={cn(
                            "h-1",
                            result.security.isSecure ? "bg-emerald-500/10" : "bg-red-500/10"
                          )}
                        />
                        {result.security.warnings.length > 0 && (
                          <div className="space-y-2 pt-2">
                            {result.security.warnings.map((warning, i) => (
                              <div key={i} className="flex items-center gap-2 text-[10px] text-red-400/80 font-mono">
                                <AlertTriangle className="h-3 w-3" />
                                {warning}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Tilt>
                )}
              </div>

              {/* Right Column: Feedback */}
              <div className="lg:col-span-2 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="glass-card border-red-500/20 premium-border">
                    <CardHeader className="flex flex-row items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-red-400" />
                      <CardTitle className="text-red-400 text-xs uppercase tracking-widest font-mono">Missing Elements</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {result.missingElements.map((item, i) => (
                          <li key={i} className="text-foreground/70 text-sm flex items-start gap-2">
                            <span className="text-red-500/50 mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="glass-card border-emerald-500/20 premium-border">
                    <CardHeader className="flex flex-row items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <CardTitle className="text-emerald-400 text-xs uppercase tracking-widest font-mono">Feedback</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {result.feedback.map((item, i) => (
                          <li key={i} className="text-foreground/70 text-sm flex items-start gap-2">
                            <span className="text-emerald-500/50 mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prompt Reconstruction Section */}
        <AnimatePresence>
          {activeTab === 'audit' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="pt-24 space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-primary" />
                  <h3 className="text-2xl font-light tracking-tight text-foreground">Prompt Reconstruction</h3>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-widest border-primary/20 text-primary/60 font-mono">
                  {optimizedResult ? 'Complete' : result ? 'Ready' : 'Locked'}
                </Badge>
              </div>

              {!result ? (
            <Card className="glass-card premium-border border-dashed p-12 text-center space-y-4 opacity-50">
              <div className="w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center mx-auto">
                <ShieldAlert className="h-8 w-8 text-foreground/20" />
              </div>
              <div className="space-y-1">
                <h4 className="text-foreground/60 font-light">Analysis Required</h4>
                <p className="text-foreground/30 text-xs max-w-xs mx-auto">
                  Audit your prompt above to unlock the professional reconstruction engine.
                </p>
              </div>
            </Card>
          ) : !optimizedResult ? (
            <Card className="glass-card premium-border border-dashed relative overflow-hidden flex flex-col items-center justify-center p-12 text-center space-y-6">
              <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full translate-y-1/2" />
              
              {isOptimizing ? (
                <div className="space-y-8 w-full max-w-md relative z-10">
                  <div className="flex justify-center">
                    <div className="relative">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="w-24 h-24 rounded-full border-2 border-dashed border-primary/30"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Wand2 className="h-8 w-8 text-primary animate-pulse" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between text-[10px] font-mono text-primary/60 uppercase tracking-widest">
                      <span>Reconstructing</span>
                      <motion.span
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        Processing...
                      </motion.span>
                    </div>
                    <div className="h-1 w-full bg-foreground/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        className="h-full bg-primary rich-glow"
                      />
                    </div>
                    <p className="text-foreground/30 text-[10px] font-mono italic">
                      Applying heuristic frameworks & persona injection...
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center relative z-10 rich-glow">
                    <Wand2 className="h-10 w-10 text-primary" />
                  </div>
                  <div className="space-y-2 relative z-10">
                    <h3 className="text-foreground text-2xl font-light tracking-tight">Ready for Perfection?</h3>
                    <p className="text-foreground/50 text-sm max-w-xs mx-auto">
                      Our AI will now reconstruct your prompt using professional engineering techniques based on the audit.
                    </p>
                  </div>
                  <Magnetic>
                    <Button 
                      onClick={handleOptimize}
                      disabled={isOptimizing}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 px-10 py-7 rounded-full text-lg font-medium transition-all hover:scale-105 active:scale-95 rich-glow relative z-10"
                    >
                      Get Optimized Prompt
                      <Sparkles className="ml-2 h-5 w-5" />
                    </Button>
                  </Magnetic>
                </>
              )}
            </Card>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Original Prompt */}
                <Card className="glass-card premium-border relative overflow-hidden opacity-60">
                  <CardHeader className="border-b border-foreground/5 bg-foreground/[0.01]">
                    <CardTitle className="text-foreground/40 text-xs uppercase tracking-widest font-mono">Original Prompt</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <ScrollArea className="h-[250px] w-full rounded-xl border border-foreground/5 bg-background/20 p-6">
                      <p className="text-foreground/60 leading-relaxed font-mono text-xs whitespace-pre-wrap">
                        {originalPromptAtOptimization}
                      </p>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Enhanced Prompt */}
                <Card className="glass-card premium-border relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-primary rich-glow" />
                  <CardHeader className="flex flex-row items-center justify-between border-b border-foreground/5 bg-foreground/[0.01]">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <CardTitle className="text-foreground text-xl font-light tracking-tight">Perfected Portrait</CardTitle>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
                      onClick={() => copyToClipboard(optimizedResult.optimizedPrompt)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <ScrollArea className="h-[250px] w-full rounded-xl border border-foreground/10 bg-background/40 p-6 backdrop-blur-md">
                      <p className="text-foreground/90 leading-relaxed font-mono text-sm whitespace-pre-wrap selection:bg-primary/30">
                        {optimizedResult.optimizedPrompt}
                      </p>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Logic Breakdown */}
              <Card className="glass-card premium-border overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <CardTitle className="text-primary text-xs uppercase tracking-widest font-mono">Logic Breakdown</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {optimizedResult.logicBreakdown.map((point, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary rich-glow shrink-0" />
                        <p className="text-sm text-foreground/70 font-light leading-relaxed">
                          {point}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 flex justify-end">
                    <Button 
                      variant="outline" 
                      className="border-foreground/10 text-foreground/60 hover:bg-foreground/5 hover:text-foreground rounded-full px-6"
                      onClick={() => setPrompt(optimizedResult.optimizedPrompt)}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Use as Base
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>

        {/* Recipe Library Section */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="pt-24 space-y-8"
        >
          <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <h3 className="text-2xl font-light tracking-tight text-foreground">Recipe Library</h3>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-foreground/20 font-mono">Select a framework to apply</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {PROMPT_RECIPES.map((recipe) => (
                  <button
                    key={recipe.id}
                    onClick={() => {
                      setPrompt(recipe.template(prompt || '[Your Task]'));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="glass-card premium-border p-6 text-left group hover:rich-glow transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                        {recipe.icon}
                      </div>
                      <span className="font-medium text-lg text-foreground/90">{recipe.name}</span>
                    </div>
                    <p className="text-sm text-foreground/40 leading-relaxed font-light">
                      {recipe.description}
                    </p>
                  </button>
                ))}
              </div>
            </motion.div>

        {/* Engineering Showcase Section */}
        <motion.div
          id="engineering-showcase"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="pt-24 space-y-16"
        >
          <div className="text-center space-y-4">
                <Badge variant="outline" className="px-4 py-1 border-primary/20 text-primary/60 font-mono tracking-widest uppercase text-[10px] backdrop-blur-md bg-primary/5">
                  Behind the Code
                </Badge>
                <h2 className="text-4xl md:text-6xl font-light tracking-tight text-foreground">
                  Crafted with <span className="italic font-serif">Surgical Precision</span>
                </h2>
                <p className="text-foreground/40 max-w-xl mx-auto text-sm font-light">
                  Our philosophy centers on the intersection of advanced heuristics and ethical AI engineering.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  {
                    icon: <Code2 className="h-6 w-6" />,
                    title: "Top-Tier Engineering",
                    description: "Built by elite developers using a modern stack (React 19, Vite, Tailwind 4) for zero-latency interactions and 8K-ready visuals."
                  },
                  {
                    icon: <Cpu className="h-6 w-6" />,
                    title: "Neural Heuristics",
                    description: "Our analysis engine uses proprietary scoring algorithms that evaluate prompts across 5 critical dimensions with mathematical fairness."
                  },
                  {
                    icon: <Layers className="h-6 w-6" />,
                    title: "Ethical Alignment",
                    description: "Every optimization is designed to be unbiased, transparent, and aligned with the highest standards of AI safety and clarity."
                  }
                ].map((item, i) => (
                  <Card key={i} className="glass-card premium-border group hover:rich-glow transition-all duration-500">
                    <CardHeader className="space-y-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        {item.icon}
                      </div>
                      <CardTitle className="text-lg font-light tracking-tight">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-foreground/40 text-sm leading-relaxed font-light">
                        {item.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="glass-card premium-border overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-12 flex flex-col md:flex-row items-center gap-12">
                  <div className="flex-1 space-y-6">
                    <h3 className="text-3xl font-light tracking-tight">The Pursuit of <span className="text-primary">Fairness</span></h3>
                    <p className="text-foreground/50 leading-relaxed font-light">
                      We believe that AI should be accessible and understandable. By breaking down prompts into transparent criteria, we empower users to see exactly how their commands are interpreted, ensuring a fair and predictable outcome every time.
                    </p>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary font-mono">
                        <Zap className="h-3 w-3" />
                        High Performance
                      </div>
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary font-mono">
                        <ShieldAlert className="h-3 w-3" />
                        Security First
                      </div>
                    </div>
                  </div>
                  <div className="w-full md:w-1/3 aspect-square rounded-2xl bg-foreground/5 border border-foreground/10 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--primary)_0%,_transparent_70%)] opacity-10 animate-pulse" />
                    <Code2 className="h-24 w-24 text-foreground/10 rotate-12" />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-center pt-8">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-foreground/20 hover:text-primary transition-colors font-mono text-[10px] uppercase tracking-widest"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  Back to Top
                </Button>
              </div>
            </motion.div>

        {/* Footer */}
        <div className="pt-12 border-t border-foreground/5 text-center">
          <p className="text-foreground/20 text-[10px] uppercase tracking-[0.3em] font-mono">
            Promptraitz © 2026 • Engineered for Excellence
          </p>
        </div>
      </div>
    </div>
  </TooltipProvider>
  );
}
