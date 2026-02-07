# Component Reference Guide - New Analytics Views

Quick reference for Frontend Developer implementing the 4 new analytics views.

---

## 1. RelationshipsView Component

### Purpose
Display relationship health scores and detailed contact engagement metrics.

### Key Metrics to Display
- Total Active Relationships (green)
- At-Risk Relationships (orange)
- Dormant Relationships (gray)

### Data Structure Expected
```typescript
interface RelationshipData {
  contact: {
    name: string;
    email: string;
    channel: 'email' | 'pulse' | 'voxer';
  };
  healthStatus: 'active' | 'at-risk' | 'dormant';
  healthScore: number; // 0-100
  stats: {
    totalMessages: number;
    responseRate: number; // 0-100
    avgResponseTime: string; // e.g., "2h 30m"
  };
}
```

### Component Structure
```tsx
<div className="view-relationships">
  {/* Summary Cards */}
  <div className="health-summary glass panel">
    <div className="health-card status-active" style={{ '--delay': '0.1s' }}>
      <div className="health-glow"></div>
      <div className="health-value">12</div>
      <div className="health-label">Active</div>
    </div>
    {/* Repeat for at-risk, dormant */}
  </div>

  {/* Relationship Cards Grid */}
  <div className="relationship-grid">
    {relationships.map((rel, index) => (
      <div
        className={`relationship-card glass status-${rel.healthStatus}`}
        style={{
          '--delay': `${index * 0.1}s`,
          '--health-color': getHealthColor(rel.healthStatus)
        }}
        key={rel.contact.email}
      >
        <div className="health-indicator"></div>

        <div className="relationship-header">
          <div className="relationship-avatar">
            {getInitials(rel.contact.name)}
          </div>
          <div className="relationship-details">
            <div className="relationship-name">{rel.contact.name}</div>
            <div className="relationship-meta">
              <span className="meta-item">
                <ChannelIcon /> {rel.contact.channel}
              </span>
              <span className="meta-item">{rel.contact.email}</span>
            </div>
          </div>
        </div>

        <div className="relationship-stats">
          <div className="stat-item">
            <div className="health-score-ring">
              <svg viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="24" fill="none" strokeWidth="4" />
                <circle
                  className="health-arc"
                  cx="26" cy="26" r="24"
                  fill="none"
                  strokeWidth="4"
                  strokeDasharray={`${rel.healthScore * 1.5}, 150`}
                />
              </svg>
              <div className="health-score-value">{rel.healthScore}</div>
            </div>
            <div className="stat-label">Health</div>
          </div>

          <div className="stat-item">
            <div className="stat-value">{rel.stats.totalMessages}</div>
            <div className="stat-label">Messages</div>
          </div>

          <div className="stat-item">
            <div className="stat-value">{rel.stats.responseRate}%</div>
            <div className="stat-label">Response</div>
          </div>
        </div>
      </div>
    ))}
  </div>
</div>
```

### Helper Functions Needed
```typescript
const getHealthColor = (status: string) => {
  switch(status) {
    case 'active': return 'var(--health-active)';
    case 'at-risk': return 'var(--health-at-risk)';
    case 'dormant': return 'var(--health-dormant)';
  }
};

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};
```

---

## 2. ConflictsView Component

### Purpose
Display communication conflicts and tension indicators with severity levels.

### Key Metrics to Display
- Low Severity Count (yellow)
- Medium Severity Count (orange)
- High Severity Count (red)
- Critical Severity Count (red + pulse)

### Data Structure Expected
```typescript
interface ConflictData {
  id: string;
  participants: string[]; // ["Alice", "Bob"]
  type: 'Missed Response' | 'Tone Mismatch' | 'Unresolved Thread' | 'Delayed Reply';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  channel: 'email' | 'pulse' | 'voxer';
}
```

### Component Structure
```tsx
<div className="view-conflicts">
  {/* Conflict Summary */}
  <div className="conflict-summary">
    {severityCounts.map((item, index) => (
      <div
        className={`conflict-indicator glass severity-${item.severity}`}
        style={{
          '--delay': `${index * 0.1}s`,
          '--severity-color': getSeverityColor(item.severity)
        }}
        key={item.severity}
      >
        <div className="severity-glow"></div>
        <div className="conflict-count">{item.count}</div>
        <div className="severity-label">{item.severity}</div>
      </div>
    ))}
  </div>

  {/* Conflicts Grid or Empty State */}
  {conflicts.length === 0 ? (
    <div className="empty-conflicts glass panel">
      <div className="celebration-icon">🎉</div>
      <h3>No Conflicts Detected!</h3>
      <p>Your communication is running smoothly.</p>
    </div>
  ) : (
    <div className="conflicts-grid">
      {conflicts.map((conflict, index) => (
        <div
          className={`conflict-card glass severity-${conflict.severity}`}
          style={{
            '--delay': `${index * 0.1}s`,
            '--severity-color': getSeverityColor(conflict.severity)
          }}
          key={conflict.id}
        >
          <div className="severity-indicator"></div>

          <div className="conflict-header">
            <div className="conflict-icon">
              <ConflictIcon type={conflict.type} />
            </div>
            <div className="conflict-info">
              <div className="conflict-participants">
                {conflict.participants.join(' ↔ ')}
              </div>
              <div className="conflict-type">{conflict.type}</div>
            </div>
          </div>

          <div className="conflict-description">
            {conflict.description}
          </div>

          <div className="conflict-meta">
            <div className="conflict-timestamp">
              <ClockIcon /> {formatRelativeTime(conflict.timestamp)}
            </div>
            <div
              className="severity-badge"
              style={{ background: getSeverityColor(conflict.severity) }}
            >
              {conflict.severity}
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

### Helper Functions Needed
```typescript
const getSeverityColor = (severity: string) => {
  switch(severity) {
    case 'low': return 'var(--conflict-low)';
    case 'medium': return 'var(--conflict-medium)';
    case 'high': return 'var(--conflict-high)';
    case 'critical': return 'var(--conflict-critical)';
  }
};

const formatRelativeTime = (date: Date) => {
  // Return "2 hours ago", "3 days ago", etc.
};
```

---

## 3. KudosView Component

### Purpose
Display recognition feed with kudos, wins, and milestone celebrations.

### Key Metrics to Display
- Total Kudos Count (gold)
- Team Wins Count (purple)
- Milestones Count (blue)

### Data Structure Expected
```typescript
interface KudosData {
  id: string;
  type: 'kudos' | 'wins' | 'milestones';
  from: string;
  to: string;
  message: string;
  timestamp: Date;
  icon: string; // '👏', '🏆', '🎯', etc.
}
```

### Component Structure
```tsx
<div className="view-kudos">
  {/* Kudos Summary */}
  <div className="kudos-summary glass panel">
    {kudosStats.map((stat, index) => (
      <div
        className={`kudos-stat-card type-${stat.type}`}
        style={{
          '--delay': `${index * 0.1}s`,
          '--kudos-color': getKudosColor(stat.type)
        }}
        key={stat.type}
      >
        <div className="kudos-glow"></div>
        <div className="kudos-stat-icon">{stat.icon}</div>
        <div className="kudos-stat-value">{stat.count}</div>
        <div className="kudos-stat-label">{stat.label}</div>
      </div>
    ))}
  </div>

  {/* Recognition Feed */}
  <div className="kudos-feed">
    {kudosList.map((kudos, index) => (
      <div
        className={`kudos-item glass type-${kudos.type} celebrating`}
        style={{
          '--delay': `${index * 0.1}s`,
          '--sparkle-delay': `${index * 0.1 + 0.3}s`,
          '--kudos-color': getKudosColor(kudos.type)
        }}
        key={kudos.id}
      >
        <div className="kudos-accent"></div>

        <div className="kudos-icon-wrapper">
          {kudos.icon}
        </div>

        <div className="kudos-content">
          <div className="kudos-header">
            <span className="kudos-from">{kudos.from}</span>
            <span className="kudos-separator">→</span>
            <span className="kudos-to">{kudos.to}</span>
          </div>

          <div className="kudos-message">{kudos.message}</div>

          <div className="kudos-footer">
            <div className="kudos-timestamp">
              <ClockIcon /> {formatRelativeTime(kudos.timestamp)}
            </div>
            <div
              className="kudos-badge"
              style={{ background: getKudosColor(kudos.type) }}
            >
              {kudos.type}
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
</div>
```

### Helper Functions Needed
```typescript
const getKudosColor = (type: string) => {
  switch(type) {
    case 'kudos': return 'var(--kudos-gold)';
    case 'wins': return 'var(--wins-purple)';
    case 'milestones': return 'var(--milestone-blue)';
  }
};

const getKudosIcon = (type: string) => {
  switch(type) {
    case 'kudos': return '👏';
    case 'wins': return '🏆';
    case 'milestones': return '🎯';
  }
};
```

---

## 4. PredictionsView Component

### Purpose
Display AI-powered relationship predictions and risk indicators.

### Key Metrics to Display
- High Confidence Predictions (green)
- Medium Confidence Predictions (cyan)
- Low Confidence Predictions (gray)

### Data Structure Expected
```typescript
interface PredictionData {
  id: string;
  contact: string;
  riskType: 'Likely to Disengage' | 'Growing Stronger' | 'Needs Attention';
  description: string;
  confidence: 'low' | 'medium' | 'high';
  confidenceScore: number; // 0-100
  factors: {
    responseTime: number; // 0-100
    messageFrequency: number; // 0-100
    sentiment: number; // 0-100
  };
  predictedDate?: Date;
}
```

### Component Structure
```tsx
<div className="view-predictions">
  {/* Predictions Overview */}
  <div className="predictions-overview glass panel">
    {confidenceStats.map((stat, index) => (
      <div
        className={`prediction-summary-card confidence-${stat.level}`}
        style={{
          '--delay': `${index * 0.1}s`,
          '--confidence-color': getConfidenceColor(stat.level)
        }}
        key={stat.level}
      >
        <div className="confidence-glow"></div>
        <div className="prediction-icon">{stat.icon}</div>
        <div className="prediction-value">{stat.count}</div>
        <div className="prediction-label">{stat.label}</div>
      </div>
    ))}
  </div>

  {/* Risk Indicators */}
  <div className="risk-indicators">
    {predictions.map((prediction, index) => (
      <div
        className={`risk-card glass confidence-${prediction.confidence} ${
          prediction.confidence === 'high' && prediction.riskType === 'Likely to Disengage'
            ? 'risk-critical'
            : ''
        }`}
        style={{
          '--delay': `${index * 0.1}s`,
          '--confidence-color': getConfidenceColor(prediction.confidence)
        }}
        key={prediction.id}
      >
        <div className="risk-indicator"></div>

        <div className="risk-header">
          <div className="risk-icon-wrapper">
            <RiskIcon type={prediction.riskType} />
          </div>
          <div className="risk-info">
            <div className="risk-title">{prediction.riskType}</div>
            <div className="risk-contact">{prediction.contact}</div>
          </div>
        </div>

        <div className="risk-description">{prediction.description}</div>

        {/* Confidence Gauges */}
        <div className="risk-gauge">
          <div className="gauge-label">Response Time</div>
          <div className="gauge-track">
            <div
              className="gauge-fill"
              style={{ width: `${prediction.factors.responseTime}%` }}
            ></div>
          </div>
          <div className="gauge-value">{prediction.factors.responseTime}%</div>
        </div>

        <div className="risk-gauge">
          <div className="gauge-label">Message Freq</div>
          <div className="gauge-track">
            <div
              className="gauge-fill"
              style={{ width: `${prediction.factors.messageFrequency}%` }}
            ></div>
          </div>
          <div className="gauge-value">{prediction.factors.messageFrequency}%</div>
        </div>

        <div className="risk-gauge">
          <div className="gauge-label">Sentiment</div>
          <div className="gauge-track">
            <div
              className="gauge-fill"
              style={{ width: `${prediction.factors.sentiment}%` }}
            ></div>
          </div>
          <div className="gauge-value">{prediction.factors.sentiment}%</div>
        </div>

        <div className="risk-meta">
          <div>
            {prediction.predictedDate &&
              `Predicted: ${formatDate(prediction.predictedDate)}`
            }
          </div>
          <div
            className="confidence-badge"
            style={{ background: getConfidenceColor(prediction.confidence) }}
          >
            {prediction.confidence} confidence
          </div>
        </div>
      </div>
    ))}
  </div>

  {/* Optional Timeline */}
  <div className="prediction-timeline glass panel">
    <div className="timeline-header">
      <h3 className="timeline-title">Prediction History</h3>
    </div>
    <div className="timeline-events">
      {/* Timeline items */}
    </div>
  </div>
</div>
```

### Helper Functions Needed
```typescript
const getConfidenceColor = (level: string) => {
  switch(level) {
    case 'low': return 'var(--confidence-low)';
    case 'medium': return 'var(--confidence-medium)';
    case 'high': return 'var(--confidence-high)';
  }
};

const formatDate = (date: Date) => {
  // Return formatted date string
};
```

---

## Common Utilities

### Icons Component Mapping
```typescript
// Use react-icons or similar
import {
  TbHeartHandshake,     // Relationships
  TbAlertTriangle,      // Conflicts
  TbTrophy,             // Kudos
  TbCrystalBall,        // Predictions
  TbClock,              // Timestamp
  TbMail,               // Email channel
  TbBrandVscode,        // Pulse channel
  TbMicrophone,         // Voxer channel
} from 'react-icons/tb';
```

### Animation Delay Calculator
```typescript
const getStaggerDelay = (index: number, baseDelay = 0.1) => {
  return `${index * baseDelay}s`;
};
```

### CSS Variable Setter
```typescript
const setCSSVariable = (
  element: HTMLElement,
  varName: string,
  value: string
) => {
  element.style.setProperty(`--${varName}`, value);
};
```

---

## Testing Checklist

For each view, verify:

- [ ] Summary cards animate with staggered delays
- [ ] Color coding matches severity/status
- [ ] Empty states display correctly
- [ ] Responsive layout works at 480px, 768px, 1024px
- [ ] Dark mode colors and glows render properly
- [ ] Hover states provide visual feedback
- [ ] Focus states visible for keyboard navigation
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Loading states handled gracefully
- [ ] Data updates don't break animations

---

## Performance Considerations

1. **Virtualization**: If list exceeds 50 items, consider react-window
2. **Memoization**: Memoize color calculations and formatters
3. **CSS Custom Properties**: Set once per component, not per item
4. **Animation Frame**: Stagger heavy animations across frames
5. **Lazy Loading**: Load views only when selected in tab switcher

---

**Implementation Priority:**
1. RelationshipsView (Foundation for others)
2. ConflictsView (Reuses card patterns)
3. KudosView (Adds celebration animations)
4. PredictionsView (Most complex with gauges)

**Estimated Implementation Time per View:** 2-3 hours each

**Design system is complete and ready!** 🎨
