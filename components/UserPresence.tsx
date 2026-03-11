import React from 'react';
import { PresenceUser } from '../types';

interface UserPresenceProps {
  users: PresenceUser[];
  onClick: () => void;
}

export const UserPresence: React.FC<UserPresenceProps> = ({ users, onClick }) => {
  // Show max 4 users, then +X count
  const visibleUsers = users.slice(0, 4);
  const extraCount = users.length - 4;

  if (users.length === 0) return null;

  // Generate a consistent color based on name
  const getColor = (name: string) => {
    const colors = [
      'bg-red-500', 'bg-orange-500', 'bg-amber-500', 
      'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 
      'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div 
      onClick={onClick}
      className="flex items-center gap-3 px-4 border-r border-gray-200 mr-4 h-8 select-none cursor-pointer hover:bg-gray-50 rounded-lg transition-colors group/panel"
      title={`Online: ${users.map(u => u.firstName).join(', ')}`} // Show full list on hover
    >
       <span className="text-xs font-medium text-gray-400 hidden xl:block animate-pulse group-hover/panel:text-blue-500">
         Live
       </span>
       <div className="flex -space-x-2 overflow-hidden p-1">
         {visibleUsers.map((user, i) => (
           <div 
            key={`${user.username}-${i}`} 
            className={`inline-block h-8 w-8 rounded-full ring-2 ring-white ${getColor(user.firstName)} flex items-center justify-center text-xs text-white font-bold relative shadow-sm transition-transform hover:scale-110 hover:z-10`}
            title={user.firstName}
           >
             {user.firstName.charAt(0).toUpperCase()}
             <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white bg-green-400 shadow-sm"></span>
           </div>
         ))}
         {extraCount > 0 && (
           <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 z-0">
             +{extraCount}
           </div>
         )}
       </div>
    </div>
  );
};