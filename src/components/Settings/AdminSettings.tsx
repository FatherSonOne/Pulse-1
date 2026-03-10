import React from 'react';
import AdminDashboard from '../AdminDashboard';

interface AdminSettingsProps {
  userId?: string;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ userId = '' }) => {
  return (
    <div className="animate-slide-up -m-8">
      <AdminDashboard userId={userId} />
    </div>
  );
};
