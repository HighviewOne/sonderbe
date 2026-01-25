import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/supabase'

export function ClientList() {
  const [clients, setClients] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'client')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading clients:', error)
    } else {
      setClients(data as Profile[])
    }
    setLoading(false)
  }

  const filteredClients = clients.filter(client =>
    client.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    client.email.toLowerCase().includes(search.toLowerCase()) ||
    client.phone?.includes(search)
  )

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading clients...</p>
      </div>
    )
  }

  return (
    <div className="client-list">
      <div className="page-header">
        <h1>Clients</h1>
        <p>{clients.length} total clients</p>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {filteredClients.length === 0 ? (
        <div className="empty-state">
          {search ? 'No clients match your search' : 'No clients yet'}
        </div>
      ) : (
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => (
                <tr key={client.id}>
                  <td>
                    <Link to={`/admin/clients/${client.id}`} className="client-name-link">
                      {client.full_name || 'No name set'}
                    </Link>
                  </td>
                  <td>{client.email}</td>
                  <td>{client.phone || '-'}</td>
                  <td>{new Date(client.created_at).toLocaleDateString()}</td>
                  <td>
                    <Link to={`/admin/clients/${client.id}`} className="btn btn-small">
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
