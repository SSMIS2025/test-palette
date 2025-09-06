import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileUp, FileDown, Download, Upload, FileText, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { getStoredData, saveStoredData, exportToJSON, exportToCSV } from '@/lib/storage';

interface Endpoint {
  id: string;
  name: string;
  url: string;
  method: string;
  headers?: string;
  body?: string;
  description?: string;
  category: string;
  priority: string;
}

interface TestResult {
  id: string;
  endpoint: string;
  status: string;
  vulnerability?: string;
  responseTime?: number;
  statusCode?: number;
  timestamp: string;
  details?: string;
}

export const ImportExport = () => {
  const [importData, setImportData] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        let data;
        
        if (file.name.endsWith('.json')) {
          data = JSON.parse(text);
        } else if (file.name.endsWith('.csv')) {
          // Enhanced CSV parsing for endpoints
          const lines = text.split('\n').filter(line => line.trim());
          if (lines.length < 2) {
            toast.error('CSV file must have headers and at least one data row');
            return;
          }
          
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
          data = lines.slice(1).map((line, index) => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const endpoint: any = {
              id: Date.now().toString() + index,
              method: 'GET',
              category: 'api',
              priority: 'medium'
            };
            
            headers.forEach((header, i) => {
              const value = values[i] || '';
              switch (header) {
                case 'name':
                case 'endpoint name':
                case 'endpoint_name':
                  endpoint.name = value;
                  break;
                case 'url':
                case 'endpoint':
                case 'endpoint_url':
                  endpoint.url = value;
                  break;
                case 'method':
                case 'http method':
                case 'http_method':
                  endpoint.method = value.toUpperCase() || 'GET';
                  break;
                case 'headers':
                case 'request_headers':
                  endpoint.headers = value;
                  break;
                case 'body':
                case 'request body':
                case 'request_body':
                  endpoint.body = value;
                  break;
                case 'description':
                  endpoint.description = value;
                  break;
                case 'category':
                  endpoint.category = value || 'api';
                  break;
                case 'priority':
                  endpoint.priority = value || 'medium';
                  break;
              }
            });
            
            return endpoint;
          }).filter(endpoint => endpoint.name && endpoint.url);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          toast.error('Excel files not directly supported. Please convert to CSV first.');
          return;
        }

        if (data && Array.isArray(data) && data.length > 0) {
          const existingEndpoints = getStoredData('endpoints', []);
          saveStoredData('endpoints', [...existingEndpoints, ...data]);
          toast.success(`Successfully imported ${data.length} endpoints`);
        } else {
          toast.error('No valid endpoints found in file');
        }
      } catch (error) {
        toast.error('Failed to import file. Please check the format.');
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
  };

  const handleJSONImport = (jsonContent: string) => {
    try {
      const data = JSON.parse(jsonContent);
      
      if (Array.isArray(data)) {
        // Assume it's an array of endpoints
        const endpoints = data.map((item, index) => ({
          id: item.id || `imported_${Date.now()}_${index}`,
          name: item.name || `Imported Endpoint ${index + 1}`,
          url: item.url || '',
          method: item.method || 'GET',
          headers: item.headers || '',
          body: item.body || '',
          description: item.description || '',
          category: item.category || 'api',
          priority: item.priority || 'medium'
        }));

        const existingEndpoints = getStoredData('endpoints', []);
        saveStoredData('endpoints', [...existingEndpoints, ...endpoints]);
        toast.success(`Successfully imported ${endpoints.length} endpoints`);
      } else if (data.endpoints) {
        // Full export format
        if (data.endpoints.length > 0) {
          const existingEndpoints = getStoredData('endpoints', []);
          saveStoredData('endpoints', [...existingEndpoints, ...data.endpoints]);
          toast.success(`Successfully imported ${data.endpoints.length} endpoints`);
        }
        
        if (data.testResults && data.testResults.length > 0) {
          const existingResults = getStoredData('testResults', []);
          saveStoredData('testResults', [...existingResults, ...data.testResults]);
          toast.success(`Successfully imported ${data.testResults.length} test results`);
        }
      } else {
        toast.error('Invalid JSON format. Expected array of endpoints or full export format.');
      }
    } catch (error) {
      toast.error('Failed to parse JSON file. Please check the format.');
      console.error('JSON import error:', error);
    }
  };

  const handleCSVImport = (csvContent: string) => {
    try {
      const lines = csvContent.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        toast.error('CSV file must contain at least a header and one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const endpoints: Endpoint[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        
        const endpoint: Endpoint = {
          id: `csv_imported_${Date.now()}_${i}`,
          name: values[headers.indexOf('name')] || `CSV Import ${i}`,
          url: values[headers.indexOf('url')] || '',
          method: values[headers.indexOf('method')] || 'GET',
          headers: values[headers.indexOf('headers')] || '',
          body: values[headers.indexOf('body')] || '',
          description: values[headers.indexOf('description')] || '',
          category: values[headers.indexOf('category')] || 'api',
          priority: values[headers.indexOf('priority')] || 'medium'
        };

        if (endpoint.url) {
          endpoints.push(endpoint);
        }
      }

      if (endpoints.length > 0) {
        const existingEndpoints = getStoredData('endpoints', []);
        saveStoredData('endpoints', [...existingEndpoints, ...endpoints]);
        toast.success(`Successfully imported ${endpoints.length} endpoints from CSV`);
      } else {
        toast.error('No valid endpoints found in CSV file');
      }
    } catch (error) {
      toast.error('Failed to parse CSV file. Please check the format.');
      console.error('CSV import error:', error);
    }
  };

  const handleTextImport = () => {
    if (!importData.trim()) {
      toast.error('Please paste some data to import');
      return;
    }

    try {
      // Try to parse as JSON first
      const data = JSON.parse(importData);
      handleJSONImport(importData);
    } catch {
      // If not JSON, try to parse as CSV
      handleCSVImport(importData);
    }
  };

  const exportEndpoints = () => {
    const endpoints = getStoredData('endpoints', []);
    if (endpoints.length === 0) {
      toast.error('No endpoints to export');
      return;
    }

    exportToJSON(endpoints, 'vuln_endpoints');
    toast.success(`Exported ${endpoints.length} endpoints to JSON`);
  };

  const exportTestResults = () => {
    const results = getStoredData('testResults', []);
    if (results.length === 0) {
      toast.error('No test results to export');
      return;
    }

    exportToJSON(results, 'vuln_test_results');
    toast.success(`Exported ${results.length} test results to JSON`);
  };

  const exportFullData = () => {
    const endpoints = getStoredData('endpoints', []);
    const testResults = getStoredData('testResults', []);

    const fullData = {
      exportDate: new Date().toISOString(),
      endpoints,
      testResults,
      summary: {
        endpointCount: endpoints.length,
        testResultCount: testResults.length
      }
    };

    exportToJSON(fullData, 'vuln_scan_complete_export');
    toast.success('Exported complete vulnerability scan data');
  };

  const exportResultsAsCSV = () => {
    const results = getStoredData('testResults', []);
    if (results.length === 0) {
      toast.error('No test results to export');
      return;
    }

    const headers = ['endpoint', 'status', 'vulnerability', 'responseTime', 'statusCode', 'timestamp', 'details'];
    exportToCSV(results, 'vuln_test_results', headers);
    toast.success(`Exported ${results.length} test results to CSV`);
  };

  const exportEndpointsAsCSV = () => {
    const endpoints = getStoredData('endpoints', []);
    if (endpoints.length === 0) {
      toast.error('No endpoints to export');
      return;
    }

    const headers = ['name', 'url', 'method', 'category', 'priority', 'description'];
    exportToCSV(endpoints, 'vuln_endpoints', headers);
    toast.success(`Exported ${endpoints.length} endpoints to CSV`);
  };

  const sampleData = {
    endpoints: [
      {
        "name": "Login API",
        "url": "https://api.example.com/login",
        "method": "POST",
        "category": "auth",
        "priority": "high",
        "description": "User authentication endpoint"
      },
      {
        "name": "User Profile",
        "url": "https://api.example.com/user/profile",
        "method": "GET", 
        "category": "api",
        "priority": "medium",
        "description": "Get user profile information"
      }
    ]
  };

  return (
    <div className="space-y-6">
      {/* Import Section */}
      <Card className="test-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            Import Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* File Import */}
            <div className="space-y-4">
              <Label>Import from File</Label>
              <div className="space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImport}
                  accept=".json,.csv,.xlsx,.xls"
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File (JSON, CSV, XLS)
                </Button>
                <p className="text-sm text-muted-foreground">
                  Supported: JSON, CSV files. For Excel: save as CSV first.
                  <br />
                  <strong>CSV Headers:</strong> name, url, method, category, priority, description, headers, body
                </p>
              </div>
            </div>

            {/* Text Import */}
            <div className="space-y-4">
              <Label htmlFor="importText">Import from Text</Label>
              <Textarea
                id="importText"
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste JSON or CSV data here..."
                className="min-h-32 font-mono text-sm"
              />
              <Button
                onClick={handleTextImport}
                className="w-full bg-primary hover:bg-primary/90"
              >
                <FileText className="h-4 w-4 mr-2" />
                Import Data
              </Button>
            </div>
          </div>

          {/* Sample Format */}
          <div className="mt-6">
            <Label>Sample JSON Format</Label>
            <Textarea
              value={JSON.stringify(sampleData, null, 2)}
              readOnly
              className="mt-2 font-mono text-sm bg-muted"
              rows={10}
            />
          </div>
        </CardContent>
      </Card>

      {/* Export Section */}
      <Card className="test-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-success" />
            Export Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* JSON Exports */}
            <div className="space-y-4">
              <Label className="text-lg font-semibold">JSON Export</Label>
              <div className="space-y-3">
                <Button
                  onClick={exportEndpoints}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Endpoints (JSON)
                </Button>
                
                <Button
                  onClick={exportTestResults}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Test Results (JSON)
                </Button>
                
                <Button
                  onClick={exportFullData}
                  className="w-full justify-start bg-success hover:bg-success/90"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Complete Data (JSON)
                </Button>
              </div>
            </div>

            {/* Excel/CSV Exports */}
            <div className="space-y-4">
              <Label className="text-lg font-semibold">Excel/CSV Export</Label>
              <div className="space-y-3">
                <Button
                  onClick={exportEndpointsAsCSV}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Endpoints (CSV)
                </Button>
                
                <Button
                  onClick={exportResultsAsCSV}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Test Results (CSV)
                </Button>
                
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    CSV files can be opened in Excel, Google Sheets, or any spreadsheet application.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Export Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {getStoredData('endpoints', []).length}
              </div>
              <div className="text-sm text-muted-foreground">Endpoints</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">
                {getStoredData('testResults', []).length}
              </div>
              <div className="text-sm text-muted-foreground">Test Results</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">
                {getStoredData('endpoints', []).length + getStoredData('testResults', []).length}
              </div>
              <div className="text-sm text-muted-foreground">Total Records</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};