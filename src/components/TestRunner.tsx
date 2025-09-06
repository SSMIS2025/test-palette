import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, RotateCcw, Zap, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { getStoredData, saveStoredData } from '@/lib/storage';

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
  endpoint: string;
  status: 'pass' | 'fail' | 'pending' | 'running';
  vulnerability?: string;
  responseTime?: number;
  statusCode?: number;
  timestamp: string;
  details?: string;
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

    // Simulate vulnerability tests
    const tests = [
      { name: 'SQL Injection', pattern: /['";]/, risk: 'high' },
      { name: 'XSS Vulnerability', pattern: /<script|javascript:|on\w+=/i, risk: 'critical' },
      { name: 'Command Injection', pattern: /[;&|`$(){}]/, risk: 'critical' },
      { name: 'Path Traversal', pattern: /\.\.[\/\\]/, risk: 'medium' },
      { name: 'LDAP Injection', pattern: /[()&|!]/, risk: 'medium' },
    ];

    try {
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
      
      const responseTime = Date.now() - startTime;
      let vulnerability = '';
      let status: 'pass' | 'fail' = 'pass';
      let statusCode = 200;

      // Simple vulnerability detection based on URL patterns
      for (const test of tests) {
        if (test.pattern.test(endpoint.url) || (endpoint.body && test.pattern.test(endpoint.body))) {
          vulnerability = test.name;
          status = 'fail';
          break;
        }
      }

      // Random status codes for demo
      const possibleCodes = [200, 401, 403, 404, 500, 502];
      statusCode = possibleCodes[Math.floor(Math.random() * possibleCodes.length)];

      // Determine status based on response code if no vulnerability found
      if (status === 'pass' && statusCode >= 400) {
        status = 'fail';
        vulnerability = `HTTP Error ${statusCode}`;
      }

      return {
        id: `${endpoint.id}_${Date.now()}`,
        endpoint: `${endpoint.method} ${endpoint.url}`,
        status,
        vulnerability: vulnerability || undefined,
        responseTime,
        statusCode,
        timestamp: new Date().toISOString(),
        details: `Response time: ${responseTime}ms, Status: ${statusCode}`
      };
    } catch (error) {
      return {
        id: `${endpoint.id}_${Date.now()}`,
        endpoint: `${endpoint.method} ${endpoint.url}`,
        status: 'fail',
        vulnerability: 'Connection Failed',
        timestamp: new Date().toISOString(),
        details: 'Unable to connect to endpoint'
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
      const updatedResults = [...testResults, ...newResults];
      saveResults(updatedResults);
    }

    setCurrentTest(null);
    setIsRunning(false);
    setProgress(100);

    const failedCount = newResults.filter(r => r.status === 'fail').length;
    if (failedCount > 0) {
      toast.error(`Scan complete! Found ${failedCount} vulnerabilities.`);
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

    if (result.status === 'fail') {
      toast.error(`Vulnerability found: ${result.vulnerability}`);
    } else {
      toast.success('Endpoint test passed!');
    }
  };

  const clearResults = () => {
    setTestResults([]);
    saveStoredData('testResults', []);
    toast.success('Test results cleared');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'fail': return <AlertTriangle className="h-4 w-4 text-destructive" />;
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
                      <p className="font-mono text-sm font-medium">{result.endpoint}</p>
                      {result.vulnerability && (
                        <p className="text-sm text-destructive font-semibold">
                          🚨 {result.vulnerability}
                        </p>
                      )}
                      {result.details && (
                        <p className="text-xs text-muted-foreground">{result.details}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={result.status === 'pass' ? 'default' : 'destructive'}
                      className={result.status === 'pass' ? 'bg-success text-success-foreground success-glow' : 'danger-glow'}
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