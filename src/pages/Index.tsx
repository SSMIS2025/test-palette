import { useState } from 'react';
import { TestSuite } from '@/components/TestSuite';
import { EndpointManager } from '@/components/EndpointManager';
import { TestRunner } from '@/components/TestRunner';
import { PortScanner } from '@/components/PortScanner';
import { ImportExport } from '@/components/ImportExport';
import { ProjectManager } from '@/components/ProjectManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Target, Network, Database, FileUp, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isScannerRunning, setIsScannerRunning] = useState(false);
  const [isPortScannerRunning, setIsPortScannerRunning] = useState(false);

  const handleTabChange = (value: string) => {
    if (isScannerRunning && value !== 'scanner') {
      toast.error('Scanner is running', {
        description: 'Please stop or pause the scanner before navigating to other tabs.'
      });
      return;
    }
    if (isPortScannerRunning && value !== 'ports') {
      toast.error('Port Scanner is running', {
        description: 'Please stop or pause the port scanner before navigating to other tabs.'
      });
      return;
    }
    setActiveTab(value);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-primary animate-pulse-glow" />
          <h1 className="text-3xl font-bold bg-gradient-cyber bg-clip-text text-transparent">
            VulnScan Pro
          </h1>
        </div>
        <p className="text-muted-foreground font-mono">
          Advanced Vulnerability Testing Suite & Security Scanner
        </p>
      </header>

      {/* Main Interface */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-6 bg-card border border-border">
          <TabsTrigger value="dashboard" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Shield className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FolderOpen className="h-4 w-4" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="endpoints" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Target className="h-4 w-4" />
            Endpoints
          </TabsTrigger>
          <TabsTrigger value="scanner" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Network className="h-4 w-4" />
            Scanner
          </TabsTrigger>
          <TabsTrigger value="ports" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Database className="h-4 w-4" />
            Ports
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FileUp className="h-4 w-4" />
            Import/Export
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="dashboard" className="space-y-6">
            <TestSuite />
          </TabsContent>
          
          <TabsContent value="projects" className="space-y-6">
            <ProjectManager onProjectSelect={() => {}} />
          </TabsContent>
          
          <TabsContent value="endpoints" className="space-y-6">
            <EndpointManager />
          </TabsContent>
          
          <TabsContent value="scanner" className="space-y-6">
            <TestRunner onScanningStateChange={setIsScannerRunning} />
          </TabsContent>
          
          <TabsContent value="ports" className="space-y-6">
            <PortScanner onScanningStateChange={setIsPortScannerRunning} />
          </TabsContent>
          
          <TabsContent value="import" className="space-y-6">
            <ImportExport />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default Index;