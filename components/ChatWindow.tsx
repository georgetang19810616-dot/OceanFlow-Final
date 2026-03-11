
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { X, Send, MessageSquare } from 'lucide-react';

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onlineCount: number;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ isOpen, onClose, messages, onSendMessage, onlineCount }) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
        // Short timeout to ensure DOM is rendered before scrolling
        setTimeout(scrollToBottom, 100);
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
      {/* Header */}
      <div className="bg-blue-600 p-3 flex justify-between items-center text-white cursor-pointer" onClick={onClose}>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          <h3 className="font-semibold text-sm">Team Chat <span className="text-blue-200 text-xs">({onlineCount} online)</span></h3>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="hover:bg-blue-700 p-1 rounded transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 h-72 overflow-y-auto p-3 bg-gray-50 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs space-y-2">
             <MessageSquare className="w-8 h-8 opacity-20" />
             <p>No messages yet.</p>
             <p>Chat with other open tabs!</p>
          </div>
        )}
        {messages.map((msg) => {
          // Render System Notification
          if (msg.isSystem) {
             return (
               <div key={msg.id} className="flex justify-center my-1">
                 <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shadow-sm">{msg.text}</span>
               </div>
             );
          }

          // Render Normal Message
          return (
            <div key={msg.id} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                msg.isMe 
                  ? 'bg-blue-500 text-white rounded-tr-none' 
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
              }`}>
                {msg.text}
              </div>
              <span className="text-[10px] text-gray-400 mt-1 px-1 flex gap-1">
                {!msg.isMe && <span className="font-semibold text-gray-500">{msg.sender}</span>}
                <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t flex gap-2">
        <input 
          type="text" 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 text-sm border rounded-full px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
          autoFocus
        />
        <button 
          type="submit" 
          disabled={!inputValue.trim()}
          className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
