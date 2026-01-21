import React from 'react';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';
import './RealTimeIndicator.css';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface RealTimeIndicatorProps {
  status: ConnectionStatus;
  className?: string;
}

export const RealTimeIndicator: React.FC<RealTimeIndicatorProps> = ({
  status,
  className = ''
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: <Wifi size={14} />,
          label: 'Live',
          className: 'rt-indicator-connected',
          title: 'Real-time updates active'
        };
      case 'connecting':
        return {
          icon: <Wifi size={14} />,
          label: 'Connecting...',
          className: 'rt-indicator-connecting',
          title: 'Connecting to real-time updates'
        };
      case 'disconnected':
        return {
          icon: <WifiOff size={14} />,
          label: 'Offline',
          className: 'rt-indicator-disconnected',
          title: 'Real-time updates paused'
        };
      case 'error':
        return {
          icon: <AlertCircle size={14} />,
          label: 'Error',
          className: 'rt-indicator-error',
          title: 'Connection error - retrying'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={`rt-indicator ${config.className} ${className}`}
      title={config.title}
    >
      <div className="rt-indicator-icon">
        {config.icon}
      </div>
      <span className="rt-indicator-label">{config.label}</span>
      {status === 'connected' && (
        <div className="rt-indicator-pulse"></div>
      )}
    </div>
  );
};
