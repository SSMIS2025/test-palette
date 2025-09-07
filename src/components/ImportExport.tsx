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
          // Enhanced CSV parsing for endpoints with category support
          const lines = text.split('\n').filter(line => line.trim());
          if (lines.length === 0) throw new Error('Empty CSV file');
          
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          console.log('CSV Headers detected:', headers);
          
          // Flexible header mapping for different CSV formats
          const headerMapping: { [key: string]: string } = {};
          
          headers.forEach((header, index) => {
            const lowerHeader = header.toLowerCase();
            if (lowerHeader.includes('name') || lowerHeader.includes('title')) headerMapping['name'] = header;
            if (lowerHeader.includes('url') || lowerHeader.includes('endpoint') || lowerHeader.includes('link')) headerMapping['url'] = header;
            if (lowerHeader.includes('method') || lowerHeader.includes('verb')) headerMapping['method'] = header;
            if (lowerHeader.includes('category') || lowerHeader.includes('type') || lowerHeader.includes('group')) headerMapping['category'] = header;
            if (lowerHeader.includes('priority') || lowerHeader.includes('severity')) headerMapping['priority'] = header;
            if (lowerHeader.includes('header')) headerMapping['headers'] = header;
            if (lowerHeader.includes('body') || lowerHeader.includes('payload')) headerMapping['body'] = header;
            if (lowerHeader.includes('description') || lowerHeader.includes('notes')) headerMapping['description'] = header;
          });

          console.log('Header mapping:', headerMapping);
          
          data = lines.slice(1).map((line, index) => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const headerIndex = (field: string) => headers.indexOf(headerMapping[field] || '');
            
            return {
              id: `csv_${Date.now()}_${index}`,
              name: values[headerIndex('name')] || `Endpoint ${index + 1}`,
              url: values[headerIndex('url')] || '',
              method: (values[headerIndex('method')] || 'GET').toUpperCase(),
              category: values[headerIndex('category')] || 'api',
              priority: (values[headerIndex('priority')] || 'medium').toLowerCase(),
              headers: values[headerIndex('headers')] || '',
              body: values[headerIndex('body')] || '',
              description: values[headerIndex('description')] || ''
            };
          }).filter(endpoint => endpoint.name && endpoint.url);
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
        const existingEndpoints = getStoredData('endpoints', []);
        const newEndpoints = data.map((item, index) => ({
          id: `imported_${Date.now()}_${index}`,
          name: item.name || `Imported Endpoint ${index + 1}`,
          url: item.url || '',
          method: (item.method || 'GET').toUpperCase(),
          category: item.category || 'api',
          priority: item.priority || 'medium',
          headers: item.headers || '',
          body: item.body || '',
          description: item.description || ''
        }));
        saveStoredData('endpoints', [...existingEndpoints, ...newEndpoints]);
        toast.success(`Successfully imported ${newEndpoints.length} endpoints from JSON`);
      } else {
        toast.error('Invalid JSON format - expected an array of endpoints');
      }
      setImportData('');
    } catch (error) {
      toast.error('Invalid JSON format');
    }
  };

  const exportEndpointsByCategory = () => {
    const endpoints = getStoredData('endpoints', []);
    if (endpoints.length === 0) {
      toast.error('No endpoints to export');
      return;
    }

    // Group by category
    const groupedEndpoints = endpoints.reduce((acc: any, endpoint: any) => {
      const category = endpoint.category || 'uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(endpoint);
      return acc;
    }, {});

    // Create CSV with categories
    const headers = ['Category', 'Name', 'URL', 'Method', 'Priority', 'Headers', 'Body', 'Description'];
    const csvContent = [
      headers.join(','),
      ...Object.entries(groupedEndpoints).flatMap(([category, endpoints]: [string, any]) =>
        (endpoints as any[]).map(endpoint => [
          `"${category}"`,
          `"${endpoint.name}"`,
          `"${endpoint.url}"`,
          endpoint.method,
          endpoint.priority,
          `"${endpoint.headers || ''}"`,
          `"${endpoint.body || ''}"`,
          `"${endpoint.description || ''}"`
        ].join(','))
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `endpoints-by-category-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Endpoints exported by category!');
  };

  const exportResults = () => {
    const results = getStoredData('testResults', []);
    const headers = ['id', 'endpointName', 'url', 'method', 'status', 'vulnerabilities', 'responseTime', 'statusCode', 'timestamp'];
    exportToCSV(results, 'test-results', headers);
  };

  const clearAllData = () => {
    saveStoredData('endpoints', []);
    saveStoredData('testResults', []);
    toast.success('All data cleared successfully');
  };

  return (
    <div className="space-y-6">
      {/* Import Section */}
      <Card className="test-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            Import Endpoints
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="file-upload">Import from File (JSON/CSV)</Label>
            <div className="flex items-center gap-4 mt-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                onChange={handleImport}
                className="hidden"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Supports CSV with flexible headers (name, url, method, category, priority) and JSON arrays
            </p>
          </div>

          <div>
            <Label htmlFor="json-import">Or Import JSON Data</Label>
            <Textarea
              id="json-import"
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="Paste JSON array of endpoints here..."
              className="font-mono text-sm"
              rows={6}
            />
            <div className="flex gap-2 mt-2">
              <Button
                onClick={() => handleJSONImport(importData)}
                disabled={!importData.trim()}
                className="bg-primary hover:bg-primary/90"
              >
                Import JSON
              </Button>
              <Button
                variant="outline"
                onClick={() => setImportData('')}
                disabled={!importData.trim()}
              >
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Section */}
      <Card className="test-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Export Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Endpoints
              </h4>
              <Button onClick={exportEndpointsByCategory} variant="outline" className="w-full">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export Endpoints by Category
              </Button>
              <Button 
                onClick={() => exportToJSON(getStoredData('endpoints', []), 'endpoints')} 
                variant="outline" 
                className="w-full"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export as JSON
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Test Results
              </h4>
              <Button onClick={exportResults} variant="outline" className="w-full">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export Results (CSV)
              </Button>
              <Button 
                onClick={() => exportToJSON(getStoredData('testResults', []), 'test-results')} 
                variant="outline" 
                className="w-full"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export as JSON
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="test-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-destructive" />
            Data Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20">
              <h4 className="font-semibold text-destructive mb-2">Danger Zone</h4>
              <p className="text-sm text-muted-foreground mb-3">
                This action will permanently delete all endpoints and test results.
              </p>
              <Button
                onClick={clearAllData}
                variant="destructive"
                size="sm"
              >
                Clear All Data
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};