import axios from 'axios';

// In development, use empty string to leverage Vite's proxy
// In production, use the environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach GitHub token to every request if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('github_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- GitHub Auth API ---

export const getGitHubClientId = async () => {
  const response = await api.get('/api/auth/github/client-id');
  return response.data;
};

export const exchangeGitHubCode = async (code) => {
  const response = await api.post('/api/auth/github/callback', { code });
  return response.data;
};

export const getGitHubUser = async () => {
  const response = await api.get('/api/auth/github/user');
  return response.data;
};

export const verifyCopilotAccess = async () => {
  const response = await api.post('/api/auth/github/verify');
  return response.data;
};

// --- Projects API ---

export const getProjects = async () => {
  const response = await api.get('/api/projects');
  return response.data;
};

export const getActiveProject = async () => {
  const response = await api.get('/api/projects/active');
  return response.data;
};

export const createProject = async (projectData) => {
  const response = await api.post('/api/projects', projectData);
  return response.data;
};

export const updateProject = async (projectId, updates) => {
  const response = await api.put(`/api/projects/${projectId}`, updates);
  return response.data;
};

export const deleteProject = async (projectId) => {
  const response = await api.delete(`/api/projects/${projectId}`);
  return response.data;
};

export const activateProject = async (projectId) => {
  const response = await api.post(`/api/projects/${projectId}/activate`);
  return response.data;
};

// --- Features API ---

export const getFeatures = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.state) params.append('state', filters.state);
  if (filters.search) params.append('search', filters.search);
  if (filters.tag) params.append('tag', filters.tag);
  if (filters.work_item_type) params.append('work_item_type', filters.work_item_type);
  
  const response = await api.get(`/api/features?${params.toString()}`);
  return response.data;
};

export const getWorkItemTypes = async () => {
  const response = await api.get('/api/work-item-types');
  return response.data;
};

// --- Jobs API ---

export const createJob = async (jobData) => {
  const response = await api.post('/api/jobs', jobData);
  return response.data;
};

export const getJobs = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset) params.append('offset', filters.offset);
  
  const response = await api.get(`/api/jobs?${params.toString()}`);
  return response.data;
};

export const getJob = async (jobId) => {
  const response = await api.get(`/api/jobs/${jobId}`);
  return response.data;
};

export const getJobLogs = async (jobId) => {
  const response = await api.get(`/api/jobs/${jobId}/logs`);
  return response.data;
};

export const cancelJob = async (jobId) => {
  const response = await api.post(`/api/jobs/${jobId}/cancel`);
  return response.data;
};

// --- Config API ---

export const getConfig = async () => {
  const response = await api.get('/api/config');
  return response.data;
};

// --- Models API ---

export const getCopilotModels = async () => {
  const response = await api.get('/api/models');
  return response.data;
};

export default api;
