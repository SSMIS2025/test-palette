import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileUp, FileDown, Download, Upload, FileText, FileSpreadsheet, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { getStoredData, saveStoredData, exportToJSON, exportToCSV } from '@/lib/storage';
import { ProjectManager, Project } from './ProjectManager';

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
  projectId: string;
  expectedStatusCode?: number;
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
  projectId: string;
}

export const ImportExport = () => {
  const [importData, setImportData] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedProject) {
      toast.error('Please select a project first before importing');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        let data;
        
        if (file.name.endsWith('.json')) {
          data = JSON.parse(text);
        } else if (file.name.endsWith('.csv')) {
          // Enhanced CSV parsing for endpoints with category and project support
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
            if (lowerHeader.includes('expected') && lowerHeader.includes('status')) headerMapping['expectedStatusCode'] = header;
            if (lowerHeader.includes('status') && lowerHeader.includes('code')) headerMapping['expectedStatusCode'] = header;
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
              description: values[headerIndex('description')] || '',
              projectId: selectedProject.id,
              expectedStatusCode: values[headerIndex('expectedStatusCode')] ? 
                parseInt(values[headerIndex('expectedStatusCode')]) : 200
            };
          }).filter(endpoint => endpoint.name && endpoint.url);
        }

        if (data && Array.isArray(data) && data.length > 0) {
          // Add project ID to all imported endpoints
          const projectEndpoints = data.map(endpoint => ({
            ...endpoint,
            projectId: selectedProject.id,
            id: `${selectedProject.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          }));
          
          const existingEndpoints = getStoredData('endpoints', []);
          saveStoredData('endpoints', [...existingEndpoints, ...projectEndpoints]);
          toast.success(`Successfully imported ${projectEndpoints.length} endpoints to project: ${selectedProject.name}`);
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
    if (!selectedProject) {
      toast.error('Please select a project first before importing');
      return;
    }

    try {
      const data = JSON.parse(jsonContent);
      if (Array.isArray(data)) {
        const existingEndpoints = getStoredData('endpoints', []);
        const newEndpoints = data.map((item, index) => ({
          id: `${selectedProject.id}_imported_${Date.now()}_${index}`,
          name: item.name || `Imported Endpoint ${index + 1}`,
          url: item.url || '',
          method: (item.method || 'GET').toUpperCase(),
          category: item.category || 'api',
          priority: item.priority || 'medium',
          headers: item.headers || '',
          body: item.body || '',
          description: item.description || '',
          projectId: selectedProject.id,
          expectedStatusCode: item.expectedStatusCode || 200
        }));
        saveStoredData('endpoints', [...existingEndpoints, ...newEndpoints]);
        toast.success(`Successfully imported ${newEndpoints.length} endpoints to project: ${selectedProject.name}`);
      } else {
        toast.error('Invalid JSON format - expected an array of endpoints');
      }
      setImportData('');
    } catch (error) {
      toast.error('Invalid JSON format');
    }
  };

  const exportEndpointsByProject = () => {
    if (!selectedProject) {
      toast.error('Please select a project to export');
      return;
    }

    const allEndpoints = getStoredData('endpoints', []);
    const projectEndpoints = allEndpoints.filter((ep: Endpoint) => ep.projectId === selectedProject.id);
    
    if (projectEndpoints.length === 0) {
      toast.error('No endpoints found for selected project');
      return;
    }

    // Group by category
    const groupedEndpoints = projectEndpoints.reduce((acc: any, endpoint: any) => {
      const category = endpoint.category || 'uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(endpoint);
      return acc;
    }, {});

    // Create CSV with categories and expected status codes
    const headers = ['Project', 'Category', 'Name', 'URL', 'Method', 'Priority', 'Expected Status Code', 'Headers', 'Body', 'Description'];
    const csvContent = [
      headers.join(','),
      ...Object.entries(groupedEndpoints).flatMap(([category, endpoints]: [string, any]) =>
        (endpoints as any[]).map(endpoint => [
          `"${selectedProject.name}"`,
          `"${category}"`,
          `"${endpoint.name}"`,
          `"${endpoint.url}"`,
          endpoint.method,
          endpoint.priority,
          endpoint.expectedStatusCode || 200,
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
    link.setAttribute('download', `${selectedProject.name}-endpoints-by-category-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Endpoints exported for project: ${selectedProject.name}!`);
  };

  const exportResultsByProject = () => {
    if (!selectedProject) {
      toast.error('Please select a project to export results');
      return;
    }

    const allResults = getStoredData('testResults', []);
    const projectResults = allResults.filter((result: TestResult) => result.projectId === selectedProject.id);
    
    if (projectResults.length === 0) {
      toast.error('No test results found for selected project');
      return;
    }

    // Group results by PASS/FAIL
    const passResults = projectResults.filter((r: TestResult) => r.status === 'pass');
    const failResults = projectResults.filter((r: TestResult) => r.status === 'fail' || r.status === 'error');

    const headers = ['Project', 'Category', 'Endpoint Name', 'URL', 'Method', 'Status', 'Vulnerabilities', 'Response Time', 'Status Code', 'Timestamp'];
    const csvContent = [
      headers.join(','),
      '--- PASS RESULTS ---',
      ...passResults.map((result: any) => [
        `"${selectedProject.name}"`,
        'PASS',
        `"${result.endpointName}"`,
        `"${result.url}"`,
        result.method,
        result.status,
        `"${result.vulnerabilities ? result.vulnerabilities.join('; ') : ''}"`,
        result.responseTime || 0,
        result.statusCode || 'N/A',
        `"${new Date(result.timestamp).toLocaleString()}"`
      ].join(',')),
      '--- FAIL RESULTS ---',
      ...failResults.map((result: any) => [
        `"${selectedProject.name}"`,
        'FAIL',
        `"${result.endpointName}"`,
        `"${result.url}"`,
        result.method,
        result.status,
        `"${result.vulnerabilities ? result.vulnerabilities.join('; ') : ''}"`,
        result.responseTime || 0,
        result.statusCode || 'N/A',
        `"${new Date(result.timestamp).toLocaleString()}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedProject.name}-test-results-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Test results exported for project: ${selectedProject.name}!`);
  };

  const clearProjectData = () => {
    if (!selectedProject) {
      toast.error('Please select a project to clear data');
      return;
    }

    const allEndpoints = getStoredData('endpoints', []);
    const allResults = getStoredData('testResults', []);
    
    const filteredEndpoints = allEndpoints.filter((ep: Endpoint) => ep.projectId !== selectedProject.id);
    const filteredResults = allResults.filter((result: TestResult) => result.projectId !== selectedProject.id);
    
    saveStoredData('endpoints', filteredEndpoints);
    saveStoredData('testResults', filteredResults);
    
    toast.success(`All data cleared for project: ${selectedProject.name}`);
  };

  return (
    <div className="space-y-6">
      {/* Project Selection */}
      <ProjectManager 
        selectedProject={selectedProject} 
        onProjectSelect={setSelectedProject}
        showSelector={true}
      />

      {/* Import Section */}
      <Card className="card-orange">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            Import Endpoints
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedProject ? (
            <div className="text-center py-8">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Please select a project first</p>
              <p className="text-sm text-muted-foreground">Endpoints will be imported to the selected project</p>
            </div>
          ) : (
            <>
              <div className="bg-primary/10 p-3 rounded-lg">
                <p className="text-sm font-medium">Importing to: {selectedProject.name}</p>
                <p className="text-xs text-muted-foreground">All endpoints will be added to this project</p>
              </div>
              
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
                  Supports CSV with headers: name, url, method, category, priority, expected status code, headers, body, description
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Export Section */}
      <Card className="card-cyan">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Export Project Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedProject ? (
            <div className="text-center py-8">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Please select a project first</p>
              <p className="text-sm text-muted-foreground">Export data for the selected project</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <p className="text-sm font-medium">Exporting from: {selectedProject.name}</p>
                <p className="text-xs text-muted-foreground">Only data from this project will be exported</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Endpoints
                  </h4>
                  <Button onClick={exportEndpointsByProject} variant="outline" className="w-full">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export Endpoints by Category
                  </Button>
                  <Button 
                    onClick={() => {
                      const allEndpoints = getStoredData('endpoints', []);
                      const projectEndpoints = allEndpoints.filter((ep: Endpoint) => ep.projectId === selectedProject.id);
                      exportToJSON(projectEndpoints, `${selectedProject.name}-endpoints`);
                    }} 
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
                    Test Results (PASS/FAIL)
                  </h4>
                  <Button onClick={exportResultsByProject} variant="outline" className="w-full">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export Results by Category
                  </Button>
                  <Button 
                    onClick={() => {
                      const allResults = getStoredData('testResults', []);
                      const projectResults = allResults.filter((result: TestResult) => result.projectId === selectedProject.id);
                      exportToJSON(projectResults, `${selectedProject.name}-test-results`);
                    }} 
                    variant="outline" 
                    className="w-full"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Export as JSON
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="card-red">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-destructive" />
            Project Data Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedProject ? (
            <div className="text-center py-8">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Please select a project first</p>
              <p className="text-sm text-muted-foreground">Manage data for the selected project</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20">
                <h4 className="font-semibold text-destructive mb-2">Danger Zone</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  This action will permanently delete all endpoints and test results for project: <strong>{selectedProject.name}</strong>
                </p>
                <Button
                  onClick={clearProjectData}
                  variant="destructive"
                  size="sm"
                >
                  Clear Project Data
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};