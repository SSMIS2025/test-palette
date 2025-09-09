import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Edit, Plus, Target, FolderOpen } from 'lucide-react';
import { getStoredData, saveStoredData } from '@/lib/storage';
import { useToast } from '@/components/ui/use-toast';
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
  priority: 'low' | 'medium' | 'high' | 'critical';
  projectId: string;
  expectedStatusCode?: number;
  expectedResponse?: string;
}

export const EndpointManager = () => {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    method: 'GET',
    headers: '',
    body: '',
    description: '',
    category: 'Authentication',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    expectedStatusCode: 200,
    expectedResponse: ''
  });
  const { toast } = useToast();

  const categories = [
    'Authentication',
    'Authorization', 
    'User Management',
    'Data Processing',
    'File Operations',
    'API Gateway',
    'Database Operations',
    'Payment Processing',
    'Social Integration',
    'Infrastructure'
  ];

  useEffect(() => {
    const storedEndpoints = getStoredData('endpoints', []);
    setEndpoints(storedEndpoints);
  }, []);

  const filteredEndpoints = selectedProject 
    ? endpoints.filter(endpoint => endpoint.projectId === selectedProject.id)
    : [];

  const saveEndpoints = (updatedEndpoints: Endpoint[]) => {
    setEndpoints(updatedEndpoints);
    saveStoredData('endpoints', updatedEndpoints);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProject) {
      toast({
        title: "Validation Error",
        description: "Please select a project first",
        variant: "destructive"
      });
      return;
    }
    
    if (!formData.name || !formData.url) {
      toast({
        title: "Validation Error",
        description: "Name and URL are required",
        variant: "destructive"
      });
      return;
    }

    if (editingId) {
      const updatedEndpoints = endpoints.map(endpoint =>
        endpoint.id === editingId ? { ...endpoint, ...formData, projectId: selectedProject.id } : endpoint
      );
      saveEndpoints(updatedEndpoints);
      toast({
        title: "Success",
        description: "Endpoint updated successfully"
      });
    } else {
      const newEndpoint: Endpoint = {
        id: Date.now().toString(),
        ...formData,
        projectId: selectedProject.id
      };
      saveEndpoints([...endpoints, newEndpoint]);
      toast({
        title: "Success", 
        description: "Endpoint added successfully"
      });
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      method: 'GET',
      headers: '',
      body: '',
      description: '',
      category: 'Authentication',
      priority: 'medium',
      expectedStatusCode: 200,
      expectedResponse: ''
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const handleEdit = (endpoint: Endpoint) => {
    setFormData({
      name: endpoint.name,
      url: endpoint.url,
      method: endpoint.method,
      headers: endpoint.headers || '',
      body: endpoint.body || '',
      description: endpoint.description || '',
      category: endpoint.category,
      priority: endpoint.priority,
      expectedStatusCode: endpoint.expectedStatusCode || 200,
      expectedResponse: endpoint.expectedResponse || ''
    });
    setIsEditing(true);
    setEditingId(endpoint.id);
  };

  const handleDelete = (id: string) => {
    const updatedEndpoints = endpoints.filter(endpoint => endpoint.id !== id);
    saveEndpoints(updatedEndpoints);
    toast({
      title: "Success",
      description: "Endpoint deleted successfully"
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-destructive border-destructive';
      case 'high': return 'text-warning border-warning';
      case 'medium': return 'text-primary border-primary';
      default: return 'text-muted-foreground border-muted';
    }
  };

  return (
    <div className="space-y-6">
      <ProjectManager 
        selectedProject={selectedProject}
        onProjectSelect={setSelectedProject}
        showSelector={true}
      />

      {selectedProject ? (
        <>
          <Card className="card-blue">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                {isEditing ? 'Edit Endpoint' : 'Add New Endpoint'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Endpoint Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Login API Endpoint"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url">URL *</Label>
                    <Input
                      id="url"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      placeholder="https://api.example.com/login"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Method</Label>
                    <Select value={formData.method} onValueChange={(value) => setFormData({ ...formData, method: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                        <SelectItem value="OPTIONS">OPTIONS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={formData.priority} onValueChange={(value: any) => setFormData({ ...formData, priority: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expectedStatusCode">Expected Status Code</Label>
                    <Input
                      id="expectedStatusCode"
                      type="number"
                      value={formData.expectedStatusCode}
                      onChange={(e) => setFormData({ ...formData, expectedStatusCode: parseInt(e.target.value) || 200 })}
                      placeholder="200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expectedResponse">Expected Response Pattern</Label>
                    <Input
                      id="expectedResponse"
                      value={formData.expectedResponse}
                      onChange={(e) => setFormData({ ...formData, expectedResponse: e.target.value })}
                      placeholder="success, token, data..."
                    />
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button type="submit" className="bg-gradient-primary">
                    {isEditing ? 'Update Endpoint' : 'Add Endpoint'}
                  </Button>
                  {isEditing && (
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="card-green">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Configured Endpoints ({filteredEndpoints.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredEndpoints.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No endpoints configured for this project</p>
                  <p className="text-sm text-muted-foreground">Add your first endpoint above to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredEndpoints.map((endpoint) => (
                    <div
                      key={endpoint.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{endpoint.name}</h3>
                          <Badge variant="outline">{endpoint.method}</Badge>
                          <Badge 
                            variant="outline"
                            className={getPriorityColor(endpoint.priority)}
                          >
                            {endpoint.priority.toUpperCase()}
                          </Badge>
                          <Badge variant="secondary">{endpoint.category}</Badge>
                        </div>
                        <p className="font-mono text-sm text-muted-foreground">{endpoint.url}</p>
                        {endpoint.description && (
                          <p className="text-sm text-muted-foreground mt-1">{endpoint.description}</p>
                        )}
                        <div className="text-xs text-muted-foreground mt-2">
                          Expected Status: <span className="font-mono text-success">{endpoint.expectedStatusCode || 200}</span>
                          {endpoint.expectedResponse && (
                            <span> | Expected Response: <span className="font-mono text-primary">{endpoint.expectedResponse}</span></span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(endpoint)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(endpoint.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="card-purple">
          <CardContent className="text-center py-8">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Please select a project to manage endpoints</p>
            <p className="text-sm text-muted-foreground">Choose or create a project above to get started</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};