
import React, { useState } from 'react';
import { Database, Server, Code, Layout, ChevronRight, Copy, Check } from 'lucide-react';
import { Button } from './Button';

const CodeBlock = ({ code, language = 'javascript' }: { code: string, language?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative mt-2 rounded-lg overflow-hidden border border-gray-700 bg-gray-900 text-gray-100 font-mono text-sm shadow-sm group">
      <div className="flex justify-between items-center px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-400">{language}</span>
        <button onClick={handleCopy} className="text-gray-400 hover:text-white transition-colors">
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
};

export const PostgresTutorial = () => {
  const [activeStep, setActiveStep] = useState<'architecture' | 'schema' | 'backend' | 'frontend'>('architecture');

  const steps = [
    { id: 'architecture', label: 'Architecture', icon: Layout },
    { id: 'schema', label: '1. Database Schema', icon: Database },
    { id: 'backend', label: '2. Node.js API', icon: Server },
    { id: 'frontend', label: '3. React Integration', icon: Code },
  ];

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-3 flex items-center gap-3">
          <Database className="w-8 h-8 text-blue-600" />
          PostgreSQL Integration Guide
        </h2>
        <p className="text-gray-600 text-lg">
          Currently, OceanFlow runs in "Demo Mode" using browser LocalStorage. 
          Follow this guide to migrate to a production-ready PostgreSQL backend.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Nav */}
        <div className="w-full lg:w-64 flex-shrink-0 space-y-2">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id as any)}
                className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all ${
                  activeStep === step.id 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{step.label}</span>
                </div>
                {activeStep === step.id && <ChevronRight className="w-4 h-4" />}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white p-8 rounded-xl border border-gray-200 shadow-sm min-h-[500px]">
          
          {activeStep === 'architecture' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <h3 className="text-xl font-bold text-gray-800">Why do we need a backend?</h3>
              <p className="text-gray-600 leading-relaxed">
                Browsers cannot connect directly to PostgreSQL for security reasons (it would expose your database passwords to the world). 
                To use PostgreSQL, we need a standard 3-tier architecture:
              </p>
              
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 my-8">
                <div className="text-center p-4 bg-white shadow-sm rounded-lg border border-blue-100 w-32">
                  <div className="text-blue-600 font-bold mb-1">React App</div>
                  <div className="text-xs text-gray-400">(Frontend)</div>
                </div>
                <div className="hidden md:block text-gray-400">───── API Request ────►</div>
                <div className="md:hidden text-gray-400">▼</div>
                <div className="text-center p-4 bg-white shadow-sm rounded-lg border border-green-100 w-32">
                  <div className="text-green-600 font-bold mb-1">Node.js</div>
                  <div className="text-xs text-gray-400">(API Server)</div>
                </div>
                <div className="hidden md:block text-gray-400">───── SQL Query ─────►</div>
                <div className="md:hidden text-gray-400">▼</div>
                <div className="text-center p-4 bg-white shadow-sm rounded-lg border border-purple-100 w-32">
                  <div className="text-purple-600 font-bold mb-1">PostgreSQL</div>
                  <div className="text-xs text-gray-400">(Database)</div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg text-blue-800 text-sm">
                <strong>Prerequisites:</strong>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Install <strong>Node.js</strong> (v18+)</li>
                  <li>Install <strong>PostgreSQL</strong> (v14+)</li>
                  <li>Basic knowledge of command line interface</li>
                </ul>
              </div>
            </div>
          )}

          {activeStep === 'schema' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <h3 className="text-xl font-bold text-gray-800">SQL Schema</h3>
               <p className="text-gray-600">Run the following SQL commands in your PostgreSQL query tool (like pgAdmin or DBeaver) to create the tables matching OceanFlow's data structure.</p>
               
               <CodeBlock language="sql" code={`
-- 1. Create Users Table
CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY, -- Use string IDs for flexibility
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL, -- In production, use hash!
  first_name VARCHAR(50),
  role VARCHAR(20) DEFAULT 'USER',
  permissions TEXT[], -- Array of permission strings
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Databases Table (Tabs)
CREATE TABLE databases (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  fields JSONB, -- Stores column definitions
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Bookings Table
CREATE TABLE bookings (
  id VARCHAR(50) PRIMARY KEY,
  database_id VARCHAR(50) REFERENCES databases(id) ON DELETE CASCADE,
  booking_ref VARCHAR(50),
  week VARCHAR(10),
  carrier VARCHAR(50),
  client VARCHAR(100),
  service VARCHAR(50),
  pol VARCHAR(50),
  pod VARCHAR(50),
  etd DATE,
  vessel VARCHAR(100),
  container_type VARCHAR(20),
  gate_in_date DATE,
  state VARCHAR(20) DEFAULT 'PENDING',
  is_locked BOOLEAN DEFAULT FALSE,
  finance JSONB, -- Stores financial data (AP/AR/Profit)
  data JSONB, -- Stores dynamic fields not in main columns
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create System Settings Table
CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  carriers TEXT[],
  clients TEXT[],
  services TEXT[],
  pols TEXT[],
  pods TEXT[],
  container_types TEXT[],
  statuses TEXT[],
  gate_in_rates JSONB
);
INSERT INTO system_settings (id) VALUES (1); -- Initialize

-- 5. Create Quotations Table
CREATE TABLE quotations (
  id VARCHAR(50) PRIMARY KEY,
  region VARCHAR(100),
  carrier VARCHAR(50),
  pol VARCHAR(50),
  pod VARCHAR(50),
  vessel VARCHAR(100),
  etd DATE,
  data JSONB, -- Stores price, transit time, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create Sample Admin (Password: 123456)
INSERT INTO users (id, username, password, first_name, role, permissions, is_approved)
VALUES ('admin-1', 'admin', '123456', 'Admin', 'ADMIN', ARRAY['BOOKING_READ','BOOKING_CREATE','BOOKING_UPDATE','BOOKING_DELETE','BOOKING_LOCK','QUOTATION_READ','QUOTATION_CREATE','QUOTATION_UPDATE','QUOTATION_DELETE','FINANCE_READ','FINANCE_UPDATE','FINANCE_LOCK'], TRUE);
               `} />
            </div>
          )}

          {activeStep === 'backend' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <h3 className="text-xl font-bold text-gray-800">Node.js Server Setup</h3>
               <p className="text-gray-600">Create a file named <code>server.js</code>. You will need to install express and pg: <code>npm install express pg cors body-parser dotenv</code>.</p>
               
               <CodeBlock language="javascript" code={`
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'oceanflow',
  password: 'your_password',
  port: 5432,
});

// ... Implement routes as defined in the full server.js file provided in the project source ...

app.listen(3001, () => {
  console.log('Server running on port 3001');
});
               `} />
            </div>
          )}

          {activeStep === 'frontend' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <h3 className="text-xl font-bold text-gray-800">Connecting React</h3>
               <p className="text-gray-600">
                 The frontend is already configured to use <code>apiService.ts</code>. 
                 However, to ensure it talks to your backend locally, you must configure the Vite proxy.
               </p>
               
               <h4 className="font-semibold mt-4">1. Check vite.config.ts</h4>
               <CodeBlock language="typescript" code={`
// Ensure this proxy block exists:
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
      secure: false,
    }
  }
}
               `} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
