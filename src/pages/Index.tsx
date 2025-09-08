import { useState } from 'react';
import { TestSuite } from '@/components/TestSuite';
import { EndpointManager } from '@/components/EndpointManager';
import { TestRunner } from '@/components/TestRunner';
import { PortScanner } from '@/components/PortScanner';
import { ImportExport } from '@/components/ImportExport';
import { ProjectManager } from '@/components/ProjectManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Target, Network, Database, FileUp, FolderOpen } from 'lucide-react';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 bg-card border border-border">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="endpoints" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Endpoints
          </TabsTrigger>
          <TabsTrigger value="scanner" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Scanner
          </TabsTrigger>
          <TabsTrigger value="ports" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Ports
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
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
            <TestRunner />
          </TabsContent>
          
          <TabsContent value="ports" className="space-y-6">
            <PortScanner />
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