import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, RotateCcw, Zap, AlertTriangle, CheckCircle, Clock, Download } from 'lucide-react';
import { toast } from 'sonner';
import { getStoredData, saveStoredData } from '@/lib/storage';
import axios from 'axios';

interface Endpoint {
  id: string;
  name: string;
  url: string;
  method: string;
  headers?: string;
  body?: string;
  priority: string;
}

interface TestResult {
  id: string;
  endpointName: string;
  url: string;
  method: string;
  status: 'secure' | 'vulnerable' | 'error';
  vulnerabilities: string[];
  responseTime?: number;
  statusCode?: number;
  timestamp: string;
}

export const TestRunner = () => {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const storedEndpoints = getStoredData('endpoints', []);
    const storedResults = getStoredData('testResults', []);
    setEndpoints(storedEndpoints);
    setTestResults(storedResults);
  }, []);

  const saveResults = (newResults: TestResult[]) => {
    setTestResults(newResults);
    saveStoredData('testResults', newResults);
  };

  const runSingleTest = async (endpoint: Endpoint): Promise<TestResult> => {
    const startTime = Date.now();
    setCurrentTest(endpoint.id);
    
    try {
      // Parse headers if provided
      let headers = {};
      if (endpoint.headers) {
        try {
          headers = JSON.parse(endpoint.headers);
        } catch (e) {
          console.warn('Invalid headers JSON:', endpoint.headers);
        }
      }

      // Use proxy to avoid CORS issues
      const proxyUrl = 'https://api.allorigins.win/raw?url=';
      const targetUrl = endpoint.url.startsWith('http') ? endpoint.url : `https://${endpoint.url}`;
      const requestUrl = `${proxyUrl}${encodeURIComponent(targetUrl)}`;

      // Prepare request config
      const config: any = {
        method: endpoint.method.toLowerCase(),
        url: requestUrl,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...headers
        },
        timeout: 15000,
        validateStatus: () => true // Accept all status codes
      };

      // Add body for POST/PUT/PATCH requests
      if (['post', 'put', 'patch'].includes(config.method) && endpoint.body) {
        try {
          config.data = JSON.parse(endpoint.body);
        } catch (e) {
          config.data = endpoint.body;
        }
      }

      const response = await axios(config);
      const responseTime = Date.now() - startTime;

      // Basic vulnerability checks
      const vulnerabilities = [];
      
      // Check for common security headers
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
      
      // Check status codes
      if (response.status >= 500) {
        vulnerabilities.push('Server Error - Potential Information Disclosure');
      }
      
      // Check for SQL injection patterns in response
      const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      if (responseText.includes('mysql_') || responseText.includes('ORA-') || responseText.includes('SQLException')) {
        vulnerabilities.push('Potential SQL Error Information Disclosure');
      }

      return {
        id: `${endpoint.id}_${Date.now()}`,
        endpointName: endpoint.name,
        url: endpoint.url,
        method: endpoint.method,
        status: vulnerabilities.length > 0 ? 'vulnerable' : 'secure',
        vulnerabilities,
        responseTime,
        statusCode: response.status,
        timestamp: new Date().toISOString()
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
        timestamp: new Date().toISOString()
      };
    }
  };

  const runAllTests = async () => {
    if (endpoints.length === 0) {
      toast.error('No endpoints configured. Add endpoints first.');
      return;
    }

    setIsRunning(true);
    setProgress(0);
    toast.info('Starting vulnerability scan...');

    const newResults: TestResult[] = [];

    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      setCurrentTest(endpoint.id);
      setProgress(((i + 1) / endpoints.length) * 100);

      const result = await runSingleTest(endpoint);
      newResults.push(result);

      // Update results in real-time
      const allResults = [...testResults, ...newResults];
      saveResults(allResults);
    }

    setCurrentTest(null);
    setIsRunning(false);
    setProgress(100);

    const failedCount = newResults.filter(r => r.status === 'vulnerable' || r.status === 'error').length;
    if (failedCount > 0) {
      toast.error(`Scan complete! Found ${failedCount} issues.`);
    } else {
      toast.success('Scan complete! No vulnerabilities found.');
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

    if (result.status === 'vulnerable' || result.status === 'error') {
      toast.error(`Issues found: ${result.vulnerabilities.join(', ')}`);
    } else {
      toast.success('Endpoint test passed!');
    }
  };

  const clearResults = () => {
    setTestResults([]);
    saveStoredData('testResults', []);
    toast.success('Test results cleared');
  };

  const downloadResultsCSV = () => {
    if (testResults.length === 0) {
      toast.error('No results to download');
      return;
    }

    const headers = ['Endpoint Name', 'URL', 'Method', 'Status', 'Vulnerabilities', 'Response Time (ms)', 'Status Code', 'Timestamp'];
    const csvContent = [
      headers.join(','),
      ...testResults.map(result => [
        `"${result.endpointName}"`,
        `"${result.url}"`,
        result.method,
        result.status,
        `"${result.vulnerabilities.join('; ')}"`,
        result.responseTime || 0,
        result.statusCode || 0,
        `"${new Date(result.timestamp).toLocaleString()}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `vulnerability-test-results-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Results downloaded successfully!');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'secure': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'vulnerable': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'running': return <Clock className="h-4 w-4 text-warning animate-spin" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Test Controls */}
      <Card className="test-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary animate-pulse-glow" />
            Vulnerability Scanner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Button
              onClick={runAllTests}
              disabled={isRunning || endpoints.length === 0}
              className="bg-primary hover:bg-primary/90"
            >
              {isRunning ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              {isRunning ? 'Running...' : 'Run All Tests'}
            </Button>
            
            <Button
              variant="outline"
              onClick={clearResults}
              disabled={isRunning || testResults.length === 0}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear Results
            </Button>

            <Button
              variant="outline"
              onClick={downloadResultsCSV}
              disabled={isRunning || testResults.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>

            <div className="text-sm text-muted-foreground">
              {endpoints.length} endpoint(s) configured
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
      <Card className="test-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            Individual Tests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {endpoints.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No endpoints to test</p>
              <p className="text-sm text-muted-foreground">Configure endpoints first</p>
            </div>
          ) : (
            <div className="space-y-3">
              {endpoints.map((endpoint) => (
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
                    </div>
                    <p className="font-mono text-sm text-muted-foreground">
                      {endpoint.url}
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

      {/* Recent Results */}
      <Card className="test-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Test Results ({testResults.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {testResults.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No test results yet</p>
              <p className="text-sm text-muted-foreground">Run tests to see results here</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {testResults.slice().reverse().map((result) => (
                <div
                  key={result.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30 animate-matrix"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="font-mono text-sm font-medium">{result.endpointName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{result.method} {result.url}</p>
                      {result.vulnerabilities.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {result.vulnerabilities.map((vuln, index) => (
                            <p key={index} className="text-sm text-destructive font-semibold">
                              🚨 {vuln}
                            </p>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Response: {result.responseTime}ms | Status: {result.statusCode}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={result.status === 'secure' ? 'default' : 'destructive'}
                      className={result.status === 'secure' ? 'bg-success text-success-foreground success-glow' : 'danger-glow'}
                    >
                      {result.status.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};