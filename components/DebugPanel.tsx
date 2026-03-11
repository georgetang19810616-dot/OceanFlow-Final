// import React, { useState } from 'react';
// import { Database, Booking, Quotation } from '../types';
// import { Button } from './Button';
// import { Bug, Database as DbIcon, RefreshCw, X, Eye, AlertCircle, CheckCircle, Server, Cpu } from 'lucide-react';
// import { apiService } from '../services/apiService';

// interface DebugPanelProps {
//   databases: Database[];
//   activeDbId: string;
//   onRefresh: () => void;
//   showAsButton?: boolean;
//   onButtonClick?: () => void;
// }

// export const DebugPanel: React.FC<DebugPanelProps> = ({ 
//   databases, 
//   activeDbId, 
//   onRefresh,
//   showAsButton = false,
//   onButtonClick
// }) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [activeSection, setActiveSection] = useState<'overview' | 'data' | 'api' | 'logs'>('overview');
//   const [isTestingConnection, setIsTestingConnection] = useState(false);
//   const [connectionStatus, setConnectionStatus] = useState<{ connected: boolean; message: string } | null>(null);
  
//   const activeDb = databases.find(db => db.id === activeDbId);
  
//   const testConnection = async () => {
//     setIsTestingConnection(true);
//     try {
//       const isConnected = await apiService.testConnection();
//       setConnectionStatus({
//         connected: isConnected,
//         message: isConnected ? '✅ 后端连接正常' : '❌ 后端连接失败'
//       });
//     } catch (error) {
//       setConnectionStatus({
//         connected: false,
//         message: `❌ 连接测试失败: ${error.message}`
//       });
//     } finally {
//       setIsTestingConnection(false);
//     }
//   };
  
//   const getApiEndpoints = async () => {
//     try {
//       const result = await apiService.getEndpoints();
//       console.log('API Endpoints:', result.endpoints);
//       alert(`找到 ${result.total} 个 API 端点，请查看控制台获取详细信息`);
//     } catch (error) {
//       alert(`获取 API 端点失败: ${error.message}`);
//     }
//   };
  
//   const sampleBooking = activeDb?.bookings?.[0];
  
//   // 如果是按钮模式，只渲染按钮
//   if (showAsButton) {
//     return (
//       <button
//         onClick={() => {
//           setIsOpen(true);
//           if (onButtonClick) onButtonClick();
//         }}
//         title="调试信息"
//         className="text-[11px] px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 text-gray-600 flex items-center gap-1 transition-colors"
//       >
//         <Bug className="w-3 h-3" />
//         Debug
//       </button>
//     );
//   }
  
//   // 如果不在按钮模式，就渲染完整的浮动面板
//   if (!isOpen) return null;
  
//   return (
//     <div className="fixed bottom-16 right-4 z-50 w-96 max-h-[80vh] bg-gray-900 text-white rounded-lg shadow-2xl overflow-hidden flex flex-col border border-gray-700">
//       {/* Header */}
//       <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-950">
//         <div className="flex items-center gap-2">
//           <Bug className="w-5 h-5 text-blue-400" />
//           <h3 className="font-bold text-lg">Debug Panel</h3>
//         </div>
//         <Button 
//           variant="ghost" 
//           size="sm" 
//           onClick={() => setIsOpen(false)}
//           className="text-gray-400 hover:text-white"
//         >
//           <X className="w-4 h-4" />
//         </Button>
//       </div>
      
//       {/* Tabs */}
//       <div className="flex border-b border-gray-800 bg-gray-950">
//         <button
//           onClick={() => setActiveSection('overview')}
//           className={`flex-1 py-2 text-sm font-medium ${activeSection === 'overview' ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
//         >
//           <div className="flex items-center justify-center gap-1">
//             <Cpu className="w-3 h-3" />
//             概览
//           </div>
//         </button>
//         <button
//           onClick={() => setActiveSection('data')}
//           className={`flex-1 py-2 text-sm font-medium ${activeSection === 'data' ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
//         >
//           <div className="flex items-center justify-center gap-1">
//             <DbIcon className="w-3 h-3" />
//             数据
//           </div>
//         </button>
//         <button
//           onClick={() => setActiveSection('api')}
//           className={`flex-1 py-2 text-sm font-medium ${activeSection === 'api' ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
//         >
//           <div className="flex items-center justify-center gap-1">
//             <Server className="w-3 h-3" />
//             API
//           </div>
//         </button>
//       </div>
      
//       {/* Content */}
//       <div className="flex-1 overflow-auto p-4">
//         {activeSection === 'overview' && (
//           <div className="space-y-4">
//             <div>
//               <h4 className="font-semibold mb-2 flex items-center gap-2">
//                 <CheckCircle className="w-4 h-4 text-green-400" />
//                 系统状态
//               </h4>
//               <div className="grid grid-cols-2 gap-2 text-sm">
//                 <div className="bg-gray-800 p-2 rounded">
//                   <div className="text-gray-400 text-xs">数据库</div>
//                   <div className="font-semibold">{databases.length}</div>
//                 </div>
//                 <div className="bg-gray-800 p-2 rounded">
//                   <div className="text-gray-400 text-xs">活跃数据库</div>
//                   <div className="font-semibold">{activeDb?.name || '无'}</div>
//                 </div>
//                 <div className="bg-gray-800 p-2 rounded">
//                   <div className="text-gray-400 text-xs">预订数</div>
//                   <div className="font-semibold">{activeDb?.bookings?.length || 0}</div>
//                 </div>
//                 <div className="bg-gray-800 p-2 rounded">
//                   <div className="text-gray-400 text-xs">总预订</div>
//                   <div className="font-semibold">
//                     {databases.reduce((sum, db) => sum + (db.bookings?.length || 0), 0)}
//                   </div>
//                 </div>
//               </div>
//             </div>
            
//             <div>
//               <h4 className="font-semibold mb-2 flex items-center gap-2">
//                 <AlertCircle className="w-4 h-4 text-amber-400" />
//                 连接状态
//               </h4>
//               <div className="space-y-2">
//                 {connectionStatus && (
//                   <div className={`p-2 rounded ${connectionStatus.connected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
//                     <div className="text-xs font-medium">{connectionStatus.message}</div>
//                   </div>
//                 )}
//                 <div className="flex gap-2">
//                   <Button 
//                     size="sm" 
//                     onClick={testConnection}
//                     disabled={isTestingConnection}
//                     className="flex-1 bg-blue-600 hover:bg-blue-700"
//                   >
//                     {isTestingConnection ? (
//                       <>
//                         <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
//                         测试中...
//                       </>
//                     ) : (
//                       <>
//                         <Server className="w-3 h-3 mr-2" />
//                         测试连接
//                       </>
//                     )}
//                   </Button>
//                   <Button 
//                     size="sm" 
//                     onClick={getApiEndpoints}
//                     variant="secondary"
//                     className="flex-1 border-gray-700"
//                   >
//                     <Eye className="w-3 h-3 mr-2" />
//                     API端点
//                   </Button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}
        
//         {activeSection === 'data' && (
//           <div className="space-y-4">
//             <div>
//               <h4 className="font-semibold mb-2">当前数据库</h4>
//               <div className="bg-gray-800 p-3 rounded text-sm">
//                 <div className="grid grid-cols-2 gap-2 mb-2">
//                   <div>
//                     <span className="text-gray-400">ID: </span>
//                     <span className="font-mono text-xs break-all">{activeDb?.id}</span>
//                   </div>
//                   <div>
//                     <span className="text-gray-400">名称: </span>
//                     <span>{activeDb?.name}</span>
//                   </div>
//                   <div>
//                     <span className="text-gray-400">字段数: </span>
//                     <span>{activeDb?.fields?.length || 0}</span>
//                   </div>
//                   <div>
//                     <span className="text-gray-400">预订数: </span>
//                     <span>{activeDb?.bookings?.length || 0}</span>
//                   </div>
//                 </div>
//               </div>
//             </div>
            
//             {sampleBooking && (
//               <div>
//                 <h4 className="font-semibold mb-2">示例预订数据</h4>
//                 <div className="bg-gray-800 p-3 rounded">
//                   <pre className="text-xs overflow-auto max-h-32">
//                     {JSON.stringify({
//                       id: sampleBooking.id,
//                       bookingRef: sampleBooking.bookingRef,
//                       client: sampleBooking.client,
//                       carrier: sampleBooking.carrier,
//                       type: sampleBooking.type,
//                       qty: sampleBooking.qty,
//                       gateIn: sampleBooking.gateIn,
//                       state: sampleBooking.state,
//                       createdAt: sampleBooking.createdAt
//                     }, null, 2)}
//                   </pre>
//                 </div>
//                 <div className="mt-2 text-xs text-gray-400">
//                   字段映射: type → containerType, qty → quantity, gateIn → gateInDate
//                 </div>
//               </div>
//             )}
//           </div>
//         )}
        
//         {activeSection === 'api' && (
//           <div className="space-y-4">
//             <div>
//               <h4 className="font-semibold mb-2">API 调试工具</h4>
//               <div className="space-y-2">
//                 <Button 
//                   size="sm" 
//                   onClick={() => {
//                     console.log('📊 Databases:', databases);
//                     console.log('📊 Active DB:', activeDb);
//                     alert('数据已输出到控制台');
//                   }}
//                   className="w-full bg-gray-800 hover:bg-gray-700"
//                 >
//                   <Eye className="w-3 h-3 mr-2" />
//                   输出数据到控制台
//                 </Button>
                
//                 <Button 
//                   size="sm" 
//                   onClick={onRefresh}
//                   className="w-full bg-blue-600 hover:bg-blue-700"
//                 >
//                   <RefreshCw className="w-3 h-3 mr-2" />
//                   刷新所有数据
//                 </Button>
                
//                 <div className="text-xs text-gray-400 mt-4">
//                   <div className="font-semibold mb-1">提示:</div>
//                   <ul className="space-y-1">
//                     <li>• 检查控制台的网络请求</li>
//                     <li>• 查看数据映射是否正确</li>
//                     <li>• 验证字段名映射: type/qty/gateIn</li>
//                     <li>• 检查日期格式转换</li>
//                   </ul>
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}
//       </div>
      
//       {/* Footer */}
//       <div className="p-3 border-t border-gray-800 bg-gray-950">
//         <div className="text-xs text-gray-500">
//           调试模式已激活 - 仅用于开发和故障排除
//         </div>
//       </div>
//     </div>
//   );
// };

import React from 'react';
import { Database } from '../types';
import { Button } from './Button';
import { Bug } from 'lucide-react';

interface DebugPanelProps {
  databases: Database[];
  activeDbId: string;
  onRefresh: () => void;
  showAsButton?: boolean;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ 
  databases, 
  activeDbId, 
  onRefresh,
  showAsButton = false
}) => {
  
  // 如果是按钮模式，只渲染按钮
  if (showAsButton) {
    return (
      <button
        onClick={() => {
          console.log('Debug clicked');
          console.log('Databases:', databases);
          console.log('Active DB ID:', activeDbId);
          alert('查看控制台获取调试信息');
        }}
        title="调试信息"
        className="text-[11px] px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 text-gray-600 flex items-center gap-1 transition-colors"
      >
        <Bug className="w-3 h-3" />
        Debug
      </button>
    );
  }
  
  // 如果不在按钮模式，不渲染任何东西（因为我们不需要浮动面板）
  return null;
};