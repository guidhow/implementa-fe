import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getJobs } from '../api'

function Jobs() {
  const [statusFilter, setStatusFilter] = useState('')
  
  const { data: jobs, isLoading, error, refetch } = useQuery({
    queryKey: ['jobs', statusFilter],
    queryFn: () => getJobs({ status: statusFilter }),
    refetchInterval: 5000, // Refetch every 5 seconds
  })
  
  if (isLoading) return <div className="container"><div className="loading">Loading jobs...</div></div>
  if (error) return <div className="container"><div className="error">Error loading jobs: {error.message}</div></div>
  
  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Implementation Jobs</h1>
        <button onClick={() => refetch()}>Refresh</button>
      </div>
      
      <div className="card">
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      
      <div className="card">
        <h2>Jobs ({jobs?.length || 0})</h2>
        
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Features</th>
              <th>Branch</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs?.map(job => (
              <tr key={job.id}>
                <td><code>{job.id.substring(0, 8)}</code></td>
                <td>
                  <span className={`badge badge-${job.status}`}>
                    {job.status}
                  </span>
                </td>
                <td>{job.features.length} feature(s)</td>
                <td>{job.branch_name || '-'}</td>
                <td>{new Date(job.created_at).toLocaleString()}</td>
                <td>
                  <Link to={`/jobs/${job.id}`}>View Details</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Jobs
