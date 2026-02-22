import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { getJob, getJobLogs } from '../api'

function JobDetail() {
  const { jobId } = useParams()
  
  const { data: job, isLoading, error } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId),
    refetchInterval: (data) => {
      // Stop refetching if job is in terminal state
      return data?.status === 'success' || data?.status === 'failed' || data?.status === 'cancelled'
        ? false
        : 3000
    },
  })
  
  const { data: logs } = useQuery({
    queryKey: ['jobLogs', jobId],
    queryFn: () => getJobLogs(jobId),
    refetchInterval: (data) => {
      return job?.status === 'success' || job?.status === 'failed' || job?.status === 'cancelled'
        ? false
        : 3000
    },
  })
  
  if (isLoading) return <div className="container"><div className="loading">Loading job details...</div></div>
  if (error) return <div className="container"><div className="error">Error loading job: {error.message}</div></div>
  
  return (
    <div className="container">
      <Link to="/jobs">← Back to Jobs</Link>
      
      <h1>Job Details</h1>
      
      <div className="card">
        <h2>Job Information</h2>
        <table>
          <tbody>
            <tr>
              <th>Job ID:</th>
              <td><code>{job.id}</code></td>
            </tr>
            <tr>
              <th>Status:</th>
              <td>
                <span className={`badge badge-${job.status}`}>
                  {job.status}
                </span>
              </td>
            </tr>
            <tr>
              <th>Repository:</th>
              <td>{job.repo}</td>
            </tr>
            <tr>
              <th>Base Branch:</th>
              <td>{job.base_branch}</td>
            </tr>
            <tr>
              <th>Branch Name:</th>
              <td>{job.branch_name || '-'}</td>
            </tr>
            <tr>
              <th>Commit Hash:</th>
              <td>{job.commit_hash ? <code>{job.commit_hash.substring(0, 8)}</code> : '-'}</td>
            </tr>
            <tr>
              <th>Created:</th>
              <td>{new Date(job.created_at).toLocaleString()}</td>
            </tr>
            <tr>
              <th>Started:</th>
              <td>{job.started_at ? new Date(job.started_at).toLocaleString() : '-'}</td>
            </tr>
            <tr>
              <th>Finished:</th>
              <td>{job.finished_at ? new Date(job.finished_at).toLocaleString() : '-'}</td>
            </tr>
            {job.error_message && (
              <tr>
                <th>Error:</th>
                <td className="error">{job.error_message}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div className="card">
        <h2>Features ({job.features.length})</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>State</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {job.features.map(feature => (
              <tr key={feature.id}>
                <td>{feature.id}</td>
                <td>{feature.title}</td>
                <td><span className={`badge badge-${feature.state.toLowerCase()}`}>{feature.state}</span></td>
                <td>
                  {feature.url && (
                    <a href={feature.url} target="_blank" rel="noopener noreferrer">View</a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {logs && logs.length > 0 && (
        <div className="card">
          <h2>Execution Logs</h2>
          <div className="log-viewer">
            {logs.map(log => (
              <div key={log.id} className="log-entry">
                <span className="log-time">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`log-level log-level-${log.level}`}>
                  {log.level}
                </span>
                <span className="log-message">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {job.branch_name && job.status === 'success' && (
        <div className="card" style={{ backgroundColor: '#064e3b', borderColor: '#10b981' }}>
          <h2>✓ Job Completed Successfully</h2>
          <p>Branch <code>{job.branch_name}</code> has been created and pushed to the repository.</p>
          <p>Commit: <code>{job.commit_hash?.substring(0, 8)}</code></p>
          <p>You can now review the changes and create a pull request if needed.</p>
        </div>
      )}
    </div>
  )
}

export default JobDetail
