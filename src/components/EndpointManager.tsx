import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit, Globe, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { getStoredData, saveStoredData } from '@/lib/storage';

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
}

export const EndpointManager = () => {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Endpoint>>({
    method: 'GET',
    category: 'api',
    priority: 'medium'
  });

  useEffect(() => {
    const stored = getStoredData('endpoints', []);
    setEndpoints(stored);
  }, []);

  const saveEndpoints = (newEndpoints: Endpoint[]) => {
    setEndpoints(newEndpoints);
    saveStoredData('endpoints', newEndpoints);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.url) {
      toast.error('Name and URL are required');
      return;
    }

    const newEndpoint: Endpoint = {
      id: isEditing || Date.now().toString(),
      name: formData.name!,
      url: formData.url!,
      method: formData.method || 'GET',
      headers: formData.headers,
      body: formData.body,
      description: formData.description,
      category: formData.category || 'api',
      priority: formData.priority || 'medium'
    };

    if (isEditing) {
      const updatedEndpoints = endpoints.map(ep => 
        ep.id === isEditing ? newEndpoint : ep
      );
      saveEndpoints(updatedEndpoints);
      toast.success('Endpoint updated successfully');
    } else {
      saveEndpoints([...endpoints, newEndpoint]);
      toast.success('Endpoint added successfully');
    }

    setFormData({ method: 'GET', category: 'api', priority: 'medium' });
    setIsEditing(null);
  };

  const handleEdit = (endpoint: Endpoint) => {
    setFormData(endpoint);
    setIsEditing(endpoint.id);
  };

  const handleDelete = (id: string) => {
    const updatedEndpoints = endpoints.filter(ep => ep.id !== id);
    saveEndpoints(updatedEndpoints);
    toast.success('Endpoint deleted successfully');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-destructive';
      case 'high': return 'text-warning';
      case 'medium': return 'text-primary';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Add/Edit Form */}
      <Card className="test-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            {isEditing ? 'Edit Endpoint' : 'Add New Endpoint'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Endpoint Name</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Login API"
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  value={formData.url || ''}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://api.example.com/login"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="method">Method</Label>
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
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="auth">Authentication</SelectItem>
                    <SelectItem value="database">Database</SelectItem>
                    <SelectItem value="file">File Upload</SelectItem>
                    <SelectItem value="admin">Admin Panel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
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

            <div>
              <Label htmlFor="headers">Headers (JSON)</Label>
              <Textarea
                id="headers"
                value={formData.headers || ''}
                onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                className="font-mono text-sm"
              />
            </div>

            <div>
              <Label htmlFor="body">Request Body</Label>
              <Textarea
                id="body"
                value={formData.body || ''}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder='{"username": "test", "password": "test"}'
                className="font-mono text-sm"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description of what this endpoint does..."
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                {isEditing ? 'Update' : 'Add'} Endpoint
              </Button>
              {isEditing && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setFormData({ method: 'GET', category: 'api', priority: 'medium' });
                    setIsEditing(null);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Endpoints List */}
      <Card className="test-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Configured Endpoints ({endpoints.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {endpoints.length === 0 ? (
            <div className="text-center py-8">
              <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No endpoints configured</p>
              <p className="text-sm text-muted-foreground">Add your first endpoint to start testing</p>
            </div>
          ) : (
            <div className="space-y-4">
              {endpoints.map((endpoint) => (
                <div
                  key={endpoint.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors animate-matrix"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{endpoint.name}</h3>
                      <Badge variant="outline" className="font-mono text-xs">
                        {endpoint.method}
                      </Badge>
                      <Badge variant="secondary">{endpoint.category}</Badge>
                      <Badge className={getPriorityColor(endpoint.priority)}>
                        {endpoint.priority}
                      </Badge>
                    </div>
                    <p className="font-mono text-sm text-muted-foreground mb-1">
                      {endpoint.url}
                    </p>
                    {endpoint.description && (
                      <p className="text-sm text-muted-foreground">
                        {endpoint.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(endpoint)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(endpoint.id)}
                      className="text-destructive hover:text-destructive"
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
    </div>
  );
};