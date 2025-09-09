import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Play, Pause, RotateCcw, Zap, AlertTriangle, CheckCircle, Clock, Download, Settings, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { getStoredData, saveStoredData } from '@/lib/storage';
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

export const TestRunner = () => {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [testConfig, setTestConfig] = useState<TestConfig>({
    projectId: '',
    expectedContent: '',
    checkContent: false
  });
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    const storedEndpoints = getStoredData('endpoints', []);
    const storedProjects = getStoredData('projects', []);
    const storedResults = getStoredData('testResults', []);
    setEndpoints(storedEndpoints);
    setProjects(storedProjects);
    setTestResults(storedResults);
  }, []);

  const saveResults = (newResults: TestResult[]) => {
    setTestResults(newResults);
    saveStoredData('testResults', newResults);
  };

  const getProjectEndpoints = () => {
    if (!selectedProject) return [];
    return endpoints.filter(ep => ep.projectId === selectedProject.id);
  };

  const replaceIPAddress = (url: string, projectIP?: string) => {
    if (!projectIP) return url;
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      urlObj.hostname = projectIP;
      return urlObj.toString();
    } catch {
      return url.replace(/https?:\/\/[^\/]+/, `http://${projectIP}`);
    }
  };

  const runSingleTest = async (endpoint: Endpoint): Promise<TestResult> => {
    const startTime = Date.now();
    setCurrentTest(endpoint.id);
    
    try {
      // Replace IP if project has one configured
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
      
      // CORS handling with multiple proxy services
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

      // Determine pass/fail based on expected status code and content
      let status: 'pass' | 'fail' | 'error' = 'pass';
      const vulnerabilities = [];

      // Check expected status code
      if (endpoint.expectedStatusCode && response.status !== endpoint.expectedStatusCode) {
        status = 'fail';
        vulnerabilities.push(`Expected status ${endpoint.expectedStatusCode}, got ${response.status}`);
      }

      // Check expected content if configured
      if (testConfig.checkContent && testConfig.expectedContent) {
        if (!responseText.includes(testConfig.expectedContent)) {
          status = 'fail';
          vulnerabilities.push(`Expected content "${testConfig.expectedContent}" not found in response`);
        }
      }

      // Security vulnerability checks
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

    setIsRunning(true);
    setProgress(0);
    toast.info(`Starting tests for project: ${selectedProject.name}`);

    const newResults: TestResult[] = [];

    for (let i = 0; i < projectEndpoints.length; i++) {
      const endpoint = projectEndpoints[i];
      setCurrentTest(endpoint.id);
      setProgress(((i + 1) / projectEndpoints.length) * 100);

      const result = await runSingleTest(endpoint);
      newResults.push(result);

      const allResults = [...testResults, ...newResults];
      saveResults(allResults);
    }

    setCurrentTest(null);
    setIsRunning(false);
    setProgress(100);

    const passCount = newResults.filter(r => r.status === 'pass').length;
    const failCount = newResults.filter(r => r.status === 'fail' || r.status === 'error').length;
    
    if (failCount > 0) {
      toast.error(`Tests complete! ${passCount} passed, ${failCount} failed.`);
    } else {
      toast.success(`All ${passCount} tests passed!`);
    }
  };

  const runSingleEndpointTest = async (endpoint: Endpoint) => {
    setIsRunning(true);
    toast.info(`Testing ${endpoint.name}...`);

    const result = await runSingleTest(endpoint);
    const updatedResults = [...testResults, result];
    saveResults(updatedResults);

    setIsRunning(false);
    setCurrentTest(null);

    if (result.status === 'fail' || result.status === 'error') {
      toast.error(`Test failed: ${result.vulnerabilities.join(', ')}`);
    } else {
      toast.success('Test passed!');
    }
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
          <div className="flex items-center gap-4 mb-4">
            <Button
              onClick={runAllTests}
              disabled={isRunning || !selectedProject || getProjectEndpoints().length === 0}
              className="bg-primary hover:bg-primary/90"
            >
              {isRunning ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              {isRunning ? 'Running...' : 'Run All Tests'}
            </Button>
            
            <Button
              variant="outline"
              onClick={clearResults}
              disabled={isRunning || projectResults.length === 0}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear Results
            </Button>

            <Button
              variant="outline"
              onClick={downloadResultsCSV}
              disabled={isRunning || projectResults.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>

            <div className="text-sm text-muted-foreground">
              {selectedProject ? `${getProjectEndpoints().length} endpoint(s) in ${selectedProject.name}` : 'No project selected'}
            </div>
          </div>

          {isRunning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress: {Math.round(progress)}%</span>
                {currentTest && (
                  <span className="text-primary animate-pulse">
                    Testing endpoint...
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
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            Individual Tests
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
            <div className="space-y-3">
              {getProjectEndpoints().map((endpoint) => (
                <div
                  key={endpoint.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
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
                    onClick={() => runSingleEndpointTest(endpoint)}
                    disabled={isRunning}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {currentTest === endpoint.id ? (
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Results - PASS/FAIL Categories */}
      {projectResults.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PASS Results */}
          <Card className="card-green">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                PASS Results ({passResults.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {passResults.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No passing tests yet</p>
                ) : (
                  passResults.slice().reverse().map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between p-3 border border-success/20 rounded-lg bg-success/5"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {getStatusIcon(result.status)}
                        <div>
                          <p className="font-mono text-sm font-medium">{result.endpointName}</p>
                          <p className="font-mono text-xs text-muted-foreground">{result.method} {result.url}</p>
                          <p className="text-xs text-muted-foreground">
                            Response: {result.responseTime}ms | Status: {result.statusCode}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-success text-success-foreground">
                        PASS
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* FAIL Results */}
          <Card className="card-red">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                FAIL Results ({failResults.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {failResults.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No failed tests</p>
                ) : (
                  failResults.slice().reverse().map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between p-3 border border-destructive/20 rounded-lg bg-destructive/5"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {getStatusIcon(result.status)}
                        <div>
                          <p className="font-mono text-sm font-medium">{result.endpointName}</p>
                          <p className="font-mono text-xs text-muted-foreground">{result.method} {result.url}</p>
                          {result.vulnerabilities.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {result.vulnerabilities.map((vuln, index) => (
                                <p key={index} className="text-sm text-destructive">
                                  • {vuln}
                                </p>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Response: {result.responseTime}ms | Status: {result.statusCode}
                          </p>
                        </div>
                      </div>
                      <Badge variant="destructive">
                        {result.status.toUpperCase()}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};