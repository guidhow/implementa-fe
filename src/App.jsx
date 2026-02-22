import { useState, useEffect, useRef, createContext, useContext } from 'react'
import { Routes, Route, Link, useSearchParams } from 'react-router-dom'
import Features from './pages/Features'
import Jobs from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import headerLogo from './images/header-logo.png'
import { getConfig, getGitHubClientId, exchangeGitHubCode, getGitHubUser, getProjects, createProject as apiCreateProject, updateProject as apiUpdateProject, deleteProject as apiDeleteProject, activateProject as apiActivateProject, getCopilotModels } from './api'

// Global configuration context
export const ConfigContext = createContext()

// GitHub auth context
export const AuthContext = createContext()

export function useConfig() {
  return useContext(ConfigContext)
}

export function useAuth() {
  return useContext(AuthContext)
}

function App() {
  const [showConfig, setShowConfig] = useState(false)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [deletingProject, setDeletingProject] = useState(null)
  const [isCustomModel, setIsCustomModel] = useState(false)
  const [projectInfo, setProjectInfo] = useState({ project: '', repoUrl: '', orgUrl: '', hasActiveProject: false })
  const [projectLoading, setProjectLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Projects state
  const [projects, setProjects] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  
  // Copilot models state
  const [copilotModels, setCopilotModels] = useState([])
  const [modelsLoading, setModelsLoading] = useState(false)
  
  // GitHub Auth state
  const [githubUser, setGithubUser] = useState(() => {
    const saved = localStorage.getItem('github_user')
    return saved ? JSON.parse(saved) : null
  })
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('github_token'))
  const [authLoading, setAuthLoading] = useState(false)

  const [config, setConfig] = useState(() => {
    const savedModel = localStorage.getItem('copilotModel') || 'gpt-4.1'
    return {
      copilotModel: savedModel,
      baseBranch: localStorage.getItem('baseBranch') || 'main',
      branchPrefix: localStorage.getItem('branchPrefix') || 'feature/',
      _isCustomModel: false // Will be updated once models are loaded
    }
  })

  const isLoggedIn = !!githubToken && !!githubUser

  // Fetch project configuration from backend (requires login)
  const fetchProjectConfig = async () => {
    if (!isLoggedIn) {
      setProjectLoading(false)
      return
    }
    try {
      const data = await getConfig()
      setProjectInfo(data)
    } catch (error) {
      console.error('Error fetching project config:', error)
    } finally {
      setProjectLoading(false)
    }
  }

  // Fetch user's projects
  const fetchProjects = async () => {
    if (!isLoggedIn) return
    setProjectsLoading(true)
    try {
      const data = await getProjects()
      setProjects(data)
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setProjectsLoading(false)
    }
  }

  // Fetch available Copilot models from SDK
  const fetchCopilotModels = async () => {
    if (!isLoggedIn) return
    console.log('[DevMind] Fetching Copilot models...')
    setModelsLoading(true)
    try {
      const data = await getCopilotModels()
      console.log('[DevMind] Models received:', data)
      setCopilotModels(data.models || [])
      // Update _isCustomModel based on loaded models
      const modelIds = (data.models || []).map(m => m.id || m.name || m)
      setConfig(prev => ({
        ...prev,
        _isCustomModel: prev.copilotModel && !modelIds.includes(prev.copilotModel)
      }))
    } catch (error) {
      console.error('[DevMind] Error fetching Copilot models:', error)
      // Fallback to empty - will show only Custom option
      setCopilotModels([])
    } finally {
      setModelsLoading(false)
    }
  }

  useEffect(() => {
    fetchProjectConfig()
    fetchProjects()
    fetchCopilotModels()
  }, [isLoggedIn])

  // Handle GitHub OAuth callback (use ref to prevent StrictMode double-exchange)
  const codeExchangedRef = useRef(false)
  useEffect(() => {
    const code = searchParams.get('code')
    if (code && !githubToken && !codeExchangedRef.current) {
      codeExchangedRef.current = true
      setAuthLoading(true)
      // Remove code from URL immediately to avoid re-triggering
      searchParams.delete('code')
      setSearchParams(searchParams, { replace: true })

      exchangeGitHubCode(code)
        .then((data) => {
          localStorage.setItem('github_token', data.access_token)
          localStorage.setItem('github_user', JSON.stringify(data.user))
          setGithubToken(data.access_token)
          setGithubUser(data.user)
        })
        .catch((err) => {
          console.error('GitHub OAuth error:', err)
          codeExchangedRef.current = false
          alert('GitHub login failed. Please try again.')
        })
        .finally(() => setAuthLoading(false))
    }
  }, [searchParams])

  // Verify stored token is still valid on mount
  useEffect(() => {
    if (githubToken && !githubUser) {
      getGitHubUser()
        .then((user) => {
          setGithubUser(user)
          localStorage.setItem('github_user', JSON.stringify(user))
        })
        .catch(() => {
          // Token expired, clear it
          handleLogout()
        })
    }
  }, [])

  const handleGitHubLogin = async () => {
    try {
      const { client_id } = await getGitHubClientId()
      const redirectUri = window.location.origin + window.location.pathname
      const scope = 'read:user user:email'
      window.location.href = `https://github.com/login/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`
    } catch (err) {
      console.error('Failed to get GitHub client ID:', err)
      alert('GitHub OAuth not configured on the server.')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('github_token')
    localStorage.removeItem('github_user')
    setGithubToken(null)
    setGithubUser(null)
    setProjects([])
    setProjectInfo({ project: '', repoUrl: '', orgUrl: '', hasActiveProject: false })
  }

  // Project management handlers
  const handleSaveProject = async (projectData) => {
    try {
      if (editingProject) {
        await apiUpdateProject(editingProject.id, projectData)
      } else {
        await apiCreateProject({ ...projectData, is_active: true })
      }
      setShowProjectModal(false)
      setEditingProject(null)
      await fetchProjects()
      await fetchProjectConfig()
    } catch (err) {
      console.error('Error saving project:', err)
      alert('Error saving project: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleDeleteProject = async () => {
    if (!deletingProject) return
    try {
      await apiDeleteProject(deletingProject.id)
      setDeletingProject(null)
      await fetchProjects()
      await fetchProjectConfig()
    } catch (err) {
      console.error('Error deleting project:', err)
    }
  }

  const handleActivateProject = async (projectId) => {
    try {
      await apiActivateProject(projectId)
      await fetchProjects()
      await fetchProjectConfig()
    } catch (err) {
      console.error('Error activating project:', err)
    }
  }

  // Merge project info into config for context
  const fullConfig = {
    ...config,
    repoUrl: projectInfo.repoUrl || '',
    project: projectInfo.project || '',
    orgUrl: projectInfo.orgUrl || '',
    hasActiveProject: projectInfo.hasActiveProject || false,
    projectName: projectInfo.projectName || '',
    trackerType: projectInfo.trackerType || '',
  }

  const handleConfigChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }))
    localStorage.setItem(key, value)
  }

  const isConfigured = projectInfo.hasActiveProject && projectInfo.repoUrl && projectInfo.repoUrl.trim() !== ''

  return (
    <ConfigContext.Provider value={fullConfig}>
      <AuthContext.Provider value={{ githubUser, githubToken, isLoggedIn, handleGitHubLogin, handleLogout, authLoading }}>
      <div className="app">
        <nav className="nav">
          <div className="nav-brand">
            <Link to="/">
              <img src={headerLogo} alt="DevMind" />
            </Link>
            {projectInfo.project && (
              <span style={{ 
                marginLeft: '1rem', 
                fontSize: '0.9rem', 
                color: '#888',
                fontWeight: 'normal'
              }}>
                📦 {projectInfo.project}
              </span>
            )}
          </div>
          <ul className="nav-links">
            <li><Link to="/">Features</Link></li>
            <li><Link to="/jobs">Jobs</Link></li>
            <li>
              <button 
                onClick={() => setShowConfig(!showConfig)}
                style={{ 
                  background: isConfigured ? '#28a745' : '#dc3545',
                  border: 'none',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                ⚙️ Config {isConfigured ? '✓' : '!'}
              </button>
            </li>
            {isLoggedIn && (
              <li>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img 
                    src={githubUser.avatar_url} 
                    alt={githubUser.login}
                    style={{ 
                      width: '28px', 
                      height: '28px', 
                      borderRadius: '50%',
                      border: '2px solid #28a745'
                    }} 
                  />
                  <span style={{ fontSize: '0.85rem', color: '#ccc' }}>
                    {githubUser.login}
                  </span>
                  <button
                    onClick={handleLogout}
                    style={{
                      background: '#6c757d',
                      border: 'none',
                      color: 'white',
                      padding: '0.4rem 0.7rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    Logout
                  </button>
                </div>
              </li>
            )}
          </ul>
        </nav>

        {showConfig && (
          <div className="config-panel" style={{
            background: '#1a1a2e',
            padding: '1.5rem',
            borderBottom: '1px solid #333',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label style={{ fontWeight: 'bold', color: 'white', fontSize: '1rem' }}>
                  📂 Projects
                </label>
                {isLoggedIn && (
                  <button
                    onClick={() => { setEditingProject(null); setShowProjectModal(true) }}
                    style={{
                      background: '#4dabf7',
                      border: 'none',
                      color: 'white',
                      padding: '0.4rem 0.8rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    + New Project
                  </button>
                )}
              </div>
              {!isLoggedIn ? (
                <div style={{ padding: '0.75rem', background: '#2a2a4e', borderRadius: '4px', color: '#ffa726' }}>
                  🔒 Log in with GitHub to manage projects
                </div>
              ) : projectsLoading ? (
                <div style={{ padding: '0.75rem', background: '#2a2a4e', borderRadius: '4px', color: '#888' }}>
                  Loading projects...
                </div>
              ) : projects.length === 0 ? (
                <div style={{ padding: '0.75rem', background: '#2a2a4e', borderRadius: '4px', color: '#ffa726' }}>
                  No projects configured. Click "+ New Project" to connect Azure DevOps or Jira.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {projects.map(p => (
                    <div key={p.id} style={{
                      padding: '0.5rem 0.75rem',
                      background: p.is_active ? '#1b5e20' : '#2a2a4e',
                      border: p.is_active ? '2px solid #4caf50' : '1px solid #444',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      minWidth: '200px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: 'white', fontWeight: 'bold', fontSize: '0.9rem' }}>
                          {p.is_active && '✅ '}{p.name}
                        </div>
                        <div style={{ color: '#aaa', fontSize: '0.75rem' }}>
                          {p.tracker_type === 'azure' ? '🔷 Azure DevOps' : '🟡 Jira'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {!p.is_active && (
                          <button onClick={() => handleActivateProject(p.id)} title="Activate" style={{
                            background: '#388e3c', border: 'none', color: 'white', padding: '0.2rem 0.5rem',
                            borderRadius: '3px', cursor: 'pointer', fontSize: '0.75rem'
                          }}>Use</button>
                        )}
                        <button onClick={() => { setEditingProject(p); setShowProjectModal(true) }} title="Edit" style={{
                          background: '#555', border: 'none', color: 'white', padding: '0.2rem 0.5rem',
                          borderRadius: '3px', cursor: 'pointer', fontSize: '0.75rem'
                        }}>✏️</button>
                        <button onClick={() => setDeletingProject(p)} title="Delete" style={{
                          background: '#c62828', border: 'none', color: 'white', padding: '0.2rem 0.5rem',
                          borderRadius: '3px', cursor: 'pointer', fontSize: '0.75rem'
                        }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'white' }}>
                🤖 Copilot Model
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                <select
                  value={config._isCustomModel ? 'custom' : config.copilotModel}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setConfig(prev => ({ ...prev, _isCustomModel: true, copilotModel: '' }))
                    } else {
                      setConfig(prev => ({ ...prev, _isCustomModel: false, copilotModel: e.target.value }))
                      localStorage.setItem('copilotModel', e.target.value)
                    }
                  }}
                  style={{ width: '100%', padding: '0.5rem' }}
                  disabled={modelsLoading}
                >
                  {modelsLoading ? (
                    <option value="">Loading models...</option>
                  ) : copilotModels.length > 0 ? (
                    <>
                      {copilotModels.map((model, idx) => {
                        const modelId = model.id || model.name || model
                        const modelLabel = model.label || model.name || model.id || model
                        const isDefault = model.isDefault || idx === 0
                        return (
                          <option key={modelId} value={modelId}>
                            {modelLabel}{isDefault ? ' (Recommended)' : ''}
                          </option>
                        )
                      })}
                      <option value="custom">✏️ Custom...</option>
                    </>
                  ) : (
                    <>
                      <option value="gpt-4.1">GPT-4.1 (Recommended)</option>
                      <option value="custom">✏️ Custom...</option>
                    </>
                  )}
                </select>
                {config._isCustomModel && (
                  <input
                    type="text"
                    value={config.copilotModel}
                    onChange={(e) => handleConfigChange('copilotModel', e.target.value)}
                    placeholder="Enter custom model name (e.g., gpt-4-turbo)"
                    style={{ width: '100%', padding: '0.5rem' }}
                  />
                )}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'white' }}>
                🌿 Base Branch
              </label>
              <input
                type="text"
                value={config.baseBranch}
                onChange={(e) => handleConfigChange('baseBranch', e.target.value)}
                placeholder="main"
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'white' }}>
                📁 Branch Prefix
              </label>
              <input
                type="text"
                value={config.branchPrefix}
                onChange={(e) => handleConfigChange('branchPrefix', e.target.value)}
                placeholder="feature/"
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>
          </div>
        )}

        {/* Project Create/Edit Modal */}
        {showProjectModal && (
          <ProjectModal
            project={editingProject}
            onSave={handleSaveProject}
            onClose={() => { setShowProjectModal(false); setEditingProject(null) }}
          />
        )}

        {deletingProject && (
          <DeleteConfirmModal
            projectName={deletingProject.name}
            onConfirm={handleDeleteProject}
            onCancel={() => setDeletingProject(null)}
          />
        )}
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Features />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:jobId" element={<JobDetail />} />
          </Routes>
        </main>
      </div>
    </AuthContext.Provider>
    </ConfigContext.Provider>
  )
}


// ---- Project Create/Edit Modal Component ----

function ProjectModal({ project, onSave, onClose }) {
  const [name, setName] = useState(project?.name || '')
  const [trackerType, setTrackerType] = useState(project?.tracker_type || 'azure')
  const [repoUrl, setRepoUrl] = useState(project?.repo_url || '')
  const [saving, setSaving] = useState(false)

  // Azure DevOps fields
  const [azdoOrgUrl, setAzdoOrgUrl] = useState(project?.tracker_config?.azdo_org_url || '')
  const [azdoProject, setAzdoProject] = useState(project?.tracker_config?.azdo_project || '')
  const [azdoPat, setAzdoPat] = useState(project?.tracker_config?.azdo_pat || '')

  // Git credentials (optional, for non-Azure repos)
  const [gitPat, setGitPat] = useState(project?.tracker_config?.git_pat || '')

  // Git author override (optional, for remotes that enforce author membership)
  const [gitAuthorName, setGitAuthorName] = useState(project?.tracker_config?.git_author_name || '')
  const [gitAuthorEmail, setGitAuthorEmail] = useState(project?.tracker_config?.git_author_email || '')

  // Jira fields
  const [jiraServerUrl, setJiraServerUrl] = useState(project?.tracker_config?.jira_server_url || '')
  const [jiraEmail, setJiraEmail] = useState(project?.tracker_config?.jira_email || '')
  const [jiraApiToken, setJiraApiToken] = useState(project?.tracker_config?.jira_api_token || '')
  const [jiraProjectKey, setJiraProjectKey] = useState(project?.tracker_config?.jira_project_key || '')
  const [jiraVerifySsl, setJiraVerifySsl] = useState(project?.tracker_config?.jira_verify_ssl ?? true)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    const authorFields = {
      ...(gitAuthorName ? { git_author_name: gitAuthorName } : {}),
      ...(gitAuthorEmail ? { git_author_email: gitAuthorEmail } : {})
    }

    const trackerConfig = trackerType === 'azure'
      ? { azdo_org_url: azdoOrgUrl, azdo_project: azdoProject, azdo_pat: azdoPat, ...authorFields }
      : { jira_server_url: jiraServerUrl, jira_email: jiraEmail, jira_api_token: jiraApiToken, jira_project_key: jiraProjectKey, jira_verify_ssl: jiraVerifySsl, ...(gitPat ? { git_pat: gitPat } : {}), ...authorFields }

    try {
      await onSave({ name, tracker_type: trackerType, repo_url: repoUrl, tracker_config: trackerConfig })
    } finally {
      setSaving(false)
    }
  }

  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
  }
  const modalStyle = {
    background: '#ffffff', borderRadius: '12px', padding: '2rem', width: '500px', maxWidth: '95vw',
    maxHeight: '85vh', overflowY: 'auto', color: '#222', border: '1px solid #ddd', boxShadow: '0 8px 30px rgba(0,0,0,0.15)'
  }
  const inputStyle = { width: '100%', padding: '0.5rem', marginTop: '0.25rem', borderRadius: '4px', border: '1px solid #ccc', background: '#f8f9fa', color: '#222' }
  const labelStyle = { display: 'block', marginTop: '0.75rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#333' }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 1rem 0', color: '#222' }}>{project ? '✏️ Edit Project' : '➕ New Project'}</h2>
        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Project Name</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} required placeholder="My Project" />

          <label style={labelStyle}>Repository URL</label>
          <input style={inputStyle} value={repoUrl} onChange={e => setRepoUrl(e.target.value)} required placeholder="https://dev.azure.com/org/_git/repo" />

          <label style={labelStyle}>Tracker Type</label>
          <select style={inputStyle} value={trackerType} onChange={e => setTrackerType(e.target.value)}>
            <option value="azure">🔷 Azure DevOps</option>
            <option value="jira">🟡 Jira</option>
          </select>

          {trackerType === 'azure' && (
            <>
              <label style={labelStyle}>Organization URL</label>
              <input style={inputStyle} value={azdoOrgUrl} onChange={e => setAzdoOrgUrl(e.target.value)} required placeholder="https://dev.azure.com/MyOrg/" />

              <label style={labelStyle}>Project Name</label>
              <input style={inputStyle} value={azdoProject} onChange={e => setAzdoProject(e.target.value)} required placeholder="MyProject" />

              <label style={labelStyle}>Personal Access Token (PAT)</label>
              <input style={inputStyle} type="password" value={azdoPat} onChange={e => setAzdoPat(e.target.value)} required placeholder="your-azdo-pat" />
            </>
          )}

          {trackerType === 'jira' && (
            <>
              <label style={labelStyle}>Jira Server URL</label>
              <input style={inputStyle} value={jiraServerUrl} onChange={e => setJiraServerUrl(e.target.value)} required placeholder="https://your-org.atlassian.net/" />

              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" value={jiraEmail} onChange={e => setJiraEmail(e.target.value)} required placeholder="user@company.com" />

              <label style={labelStyle}>API Token</label>
              <input style={inputStyle} type="password" value={jiraApiToken} onChange={e => setJiraApiToken(e.target.value)} required placeholder="your-jira-api-token" />

              <label style={labelStyle}>Project Key</label>
              <input style={inputStyle} value={jiraProjectKey} onChange={e => setJiraProjectKey(e.target.value)} required placeholder="MYPROJ" />

              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={jiraVerifySsl} onChange={e => setJiraVerifySsl(e.target.checked)} />
                Verify SSL
              </label>

              <hr style={{ border: 'none', borderTop: '1px solid #ddd', margin: '1rem 0 0.5rem' }} />
              <label style={labelStyle}>Git Personal Access Token <span style={{ fontWeight: 'normal', color: '#888', fontSize: '0.8rem' }}>(optional)</span></label>
              <input style={inputStyle} type="password" value={gitPat} onChange={e => setGitPat(e.target.value)} placeholder="PAT for git clone/push" />
              <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                Required if the repo is not on GitHub. For GitHub repos, your login token is used automatically.
              </p>
            </>
          )}

          {/* Git Author Override — common to all tracker types */}
          <hr style={{ border: 'none', borderTop: '1px solid #ddd', margin: '1rem 0 0.5rem' }} />
          <p style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555', margin: '0.5rem 0 0.25rem' }}>
            ✍️ Git Author <span style={{ fontWeight: 'normal', color: '#888', fontSize: '0.75rem' }}>(optional — required by GitLab when the server enforces author membership)</span>
          </p>
          <label style={labelStyle}>Author Name</label>
          <input style={inputStyle} value={gitAuthorName} onChange={e => setGitAuthorName(e.target.value)} placeholder="John Doe" />
          <label style={labelStyle}>Author Email</label>
          <input style={inputStyle} type="email" value={gitAuthorEmail} onChange={e => setGitAuthorEmail(e.target.value)} placeholder="john.doe@company.com" />

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{
              background: '#e9ecef', border: '1px solid #ccc', color: '#333', padding: '0.5rem 1rem',
              borderRadius: '4px', cursor: 'pointer'
            }}>Cancel</button>
            <button type="submit" disabled={saving} style={{
              background: '#4dabf7', border: 'none', color: 'white', padding: '0.5rem 1rem',
              borderRadius: '4px', cursor: 'pointer'
            }}>{saving ? 'Saving...' : 'Save Project'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}


// ---- Delete Confirmation Modal Component ----

function DeleteConfirmModal({ projectName, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1001
    }} onClick={onCancel}>
      <div style={{
        background: '#ffffff', borderRadius: '8px', padding: '2rem',
        width: '400px', maxWidth: '90vw', color: '#222', boxShadow: '0 8px 30px rgba(0,0,0,0.15)'
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#222' }}>🗑️ Delete Project</h3>
        <p style={{ color: '#555', marginBottom: '1.5rem' }}>
          Are you sure you want to delete <strong style={{ color: '#c62828' }}>{projectName}</strong>? This action cannot be undone.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onCancel} style={{
            background: '#e9ecef', border: '1px solid #ccc', color: '#333', padding: '0.5rem 1rem',
            borderRadius: '4px', cursor: 'pointer'
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            background: '#c62828', border: 'none', color: 'white', padding: '0.5rem 1rem',
            borderRadius: '4px', cursor: 'pointer'
          }}>Delete</button>
        </div>
      </div>
    </div>
  )
}


export default App
