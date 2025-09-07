import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { getStoredData } from '@/lib/storage';

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

export const TestSuite = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    passed: 0,
    failed: 0,
    pending: 0
  });

  useEffect(() => {
    const results = getStoredData('testResults', []);
    setTestResults(results);
    
    const stats = results.reduce((acc: any, result: TestResult) => {
      acc.total++;
      acc[result.status === 'secure' ? 'passed' : result.status === 'vulnerable' ? 'failed' : 'pending']++;
      return acc;
    }, { total: 0, passed: 0, failed: 0, pending: 0 });
    
    setStats(stats);
  }, []);

  const successRate = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="test-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Vulnerability scans executed
            </p>
          </CardContent>
        </Card>

        <Card className="test-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Passed</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.passed}</div>
            <p className="text-xs text-muted-foreground">
              Secure endpoints
            </p>
          </CardContent>
        </Card>

        <Card className="test-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.failed}</div>
            <p className="text-xs text-muted-foreground">
              Vulnerabilities found
            </p>
          </CardContent>
        </Card>

        <Card className="test-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Shield className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{successRate.toFixed(1)}%</div>
            <Progress value={successRate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Recent Test Results */}
      <Card className="test-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Recent Test Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {testResults.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No test results yet</p>
              <p className="text-sm text-muted-foreground">Run your first vulnerability scan to see results here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {testResults.slice(-5).reverse().map((result) => (
                <div
                  key={result.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors animate-matrix"
                >
                  <div className="flex items-center gap-3">
                    {result.status === 'secure' && <CheckCircle className="h-5 w-5 text-success" />}
                    {result.status === 'vulnerable' && <AlertTriangle className="h-5 w-5 text-destructive" />}
                    {result.status === 'error' && <Clock className="h-5 w-5 text-warning" />}
                    <div>
                      <p className="font-mono text-sm font-medium">{result.endpointName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{result.method} {result.url}</p>
                      {result.vulnerabilities && result.vulnerabilities.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {result.vulnerabilities.map((vuln, index) => (
                            <p key={index} className="text-sm text-destructive font-semibold">
                              🚨 {vuln}
                            </p>
                          ))}
                        </div>
                      )}
                      {result.responseTime && result.statusCode && (
                        <p className="text-xs text-muted-foreground">
                          Response: {result.responseTime}ms | Status: {result.statusCode}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={result.status === 'secure' ? 'default' : result.status === 'vulnerable' ? 'destructive' : 'secondary'}
                      className={result.status === 'secure' ? 'bg-success text-success-foreground' : ''}
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