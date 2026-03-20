import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || '';

function ActiveHandles() {
    const [handles, setHandles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cursor, setCursor] = useState('0');
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const observerRef = useRef(null);
    const loadMoreRef = useRef(null);

    // Fetch active handles
    const fetchHandles = useCallback(async (cursorVal = '0', append = false) => {
        if (append) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }

        try {
            const res = await fetch(`${API_URL}/api/active?cursor=${cursorVal}&limit=100`);
            const data = await res.json();

            if (data.success) {
                if (append) {
                    setHandles(prev => [...prev, ...data.handles]);
                } else {
                    setHandles(data.handles);
                }
                setCursor(data.cursor);
                setHasMore(data.hasMore);
                setTotalCount(data.totalApprox);
            }
        } catch (error) {
            console.error('Failed to fetch handles:', error);
        }

        setLoading(false);
        setLoadingMore(false);
    }, []);

    // Fetch count for stats
    const fetchCount = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/active/count`);
            const data = await res.json();
            if (data.success) {
                setTotalCount(data.count);
            }
        } catch (error) {
            console.error('Failed to fetch count:', error);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchHandles('0', false);
        fetchCount();

        // Auto-refresh count every 5 seconds
        const countInterval = setInterval(fetchCount, 5000);

        return () => {
            clearInterval(countInterval);
        };
    }, [fetchHandles, fetchCount]);

    // Infinite scroll observer
    useEffect(() => {
        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
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
    }, [cursor, hasMore, loadingMore, loading, fetchHandles]);

    // Filter handles by search
    const filteredHandles = handles.filter(h =>
        h.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Format TTL
    const formatTtl = (ttl) => {
        if (ttl === null) return '∞ Forever';
        if (ttl <= 0) return 'Expired';
        if (ttl < 60) return `${ttl}s`;
        if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`;
        if (ttl < 86400) return `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m`;
        return `${Math.floor(ttl / 86400)}d ${Math.floor((ttl % 86400) / 3600)}h`;
    };

    // Format number with commas
    const formatNumber = (num) => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    // Get time ago
    const timeAgo = (dateStr) => {
        const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    return (
        <div className="app active-page">
            {/* Header */}
            <header className="active-header">
                <Link to="/" className="back-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back to Mail
                </Link>
                <div className="active-title">
                    <div className="title-glow"></div>
                    <h1>Active Handles</h1>
                    <span className="live-badge">
                        <span className="live-dot"></span>
                        Live
                    </span>
                </div>
            </header>

            {/* Stats Bar */}
            <div className="active-stats-bar">
                <div className="stat-card primary">
                    <div className="stat-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{formatNumber(totalCount)}</span>
                        <span className="stat-label">Active Handles</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon green">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{filteredHandles.filter(h => h.isPermanent).length}</span>
                        <span className="stat-label">Permanent</span>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="active-search-container">
                <div className="search-box">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search handles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="clear-search" onClick={() => setSearchQuery('')}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>
                <span className="search-results">
                    Showing {formatNumber(filteredHandles.length)} of {formatNumber(handles.length)} loaded
                </span>
            </div>

            {/* Handles Grid */}
            <div className="handles-container">
                {loading ? (
                    <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <p>Loading active handles...</p>
                    </div>
                ) : filteredHandles.length === 0 ? (
                    <div className="empty-state">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M8 15h8" />
                            <circle cx="9" cy="9" r="1" />
                            <circle cx="15" cy="9" r="1" />
                        </svg>
                        <h3>No handles found</h3>
                        <p>{searchQuery ? 'Try a different search term' : 'No active email handles at the moment'}</p>
                    </div>
                ) : (
                    <div className="handles-grid">
                        {filteredHandles.map((handle, index) => (
                            <div
                                key={`${handle.email}-${index}`}
                                className={`handle-card ${handle.isPermanent ? 'permanent' : ''}`}
                            >
                                <div className="handle-main">
                                    <span className="handle-name">@{handle.handle}</span>
                                    <span className="handle-domain">stepmail.tech</span>
                                </div>
                                <div className="handle-meta">
                                    <span className={`handle-ttl ${handle.isPermanent ? 'permanent' : ''}`}>
                                        {handle.isPermanent ? (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                                                    <path d="M18.364 5.636l-2.828 2.828M5.636 18.364l2.828-2.828M5.636 5.636l2.828 2.828M18.364 18.364l-2.828-2.828" />
                                                </svg>
                                                Forever
                                            </>
                                        ) : (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <polyline points="12 6 12 12 16 14" />
                                                </svg>
                                                {formatTtl(handle.ttl)}
                                            </>
                                        )}
                                    </span>
                                    {handle.hasForwarding && (
                                        <span className="handle-forwarding">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                                            </svg>
                                            FWD
                                        </span>
                                    )}
                                </div>
                                <div className="handle-created">
                                    Created {timeAgo(handle.createdAt)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Load more trigger */}
                {hasMore && !loading && (
                    <div ref={loadMoreRef} className="load-more-trigger">
                        {loadingMore && (
                            <div className="loading-more">
                                <div className="loading-spinner small"></div>
                                <span>Loading more...</span>
                            </div>
                        )}
                    </div>
                )}

                {!hasMore && handles.length > 0 && (
                    <div className="end-message">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        All handles loaded
                    </div>
                )}
            </div>
        </div>
    );
}

export default ActiveHandles;
