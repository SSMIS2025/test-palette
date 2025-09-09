import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Edit, Plus, FolderOpen } from 'lucide-react';
import { getStoredData, saveStoredData } from '@/lib/storage';
import { useToast } from '@/components/ui/use-toast';

export interface Project {
  id: string;
  name: string;
  description: string;
  ipAddress?: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectManagerProps {
  selectedProject?: Project;
  onProjectSelect: (project: Project | null) => void;
  showSelector?: boolean;
}

export const ProjectManager = ({ selectedProject, onProjectSelect, showSelector = false }: ProjectManagerProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ipAddress: '',
    category: 'Web Application'
  });
  const { toast } = useToast();

  const categories = [
    'Web Application',
    'API Testing',
    'Mobile Backend',
    'IoT Device',
    'Network Service',
    'Database',
    'Cloud Service',
    'Microservice'
  ];

  useEffect(() => {
    const storedProjects = getStoredData('projects', []);
    setProjects(storedProjects);
  }, []);

  const saveProjects = (updatedProjects: Project[]) => {
    setProjects(updatedProjects);
    saveStoredData('projects', updatedProjects);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Project name is required",
        variant: "destructive"
      });
      return;
    }

    const now = new Date().toISOString();
    
    if (editingId) {
      const updatedProjects = projects.map(project =>
        project.id === editingId
          ? { ...project, ...formData, updatedAt: now }
          : project
      );
      saveProjects(updatedProjects);
      toast({
        title: "Success",
        description: "Project updated successfully"
      });
    } else {
      const newProject: Project = {
        id: Date.now().toString(),
        ...formData,
        createdAt: now,
        updatedAt: now
      };
      saveProjects([...projects, newProject]);
      toast({
        title: "Success",
        description: "Project created successfully"
      });
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      ipAddress: '',
      category: 'Web Application'
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const handleEdit = (project: Project) => {
    setFormData({
      name: project.name,
      description: project.description,
      ipAddress: project.ipAddress || '',
      category: project.category
    });
    setIsEditing(true);
    setEditingId(project.id);
  };

  const handleDelete = (id: string) => {
    const updatedProjects = projects.filter(project => project.id !== id);
    saveProjects(updatedProjects);
    
    // If deleted project was selected, clear selection
    if (selectedProject?.id === id) {
      onProjectSelect(null);
    }
    
    toast({
      title: "Success",
      description: "Project deleted successfully"
    });
  };

  if (showSelector) {
    return (
      <Card className="card-cyan mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Select Project
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Select
              value={selectedProject?.id || ''}
              onValueChange={(value) => {
                if (value) {
                  const project = projects.find(p => p.id === value);
                  onProjectSelect(project || null);
                } else {
                  onProjectSelect(null);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a project to work with..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center gap-2">
                      <span>{project.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {project.category}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProject && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{selectedProject.name}</h4>
                  <Badge variant="outline">{selectedProject.category}</Badge>
                </div>
                {selectedProject.description && (
                  <p className="text-sm text-muted-foreground mb-2">{selectedProject.description}</p>
                )}
                {selectedProject.ipAddress && (
                  <p className="text-xs font-mono text-primary">IP: {selectedProject.ipAddress}</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Project Form */}
      <Card className="card-blue">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            {isEditing ? 'Edit Project' : 'Create New Project'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., E-commerce API Security Test"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
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
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ipAddress">IP Address (Optional)</Label>
              <Input
                id="ipAddress"
                value={formData.ipAddress}
                onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                placeholder="e.g., 192.168.1.100 (will replace domain names in URLs)"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the project and testing objectives..."
                rows={3}
              />
            </div>
            
            <div className="flex gap-2">
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                {isEditing ? 'Update Project' : 'Create Project'}
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

      {/* Projects List */}
      <Card className="card-green">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Projects ({projects.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No projects created yet</p>
              <p className="text-sm text-muted-foreground">Create your first project to organize your testing endpoints</p>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors animate-matrix"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{project.name}</h3>
                      <Badge variant="outline">{project.category}</Badge>
                      {selectedProject?.id === project.id && (
                        <Badge className="bg-success text-success-foreground">Selected</Badge>
                      )}
                    </div>
                    {project.description && (
                      <p className="text-sm text-muted-foreground mb-2">{project.description}</p>
                    )}
                    {project.ipAddress && (
                      <p className="text-xs font-mono text-primary mb-2">IP: {project.ipAddress}</p>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Created: {new Date(project.createdAt).toLocaleDateString()}
                      {project.updatedAt !== project.createdAt && (
                        <span> • Updated: {new Date(project.updatedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onProjectSelect(project)}
                    >
                      Select
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(project)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(project.id)}
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