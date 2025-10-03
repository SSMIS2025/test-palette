import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Play, Pause, Square, RotateCcw, Zap, AlertTriangle, CheckCircle, Clock, Download, Settings, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { getStoredData, saveStoredData } from '@/lib/storage';
import { getSessionData, saveSessionData, SESSION_KEYS } from '@/lib/session';
import { ProjectManager, Project } from './ProjectManager';
import axios from 'axios';

interface Endpoint {
  id: string;
  name: string;
  url: string;
  method: string;
  headers?: string;
  body?: string;
  priority: string;
  projectId: string;
  expectedStatusCode?: number;
  expectedContent?: string;
}

interface TestResult {
  id: string;
  endpointName: string;
  url: string;
  method: string;
  status: 'pass' | 'fail' | 'error';
  vulnerabilities: string[];
  responseTime?: number;
  statusCode?: number;
  timestamp: string;
  projectId: string;
  actualContent?: string;
}

interface TestConfig {
  projectId: string;
  expectedContent: string;
  checkContent: boolean;
}

type TestState = 'idle' | 'running' | 'paused' | 'stopped';

export const TestRunner = () => {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testState, setTestState] = useState<TestState>('idle');
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [testConfig, setTestConfig] = useState<TestConfig>({
    projectId: '',
    expectedContent: '',
    checkContent: false
  });
  const [showConfig, setShowConfig] = useState(false);
  const [summary, setSummary] = useState({ total: 0, pass: 0, fail: 0, notStarted: 0 });
  
  // Ref to track the current state for the test loop
  const testStateRef = useRef<TestState>('idle');
  
  // Helper to get current state without type narrowing
  const getCurrentState = (): TestState => testStateRef.current;

  useEffect(() => {
    const storedEndpoints = getStoredData('endpoints', []);
    const storedProjects = getStoredData('projects', []);
    const sessionProject = getSessionData(SESSION_KEYS.SELECTED_PROJECT, null);
    
    setEndpoints(storedEndpoints);
    setProjects(storedProjects);
    
    if (sessionProject) {
      const project = storedProjects.find((p: Project) => p.id === sessionProject.id);
      if (project) setSelectedProject(project);
    }

    // Restore session state including test results
    const savedState = getSessionData(SESSION_KEYS.SCANNER_STATE, null);
    if (savedState) {
      // Restore test results from session
      if (savedState.testResults) {
        setTestResults(savedState.testResults);
      }
      
      // Reset to idle if was running, paused, or stopped
      const restoredState = ['running', 'paused', 'stopped'].includes(savedState.testState) 
        ? 'idle' 
        : savedState.testState;
      setTestState(restoredState);
      testStateRef.current = restoredState;
      setCurrentTestIndex(savedState.currentTestIndex || 0);
      setProgress(savedState.progress || 0);
    }
  }, []);

  useEffect(() => {
    if (selectedProject) {
      saveSessionData(SESSION_KEYS.SELECTED_PROJECT, selectedProject);
    }
  }, [selectedProject]);

  useEffect(() => {
    // Update ref whenever state changes
    testStateRef.current = testState;
    
    // Save scanner state to session including test results
    saveSessionData(SESSION_KEYS.SCANNER_STATE, {
      testState,
      currentTestIndex,
      progress,
      testResults
    });
  }, [testState, currentTestIndex, progress, testResults]);

  useEffect(() => {
    // Update summary stats
    const projectEndpoints = getProjectEndpoints();
    const projectResults = testResults.filter(r => r.projectId === selectedProject?.id);
    setSummary({
      total: projectEndpoints.length,
      pass: projectResults.filter(r => r.status === 'pass').length,
      fail: projectResults.filter(r => r.status === 'fail' || r.status === 'error').length,
      notStarted: Math.max(0, projectEndpoints.length - projectResults.length)
    });
  }, [endpoints, testResults, selectedProject]);

  const saveResults = (newResults: TestResult[]) => {
    setTestResults(newResults);
    saveStoredData('testResults', newResults);
  };

  const getProjectEndpoints = () => {
    if (!selectedProject) return [];
    return endpoints.filter(ep => ep.projectId === selectedProject.id);
  };

  const getFilteredEndpoints = () => {
    const projectEndpoints = getProjectEndpoints();
    if (searchQuery.trim() === '') return projectEndpoints;
    
    return projectEndpoints.filter(endpoint =>
      endpoint.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      endpoint.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      endpoint.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
      endpoint.priority.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const replaceIPAddress = (url: string, projectIP?: string) => {
    if (!projectIP || !projectIP.trim()) return url;
    
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        if (!urlObj.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) || urlObj.hostname !== projectIP) {
          urlObj.hostname = projectIP;
        }
        return urlObj.toString();
      }
      
      if (url.includes('://')) {
        return url;
      }
      
      const domainPortPath = url.split('/');
      const domainPort = domainPortPath[0];
      const pathPart = domainPortPath.slice(1).join('/');
      
      let newDomainPort;
      if (domainPort.includes(':')) {
        const [, port] = domainPort.split(':');
        newDomainPort = `${projectIP}:${port}`;
      } else {
        newDomainPort = projectIP;
      }
      
      return pathPart ? `${newDomainPort}/${pathPart}` : newDomainPort;
      
    } catch (error) {
      console.warn('Error replacing IP address:', error);
      return url;
    }
  };

  const runSingleTest = async (endpoint: Endpoint): Promise<TestResult> => {
    const startTime = Date.now();
    setCurrentTest(endpoint.id);
    
    try {
      const finalUrl = replaceIPAddress(endpoint.url, selectedProject?.ipAddress);
      
      let headers = {};
      if (endpoint.headers) {
        try {
          headers = JSON.parse(endpoint.headers);
        } catch (e) {
          console.warn('Invalid headers JSON:', endpoint.headers);
        }
      }

      const targetUrl = finalUrl.startsWith('http') ? finalUrl : `https://${finalUrl}`;
      
      const proxyServices = [
        'https://api.codetabs.com/v1/proxy?quest=',
        'https://cors-anywhere.herokuapp.com/',
        'https://api.allorigins.win/raw?url='
      ];
      
      let requestUrl = targetUrl;
      if (!targetUrl.includes(window.location.hostname)) {
        requestUrl = `${proxyServices[2]}${encodeURIComponent(targetUrl)}`;
      }

      const config: any = {
        method: endpoint.method.toLowerCase(),
        url: requestUrl,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VulnScan-Pro/1.0',
          'Accept': '*/*',
          ...headers
        },
        timeout: 10000,
        validateStatus: () => true,
        maxRedirects: 3,
        withCredentials: false
      };

      if (['post', 'put', 'patch'].includes(config.method) && endpoint.body) {
        try {
          config.data = JSON.parse(endpoint.body);
        } catch (e) {
          config.data = endpoint.body;
        }
      }

      const response = await axios(config);
      const responseTime = Date.now() - startTime;
      const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

      let status: 'pass' | 'fail' | 'error' = 'pass';
      const vulnerabilities = [];

      if (endpoint.expectedStatusCode && response.status !== endpoint.expectedStatusCode) {
        status = 'fail';
        vulnerabilities.push(`Expected status ${endpoint.expectedStatusCode}, got ${response.status}`);
      }

      if (testConfig.checkContent && testConfig.expectedContent) {
        if (!responseText.includes(testConfig.expectedContent)) {
          status = 'fail';
          vulnerabilities.push(`Expected content "${testConfig.expectedContent}" not found in response`);
        }
      }

      if (!response.headers['x-content-type-options']) {
        vulnerabilities.push('Missing X-Content-Type-Options header');
      }
      if (!response.headers['x-frame-options']) {
        vulnerabilities.push('Missing X-Frame-Options header');
      }
      if (!response.headers['x-xss-protection']) {
        vulnerabilities.push('Missing X-XSS-Protection header');
      }
      if (!response.headers['strict-transport-security'] && endpoint.url.startsWith('https:')) {
        vulnerabilities.push('Missing Strict-Transport-Security header');
      }
      
      if (response.status >= 500) {
        vulnerabilities.push('Server Error - Potential Information Disclosure');
      }
      
      if (responseText.includes('mysql_') || responseText.includes('ORA-') || responseText.includes('SQLException')) {
        vulnerabilities.push('Potential SQL Error Information Disclosure');
      }

      return {
        id: `${endpoint.id}_${Date.now()}`,
        endpointName: endpoint.name,
        url: endpoint.url,
        method: endpoint.method,
        status,
        vulnerabilities,
        responseTime,
        statusCode: response.status,
        timestamp: new Date().toISOString(),
        projectId: endpoint.projectId,
        actualContent: responseText.substring(0, 500)
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return {
        id: `${endpoint.id}_${Date.now()}`,
        endpointName: endpoint.name,
        url: endpoint.url,
        method: endpoint.method,
        status: 'error',
        vulnerabilities: [`Connection Error: ${error.message}`],
        responseTime,
        statusCode: 0,
        timestamp: new Date().toISOString(),
        projectId: endpoint.projectId
      };
    }
  };

  const runAllTests = async () => {
    const projectEndpoints = getProjectEndpoints();
    
    if (projectEndpoints.length === 0) {
      toast.error('No endpoints found for selected project. Add endpoints first.');
      return;
    }

    if (!selectedProject) {
      toast.error('Please select a project first.');
      return;
    }

    setTestState('running');
    testStateRef.current = 'running';
    setProgress(0);
    setCurrentTestIndex(0);
    toast.info(`Starting tests for project: ${selectedProject.name}`, {
      description: 'Tests are being validated in the background'
    });

    const newResults: TestResult[] = [];
    let wasStopped = false;

    for (let i = 0; i < projectEndpoints.length; i++) {
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

      const endpoint = projectEndpoints[i];
      setCurrentTest(endpoint.id);
      setCurrentTestIndex(i);
      setProgress(((i + 1) / projectEndpoints.length) * 100);

      const result = await runSingleTest(endpoint);
      newResults.push(result);

      const allResults = [...testResults, ...newResults];
      saveResults(allResults);
    }

    setCurrentTest(null);
    setTestState('idle');
    testStateRef.current = 'idle';
    
    // Only show completion message if not stopped
    if (!wasStopped) {
      setProgress(100);
      const passCount = newResults.filter(r => r.status === 'pass').length;
      const failCount = newResults.filter(r => r.status === 'fail' || r.status === 'error').length;
      
      if (failCount > 0) {
        toast.error(`Tests complete! ${passCount} passed, ${failCount} failed.`);
      } else {
        toast.success(`All ${passCount} tests passed!`);
      }
    }
  };

  const runSingleEndpointTest = async (endpoint: Endpoint) => {
    setTestState('running');
    toast.info(`Testing ${endpoint.name}...`);

    const result = await runSingleTest(endpoint);
    const updatedResults = [...testResults, result];
    saveResults(updatedResults);

    setTestState('idle');
    setCurrentTest(null);

    if (result.status === 'fail' || result.status === 'error') {
      toast.error(`Test failed: ${result.vulnerabilities.join(', ')}`);
    } else {
      toast.success('Test passed!');
    }
  };

  const pauseTests = () => {
    setTestState('paused');
    testStateRef.current = 'paused';
    toast.info('Tests paused');
  };

  const resumeTests = () => {
    setTestState('running');
    testStateRef.current = 'running';
    toast.info('Tests resumed');
  };

  const stopTests = () => {
    setTestState('stopped');
    testStateRef.current = 'stopped';
    setCurrentTest(null);
    toast.warning('Tests stopped');
    
    // Reset to idle after a brief moment
    setTimeout(() => {
      setTestState('idle');
      testStateRef.current = 'idle';
    }, 500);
  };

  const clearResults = () => {
    setTestResults([]);
    saveStoredData('testResults', []);
    toast.success('Test results cleared');
  };

  const downloadResultsCSV = () => {
    const projectResults = testResults.filter(r => !selectedProject || r.projectId === selectedProject.id);
    
    if (projectResults.length === 0) {
      toast.error('No results to export for selected project');
      return;
    }

    const headers = ['Project', 'Endpoint Name', 'URL', 'Method', 'Status', 'Vulnerabilities', 'Response Time (ms)', 'Status Code', 'Timestamp'];
    const csvContent = [
      headers.join(','),
      ...projectResults.map(result => {
        const project = projects.find(p => p.id === result.projectId);
        return [
          `"${project?.name || 'Unknown'}"`,
          `"${result.endpointName}"`,
          `"${result.url}"`,
          result.method,
          result.status,
          `"${result.vulnerabilities ? result.vulnerabilities.join('; ') : ''}"`,
          result.responseTime || 0,
          result.statusCode || 'N/A',
          `"${new Date(result.timestamp).toLocaleString()}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `test-results-${selectedProject?.name || 'all'}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Test results exported successfully!');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'fail': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'running': return <Clock className="h-4 w-4 text-warning animate-spin" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const projectResults = testResults.filter(r => !selectedProject || r.projectId === selectedProject.id);
  const passResults = projectResults.filter(r => r.status === 'pass');
  const failResults = projectResults.filter(r => r.status === 'fail' || r.status === 'error');

  return (
    <div className="space-y-6">
      {/* Project Selection */}
      <ProjectManager 
        selectedProject={selectedProject} 
        onProjectSelect={setSelectedProject}
        showSelector={true}
      />

      {/* Test Summary Stats */}
      {selectedProject && (
        <Card className="card-cyan">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary animate-pulse-glow" />
              Test Suite Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border border-border rounded-lg bg-primary/10">
                <div className="text-3xl font-bold text-primary">{summary.total}</div>
                <div className="text-sm text-muted-foreground">Total Tests</div>
              </div>
              <div className="text-center p-4 border border-border rounded-lg bg-success/10">
                <div className="text-3xl font-bold text-success">{summary.pass}</div>
                <div className="text-sm text-muted-foreground">Pass</div>
              </div>
              <div className="text-center p-4 border border-border rounded-lg bg-destructive/10">
                <div className="text-3xl font-bold text-destructive">{summary.fail}</div>
                <div className="text-sm text-muted-foreground">Fail</div>
              </div>
              <div className="text-center p-4 border border-border rounded-lg bg-muted/30">
                <div className="text-3xl font-bold text-muted-foreground">{summary.notStarted}</div>
                <div className="text-sm text-muted-foreground">Not Started</div>
              </div>
            </div>
            {testState === 'running' && (
              <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                <p className="text-sm font-bold text-warning">
                  🔄 Test cases are being validated in the background...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Test Configuration */}
      <Card className="card-purple">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Test Configuration
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
            >
              {showConfig ? 'Hide' : 'Show'} Config
            </Button>
          </CardTitle>
        </CardHeader>
        {showConfig && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="expectedContent">Expected Content Check</Label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={testConfig.checkContent}
                  onChange={(e) => setTestConfig({...testConfig, checkContent: e.target.checked})}
                  className="rounded"
                />
                <span className="text-sm">Enable content verification</span>
              </div>
              {testConfig.checkContent && (
                <Textarea
                  placeholder="Enter expected content to find in responses..."
                  value={testConfig.expectedContent}
                  onChange={(e) => setTestConfig({...testConfig, expectedContent: e.target.value})}
                  rows={2}
                />
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Configure test criteria to determine PASS/FAIL results. Tests will also check for security vulnerabilities.
            </div>
          </CardContent>
        )}
      </Card>

      {/* Test Controls */}
      <Card className="card-blue">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary animate-pulse-glow" />
            Test Suite Runner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            {testState === 'idle' && (
              <Button
                onClick={runAllTests}
                disabled={!selectedProject || getProjectEndpoints().length === 0}
                className="bg-primary hover:bg-primary/90"
              >
                <Play className="h-4 w-4 mr-2" />
                Run All Tests
              </Button>
            )}
            
            {testState === 'running' && (
              <>
                <Button onClick={pauseTests} variant="outline">
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
                <Button onClick={stopTests} variant="destructive">
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </>
            )}
            
            {testState === 'paused' && (
              <>
                <Button onClick={resumeTests} className="bg-primary">
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
                <Button onClick={stopTests} variant="destructive">
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </>
            )}
            
            <Button
              variant="outline"
              onClick={clearResults}
              disabled={testState === 'running' || projectResults.length === 0}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear Results
            </Button>

            <Button
              variant="outline"
              onClick={downloadResultsCSV}
              disabled={testState === 'running' || projectResults.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>

            <div className="text-sm text-muted-foreground">
              {selectedProject ? `${getProjectEndpoints().length} endpoint(s) in ${selectedProject.name}` : 'No project selected'}
            </div>
          </div>

          {testState === 'running' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress: {Math.round(progress)}%</span>
                {currentTest && (
                  <span className="text-primary animate-pulse font-bold">
                    Testing endpoint {currentTestIndex + 1} of {getProjectEndpoints().length}...
                  </span>
                )}
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual Endpoint Tests */}
      <Card className="card-green">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              Individual Run Test
            </div>
            {testState === 'running' && currentTest && (
              <Badge variant="secondary" className="text-sm">
                Running: {currentTestIndex + 1} / {getProjectEndpoints().length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {getProjectEndpoints().length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {selectedProject ? 'No endpoints in selected project' : 'Select a project to see endpoints'}
              </p>
              <p className="text-sm text-muted-foreground">Configure endpoints for this project first</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <Input
                  placeholder="Search endpoints by name, URL, method, or priority..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-md"
                />
              </div>
              <Accordion type="multiple" className="space-y-3">
                {getFilteredEndpoints().map((endpoint) => {
                const isCurrentlyTesting = currentTest === endpoint.id;
                return (
                  <AccordionItem 
                    key={endpoint.id} 
                    value={endpoint.id}
                    className={`border rounded-lg ${isCurrentlyTesting ? 'bg-warning/10 border-warning' : 'border-border'}`}
                  >
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-3 mb-1">
                            {isCurrentlyTesting && <Clock className="h-4 w-4 text-warning animate-spin" />}
                            <h3 className="font-semibold">{endpoint.name}</h3>
                            <Badge variant="outline" className="font-mono text-xs">
                              {endpoint.method}
                            </Badge>
                            <Badge className={`${endpoint.priority === 'critical' ? 'text-destructive' : 
                              endpoint.priority === 'high' ? 'text-warning' : 'text-primary'}`}>
                              {endpoint.priority}
                            </Badge>
                            {endpoint.expectedStatusCode && (
                              <Badge variant="secondary" className="text-xs">
                                Expects: {endpoint.expectedStatusCode}
                              </Badge>
                            )}
                          </div>
                          <p className="font-mono text-sm text-muted-foreground">
                            {selectedProject?.ipAddress ? replaceIPAddress(endpoint.url, selectedProject.ipAddress) : endpoint.url}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            runSingleEndpointTest(endpoint);
                          }}
                          disabled={testState === 'running'}
                          className="bg-primary hover:bg-primary/90"
                        >
                          {isCurrentlyTesting ? (
                            <>
                              <Clock className="h-4 w-4 mr-2 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Test
                            </>
                          )}
                        </Button>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pt-2">
                      <div className="space-y-2 text-sm">
                        <div><strong>Method:</strong> {endpoint.method}</div>
                        <div><strong>Priority:</strong> {endpoint.priority}</div>
                        {endpoint.headers && <div><strong>Headers:</strong> <code className="text-xs bg-muted p-1 rounded">{endpoint.headers}</code></div>}
                        {endpoint.body && <div><strong>Body:</strong> <code className="text-xs bg-muted p-1 rounded">{endpoint.body}</code></div>}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
              </Accordion>
              {getFilteredEndpoints().length === 0 && searchQuery && (
                <div className="text-center py-8 text-muted-foreground">
                  No endpoints match your search criteria
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Test Results - Parent Accordion with PASS/FAIL Categories */}
      {projectResults.length > 0 && (
        <Card className="card-gradient">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary animate-pulse-glow" />
              Test Results ({projectResults.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="space-y-4">
              {/* PASS Results Section */}
              <AccordionItem value="pass-results" className="border-success/30 rounded-lg bg-success/5">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-3 w-full">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <span className="font-semibold text-lg">PASS Results</span>
                    <Badge className="bg-success text-success-foreground ml-auto mr-4">
                      {passResults.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pt-3">
                  {passResults.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No passing tests yet</p>
                  ) : (
                    <Accordion type="multiple" className="space-y-2">
                      {passResults.slice().reverse().map((result) => (
                        <AccordionItem key={result.id} value={result.id} className="border border-success/20 rounded-lg bg-success/5">
                          <AccordionTrigger className="px-3 hover:no-underline">
                            <div className="flex items-center gap-3 flex-1">
                              {getStatusIcon(result.status)}
                              <div className="text-left">
                                <p className="font-mono text-sm font-medium">{result.endpointName}</p>
                                <p className="font-mono text-xs text-muted-foreground">{result.method}</p>
                              </div>
                            </div>
                            <Badge className="bg-success text-success-foreground ml-2">
                              PASS
                            </Badge>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pt-2">
                            <div className="space-y-1 text-sm">
                              <p><strong>URL:</strong> {result.url}</p>
                              <p><strong>Response Time:</strong> {result.responseTime}ms</p>
                              <p><strong>Status Code:</strong> {result.statusCode}</p>
                              <p><strong>Timestamp:</strong> {new Date(result.timestamp).toLocaleString()}</p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* FAIL Results Section */}
              <AccordionItem value="fail-results" className="border-destructive/30 rounded-lg bg-destructive/5">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-3 w-full">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <span className="font-semibold text-lg">FAIL Results</span>
                    <Badge variant="destructive" className="ml-auto mr-4">
                      {failResults.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pt-3">
                  {failResults.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No failed tests</p>
                  ) : (
                    <Accordion type="multiple" className="space-y-2">
                      {failResults.slice().reverse().map((result) => (
                        <AccordionItem key={result.id} value={result.id} className="border border-destructive/20 rounded-lg bg-destructive/5">
                          <AccordionTrigger className="px-3 hover:no-underline">
                            <div className="flex items-center gap-3 flex-1">
                              {getStatusIcon(result.status)}
                              <div className="text-left">
                                <p className="font-mono text-sm font-medium">{result.endpointName}</p>
                                <p className="font-mono text-xs text-muted-foreground">{result.method}</p>
                              </div>
                            </div>
                            <Badge variant="destructive" className="ml-2">
                              {result.status.toUpperCase()}
                            </Badge>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pt-2">
                            <div className="space-y-2 text-sm">
                              <p><strong>URL:</strong> {result.url}</p>
                              <p><strong>Response Time:</strong> {result.responseTime}ms</p>
                              <p><strong>Status Code:</strong> {result.statusCode}</p>
                              {result.vulnerabilities.length > 0 && (
                                <div>
                                  <strong>Vulnerabilities:</strong>
                                  <ul className="list-disc pl-5 mt-1 space-y-1">
                                    {result.vulnerabilities.map((vuln, index) => (
                                      <li key={index} className="text-destructive">
                                        {vuln}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <p><strong>Timestamp:</strong> {new Date(result.timestamp).toLocaleString()}</p>
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
