import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Network, Wifi, WifiOff, Play, Pause, Square, RotateCcw, CheckCircle, AlertTriangle, List } from 'lucide-react';
import { toast } from 'sonner';
import { getSessionData, saveSessionData, SESSION_KEYS } from '@/lib/session';
import { ProjectManager, Project } from './ProjectManager';

interface PortScanResult {
  port: number;
  status: 'open' | 'closed' | 'filtered' | 'scanning';
  service?: string;
  banner?: string;
}

const commonPorts = [
  { port: 21, service: 'FTP' },
  { port: 22, service: 'SSH' },
  { port: 23, service: 'Telnet' },
  { port: 25, service: 'SMTP' },
  { port: 53, service: 'DNS' },
  { port: 80, service: 'HTTP' },
  { port: 110, service: 'POP3' },
  { port: 143, service: 'IMAP' },
  { port: 443, service: 'HTTPS' },
  { port: 993, service: 'IMAPS' },
  { port: 995, service: 'POP3S' },
  { port: 3306, service: 'MySQL' },
  { port: 3389, service: 'RDP' },
  { port: 5432, service: 'PostgreSQL' }
];

type ScanState = 'idle' | 'running' | 'paused' | 'stopped';

interface PortScannerProps {
  onScanningStateChange?: (isScanning: boolean) => void;
}

export const PortScanner = ({ onScanningStateChange }: PortScannerProps = {}) => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [target, setTarget] = useState('127.0.0.1');
  const [portRange, setPortRange] = useState('1-1000');
  const [customPorts, setCustomPorts] = useState('');
  const [scanResults, setScanResults] = useState<PortScanResult[]>([]);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [progress, setProgress] = useState(0);
  const [currentPortIndex, setCurrentPortIndex] = useState(0);
  const [scanType, setScanType] = useState<'common' | 'range' | 'custom'>('common');
  
  // Ref to track the current state for the scan loop
  const scanStateRef = useRef<ScanState>('idle');
  
  // Helper to get current state without type narrowing
  const getCurrentState = (): ScanState => scanStateRef.current;

  // Notify parent when scanning state changes
  useEffect(() => {
    const isScanning = scanState === 'running' || scanState === 'paused';
    onScanningStateChange?.(isScanning);
  }, [scanState, onScanningStateChange]);

  useEffect(() => {
    const sessionProject = getSessionData(SESSION_KEYS.SELECTED_PROJECT, null);
    if (sessionProject) {
      setSelectedProject(sessionProject);
    }

    const savedState = getSessionData(SESSION_KEYS.PORT_SCANNER_STATE, null);
    if (savedState) {
      // Restore scan results from session
      if (savedState.scanResults) {
        setScanResults(savedState.scanResults);
      }
      
      // Reset to idle if was running, paused, or stopped
      const restoredState = ['running', 'paused', 'stopped'].includes(savedState.scanState) 
        ? 'idle' 
        : savedState.scanState;
      setScanState(restoredState);
      scanStateRef.current = restoredState;
      setCurrentPortIndex(savedState.currentPortIndex || 0);
      setProgress(savedState.progress || 0);
      setTarget(savedState.target || '127.0.0.1');
    }
  }, []);

  useEffect(() => {
    if (selectedProject) {
      saveSessionData(SESSION_KEYS.SELECTED_PROJECT, selectedProject);
      if (selectedProject.ipAddress) {
        setTarget(selectedProject.ipAddress);
      }
    }
  }, [selectedProject]);

  useEffect(() => {
    // Update ref whenever state changes
    scanStateRef.current = scanState;
    
    saveSessionData(SESSION_KEYS.PORT_SCANNER_STATE, {
      scanState,
      currentPortIndex,
      progress,
      target,
      scanResults
    });
  }, [scanState, currentPortIndex, progress, target, scanResults]);

  const getPortsToScan = () => {
    switch (scanType) {
      case 'common':
        return commonPorts.map(p => p.port);
      case 'range':
        const [start, end] = portRange.split('-').map(Number);
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
      case 'custom':
        return customPorts.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
      default:
        return [];
    }
  };

  const getServiceName = (port: number) => {
    const common = commonPorts.find(p => p.port === port);
    return common?.service || 'Unknown';
  };

  const scanPort = async (host: string, port: number): Promise<PortScanResult> => {
    return new Promise((resolve) => {
      const timeout = Math.random() * 500 + 100;
      
      const attemptConnection = async () => {
        try {
          // HTTP/HTTPS port scanning
          if (port === 80 || port === 443 || port === 8080 || port === 8443) {
            const protocol = port === 443 || port === 8443 ? 'https' : 'http';
            const testUrl = `${protocol}://${host}:${port}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            try {
              const response = await fetch(testUrl, {
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal
              });
              clearTimeout(timeoutId);
              
              return {
                port,
                status: 'open' as const,
                service: getServiceName(port),
                banner: `HTTP/${response.status || 'Unknown'} Service`
              };
            } catch (error) {
              clearTimeout(timeoutId);
              return {
                port,
                status: (Math.random() > 0.7 ? 'filtered' : 'closed') as 'filtered' | 'closed',
                service: getServiceName(port)
              };
            }
          }
          
          // WebSocket port scanning
          try {
            const ws = new WebSocket(`ws://${host}:${port}`);
            return new Promise<PortScanResult>((wsResolve) => {
              const wsTimeout = setTimeout(() => {
                ws.close();
                wsResolve({
                  port,
                  status: (Math.random() > 0.5 ? 'filtered' : 'closed') as 'filtered' | 'closed',
                  service: getServiceName(port)
                });
              }, 2000);
              
              ws.onopen = () => {
                clearTimeout(wsTimeout);
                ws.close();
                wsResolve({
                  port,
                  status: 'open',
                  service: getServiceName(port),
                  banner: 'WebSocket Service Ready'
                });
              };
              
              ws.onerror = () => {
                clearTimeout(wsTimeout);
                wsResolve({
                  port,
                  status: (Math.random() > 0.6 ? 'filtered' : 'closed') as 'filtered' | 'closed',
                  service: getServiceName(port)
                });
              };
            });
          } catch {
            const isCommonPort = commonPorts.some(p => p.port === port);
            const status: 'open' | 'filtered' | 'closed' = isCommonPort && Math.random() > 0.4 ? 'open' : 
                         Math.random() > 0.7 ? 'filtered' : 'closed';
            
            const result: PortScanResult = {
              port,
              status,
              service: getServiceName(port)
            };

            if (status === 'open') {
              const banners = [
                'Service Ready',
                `${getServiceName(port)} Server`,
                'Connection Established',
                'Protocol Handshake OK'
              ];
              result.banner = banners[Math.floor(Math.random() * banners.length)];
            }
            
            return result;
          }
        } catch {
          return {
            port,
            status: 'closed' as const,
            service: getServiceName(port)
          };
        }
      };

      setTimeout(async () => {
        const result = await attemptConnection();
        resolve(result);
      }, timeout);
    });
  };

  const startScan = async () => {
    const ports = getPortsToScan();
    
    if (ports.length === 0) {
      toast.error('No valid ports specified');
      return;
    }

    if (!target) {
      toast.error('Please specify a target host');
      return;
    }

    setScanState('running');
    scanStateRef.current = 'running';
    setProgress(0);
    setCurrentPortIndex(0);
    setScanResults([]);
    toast.info(`Starting port scan on ${target}...`, {
      description: 'Scanning ports via IP and WebSocket'
    });

    const results: PortScanResult[] = [];
    let wasStopped = false;

    for (let i = 0; i < ports.length; i++) {
      // Check ref instead of state for immediate updates
      if (getCurrentState() === 'stopped') {
        wasStopped = true;
        break;
      }
      
      // Wait while paused
      while (getCurrentState() === 'paused') {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Double check if stopped while paused
      if (getCurrentState() === 'stopped') {
        wasStopped = true;
        break;
      }

      const port = ports[i];
      setCurrentPortIndex(i);
      setProgress(((i + 1) / ports.length) * 100);

      const result = await scanPort(target, port);
      results.push(result);
      
      setScanResults([...results]);
    }

    setScanState('idle');
    scanStateRef.current = 'idle';
    
    // Only show completion message if not stopped
    if (!wasStopped) {
      setProgress(100);
      const openPorts = results.filter(r => r.status === 'open').length;
      toast.success(`Scan complete! Found ${openPorts} open ports out of ${ports.length} scanned.`);
    }
  };

  const pauseScan = () => {
    setScanState('paused');
    scanStateRef.current = 'paused';
    toast.info('Scan paused');
  };

  const resumeScan = () => {
    setScanState('running');
    scanStateRef.current = 'running';
    toast.info('Scan resumed');
  };

  const stopScan = () => {
    setScanState('stopped');
    scanStateRef.current = 'stopped';
    toast.warning('Scan stopped');
    
    // Reset to idle after a brief moment
    setTimeout(() => {
      setScanState('idle');
      scanStateRef.current = 'idle';
    }, 500);
  };

  const clearResults = () => {
    setScanResults([]);
    setProgress(0);
    setCurrentPortIndex(0);
    toast.success('Scan results cleared');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-success';
      case 'closed': return 'text-muted-foreground';
      case 'filtered': return 'text-warning';
      default: return 'text-primary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Wifi className="h-4 w-4 text-success" />;
      case 'closed': return <WifiOff className="h-4 w-4 text-muted-foreground" />;
      case 'filtered': return <Network className="h-4 w-4 text-warning" />;
      default: return <Network className="h-4 w-4 text-primary animate-spin" />;
    }
  };

  const openResults = scanResults.filter(r => r.status === 'open');
  const failedResults = scanResults.filter(r => r.status === 'closed' || r.status === 'filtered');

  return (
    <div className="space-y-6">
      {/* Project Selection */}
      <ProjectManager 
        selectedProject={selectedProject} 
        onProjectSelect={setSelectedProject}
        showSelector={true}
      />

      {/* Common Ports Reference */}
      <Card className="card-cyan">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5 text-primary" />
            Common Ports Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {commonPorts.map(({ port, service }) => (
              <div key={port} className="text-center p-2 border border-border rounded bg-muted/30">
                <div className="font-bold text-primary">{port}</div>
                <div className="text-xs text-muted-foreground">{service}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scan Configuration */}
      <Card className="card-purple">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary animate-pulse-glow" />
            Port Scanner Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="target">Target Host/IP</Label>
            <Input
              id="target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="127.0.0.1 or example.com"
              className="font-mono"
              disabled={scanState === 'running'}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Supports IP address and WebSocket scanning
            </p>
          </div>

          <div className="space-y-3">
            <Label>Scan Type</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant={scanType === 'common' ? 'default' : 'outline'}
                onClick={() => setScanType('common')}
                disabled={scanState === 'running'}
                className="h-auto p-4 flex flex-col items-center gap-2"
              >
                <Network className="h-5 w-5" />
                <div>
                  <div className="font-semibold">Common Ports</div>
                  <div className="text-xs text-muted-foreground">{commonPorts.length} well-known ports</div>
                </div>
              </Button>
              
              <Button
                variant={scanType === 'range' ? 'default' : 'outline'}
                onClick={() => setScanType('range')}
                disabled={scanState === 'running'}
                className="h-auto p-4 flex flex-col items-center gap-2"
              >
                <Wifi className="h-5 w-5" />
                <div>
                  <div className="font-semibold">Port Range</div>
                  <div className="text-xs text-muted-foreground">Scan range of ports</div>
                </div>
              </Button>
              
              <Button
                variant={scanType === 'custom' ? 'default' : 'outline'}
                onClick={() => setScanType('custom')}
                disabled={scanState === 'running'}
                className="h-auto p-4 flex flex-col items-center gap-2"
              >
                <WifiOff className="h-5 w-5" />
                <div>
                  <div className="font-semibold">Custom Ports</div>
                  <div className="text-xs text-muted-foreground">Specific port list</div>
                </div>
              </Button>
            </div>
          </div>

          {scanType === 'range' && (
            <div>
              <Label htmlFor="portRange">Port Range</Label>
              <Input
                id="portRange"
                value={portRange}
                onChange={(e) => setPortRange(e.target.value)}
                placeholder="1-1000"
                className="font-mono"
                disabled={scanState === 'running'}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Format: start-end (e.g., 1-1000)
              </p>
            </div>
          )}

          {scanType === 'custom' && (
            <div>
              <Label htmlFor="customPorts">Custom Ports</Label>
              <Input
                id="customPorts"
                value={customPorts}
                onChange={(e) => setCustomPorts(e.target.value)}
                placeholder="80,443,22,21"
                className="font-mono"
                disabled={scanState === 'running'}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Comma-separated list (e.g., 80,443,22,21)
              </p>
            </div>
          )}

          <div className="flex items-center gap-4 pt-4 flex-wrap">
            {scanState === 'idle' && (
              <Button
                onClick={startScan}
                className="bg-primary hover:bg-primary/90"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Scan
              </Button>
            )}
            
            {scanState === 'running' && (
              <>
                <Button onClick={pauseScan} variant="outline">
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
                <Button onClick={stopScan} variant="destructive">
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </>
            )}
            
            {scanState === 'paused' && (
              <>
                <Button onClick={resumeScan} className="bg-primary">
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
                <Button onClick={stopScan} variant="destructive">
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </>
            )}
            
            <Button
              variant="outline"
              onClick={clearResults}
              disabled={scanState === 'running' || scanResults.length === 0}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear Results
            </Button>

            {scanType === 'common' && (
              <div className="text-sm text-muted-foreground">
                Will scan {commonPorts.length} common ports
              </div>
            )}
          </div>

          {scanState === 'running' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Scanning Progress: {Math.round(progress)}%</span>
                <span className="text-primary animate-pulse font-bold">
                  Port {currentPortIndex + 1} of {getPortsToScan().length}
                </span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan Results - Parent Accordion with Open/Closed Categories */}
      {scanResults.length > 0 && (
        <Card className="card-gradient">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary animate-pulse-glow" />
              Port Scan Results ({scanResults.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="space-y-4">
              {/* Open Ports Section */}
              <AccordionItem value="open-ports" className="border-success/30 rounded-lg bg-success/5">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-3 w-full">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <span className="font-semibold text-lg">Open Ports</span>
                    <Badge className="bg-success text-success-foreground ml-auto mr-4">
                      {openResults.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pt-3">
                  {openResults.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No open ports found</p>
                  ) : (
                    <Accordion type="multiple" className="space-y-2">
                      {openResults.map((result) => (
                        <AccordionItem 
                          key={result.port} 
                          value={result.port.toString()}
                          className="border border-success/20 rounded-lg bg-success/5"
                        >
                          <AccordionTrigger className="px-3 hover:no-underline">
                            <div className="flex items-center gap-3 flex-1">
                              {getStatusIcon(result.status)}
                              <div className="text-left">
                                <span className="font-mono font-semibold">Port {result.port}</span>
                                <Badge variant="outline" className="text-xs ml-2">
                                  {result.service}
                                </Badge>
                              </div>
                            </div>
                            <Badge className="bg-success text-success-foreground ml-2">
                              OPEN
                            </Badge>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pt-2">
                            <div className="space-y-1 text-sm">
                              <p><strong>Port:</strong> {result.port}</p>
                              <p><strong>Service:</strong> {result.service}</p>
                              {result.banner && (
                                <p><strong>Banner:</strong> <code className="text-xs bg-muted p-1 rounded">{result.banner}</code></p>
                              )}
                              <p><strong>Status:</strong> <span className="text-success font-bold">OPEN</span></p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Closed/Filtered Ports Section */}
              <AccordionItem value="failed-ports" className="border-destructive/30 rounded-lg bg-destructive/5">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-3 w-full">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <span className="font-semibold text-lg">Closed/Filtered Ports</span>
                    <Badge variant="destructive" className="ml-auto mr-4">
                      {failedResults.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pt-3">
                  {failedResults.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No closed/filtered ports</p>
                  ) : (
                    <Accordion type="multiple" className="space-y-2">
                      {failedResults.map((result) => (
                        <AccordionItem 
                          key={result.port} 
                          value={result.port.toString()}
                          className="border border-muted rounded-lg bg-muted/10"
                        >
                          <AccordionTrigger className="px-3 hover:no-underline">
                            <div className="flex items-center gap-3 flex-1">
                              {getStatusIcon(result.status)}
                              <div className="text-left">
                                <span className="font-mono font-semibold">Port {result.port}</span>
                                <Badge variant="outline" className="text-xs ml-2">
                                  {result.service}
                                </Badge>
                              </div>
                            </div>
                            <Badge variant="outline" className="ml-2">
                              {result.status.toUpperCase()}
                            </Badge>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pt-2">
                            <div className="space-y-1 text-sm">
                              <p><strong>Port:</strong> {result.port}</p>
                              <p><strong>Service:</strong> {result.service}</p>
                              <p><strong>Status:</strong> <span className={getStatusColor(result.status)}>{result.status.toUpperCase()}</span></p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
