import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || '';

function AdminDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    const [stats, setStats] = useState(null);
    const [logs, setLogs] = useState([]);
    const [handles, setHandles] = useState([]);
    const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'handles', 'logs'
    const [loading, setLoading] = useState(false);
    const [cursor, setCursor] = useState('0');
    const [hasMore, setHasMore] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [logFilter, setLogFilter] = useState('');

    const observerRef = useRef(null);
    const loadMoreRef = useRef(null);

    // Check if already authenticated (session storage)
    useEffect(() => {
        const savedPassword = sessionStorage.getItem('adminPassword');
        if (savedPassword) {
            setPassword(savedPassword);
            setIsAuthenticated(true);
        }
    }, []);

    // Login handler
    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError('');

        try {
            const res = await fetch(`${API_URL}/api/admin/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await res.json();

            if (data.success) {
                setIsAuthenticated(true);
                sessionStorage.setItem('adminPassword', password);
            } else {
                setAuthError('Invalid password');
            }
        } catch (error) {
            setAuthError('Connection error');
        }

        setAuthLoading(false);
    };

    // Fetch stats
    const fetchStats = useCallback(async () => {
        if (!isAuthenticated) return;

        try {
            const res = await fetch(`${API_URL}/api/admin/stats`, {
                headers: { 'X-Admin-Password': password }
            });
            const data = await res.json();
            if (data.success) {
                setStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }, [isAuthenticated, password]);

    // Fetch logs
    const fetchLogs = useCallback(async () => {
        if (!isAuthenticated) return;

        try {
            const url = logFilter
                ? `${API_URL}/api/admin/logs?limit=200&type=${logFilter}`
                : `${API_URL}/api/admin/logs?limit=200`;
            const res = await fetch(url, {
                headers: { 'X-Admin-Password': password }
            });
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs);
            }
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        }
    }, [isAuthenticated, password, logFilter]);

    // Fetch handles
    const fetchHandles = useCallback(async (cursorVal = '0', append = false) => {
        if (!isAuthenticated) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/handles?cursor=${cursorVal}&limit=100`, {
                headers: { 'X-Admin-Password': password }
            });
            const data = await res.json();

            if (data.success) {
                if (append) {
                    setHandles(prev => [...prev, ...data.handles]);
                } else {
                    setHandles(data.handles);
                }
                setCursor(data.cursor);
                setHasMore(data.hasMore);
            }
        } catch (error) {
            console.error('Failed to fetch handles:', error);
        }
        setLoading(false);
    }, [isAuthenticated, password]);

    // Delete handle
    const deleteHandle = async (email) => {
        if (!confirm(`Delete ${email}?`)) return;

        try {
            const res = await fetch(`${API_URL}/api/admin/handle/${encodeURIComponent(email)}`, {
                method: 'DELETE',
                headers: { 'X-Admin-Password': password }
            });
            const data = await res.json();

            if (data.success) {
                setHandles(prev => prev.filter(h => h.email !== email));
                fetchStats();
            }
        } catch (error) {
            console.error('Failed to delete handle:', error);
        }
    };

    // Load data on auth
    useEffect(() => {
        if (isAuthenticated) {
            fetchStats();
            fetchLogs();
            fetchHandles('0', false);

            // Auto-refresh stats every 10 seconds
            const interval = setInterval(fetchStats, 10000);
            return () => clearInterval(interval);
        }
    }, [isAuthenticated, fetchStats, fetchLogs, fetchHandles]);

    // Refresh logs when filter changes
    useEffect(() => {
        if (isAuthenticated) {
            fetchLogs();
        }
    }, [logFilter, fetchLogs]);

    // Infinite scroll for handles
    useEffect(() => {
        if (activeTab !== 'handles') return;

        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !loading) {
                    fetchHandles(cursor, true);
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observerRef.current.observe(loadMoreRef.current);
        }

        return () => {
            if (observerRef.current) observerRef.current.disconnect();
        };
    }, [cursor, hasMore, loading, activeTab, fetchHandles]);

    // Filter handles
    const filteredHandles = handles.filter(h =>
        h.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Format helpers
    const formatUptime = (seconds) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${mins}m`;
    };

    const formatTtl = (ttl) => {
        if (ttl === null) return '∞ Forever';
        if (ttl <= 0) return 'Expired';
        if (ttl < 60) return `${ttl}s`;
        if (ttl < 3600) return `${Math.floor(ttl / 60)}m`;
        if (ttl < 86400) return `${Math.floor(ttl / 3600)}h`;
        return `${Math.floor(ttl / 86400)}d`;
    };

    const formatNumber = (num) => num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") || '0';

    const timeAgo = (dateStr) => {
        const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    const getLogTypeColor = (type) => {
        switch (type) {
            case 'error': return '#ff4444';
            case 'email_received': return '#00d4ff';
            case 'email_sent': return '#4CAF50';
            case 'spam_blocked': return '#ff9800';
            case 'rate_limited': return '#e91e63';
            default: return '#888';
        }
    };

    // Login screen
    if (!isAuthenticated) {
        return (
            <div className="app admin-login">
                <div className="login-container">
                    <div className="login-card">
                        <div className="login-header">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <h1>Admin Dashboard</h1>
                            <p>Enter password to continue</p>
                        </div>

                        <form onSubmit={handleLogin}>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Admin password"
                                autoFocus
                            />
                            {authError && <div className="auth-error">{authError}</div>}
                            <button type="submit" disabled={authLoading}>
                                {authLoading ? 'Verifying...' : 'Login'}
                            </button>
                        </form>

                        <Link to="/" className="back-link">← Back to StepMail</Link>
                    </div>
                </div>
            </div>
        );
    }

    // Dashboard
    return (
        <div className="app admin-dashboard">
            {/* Header */}
            <header className="admin-header">
                <Link to="/" className="back-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back
                </Link>
                <h1>Admin Dashboard</h1>
                <button
                    className="logout-btn"
                    onClick={() => {
                        sessionStorage.removeItem('adminPassword');
                        setIsAuthenticated(false);
                        setPassword('');
                    }}
                >
                    Logout
                </button>
            </header>

            {/* Tabs */}
            <div className="admin-tabs">
                <button
                    className={activeTab === 'overview' ? 'active' : ''}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview
                </button>
                <button
                    className={activeTab === 'handles' ? 'active' : ''}
                    onClick={() => setActiveTab('handles')}
                >
                    Handles ({formatNumber(stats?.handles?.total)})
                </button>
                <button
                    className={activeTab === 'logs' ? 'active' : ''}
                    onClick={() => setActiveTab('logs')}
                >
                    Logs
                </button>
            </div>

            {/* Content */}
            <div className="admin-content">
                {activeTab === 'overview' && stats && (
                    <div className="overview-grid">
                        {/* System Stats */}
                        <div className="stat-card large">
                            <h3>System</h3>
                            <div className="stat-row">
                                <span>CPU</span>
                                <span className="stat-value">{stats.system.cpu.percentage}%</span>
                            </div>
                            <div className="progress-bar">
                                <div style={{ width: `${stats.system.cpu.percentage}%` }}></div>
                            </div>
                            <div className="stat-row">
                                <span>Memory</span>
                                <span className="stat-value">{stats.system.memory.used}GB / {stats.system.memory.total}GB</span>
                            </div>
                            <div className="progress-bar">
                                <div style={{ width: `${stats.system.memory.percentage}%` }}></div>
                            </div>
                            <div className="stat-row">
                                <span>Uptime</span>
                                <span className="stat-value">{formatUptime(stats.system.uptime)}</span>
                            </div>
                            <div className="stat-row">
                                <span>Node Uptime</span>
                                <span className="stat-value">{formatUptime(stats.system.nodeUptime)}</span>
                            </div>
                        </div>

                        {/* Handles Stats */}
                        <div className="stat-card">
                            <h3>Email Handles</h3>
                            <div className="big-number">{formatNumber(stats.handles.total)}</div>
                            <div className="stat-breakdown">
                                <span>Permanent: {formatNumber(stats.handles.permanent)}</span>
                                <span>Expiring: {formatNumber(stats.handles.expiring)}</span>
                            </div>
                        </div>

                        {/* Redis Stats */}
                        <div className="stat-card">
                            <h3>Redis</h3>
                            <div className="stat-row">
                                <span>Memory</span>
                                <span className="stat-value">{stats.redis.memory}</span>
                            </div>
                            <div className="stat-row">
                                <span>Clients</span>
                                <span className="stat-value">{stats.redis.clients}</span>
                            </div>
                            <div className="stat-row">
                                <span>Total Connections</span>
                                <span className="stat-value">{formatNumber(stats.redis.totalConnections)}</span>
                            </div>
                        </div>

                        {/* Rate Limiting */}
                        <div className="stat-card">
                            <h3>Rate Limiting</h3>
                            <div className="stat-row">
                                <span>Active Rate Limit Keys</span>
                                <span className="stat-value">{stats.rateLimiting.activeKeys}</span>
                            </div>
                        </div>

                        {/* Config */}
                        <div className="stat-card">
                            <h3>Configuration</h3>
                            <div className="stat-row">
                                <span>Domain</span>
                                <span className="stat-value">{stats.config.emailDomain}</span>
                            </div>
                            <div className="stat-row">
                                <span>Default TTL</span>
                                <span className="stat-value">{stats.config.defaultTTL}s</span>
                            </div>
                            <div className="stat-row">
                                <span>Spam Threshold</span>
                                <span className="stat-value">{stats.config.spamThreshold}</span>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'handles' && (
                    <div className="handles-section">
                        <div className="search-bar">
                            <input
                                type="text"
                                placeholder="Search handles..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="handles-table">
                            <div className="table-header">
                                <span>Email</span>
                                <span>TTL</span>
                                <span>Inbox</span>
                                <span>Forward</span>
                                <span>Created</span>
                                <span>Actions</span>
                            </div>

                            {loading && handles.length === 0 ? (
                                <div className="loading-state">Loading...</div>
                            ) : (
                                filteredHandles.map((handle, index) => (
                                    <div key={`${handle.email}-${index}`} className="table-row">
                                        <span className="email-cell">{handle.email}</span>
                                        <span className={handle.isPermanent ? 'permanent' : ''}>
                                            {formatTtl(handle.ttl)}
                                        </span>
                                        <span>{handle.inboxCount}</span>
                                        <span>{handle.forwardTo || '-'}</span>
                                        <span>{timeAgo(handle.createdAt)}</span>
                                        <span>
                                            <button
                                                className="delete-btn"
                                                onClick={() => deleteHandle(handle.email)}
                                            >
                                                Delete
                                            </button>
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        {hasMore && (
                            <div ref={loadMoreRef} className="load-more">
                                {loading && <span>Loading more...</span>}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="logs-section">
                        <div className="logs-filter">
                            <select value={logFilter} onChange={(e) => setLogFilter(e.target.value)}>
                                <option value="">All Logs</option>
                                <option value="info">Info</option>
                                <option value="error">Errors</option>
                                <option value="email_received">Emails Received</option>
                                <option value="email_sent">Emails Sent</option>
                                <option value="spam_blocked">Spam Blocked</option>
                                <option value="rate_limited">Rate Limited</option>
                            </select>
                            <button onClick={fetchLogs}>Refresh</button>
                        </div>

                        <div className="logs-container">
                            {logs.length === 0 ? (
                                <div className="empty-logs">No logs found</div>
                            ) : (
                                logs.map((log, index) => (
                                    <div key={index} className="log-entry">
                                        <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                        <span
                                            className="log-type"
                                            style={{ color: getLogTypeColor(log.type) }}
                                        >
                                            [{log.type}]
                                        </span>
                                        <span className="log-message">{log.message}</span>
                                        {Object.keys(log.details).length > 0 && (
                                            <span className="log-details">
                                                {JSON.stringify(log.details)}
                                            </span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminDashboard;
