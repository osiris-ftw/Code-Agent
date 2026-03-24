import { Button } from '../components/ui/button'
import { Code2, Cpu, Zap, Shield, MessageSquare } from 'lucide-react'

interface LandingPageProps {
  onLogin: () => void
}

export function LandingPage({ onLogin }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Hero Section */}
      <div className="relative overflow-hidden pt-20 pb-32 lg:pt-32 lg:pb-48">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_45%_at_50%_50%,hsl(var(--primary)/0.1)_0%,transparent_100%)]" />
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8 animate-fade-in">
            <Zap className="w-4 h-4 fill-primary" />
            <span>Now powered by GPT-4</span>
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-6 animate-slide-up">
            CloudCodeX <span className="text-primary">AI Assistant</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up [animation-delay:200ms]">
            Expert GPT-4 chat agent embedded directly into your cloud IDE. Generate, explain, debug, and review code in real-time.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up [animation-delay:400ms]">
            <Button size="lg" className="h-12 px-8 text-lg" onClick={onLogin}>
              Get Started for Free
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-lg">
              View Documentation
            </Button>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 py-24 border-t">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard 
            icon={<Code2 className="w-6 h-6" />}
            title="Code Generation"
            description="Write complex snippets or complete files from natural language descriptions."
          />
          <FeatureCard 
            icon={<MessageSquare className="w-6 h-6" />}
            title="Code Explanation"
            description="Understand what any code block does with line-by-line conceptual breakdowns."
          />
          <FeatureCard 
            icon={<Cpu className="w-6 h-6" />}
            title="Real-time Debugging"
            description="Analyze execution output and errors to find bugs and get instant fixes."
          />
          <FeatureCard 
            icon={<Shield className="w-6 h-6" />}
            title="Security Review"
            description="Automatically identify logic errors, performance issues, and security vulnerabilities."
          />
          <FeatureCard 
            icon={<Zap className="w-6 h-6" />}
            title="Multi-Language"
            description="Expertise in 10+ languages including Python, Go, Rust, Java, and C++."
          />
          <FeatureCard 
            icon={<Code2 className="w-6 h-6" />}
            title="IDE Integration"
            description="Deep context awareness of your project structure and current active file."
          />
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-2xl border bg-card hover:shadow-lg transition-all duration-300 group">
      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
}
