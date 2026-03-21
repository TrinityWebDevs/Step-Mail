import { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || '';

function App() {
  const [email, setEmail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' or 'sent'
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [ttl, setTtl] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeName, setComposeName] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeAttachments, setComposeAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState(false);

  // Custom email states
  const [showCustom, setShowCustom] = useState(false);
  const [customHandle, setCustomHandle] = useState('');
  const [customTtl, setCustomTtl] = useState('10'); // minutes
  const [customTtlUnit, setCustomTtlUnit] = useState('minutes');
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState(null); // null, 'available', 'taken', 'error'
  const [customError, setCustomError] = useState('');

  // Forwarding states
  const [showForwarding, setShowForwarding] = useState(false);
  const [forwardEnabled, setForwardEnabled] = useState(false);
  const [forwardTo, setForwardTo] = useState('');
  const [forwardingSaving, setForwardingSaving] = useState(false);
  const [forwardingError, setForwardingError] = useState('');
  const [forwardingSuccess, setForwardingSuccess] = useState(false);

  const checkAvailability = async (handle) => {
    if (!handle || handle.length < 3) {
      setAvailabilityStatus(null);
      return;
    }
    setCheckingAvailability(true);
    try {
      const res = await fetch(`${API_URL}/api/check/${encodeURIComponent(handle)}`);
      const data = await res.json();
      if (data.error) {
        setAvailabilityStatus('error');
        setCustomError(data.error);
      } else {
        setAvailabilityStatus(data.available ? 'available' : 'taken');
        setCustomError('');
      }
    } catch (error) {
      setAvailabilityStatus('error');
      setCustomError('Failed to check availability');
    }
    setCheckingAvailability(false);
  };

  const handleCustomHandleChange = (e) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '');
    setCustomHandle(value);
    setAvailabilityStatus(null);
    // Debounce check
    clearTimeout(window.checkTimeout);
    window.checkTimeout = setTimeout(() => checkAvailability(value), 500);
  };

  const getTtlInMinutes = () => {
    if (customTtlUnit === 'permanent') return -1; // permanent flag
    const value = parseInt(customTtl) || 10;
    switch (customTtlUnit) {
      case 'hours': return Math.min(value * 60, 525600);
      case 'days': return Math.min(value * 60 * 24, 525600);
      case 'weeks': return Math.min(value * 60 * 24 * 7, 525600);
      case 'months': return Math.min(value * 60 * 24 * 30, 525600);
      default: return Math.min(value, 525600);
    }
  };

  const createCustomEmail = async () => {
    if (!customHandle || customHandle.length < 3) {
      setCustomError('Handle must be at least 3 characters');
      return;
    }
    if (availabilityStatus !== 'available') {
      setCustomError('Please enter an available handle');
      return;
    }
    setLoading(true);
    setCustomError('');
    try {
      const res = await fetch(`${API_URL}/api/create-custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localPart: customHandle,
          ttlMinutes: -1, // Always permanent
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEmail(data.email);
        setTtl(-1); // Always permanent
        setMessages([]);
        setSelectedMessage(null);
        setShowCustom(false);
        setCustomHandle('');
        setAvailabilityStatus(null);
        localStorage.setItem('tempEmail', data.email);
        localStorage.setItem('tempEmailExpiry', 'permanent');
      } else {
        setCustomError(data.error || 'Failed to create email');
      }
    } catch (error) {
      console.error('Failed to create custom email:', error);
      setCustomError('Failed to create email');
    }
    setLoading(false);
  };

  const sendEmail = async () => {
    if (!composeTo || !composeSubject) {
      setSendError('Please fill in To and Subject fields');
      return;
    }
    setSending(true);
    setSendError('');
    try {
      // Convert attachments to base64
      const attachmentsData = await Promise.all(
        composeAttachments.map(async (file) => {
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64String = reader.result.split(',')[1];
              resolve(base64String);
            };
            reader.readAsDataURL(file);
          });
          return {
            filename: file.name,
            content: base64,
          };
        })
      );

      const res = await fetch(`${API_URL}/api/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: email,
          fromName: composeName.trim() || 'StepMail',
          to: composeTo,
          subject: composeSubject,
          text: composeBody,
          attachments: attachmentsData,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSendSuccess(true);
        setTimeout(() => {
          setShowCompose(false);
          setComposeName('');
          setComposeTo('');
          setComposeSubject('');
          setComposeBody('');
          setComposeAttachments([]);
          setSendSuccess(false);
        }, 2000);
      } else {
        setSendError(data.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Failed to send:', error);
      setSendError('Failed to send email');
    }
    setSending(false);
  };

  const generateEmail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/generate`);
      const data = await res.json();
      if (data.success) {
        setEmail(data.email);
        setTtl(data.ttl);
        setMessages([]);
        setSelectedMessage(null);
        localStorage.setItem('tempEmail', data.email);
        localStorage.setItem('tempEmailExpiry', Date.now() + data.ttl * 1000);
      }
    } catch (error) {
      console.error('Failed to generate email:', error);
    }
    setLoading(false);
  };

  const fetchInbox = useCallback(async () => {
    if (!email) return;
    try {
      const res = await fetch(`${API_URL}/api/inbox/${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages);
        setTtl(data.ttl);
      }
    } catch (error) {
      console.error('Failed to fetch inbox:', error);
    }
  }, [email]);

  const fetchSent = useCallback(async () => {
    if (!email) return;
    try {
      const res = await fetch(`${API_URL}/api/sent/${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.success) {
        setSentMessages(data.messages);
      }
    } catch (error) {
      console.error('Failed to fetch sent:', error);
    }
  }, [email]);

  const fetchForwardingSettings = useCallback(async () => {
    if (!email) return;
    try {
      const res = await fetch(`${API_URL}/api/forwarding/${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.success) {
        setForwardEnabled(data.forwardEnabled || false);
        setForwardTo(data.forwardTo || '');
      }
    } catch (error) {
      console.error('Failed to fetch forwarding settings:', error);
    }
  }, [email]);

  const saveForwardingSettings = async () => {
    setForwardingSaving(true);
    setForwardingError('');
    setForwardingSuccess(false);
    try {
      const res = await fetch(`${API_URL}/api/forwarding/${encodeURIComponent(email)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forwardEnabled,
          forwardTo,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setForwardingSuccess(true);
        setTimeout(() => setForwardingSuccess(false), 2000);
      } else {
        setForwardingError(data.error || 'Failed to save settings');
      }
    } catch (error) {
      setForwardingError('Failed to save settings');
    }
    setForwardingSaving(false);
  };

  const refreshEmail = async () => {
    if (!email) return;
    try {
      const res = await fetch(`${API_URL}/api/refresh/${encodeURIComponent(email)}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setTtl(data.ttl);
        localStorage.setItem('tempEmailExpiry', Date.now() + data.ttl * 1000);
      }
    } catch (error) {
      console.error('Failed to refresh:', error);
    }
  };

  const copyEmail = async () => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = email;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      await fetch(`${API_URL}/api/inbox/${encodeURIComponent(email)}/${messageId}`, {
        method: 'DELETE',
      });
      setMessages(msgs => msgs.filter(m => m.id !== messageId));
      if (selectedMessage?.id === messageId) {
        setSelectedMessage(null);
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  // Submit spam feedback to train the model
  const submitSpamFeedback = async (messageId, isActuallySpam) => {
    try {
      const res = await fetch(`${API_URL}/api/spam-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          messageId,
          isSpam: isActuallySpam,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Update the message in state to show feedback was submitted
        setMessages(msgs => msgs.map(m =>
          m.id === messageId ? { ...m, feedbackSubmitted: true, userMarkedSpam: isActuallySpam } : m
        ));
        if (selectedMessage?.id === messageId) {
          setSelectedMessage(prev => ({ ...prev, feedbackSubmitted: true, userMarkedSpam: isActuallySpam }));
        }
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  // Get color class based on spam score (0-6 scale)
  const getScoreColorClass = (score) => {
    if (score < 1) return 'score-safe';      // Green - very safe
    if (score < 2) return 'score-low';       // Light green - safe
    if (score < 3) return 'score-medium';    // Yellow - suspicious
    if (score < 4) return 'score-high';      // Orange - likely spam
    return 'score-spam';                      // Red - spam
  };

  const getScoreLabel = (score) => {
    if (score < 1) return 'Very Safe';
    if (score < 2) return 'Safe';
    if (score < 3) return 'Suspicious';
    if (score < 4) return 'Likely Spam';
    return 'Spam';
  };

  const releaseEmailAndCreateNew = async () => {
    // Release the old email handle first
    if (email) {
      try {
        await fetch(`${API_URL}/api/email/${encodeURIComponent(email)}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('Failed to release email:', error);
      }
    }
    // Clear local state
    setEmail(null);
    setMessages([]);
    setSentMessages([]);
    setSelectedMessage(null);
    setActiveTab('inbox');
    localStorage.removeItem('tempEmail');
    localStorage.removeItem('tempEmailExpiry');
  };

  useEffect(() => {
    const savedEmail = localStorage.getItem('tempEmail');
    const savedExpiry = localStorage.getItem('tempEmailExpiry');
    if (savedEmail && savedExpiry) {
      if (savedExpiry === 'permanent') {
        setEmail(savedEmail);
        setTtl(-1); // permanent
      } else if (Date.now() < parseInt(savedExpiry)) {
        setEmail(savedEmail);
        setTtl(Math.floor((parseInt(savedExpiry) - Date.now()) / 1000));
      }
    }
  }, []);

  useEffect(() => {
    if (!email) return;
    fetchInbox();
    fetchSent();
    fetchForwardingSettings();
    const interval = setInterval(() => {
      fetchInbox();
      fetchSent();
    }, 3000);
    return () => clearInterval(interval);
  }, [email, fetchInbox, fetchSent, fetchForwardingSettings]);

  useEffect(() => {
    // Don't run countdown for permanent emails (ttl === -1)
    if (ttl <= 0 && ttl !== -1) return;
    if (ttl === -1) return; // permanent, no countdown
    const interval = setInterval(() => {
      setTtl(t => {
        if (t === -1) return -1; // permanent
        if (t <= 1) {
          setEmail(null);
          setMessages([]);
          localStorage.removeItem('tempEmail');
          localStorage.removeItem('tempEmailExpiry');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [ttl]);

  const formatTime = (seconds) => {
    if (seconds === -1) return 'Permanent';
    if (seconds >= 86400) {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      return `${days}d ${hours}h`;
    }
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${mins}m`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getEmailParts = (email) => {
    const [local, domain] = email.split('@');
    return { local, domain };
  };

  return (
    <div className="app">
      {/* Top Bar with Logo and Active Handles */}
      <div className="top-bar">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 512 512" fill="none">
              <circle fill="#EEEDF2" cx="255.4" cy="256" r="215.6" />
              <circle fill="#434765" cx="375.5" cy="214.3" r="35" />
              <path fill="#32b4f5" stroke="#494a5b" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" d="M406.9,292.5v152.6c0,14.1-11.4,25.5-25.5,25.5h-252c-14.1,0-25.5-11.4-25.5-25.5V292.5c0-2.7,0.5-5.4,1.6-7.9c1.1-2.7,2.7-5.2,4.9-7.2l122.5-116.9c12.6-12,32.4-12,45.1,0l122.5,116.9c2.2,2.1,3.8,4.5,4.9,7.2C406.3,287.1,406.9,289.8,406.9,292.5z" />
              <path fill="none" stroke="#494a5b" strokeWidth="6" strokeLinejoin="round" d="M405.3,284.7l-43.6,29.4l-69.5,46.8c-22.2,15-51.3,15-73.6,0l-69.5-46.8l-43.6-29.4" />
              <path fill="#FFFFFF" stroke="#494a5b" strokeWidth="6" strokeLinejoin="round" d="M361.7,270.8v43.3l-80.5,54.2c-15.6,10.5-35.9,10.5-51.5,0l-80.5-54.2v-43.3c0-1.9,1.5-3.4,3.4-3.4h205.7C360.1,267.3,361.7,268.9,361.7,270.8z" />
              <line stroke="#494a5b" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" x1="202.3" x2="308.5" y1="330.4" y2="330.4" />
              <line stroke="#494a5b" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" x1="202.3" x2="308.5" y1="315.7" y2="315.7" />
              <line stroke="#494a5b" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" x1="202.3" x2="308.5" y1="300.9" y2="300.9" />
              <circle opacity="0.4" fill="#FFFFFF" cx="361.7" cy="205.5" r="35" />
              <line stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" x1="426.6" x2="418.2" y1="169.6" y2="174.7" />
              <line stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" x1="432" x2="423.3" y1="183.6" y2="183.8" />
              <line stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" x1="411.5" x2="415.3" y1="166.6" y2="158.1" />
              <circle fill="#434765" cx="331.4" cy="128" r="35" />
              <circle fill="#79CAA1" stroke="#494a5b" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" cx="317.1" cy="117.2" r="35" />
              <line stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" x1="308.1" x2="306.4" y1="56.8" y2="65.3" />
              <line stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" x1="293.2" x2="296.5" y1="59.3" y2="68.6" />
              <line stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" x1="287.3" x2="279.7" y1="73.5" y2="68" />
              <circle fill="#434765" cx="237.3" cy="105.5" r="35" />
              <circle fill="#F0C330" stroke="#494a5b" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" cx="220.4" cy="98.3" r="35" />
              <line stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" x1="172" x2="166.3" y1="124.9" y2="132.3" />
              <line stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" x1="158" x2="167.3" y1="118.6" y2="115.5" />
              <line stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" x1="155.9" x2="164.4" y1="103.6" y2="105.5" />
            </svg>
          </div>
          <div className="logo-text">
            <h1>StepMail</h1>
            <span>by stepmail.com</span>
          </div>
        </div>
      </div>

      {/* Background gradient orbs */}
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>
      <div className="bg-orb bg-orb-3"></div>

      <div className="container">

        <main className="main">
          {!email ? (
            <div className="hero">
              <div className="hero-content">
                <h2>Instant Disposable Email</h2>
                <p>Your private email address that stays forever</p>

                <div className="features">
                  <div className="feature">
                    <span className="feature-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    </span>
                    <span>Instant</span>
                  </div>
                  <div className="feature">
                    <span className="feature-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="M9 12l2 2 4-4" />
                      </svg>
                    </span>
                    <span>Private</span>
                  </div>
                  <div className="feature">
                    <span className="feature-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
                      </svg>
                    </span>
                    <span>Forever</span>
                  </div>
                </div>

                {
                  <div className="custom-email-form">
                    <div className="custom-input-row">
                      <div className="custom-input-wrapper">
                        <input
                          type="text"
                          value={customHandle}
                          onChange={handleCustomHandleChange}
                          placeholder="yourname"
                          className={`custom-input ${availabilityStatus === 'available' ? 'available' : ''} ${availabilityStatus === 'taken' || availabilityStatus === 'error' ? 'taken' : ''}`}
                          maxLength={20}
                        />
                        <span className="domain-suffix">@stepmail.tech</span>
                        {checkingAvailability && <span className="checking-indicator"></span>}
                        {availabilityStatus === 'available' && (
                          <span className="status-icon available">✓</span>
                        )}
                        {availabilityStatus === 'taken' && (
                          <span className="status-icon taken">✗</span>
                        )}
                      </div>
                    </div>

                    {customError && <div className="custom-error">{customError}</div>}
                    {availabilityStatus === 'taken' && <div className="custom-error">This handle is already taken</div>}

                    <div className="custom-actions">
                      <button
                        className="create-btn"
                        onClick={createCustomEmail}
                        disabled={loading || availabilityStatus !== 'available'}
                      >
                        {loading ? (
                          <span className="loading-spinner"></span>
                        ) : (
                          <>
                            <span>Create Email</span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          ) : (
            <div className="inbox-view">
              {/* Email Card */}
              <div className="email-card">
                <div className="email-card-header">
                  <div className="timer-badge permanent">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
                    </svg>
                    <span>Active · Forever</span>
                  </div>
                </div>

                <div className="email-address-display">
                  <span className="email-local">{getEmailParts(email).local}</span>
                  <span className="email-at">@</span>
                  <span className="email-domain">{getEmailParts(email).domain}</span>
                </div>

                <div className="email-actions">
                  <button className={`action-btn copy-btn ${copying ? 'copied' : ''}`} onClick={copyEmail}>
                    {copying ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  <button className="action-btn new-btn" onClick={releaseEmailAndCreateNew}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12l7-7 7 7" />
                    </svg>
                    <span>New</span>
                  </button>
                  <button className="action-btn compose-btn" onClick={() => setShowCompose(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    <span>Compose</span>
                  </button>
                  <button className={`action-btn forward-btn ${forwardEnabled ? 'active' : ''}`} onClick={() => setShowForwarding(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 10 20 15 15 20" />
                      <path d="M4 4v7a4 4 0 0 0 4 4h12" />
                    </svg>
                    <span>Forward</span>
                  </button>
                </div>
              </div>

              {/* Inbox */}
              <div className="inbox-container">
                <div className="inbox-sidebar">
                  <div className="inbox-tabs">
                    <button
                      className={`tab-btn ${activeTab === 'inbox' ? 'active' : ''}`}
                      onClick={() => { setActiveTab('inbox'); setSelectedMessage(null); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      Inbox
                      <span className="message-count">{messages.length}</span>
                    </button>
                    <button
                      className={`tab-btn ${activeTab === 'sent' ? 'active' : ''}`}
                      onClick={() => { setActiveTab('sent'); setSelectedMessage(null); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                      Sent
                      <span className="message-count">{sentMessages.length}</span>
                    </button>
                  </div>

                  {activeTab === 'inbox' ? (
                    messages.length === 0 ? (
                      <div className="empty-inbox">
                        <div className="empty-icon">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                          </svg>
                        </div>
                        <p>No emails yet</p>
                        <span>Share your address and messages will appear here instantly</span>
                        <div className="empty-pulse">
                          <div className="pulse-dot"></div>
                          Listening for new mail…
                        </div>
                      </div>
                    ) : (
                      <ul className="message-list">
                        {messages.map((msg) => (
                          <li
                            key={msg.id}
                            className={`message-item ${selectedMessage?.id === msg.id ? 'selected' : ''} ${msg.spam?.isSpam ? 'spam' : ''}`}
                            onClick={() => setSelectedMessage(msg)}
                          >
                            <div className="message-avatar">
                              {msg.from.charAt(0).toUpperCase()}
                            </div>
                            <div className="message-preview">
                              <div className="message-from">
                                {msg.from.split('<')[0].trim() || 'Unknown'}
                                {msg.spam?.isSpam && <span className="spam-badge">Spam</span>}
                              </div>
                              <div className="message-subject">{msg.subject || '(No Subject)'}</div>
                            </div>
                            <div className="message-time">{formatDate(msg.date)}</div>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : (
                    sentMessages.length === 0 ? (
                      <div className="empty-inbox">
                        <div className="empty-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                        </div>
                        <p>No sent emails</p>
                        <span>Messages you send will appear here</span>
                      </div>
                    ) : (
                      <ul className="message-list">
                        {sentMessages.map((msg) => (
                          <li
                            key={msg.id}
                            className={`message-item ${selectedMessage?.id === msg.id ? 'selected' : ''}`}
                            onClick={() => setSelectedMessage({ ...msg, isSent: true })}
                          >
                            <div className="message-avatar sent">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                              </svg>
                            </div>
                            <div className="message-preview">
                              <div className="message-from">To: {msg.to}</div>
                              <div className="message-subject">{msg.subject || '(No Subject)'}</div>
                            </div>
                            <div className="message-time">{formatDate(msg.date)}</div>
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </div>

                <div className="message-panel">
                  {selectedMessage ? (
                    <div className="message-content">
                      <div className="message-content-header">
                        <div className="message-info">
                          <h2>{selectedMessage.subject || '(No Subject)'}</h2>
                          <div className="message-meta">
                            {selectedMessage.isSent ? (
                              <span className="from">To: {selectedMessage.to}</span>
                            ) : (
                              <span className="from">From: {selectedMessage.from}</span>
                            )}
                            <span className="date">{new Date(selectedMessage.date).toLocaleString()}</span>
                          </div>
                          {!selectedMessage.isSent && selectedMessage.spam && (
                            <div className="spam-info-section">
                              <div className="spam-score-display">
                                <span className={`score-badge ${getScoreColorClass(selectedMessage.spam.score || 0)}`}>
                                  {getScoreLabel(selectedMessage.spam.score || 0)}
                                  <span className="score-number">({(selectedMessage.spam.score || 0).toFixed(1)})</span>
                                </span>
                                {selectedMessage.forwarded && (
                                  <span className="badge badge-forwarded">📤 Forwarded</span>
                                )}
                              </div>
                              {!selectedMessage.feedbackSubmitted ? (
                                <div className="spam-feedback">
                                  <span className="feedback-label">Was this correct?</span>
                                  <button
                                    className="feedback-btn feedback-correct"
                                    onClick={() => submitSpamFeedback(selectedMessage.id, selectedMessage.spam.isSpam)}
                                    title="Yes, correct classification"
                                  >
                                    👍
                                  </button>
                                  <button
                                    className="feedback-btn feedback-wrong"
                                    onClick={() => submitSpamFeedback(selectedMessage.id, !selectedMessage.spam.isSpam)}
                                    title="No, wrong classification"
                                  >
                                    👎
                                  </button>
                                </div>
                              ) : (
                                <div className="feedback-submitted">
                                  ✓ Thanks for your feedback!
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {!selectedMessage.isSent && (
                          <button className="delete-btn" onClick={() => deleteMessage(selectedMessage.id)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {/* Attachments */}
                      {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                        <div className="attachments-section">
                          <div className="attachments-header">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                            </svg>
                            <span>{selectedMessage.attachments.length} Attachment{selectedMessage.attachments.length > 1 ? 's' : ''}</span>
                          </div>
                          <div className="attachments-list">
                            {selectedMessage.attachments.map((att, index) => (
                              <button
                                key={index}
                                className="attachment-item"
                                onClick={() => {
                                  if (att.content) {
                                    const byteCharacters = atob(att.content);
                                    const byteNumbers = new Array(byteCharacters.length);
                                    for (let i = 0; i < byteCharacters.length; i++) {
                                      byteNumbers[i] = byteCharacters.charCodeAt(i);
                                    }
                                    const byteArray = new Uint8Array(byteNumbers);
                                    const blob = new Blob([byteArray], { type: att.contentType });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = att.filename || 'attachment';
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                  }
                                }}
                              >
                                <div className="attachment-icon">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                  </svg>
                                </div>
                                <div className="attachment-info">
                                  <span className="attachment-name">{att.filename || 'Untitled'}</span>
                                  <span className="attachment-size">{att.size ? `${(att.size / 1024).toFixed(1)} KB` : ''}</span>
                                </div>
                                <div className="attachment-download">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="message-body">
                        {selectedMessage.html ? (
                          <iframe
                            srcDoc={selectedMessage.html}
                            title="Email content"
                            sandbox="allow-same-origin"
                          />
                        ) : (
                          <div className="text-content">{selectedMessage.text}</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="no-message-selected">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      <p>Select an email to read</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="compose-overlay" onClick={() => setShowCompose(false)}>
          <div className="compose-modal" onClick={(e) => e.stopPropagation()}>
            <div className="compose-header">
              <h3>New Message</h3>
              <button className="compose-close" onClick={() => setShowCompose(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="compose-body">
              <div className="compose-field">
                <label>Your Name</label>
                <input
                  type="text"
                  value={composeName}
                  onChange={(e) => setComposeName(e.target.value)}
                  placeholder="Enter your name (e.g., John Doe)"
                />
              </div>
              <div className="compose-field">
                <label>From</label>
                <input type="text" value={email} disabled />
              </div>
              <div className="compose-field">
                <label>To</label>
                <input
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="recipient@example.com"
                />
              </div>
              <div className="compose-field">
                <label>Subject</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Enter subject"
                />
              </div>
              <div className="compose-field compose-field-body">
                <label>Message</label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your message..."
                  rows={8}
                />
              </div>

              <div className="compose-field">
                <label>Attachments</label>
                <div className="compose-attachments">
                  <input
                    type="file"
                    id="attachments"
                    multiple
                    onChange={(e) => setComposeAttachments(Array.from(e.target.files))}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="attachments" className="attachment-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    <span>Add Files</span>
                  </label>
                  {composeAttachments.length > 0 && (
                    <div className="attachment-list">
                      {composeAttachments.map((file, idx) => (
                        <div key={idx} className="attachment-chip">
                          <span>{file.name}</span>
                          <button onClick={() => setComposeAttachments(composeAttachments.filter((_, i) => i !== idx))}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {sendError && <div className="compose-error">{sendError}</div>}
              {sendSuccess && <div className="compose-success">Email sent successfully!</div>}
            </div>

            <div className="compose-footer">
              <button className="compose-cancel" onClick={() => setShowCompose(false)}>
                Cancel
              </button>
              <button className="compose-send" onClick={sendEmail} disabled={sending}>
                {sending ? (
                  <span className="loading-spinner"></span>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forwarding Settings Modal */}
      {showForwarding && (
        <div className="compose-overlay" onClick={() => setShowForwarding(false)}>
          <div className="compose-modal forwarding-modal" onClick={(e) => e.stopPropagation()}>
            <div className="compose-header">
              <h3>Email Forwarding</h3>
              <button className="compose-close" onClick={() => setShowForwarding(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="compose-body">
              <p className="forwarding-description">
                Automatically forward incoming emails to your personal email address.
                Spam emails will not be forwarded.
              </p>

              <div className="forwarding-toggle">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={forwardEnabled}
                    onChange={(e) => setForwardEnabled(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span className="toggle-label">
                  {forwardEnabled ? 'Forwarding enabled' : 'Forwarding disabled'}
                </span>
              </div>

              {forwardEnabled && (
                <div className="compose-field">
                  <label>Forward to</label>
                  <input
                    type="email"
                    value={forwardTo}
                    onChange={(e) => setForwardTo(e.target.value)}
                    placeholder="your-email@gmail.com"
                  />
                </div>
              )}

              {forwardingError && <div className="compose-error">{forwardingError}</div>}
              {forwardingSuccess && <div className="compose-success">Forwarding settings saved!</div>}
            </div>

            <div className="compose-footer">
              <button className="compose-cancel" onClick={() => setShowForwarding(false)}>
                Cancel
              </button>
              <button className="compose-send" onClick={saveForwardingSettings} disabled={forwardingSaving}>
                {forwardingSaving ? (
                  <span className="loading-spinner"></span>
                ) : (
                  <span>Save Settings</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
