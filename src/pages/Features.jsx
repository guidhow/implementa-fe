import { useState, useMemo, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getFeatures, getWorkItemTypes, createJob } from '../api'
import { useConfig, useAuth } from '../App'

function Features() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const config = useConfig()
  const { isLoggedIn, githubUser, handleGitHubLogin, authLoading } = useAuth()
  
  const [filters, setFilters] = useState({
    state: '',
    search: '',
    tag: '',
    work_item_type: 'Feature'
  })
  
  const [selectedFeatures, setSelectedFeatures] = useState([])
  const [expandedFeature, setExpandedFeature] = useState(null)
  
  // Fetch available work item types
  const { data: workItemTypes } = useQuery({
    queryKey: ['workItemTypes'],
    queryFn: getWorkItemTypes,
    enabled: isLoggedIn && config.hasActiveProject,
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  })

  // Fetch all features (no state filter) to extract available states
  const { data: allFeatures, isLoading: isFeaturesLoading, error: featuresError } = useQuery({
    queryKey: ['features', { search: filters.search, tag: filters.tag, work_item_type: filters.work_item_type }],
    queryFn: () => getFeatures({ search: filters.search, tag: filters.tag, work_item_type: filters.work_item_type }),
    enabled: isLoggedIn && config.hasActiveProject,
  })

  const availableStates = useMemo(() => {
    return [...new Set((allFeatures || []).map(f => f.state).filter(Boolean))].sort()
  }, [allFeatures])

  // Filter features client-side by state
  const features = useMemo(() => {
    if (!allFeatures) return undefined
    if (!filters.state) return allFeatures
    return allFeatures.filter(f => f.state === filters.state)
  }, [allFeatures, filters.state])

  const isLoading = isFeaturesLoading
  const error = featuresError
  
  const createJobMutation = useMutation({
    mutationFn: createJob,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      navigate(`/jobs/${data.id}`)
    },
  })
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
  }
  
  const handleSelectFeature = (featureId) => {
    setSelectedFeatures(prev => {
      if (prev.includes(featureId)) {
        return prev.filter(id => id !== featureId)
      } else {
        return [...prev, featureId]
      }
    })
  }
  
  const handleSelectAll = () => {
    if (selectedFeatures.length === features?.length) {
      setSelectedFeatures([])
    } else {
      setSelectedFeatures(features?.map(f => f.id) || [])
    }
  }
  
  const toggleExpandFeature = (featureId) => {
    setExpandedFeature(prev => prev === featureId ? null : featureId)
  }
  
  const stripHtml = (html) => {
    if (!html) return null
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return doc.body.textContent || ""
  }
  
  const handleCreateJob = () => {
    if (!isLoggedIn) {
      alert('Please log in with GitHub first to use Copilot.')
      handleGitHubLogin()
      return
    }
    
    if (selectedFeatures.length === 0) {
      alert('Please select at least one feature')
      return
    }
    
    if (!config.hasActiveProject || !config.repoUrl) {
      alert('Please configure a project with a repository URL in the settings (click ⚙️ Config button)')
      return
    }
    
    createJobMutation.mutate({
      repo: config.repoUrl,
      base_branch: config.baseBranch,
      branch_prefix: config.branchPrefix,
      features: (features || []).filter(f => selectedFeatures.includes(f.id)),
      model: config.copilotModel
    })
  }
  
  if (authLoading) return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{
        width: '48px',
        height: '48px',
        border: '4px solid #e0e0e0',
        borderTop: '4px solid #24292e',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        marginBottom: '1.5rem'
      }} />
      <p style={{ fontSize: '1.1rem', color: '#555' }}>Logging in with GitHub...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!isLoggedIn) return (
    <div className="container">
      <h1>Features</h1>
      <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
        <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>🔒 Please log in with GitHub to access features.</p>
        <button onClick={handleGitHubLogin} style={{ background: '#24292e', color: 'white', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '4px', cursor: 'pointer' }}>
          🔑 Login with GitHub
        </button>
      </div>
    </div>
  )

  if (!config.hasActiveProject) return (
    <div className="container">
      <h1>Features</h1>
      <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
        <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>📂 No active project. Please configure a project in the ⚙️ Config panel.</p>
      </div>
    </div>
  )

  if (isLoading) return <div className="container"><div className="loading">Loading features...</div></div>
  if (error) return <div className="container"><div className="error">Error loading features: {error.message}</div></div>
  
  return (
    <div className="container">
      <h1>Features {config.projectName && <span style={{ fontSize: '0.7em', color: '#888' }}>— {config.projectName}</span>}</h1>
      
      <div className="card">
        <h2>Filters</h2>
        <div className="filters">
          <div>
            <label>Type:</label>
            <select name="work_item_type" value={filters.work_item_type} onChange={handleFilterChange}>
              {(workItemTypes || ['Feature']).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label>State:</label>
            <select name="state" value={filters.state} onChange={handleFilterChange}>
              <option value="">All</option>
              {availableStates.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label>Search:</label>
            <input
              type="text"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Search in title..."
            />
          </div>
          
          <div>
            <label>Tag:</label>
            <input
              type="text"
              name="tag"
              value={filters.tag}
              onChange={handleFilterChange}
              placeholder="Filter by tag..."
            />
          </div>
        </div>
      </div>
      
      <div className="card">
        <h2>Features ({features?.length || 0})</h2>
        <p>Selected: {selectedFeatures.length}</p>
        
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>
                <input
                  type="checkbox"
                  checked={selectedFeatures.length === features?.length && features?.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th>ID</th>
              <th>Title</th>
              <th>State</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {features?.map(feature => (
              <Fragment key={feature.id}>
                <tr 
                  onClick={() => toggleExpandFeature(feature.id)}
                  className={`feature-row ${expandedFeature === feature.id ? 'expanded' : ''}`}
                  style={{ cursor: 'pointer' }}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <span className={`expand-icon ${expandedFeature === feature.id ? 'rotated' : ''}`}>
                      ▶
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedFeatures.includes(feature.id)}
                      onChange={() => handleSelectFeature(feature.id)}
                    />
                  </td>
                  <td>{feature.id}</td>
                  <td>{feature.title}</td>
                  <td><span className={`badge badge-${feature.state.toLowerCase()}`}>{feature.state}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {feature.url && (
                      <a href={feature.url} target="_blank" rel="noopener noreferrer">View</a>
                    )}
                  </td>
                </tr>
                {expandedFeature === feature.id && (
                  <tr key={`${feature.id}-details`} className="feature-details-row">
                    <td colSpan="8">
                      <div className="feature-details">
                        <div className="feature-details-section">
                          <h4>📝 Description</h4>
                          <div className="feature-details-content">
                            {feature.description ? (
                              <div dangerouslySetInnerHTML={{ __html: feature.description }} />
                            ) : (
                              <span className="no-content">No description available</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="feature-details-section">
                          <h4>✅ Acceptance Criteria</h4>
                          <div className="feature-details-content">
                            {feature.acceptance_criteria ? (
                              <div dangerouslySetInnerHTML={{ __html: feature.acceptance_criteria }} />
                            ) : (
                              <span className="no-content">No acceptance criteria defined</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="feature-details-grid">
                          <div className="feature-details-item">
                            <strong>📁 Area Path:</strong>
                            <span>{feature.area_path || '-'}</span>
                          </div>
                          <div className="feature-details-item">
                            <strong>🔄 Iteration Path:</strong>
                            <span>{feature.iteration_path || '-'}</span>
                          </div>
                        </div>
                        
                        <div className="feature-details-section">
                          <h4>📎 Attachments ({feature.attachments?.length || 0})</h4>
                          {feature.attachments && feature.attachments.length > 0 ? (
                            <ul className="attachments-list">
                              {feature.attachments.map((att, idx) => (
                                <li key={idx}>
                                  <span className="attachment-icon">📄</span>
                                  <span>{att.name || att}</span>
                                  {att.resource_size > 0 && (
                                    <span className="attachment-size">
                                      ({Math.round(att.resource_size / 1024)} KB)
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="no-content">No attachments</span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      
      {selectedFeatures.length > 0 && (
        <div className="card">
          <h2>Create Implementation Job</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ 
              background: config.repoUrl ? '#e8f5e9' : '#ffebee', 
              padding: '1rem', 
              borderRadius: '8px',
              border: config.repoUrl ? '2px solid #4caf50' : '2px solid #f44336',
              color: '#1a1a2e'
            }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: config.repoUrl ? '#2e7d32' : '#c62828' }}>📋 Job Configuration</h4>
              <p style={{ margin: '0.35rem 0', color: '#333' }}><strong>Repository:</strong> {config.repoUrl || '⚠️ Not configured'}</p>
              <p style={{ margin: '0.35rem 0', color: '#333' }}><strong>Model:</strong> {config.copilotModel}</p>
              <p style={{ margin: '0.35rem 0', color: '#333' }}><strong>Base Branch:</strong> {config.baseBranch}</p>
              <p style={{ margin: '0.35rem 0', color: '#333' }}><strong>Branch Prefix:</strong> {config.branchPrefix}</p>
              <p style={{ margin: '0.35rem 0', color: isLoggedIn ? '#2e7d32' : '#c62828' }}>
                <strong>GitHub:</strong> {isLoggedIn ? `✅ Logged in as ${githubUser?.login}` : '❌ Not logged in'}
              </p>
              {!config.repoUrl && (
                <p style={{ color: '#c62828', marginTop: '0.75rem', fontWeight: '500' }}>
                  ⚠️ Click the "⚙️ Config" button in the navbar to configure the repository URL
                </p>
              )}
            </div>
            
            {!isLoggedIn && (
              <div style={{
                background: '#fff3e0',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '2px solid #ff9800',
                color: '#e65100',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span>🔒</span>
                <span>You must <strong>log in with GitHub</strong> to start implementation jobs.</span>
                <button
                  onClick={handleGitHubLogin}
                  style={{
                    background: '#24292e',
                    border: 'none',
                    color: 'white',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginLeft: '0.5rem',
                    fontSize: '0.85rem'
                  }}
                >
                  🔑 Login with GitHub
                </button>
              </div>
            )}

            <button
              onClick={handleCreateJob}
              disabled={createJobMutation.isPending || !config.repoUrl || !isLoggedIn}
              style={{ alignSelf: 'flex-start' }}
              title={!isLoggedIn ? 'GitHub login required to create jobs' : ''}
            >
              {createJobMutation.isPending ? 'Creating Job...' : !isLoggedIn ? '🔒 GitHub Login Required' : '🚀 Create Job'}
            </button>
            
            {createJobMutation.isError && (
              <div className="error">
                Error creating job: {createJobMutation.error.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Features
