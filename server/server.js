const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// ==================== 日期工具函数 ====================
const getCurrentDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getYesterdayDate = () => {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatSimpleDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    return dateString;
  }
};

// ==================== 中间件配置 ====================
app.use(cors({
  origin: ['http://localhost:3000', 'http://81.69.254.199'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 数据库配置
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'oceanflow',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 10000,
  query_timeout: 10000,
});

// ==================== 新增邮件处理模块 ====================
const nodemailer = require('nodemailer');
const Imap = require('imap');
const simpleParser = require('mailparser').simpleParser;
const { promisify } = require('util');

// 邮件配置
const mailConfig = {
  imap: {
    user: process.env.OUTLOOK_EMAIL || 'your-email@outlook.com',
    password: process.env.OUTLOOK_PASSWORD || 'your-password',
    host: 'outlook.office365.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  }
};

// 初始化IMAP连接
const createImapConnection = () => {
  return new Imap({
    user: mailConfig.imap.user,
    password: mailConfig.imap.password,
    host: mailConfig.imap.host,
    port: mailConfig.imap.port,
    tls: mailConfig.imap.tls,
    tlsOptions: mailConfig.imap.tlsOptions,
    authTimeout: 3000
  });
};

// 搜索邮件的函数
const searchEmailByBookingRef = async (bookingRef) => {
  return new Promise((resolve, reject) => {
    const imap = createImapConnection();
    const results = {
      found: false,
      emails: [],
      error: null
    };

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          results.error = err.message;
          imap.end();
          return reject(err);
        }

        // 搜索主题包含bookingRef的邮件
        const searchCriteria = [
          'UNSEEN', // 未读邮件
          ['SUBJECT', bookingRef]
        ];

        imap.search(searchCriteria, (searchErr, resultsArray) => {
          if (searchErr) {
            results.error = searchErr.message;
            imap.end();
            return reject(searchErr);
          }

          if (resultsArray.length === 0) {
            results.found = false;
            results.message = `未找到包含 ${bookingRef} 的邮件`;
            imap.end();
            return resolve(results);
          }

          // 获取邮件内容
          const fetch = imap.fetch(resultsArray, {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
            struct: true
          });

          const emails = [];

          fetch.on('message', (msg, seqno) => {
            const email = {
              seqno: seqno,
              headers: {},
              text: '',
              attachments: []
            };

            msg.on('body', (stream, info) => {
              let buffer = '';
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
              stream.on('end', () => {
                if (info.which === 'TEXT') {
                  email.text = buffer;
                } else {
                  // 解析邮件头
                  const headerLines = buffer.split('\r\n');
                  headerLines.forEach(line => {
                    const parts = line.split(': ');
                    if (parts.length === 2) {
                      const key = parts[0].toLowerCase();
                      email.headers[key] = parts[1];
                    }
                  });
                }
              });
            });

            msg.once('attributes', (attrs) => {
              email.uid = attrs.uid;
              email.date = attrs.date;
              email.size = attrs.size;
            });

            msg.once('end', () => {
              emails.push(email);
            });
          });

          fetch.once('error', (fetchErr) => {
            results.error = fetchErr.message;
            imap.end();
            reject(fetchErr);
          });

          fetch.once('end', () => {
            results.found = true;
            results.emails = emails;
            results.message = `找到 ${emails.length} 封包含 ${bookingRef} 的邮件`;
            imap.end();
            resolve(results);
          });
        });
      });
    });

    imap.once('error', (err) => {
      results.error = err.message;
      reject(err);
    });

    imap.once('end', () => {
      console.log('IMAP连接已关闭');
    });

    imap.connect();
  });
};

// 下载邮件附件的函数
const downloadEmailAttachments = async (bookingRef, emailUid) => {
  return new Promise((resolve, reject) => {
    const imap = createImapConnection();
    const attachments = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        const fetch = imap.fetch(emailUid, {
          bodies: '',
          struct: true
        });

        fetch.on('message', (msg, seqno) => {
          msg.on('body', (stream, info) => {
            simpleParser(stream, (parseErr, parsed) => {
              if (parseErr) {
                imap.end();
                return reject(parseErr);
              }

              if (parsed.attachments && parsed.attachments.length > 0) {
                parsed.attachments.forEach((attachment, index) => {
                  const fileName = attachment.filename || `attachment_${Date.now()}_${index}.dat`;
                  const fileContent = attachment.content;
                  
                  attachments.push({
                    fileName: fileName,
                    contentType: attachment.contentType,
                    size: attachment.size,
                    content: fileContent,
                    base64: fileContent.toString('base64')
                  });
                });
              }

              resolve({
                success: true,
                bookingRef: bookingRef,
                emailUid: emailUid,
                attachments: attachments,
                count: attachments.length,
                message: `下载了 ${attachments.length} 个附件`
              });
            });
          });
        });

        fetch.once('error', (fetchErr) => {
          imap.end();
          reject(fetchErr);
        });

        fetch.once('end', () => {
          imap.end();
        });
      });
    });

    imap.once('error', (err) => {
      reject(err);
    });

    imap.connect();
  });
};

// ==================== 邮件相关API端点 ====================
// ==================== 邮件相关API端点（兼容前端路由） ====================

// 兼容性：前端使用 /api/email/ 前缀，后端实际使用 /api/mail/ 前缀
// 转发所有 /api/email/* 请求到对应的 /api/mail/* 端点

// 1. 邮件状态检查（前端需要 /api/email/status）
app.get('/api/email/status', async (req, res) => {
  try {
    console.log('📧 邮件状态检查请求（兼容路由）');
    
    // 重定向到测试接口
    const testUrl = `http://${req.headers.host}/api/mail/test`;
    console.log(`🔄 重定向到: ${testUrl}`);
    
    // 直接调用测试函数，避免重定向
    const imap = createImapConnection();
    
    return new Promise((resolve, reject) => {
      let connected = false;
      
      imap.once('ready', () => {
        connected = true;
        imap.end();
        resolve({
          success: true,
          connected: true,
          message: '邮箱连接正常',
          timestamp: new Date().toISOString()
        });
      });
      
      imap.once('error', (err) => {
        connected = false;
        imap.end();
        resolve({
          success: false,
          connected: false,
          message: `邮箱连接失败: ${err.message}`,
          timestamp: new Date().toISOString()
        });
      });
      
      imap.once('end', () => {
        console.log('测试连接结束');
      });
      
      // 设置超时
      setTimeout(() => {
        if (!connected) {
          imap.end();
          resolve({
            success: false,
            connected: false,
            message: '邮箱连接超时',
            timestamp: new Date().toISOString()
          });
        }
      }, 5000);
      
      imap.connect();
    }).then(result => {
      res.json(result);
    }).catch(error => {
      res.json({
        success: false,
        connected: false,
        message: `邮箱连接异常: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    });
    
  } catch (error) {
    console.error('❌ 邮件状态检查失败:', error);
    res.status(500).json({
      success: false,
      connected: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 2. 邮件搜索（兼容路由）
app.get('/api/email/search/:bookingRef', async (req, res) => {
  try {
    const { bookingRef } = req.params;
    console.log(`📧 邮件搜索（兼容路由）: ${bookingRef}`);
    
    // 重定向到实际接口
    const searchUrl = `/api/mail/search/${bookingRef}`;
    console.log(`🔄 重定向到: ${searchUrl}`);
    
    // 直接调用搜索函数
    const searchResults = await searchEmailByBookingRef(bookingRef);
    
    res.json({
      success: true,
      bookingRef,
      ...searchResults,
      timestamp: new Date().toISOString(),
      note: '来自兼容性路由 /api/email/search/'
    });
    
  } catch (error) {
    console.error('❌ 邮件搜索失败（兼容路由）:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: '邮件搜索失败，请检查邮箱配置',
      timestamp: new Date().toISOString()
    });
  }
});

// 3. 邮件附件下载（兼容路由）- 注意：前端可能只传递 bookingRef
app.get('/api/email/download/:bookingRef', async (req, res) => {
  try {
    const { bookingRef } = req.params;
    const { emailUid } = req.query;
    
    console.log(`📎 邮件附件下载（兼容路由）: ${bookingRef}, emailUid: ${emailUid}`);
    
    if (!emailUid) {
      // 如果没有提供 emailUid，先搜索邮件
      console.log('🔍 未提供emailUid，先搜索邮件...');
      const searchResults = await searchEmailByBookingRef(bookingRef);
      
      if (!searchResults.found || searchResults.emails.length === 0) {
        return res.json({
          success: false,
          bookingRef,
          message: `未找到包含 ${bookingRef} 的邮件，无法下载附件`,
          searchResults
        });
      }
      
      // 使用第一个邮件的 UID
      const firstEmail = searchResults.emails[0];
      console.log(`📧 使用第一个邮件的UID: ${firstEmail.uid}`);
      
      // 重定向到带UID的下载接口
      const downloadUrl = `/api/mail/download/${bookingRef}/${firstEmail.uid}`;
      console.log(`🔄 重定向到: ${downloadUrl}`);
      
      // 直接调用下载函数
      const downloadResults = await downloadEmailAttachments(bookingRef, firstEmail.uid);
      
      if (downloadResults.attachments.length === 0) {
        return res.json({
          success: true,
          bookingRef,
          message: '未找到附件',
          attachments: []
        });
      }
      
      // 处理附件下载（代码与原有逻辑相同）
      if (downloadResults.attachments.length === 1) {
        const attachment = downloadResults.attachments[0];
        
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
        res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
        res.setHeader('Content-Length', attachment.size);
        
        return res.send(Buffer.from(attachment.content));
      }
      
      // 多个附件处理（代码与原有逻辑相同）
      try {
        const AdmZip = require('adm-zip');
        const zip = new AdmZip();
        
        downloadResults.attachments.forEach(attachment => {
          zip.addFile(attachment.fileName, Buffer.from(attachment.content));
        });
        
        const zipBuffer = zip.toBuffer();
        const zipFileName = `attachments_${bookingRef}_${Date.now()}.zip`;
        
        res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Length', zipBuffer.length);
        
        return res.send(zipBuffer);
        
      } catch (zipError) {
        console.warn('ZIP压缩失败，返回附件列表:', zipError.message);
        
        return res.json({
          success: true,
          bookingRef,
          message: `找到 ${downloadResults.attachments.length} 个附件`,
          attachments: downloadResults.attachments.map(att => ({
            fileName: att.fileName,
            contentType: att.contentType,
            size: att.size,
            base64: att.base64.substring(0, 100) + '...',
            downloadUrl: `/api/mail/attachment/${bookingRef}/${firstEmail.uid}/${encodeURIComponent(att.fileName)}`
          }))
        });
      }
    } else {
      // 有 emailUid，直接重定向到现有接口
      console.log(`🔄 重定向到: /api/mail/download/${bookingRef}/${emailUid}`);
      return res.redirect(`/api/mail/download/${bookingRef}/${emailUid}`);
    }
    
  } catch (error) {
    console.error('❌ 邮件附件下载失败（兼容路由）:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: '附件下载失败',
      timestamp: new Date().toISOString()
    });
  }
});

// 4. 简化版邮件状态检查
app.get('/api/email/check', async (req, res) => {
  try {
    console.log('📧 简化版邮件状态检查');
    
    const imap = createImapConnection();
    
    return new Promise((resolve, reject) => {
      let connected = false;
      
      imap.once('ready', () => {
        connected = true;
        imap.end();
        resolve({
          status: 'connected',
          message: '邮箱连接正常',
          timestamp: new Date().toISOString()
        });
      });
      
      imap.once('error', (err) => {
        connected = false;
        imap.end();
        resolve({
          status: 'disconnected',
          message: `邮箱连接失败: ${err.message}`,
          timestamp: new Date().toISOString()
        });
      });
      
      setTimeout(() => {
        if (!connected) {
          imap.end();
          resolve({
            status: 'timeout',
            message: '邮箱连接超时',
            timestamp: new Date().toISOString()
          });
        }
      }, 3000);
      
      imap.connect();
    }).then(result => {
      res.json(result);
    }).catch(error => {
      res.json({
        status: 'error',
        message: `邮箱连接异常: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    });
    
  } catch (error) {
    console.error('❌ 简化版邮件状态检查失败:', error);
    res.json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 5. 邮件列表（兼容路由）
app.get('/api/email/recent', async (req, res) => {
  try {
    console.log('📧 获取最近邮件（兼容路由）');
    
    // 重定向到实际接口
    const recentUrl = '/api/mail/recent';
    console.log(`🔄 重定向到: ${recentUrl}`);
    
    // 直接调用函数
    return new Promise((resolve, reject) => {
      const imap = createImapConnection();
      const emails = [];
      
      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            imap.end();
            return reject(err);
          }
          
          const limit = req.query.limit || 10;
          const fetch = imap.seq.fetch(`${box.messages.total - parseInt(limit) + 1}:${box.messages.total}`, {
            bodies: ['HEADER.FIELDS (FROM SUBJECT DATE)'],
            struct: true
          });
          
          fetch.on('message', (msg, seqno) => {
            const email = {
              seqno: seqno,
              subject: '',
              from: '',
              date: ''
            };
            
            msg.on('body', (stream, info) => {
              let buffer = '';
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
              stream.on('end', () => {
                const headerLines = buffer.split('\r\n');
                headerLines.forEach(line => {
                  if (line.toLowerCase().startsWith('subject:')) {
                    email.subject = line.substring(9).trim();
                  } else if (line.toLowerCase().startsWith('from:')) {
                    email.from = line.substring(6).trim();
                  } else if (line.toLowerCase().startsWith('date:')) {
                    email.date = line.substring(6).trim();
                  }
                });
              });
            });
            
            msg.once('end', () => {
              emails.push(email);
            });
          });
          
          fetch.once('error', (fetchErr) => {
            imap.end();
            reject(fetchErr);
          });
          
          fetch.once('end', () => {
            imap.end();
            resolve(emails.reverse());
          });
        });
      });
      
      imap.once('error', (err) => {
        reject(err);
      });
      
      imap.connect();
    }).then(emails => {
      res.json({
        success: true,
        emails,
        count: emails.length,
        timestamp: new Date().toISOString(),
        note: '来自兼容性路由 /api/email/recent'
      });
    }).catch(error => {
      throw error;
    });
    
  } catch (error) {
    console.error('❌ 获取邮件列表失败（兼容路由）:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 6. 统一的邮件连接测试（兼容多个端点）
app.get('/api/email/test', async (req, res) => {
  try {
    console.log('📧 邮件连接测试（兼容路由）');
    
    // 重定向到实际接口
    const testUrl = '/api/mail/test';
    console.log(`🔄 重定向到: ${testUrl}`);
    
    // 直接调用函数
    return new Promise((resolve, reject) => {
      const imap = createImapConnection();
      let connected = false;
      
      imap.once('ready', () => {
        connected = true;
        imap.end();
        resolve({
          success: true,
          message: '邮箱连接成功',
          connected: true,
          timestamp: new Date().toISOString()
        });
      });
      
      imap.once('error', (err) => {
        connected = false;
        imap.end();
        resolve({
          success: false,
          message: `邮箱连接失败: ${err.message}`,
          connected: false,
          timestamp: new Date().toISOString()
        });
      });
      
      setTimeout(() => {
        if (!connected) {
          imap.end();
          resolve({
            success: false,
            message: '邮箱连接超时',
            connected: false,
            timestamp: new Date().toISOString()
          });
        }
      }, 5000);
      
      imap.connect();
    }).then(result => {
      res.json(result);
    }).catch(error => {
      res.json({
        success: false,
        message: `邮箱连接异常: ${error.message}`,
        connected: false,
        timestamp: new Date().toISOString()
      });
    });
    
  } catch (error) {
    console.error('❌ 邮件连接测试失败（兼容路由）:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      connected: false,
      timestamp: new Date().toISOString()
    });
  }
});

// 7. 邮件附件下载（带UID的兼容路由）
app.get('/api/email/download/:bookingRef/:emailUid', async (req, res) => {
  try {
    const { bookingRef, emailUid } = req.params;
    
    console.log(`📎 邮件附件下载（带UID兼容路由）: ${bookingRef}, UID: ${emailUid}`);
    
    // 重定向到实际接口
    const downloadUrl = `/api/mail/download/${bookingRef}/${emailUid}`;
    console.log(`🔄 重定向到: ${downloadUrl}`);
    
    // 直接调用下载函数
    const downloadResults = await downloadEmailAttachments(bookingRef, emailUid);
    
    if (downloadResults.attachments.length === 0) {
      return res.json({
        success: true,
        bookingRef,
        message: '未找到附件',
        attachments: []
      });
    }
    
    // 单个附件
    if (downloadResults.attachments.length === 1) {
      const attachment = downloadResults.attachments[0];
      
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
      res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
      res.setHeader('Content-Length', attachment.size);
      
      return res.send(Buffer.from(attachment.content));
    }
    
    // 多个附件
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip();
      
      downloadResults.attachments.forEach(attachment => {
        zip.addFile(attachment.fileName, Buffer.from(attachment.content));
      });
      
      const zipBuffer = zip.toBuffer();
      const zipFileName = `attachments_${bookingRef}_${Date.now()}.zip`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', zipBuffer.length);
      
      return res.send(zipBuffer);
      
    } catch (zipError) {
      console.warn('ZIP压缩失败，返回附件列表:', zipError.message);
      
      return res.json({
        success: true,
        bookingRef,
        message: `找到 ${downloadResults.attachments.length} 个附件`,
        attachments: downloadResults.attachments.map(att => ({
          fileName: att.fileName,
          contentType: att.contentType,
          size: att.size,
          base64: att.base64.substring(0, 100) + '...',
          downloadUrl: `/api/email/attachment/${bookingRef}/${emailUid}/${encodeURIComponent(att.fileName)}`
        }))
      });
    }
    
  } catch (error) {
    console.error('❌ 邮件附件下载失败（带UID兼容路由）:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: '附件下载失败',
      timestamp: new Date().toISOString()
    });
  }
});

// 8. 单个附件下载（兼容路由）
app.get('/api/email/attachment/:bookingRef/:emailUid/:fileName', async (req, res) => {
  try {
    const { bookingRef, emailUid, fileName } = req.params;
    const decodedFileName = decodeURIComponent(fileName);
    
    console.log(`📄 下载单个附件（兼容路由）: ${decodedFileName}`);
    
    // 重定向到实际接口
    const attachmentUrl = `/api/mail/attachment/${bookingRef}/${emailUid}/${fileName}`;
    console.log(`🔄 重定向到: ${attachmentUrl}`);
    
    const downloadResults = await downloadEmailAttachments(bookingRef, emailUid);
    
    const attachment = downloadResults.attachments.find(
      att => att.fileName === decodedFileName
    );
    
    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: '附件不存在'
      });
    }
    
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
    res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', attachment.size);
    
    res.send(Buffer.from(attachment.content));
    
  } catch (error) {
    console.error('❌ 下载单个附件失败（兼容路由）:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 新增：SMTP连接测试 ====================

// 8. SMTP连接测试
app.get('/api/test-smtp', async (req, res) => {
  try {
    console.log('📧 测试SMTP连接...');
    console.log('📧 邮箱地址:', process.env.OUTLOOK_EMAIL);
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.OUTLOOK_EMAIL,
        pass: process.env.OUTLOOK_PASSWORD
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      },
      debug: true, // 启用调试输出
      logger: true
    });
    
    console.log('🔍 正在验证SMTP连接...');
    
    // 验证连接配置
    const verifyResult = await transporter.verify();
    
    console.log('✅ SMTP连接验证成功');
    
    // 尝试发送测试邮件
    try {
      const testEmail = {
        from: process.env.OUTLOOK_EMAIL,
        to: process.env.OUTLOOK_EMAIL, // 发送给自己
        subject: 'OceanFlow SMTP 连接测试',
        text: `这是一封测试邮件，用于验证SMTP连接。\n时间: ${new Date().toISOString()}\n服务器: ${req.headers.host}`,
        html: `
          <h2>OceanFlow SMTP 连接测试</h2>
          <p>这是一封测试邮件，用于验证SMTP连接。</p>
          <ul>
            <li><strong>时间:</strong> ${new Date().toLocaleString()}</li>
            <li><strong>服务器:</strong> ${req.headers.host}</li>
            <li><strong>环境:</strong> ${process.env.NODE_ENV || 'development'}</li>
          </ul>
          <p>如果收到此邮件，说明SMTP配置正确。</p>
        `
      };
      
      const sendResult = await transporter.sendMail(testEmail);
      
      console.log('📨 测试邮件发送成功:', sendResult.messageId);
      
      res.json({
        success: true,
        message: 'SMTP连接成功并已发送测试邮件',
        verification: verifyResult,
        emailSent: {
          messageId: sendResult.messageId,
          accepted: sendResult.accepted,
          rejected: sendResult.rejected
        },
        config: {
          host: 'smtp.office365.com',
          port: 587,
          user: process.env.OUTLOOK_EMAIL,
          passwordLength: process.env.OUTLOOK_PASSWORD ? process.env.OUTLOOK_PASSWORD.length : 0
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (sendError) {
      console.warn('⚠️ 邮件发送失败，但连接验证成功:', sendError.message);
      
      res.json({
        success: true,
        message: 'SMTP连接验证成功，但发送测试邮件失败',
        verification: verifyResult,
        sendError: {
          message: sendError.message,
          code: sendError.code
        },
        config: {
          host: 'smtp.office365.com',
          port: 587,
          user: process.env.OUTLOOK_EMAIL
        },
        note: '连接已建立，但发送邮件可能需要额外的权限配置'
      });
    }
    
  } catch (error) {
    console.error('❌ SMTP测试失败:', error);
    
    // 提供详细的错误信息
    const errorDetails = {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    };
    
    console.error('🔍 错误详情:', errorDetails);
    
    res.json({
      success: false,
      message: `SMTP测试失败: ${error.message}`,
      error: errorDetails,
      troubleshooting: [
        '1. 检查邮箱密码是否正确',
        '2. 确认是否启用了双重验证',
        '3. 如果是双重验证，需要使用应用专用密码',
        '4. 检查服务器防火墙是否允许出站587端口',
        '5. 尝试访问 https://outlook.office365.com 验证账户状态'
      ],
      config: {
        email: process.env.OUTLOOK_EMAIL,
        passwordSet: !!process.env.OUTLOOK_PASSWORD,
        host: 'smtp.office365.com',
        port: 587,
        timestamp: new Date().toISOString()
      }
    });
  }
});


// ==================== 原有邮件相关API端点 ====================
// 1. 搜索包含bookingRef的邮件
app.get('/api/mail/search/:bookingRef', async (req, res) => {
  try {
    const { bookingRef } = req.params;
    
    if (!bookingRef) {
      return res.status(400).json({
        success: false,
        error: '需要提供bookingRef参数'
      });
    }

    console.log(`📧 搜索邮件: ${bookingRef}`);
    
    const searchResults = await searchEmailByBookingRef(bookingRef);
    
    res.json({
      success: true,
      bookingRef,
      ...searchResults,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 搜索邮件失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: '邮件搜索失败，请检查邮箱配置'
    });
  }
});

// 2. 下载邮件附件
app.get('/api/mail/download/:bookingRef/:emailUid', async (req, res) => {
  try {
    const { bookingRef, emailUid } = req.params;
    
    if (!bookingRef || !emailUid) {
      return res.status(400).json({
        success: false,
        error: '需要提供bookingRef和emailUid参数'
      });
    }

    console.log(`📎 下载附件: ${bookingRef}, 邮件UID: ${emailUid}`);
    
    const downloadResults = await downloadEmailAttachments(bookingRef, emailUid);
    
    if (downloadResults.attachments.length === 0) {
      return res.json({
        success: true,
        bookingRef,
        message: '未找到附件',
        attachments: []
      });
    }

    // 如果只有一个附件，直接返回文件
    if (downloadResults.attachments.length === 1) {
      const attachment = downloadResults.attachments[0];
      
      // 设置响应头，让浏览器下载文件
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
      res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
      res.setHeader('Content-Length', attachment.size);
      
      // 发送文件内容
      return res.send(Buffer.from(attachment.content));
    }

    // 如果有多个附件，返回ZIP文件（需要安装adm-zip库）
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip();
      
      downloadResults.attachments.forEach(attachment => {
        zip.addFile(attachment.fileName, Buffer.from(attachment.content));
      });
      
      const zipBuffer = zip.toBuffer();
      const zipFileName = `attachments_${bookingRef}_${Date.now()}.zip`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', zipBuffer.length);
      
      return res.send(zipBuffer);
      
    } catch (zipError) {
      console.warn('ZIP压缩失败，返回附件列表:', zipError.message);
      
      // 如果ZIP压缩失败，返回附件列表供用户选择下载
      return res.json({
        success: true,
        bookingRef,
        message: `找到 ${downloadResults.attachments.length} 个附件`,
        attachments: downloadResults.attachments.map(att => ({
          fileName: att.fileName,
          contentType: att.contentType,
          size: att.size,
          base64: att.base64.substring(0, 100) + '...', // 只返回部分内容预览
          downloadUrl: `/api/mail/attachment/${bookingRef}/${emailUid}/${encodeURIComponent(att.fileName)}`
        }))
      });
    }
    
  } catch (error) {
    console.error('❌ 下载附件失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: '附件下载失败'
    });
  }
});

// 3. 下载单个附件
app.get('/api/mail/attachment/:bookingRef/:emailUid/:fileName', async (req, res) => {
  try {
    const { bookingRef, emailUid, fileName } = req.params;
    const decodedFileName = decodeURIComponent(fileName);
    
    console.log(`📄 下载单个附件: ${decodedFileName}`);
    
    const downloadResults = await downloadEmailAttachments(bookingRef, emailUid);
    
    const attachment = downloadResults.attachments.find(
      att => att.fileName === decodedFileName
    );
    
    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: '附件不存在'
      });
    }
    
    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
    res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', attachment.size);
    
    // 发送文件内容
    res.send(Buffer.from(attachment.content));
    
  } catch (error) {
    console.error('❌ 下载单个附件失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 4. 获取邮件列表（简化版）
app.get('/api/mail/recent', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    return new Promise((resolve, reject) => {
      const imap = createImapConnection();
      const emails = [];
      
      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            imap.end();
            return reject(err);
          }
          
          const fetch = imap.seq.fetch(`${box.messages.total - parseInt(limit) + 1}:${box.messages.total}`, {
            bodies: ['HEADER.FIELDS (FROM SUBJECT DATE)'],
            struct: true
          });
          
          fetch.on('message', (msg, seqno) => {
            const email = {
              seqno: seqno,
              subject: '',
              from: '',
              date: ''
            };
            
            msg.on('body', (stream, info) => {
              let buffer = '';
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
              stream.on('end', () => {
                const headerLines = buffer.split('\r\n');
                headerLines.forEach(line => {
                  if (line.toLowerCase().startsWith('subject:')) {
                    email.subject = line.substring(9).trim();
                  } else if (line.toLowerCase().startsWith('from:')) {
                    email.from = line.substring(6).trim();
                  } else if (line.toLowerCase().startsWith('date:')) {
                    email.date = line.substring(6).trim();
                  }
                });
              });
            });
            
            msg.once('end', () => {
              emails.push(email);
            });
          });
          
          fetch.once('error', (fetchErr) => {
            imap.end();
            reject(fetchErr);
          });
          
          fetch.once('end', () => {
            imap.end();
            resolve(emails.reverse()); // 最新的邮件在前
          });
        });
      });
      
      imap.once('error', (err) => {
        reject(err);
      });
      
      imap.connect();
    }).then(emails => {
      res.json({
        success: true,
        emails,
        count: emails.length,
        timestamp: new Date().toISOString()
      });
    }).catch(error => {
      throw error;
    });
    
  } catch (error) {
    console.error('❌ 获取邮件列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 5. 测试邮箱连接
app.get('/api/mail/test', async (req, res) => {
  try {
    return new Promise((resolve, reject) => {
      const imap = createImapConnection();
      let connected = false;
      
      imap.once('ready', () => {
        connected = true;
        imap.end();
        resolve(true);
      });
      
      imap.once('error', (err) => {
        connected = false;
        imap.end();
        reject(err);
      });
      
      imap.once('end', () => {
        console.log('测试连接结束');
      });
      
      // 设置超时
      setTimeout(() => {
        if (!connected) {
          imap.end();
          reject(new Error('连接超时'));
        }
      }, 5000);
      
      imap.connect();
    }).then(() => {
      res.json({
        success: true,
        message: '邮箱连接成功',
        config: {
          user: mailConfig.imap.user,
          host: mailConfig.imap.host
        },
        timestamp: new Date().toISOString()
      });
    }).catch(error => {
      res.json({
        success: false,
        error: error.message,
        message: '邮箱连接失败，请检查配置',
        config: {
          user: mailConfig.imap.user,
          host: mailConfig.imap.host
        }
      });
    });
    
  } catch (error) {
    console.error('❌ 测试邮箱连接失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 在启动服务器时测试邮箱连接
app.on('listening', () => {
  console.log('📧 尝试连接邮箱...');
  console.log('ℹ️  邮件API可用路径:');
  console.log('   - /api/mail/* (原生)');
  console.log('   - /api/email/* (兼容前端)');
  
  // 异步测试连接，不阻塞启动
  setTimeout(async () => {
    try {
      const imap = createImapConnection();
      
      imap.once('ready', () => {
        console.log('✅ 邮箱连接成功');
        imap.end();
      });
      
      imap.once('error', (err) => {
        console.warn('⚠️ 邮箱连接失败:', err.message);
        console.log('ℹ️  如需使用邮件功能，请设置以下环境变量:');
        console.log('   OUTLOOK_EMAIL=您的Outlook邮箱');
        console.log('   OUTLOOK_PASSWORD=您的邮箱密码或应用专用密码');
        imap.end();
      });
      
      imap.connect();
    } catch (error) {
      console.warn('⚠️ 邮箱连接测试异常:', error.message);
    }
  }, 2000);
});

// ==================== 数据映射函数 ====================
const mapBookingRowToFrontend = (row) => {
  if (!row) return null;
  
  console.log('📥 映射数据库行到前端:', {
    id: row.id,
    etd: row.etd,
    hasData: !!row.data,
    dataType: typeof row.data
  });
  
  const data = row.data || {};
  let parsedData = data;
  
  // 解析 data 字段
  if (typeof data === 'string') {
    try {
      parsedData = JSON.parse(data);
      console.log('✅ 成功解析 data 字段:', {
        client: parsedData.client,
        carrier: parsedData.carrier,
        type: parsedData.type
      });
    } catch (e) {
      console.warn('解析 data 字段失败:', e.message);
      parsedData = {};
    }
  } else if (data && typeof data === 'object') {
    parsedData = data;
  } else {
    parsedData = {};
  }
  
  // ==================== 简化日期处理函数 ====================
  const formatDateForFrontend = (dateString) => {
    if (!dateString) return '';
    
    try {
      // 如果已经是 YYYY-MM-DD 格式，直接返回
      if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateString;
      }
      
      // 对于其他格式，尝试解析但不进行时区转换
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn('日期解析失败:', dateString);
        return dateString;
      }
      
      // 直接格式化为 YYYY-MM-DD，不进行时区转换
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.warn('日期格式化错误:', error, dateString);
      return dateString;
    }
  };
  
  // ==================== 处理所有日期字段 ====================
  const etd = formatDateForFrontend(row.etd || '');
  const gateIn = formatDateForFrontend(parsedData.gateIn || '');
  const eta = formatDateForFrontend(parsedData.eta || '');
  const etb = formatDateForFrontend(parsedData.etb || '');
  
  console.log('📅 日期处理结果:', {
    etd: { raw: row.etd, processed: etd },
    gateIn: { raw: parsedData.gateIn, processed: gateIn },
    eta: { raw: parsedData.eta, processed: eta },
    etb: { raw: parsedData.etb, processed: etb }
  });
  
  // 创建返回对象
  const result = {
    id: row.id,
    database_id: row.database_id || '',
    week: row.week || '',
    bookingRef: row.bookingref || '',
    
    // 系统字段 - 使用处理后的日期
    etd: etd,
    state: row.status || parsedData.status || 'PENDING',
    isLocked: row.is_locked || false,
    finance: row.finance || parsedData.finance || {},
    
    // 业务字段 - 使用处理后的日期
    client: parsedData.client || '',
    carrier: parsedData.carrier || '',
    service: parsedData.service || '',
    pol: parsedData.pol || '',
    pod: parsedData.pod || '',
    vessel: parsedData.vessel || '',
    type: parsedData.type || parsedData.containerType || '',
    containerType: parsedData.type || parsedData.containerType || '',
    qty: parsedData.qty || 0,
    quantity: parsedData.qty || 0,
    gateIn: gateIn,
    gateInDate: gateIn,
    job: parsedData.job || '',
    contact: parsedData.contact || '', // 添加这一行
    allocation: parsedData.allocation || '',
    remark: parsedData.remark || '',
    eta: eta,
    etb: etb,
    
    // 状态字段
    status: row.status || parsedData.status || 'PENDING',
    
    // 保留完整的 data 字段供前端备用
    data: parsedData,
    
    // 时间戳
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  
  console.log('✅ 映射结果:', {
    id: result.id,
    bookingRef: result.bookingRef,
    etd: result.etd,
    client: result.client,
    carrier: result.carrier,
    type: result.type
  });
  
  return result;
};

// ==================== 简化日期格式化函数 ====================
const formatDateForDatabase = (dateString) => {
  if (!dateString) return '';
  
  // 如果已经是正确的 YYYY-MM-DD 格式，直接返回
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString;
  }
  
  try {
    // 尝试解析日期
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      console.warn('无效的日期字符串:', dateString);
      return '';
    }
    
    // 直接格式化为 YYYY-MM-DD，不进行时区转换
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.warn('日期格式化错误:', error, dateString);
    return '';
  }
};

// ==================== API路由 ====================

// 1. 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: 'connected',
    uptime: process.uptime()
  });
});

// 2.1 简易日志查看接口
app.get('/api/logs', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      DB_HOST: process.env.DB_HOST || 'localhost',
      DB_PORT: process.env.DB_PORT || 5432,
      DB_NAME: process.env.DB_NAME || 'oceanflow'
    },
    error: "请检查服务器控制台日志"
  });
});

// 2.2 测试数据库连接
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as time');
    res.json({
      success: true,
      database: 'connected',
      time: result.rows[0].time,
      connection: {
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER
      }
    });
  } catch (error) {
    console.error('数据库连接错误:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: '数据库连接失败'
    });
  }
});

// 2. 初始化数据 - 修改以支持新的 GateInRate 数据结构
app.get('/api/init', async (req, res) => {
  try {
    console.log('🔍 开始初始化数据...');
    
    let users = [];
    let databases = [];
    let settings = {
      carriers: [],
      clients: [],
      services: [],
      pols: [],
      pods: [],
      containerTypes: [],
      statuses: ['PENDING', 'CONFIRMED', 'ROLLED'],
      jobs: [],
      allocations: [],
      remarks: [],
      gateInRates: []
    };
    
    // 1. 获取用户
    try {
      const usersResult = await pool.query(`
        SELECT id, username, first_name, role, permissions, is_approved, database_access, created_at 
        FROM users 
        -- 移除 WHERE is_approved = true 条件
        ORDER BY created_at DESC
      `);
      users = usersResult.rows.map(u => ({
        id: u.id,
        username: u.username,
        firstName: u.first_name,
        role: u.role || 'USER',
        permissions: u.permissions || [],
        databaseAccess: u.database_access || [],
        isApproved: u.is_approved || false,
        createdAt: u.created_at
      }));
      console.log(`✅ 加载 ${users.length} 个用户`);
    } catch (userError) {
      console.warn('⚠️ 加载用户失败:', userError.message);
    }
    
    // 2. 获取数据库
    try {
      const dbResult = await pool.query(`
        SELECT id, name, description, color, icon, is_active, sort_order, created_at, updated_at 
        FROM databases 
        ORDER BY created_at ASC
      `);
      databases = dbResult.rows.map(db => ({
        id: db.id,
        name: db.name,
        description: db.description || '',
        color: db.color || '#3B82F6',
        icon: db.icon || 'database',
        isActive: db.is_active || true,
        sortOrder: db.sort_order || 0,
        createdAt: db.created_at,
        updatedAt: db.updated_at,
        bookingsCount: 0
      }));
      console.log(`✅ 加载 ${databases.length} 个数据库`);
    } catch (dbError) {
      console.warn('⚠️ 加载数据库失败:', dbError.message);
    }
    
    // 3. 获取系统设置 - 修改以支持新的 GateInRate 结构
    try {
      const settingsResult = await pool.query(`
        SELECT * FROM system_settings WHERE id = 1
      `);
      
      if (settingsResult.rows.length > 0) {
        const row = settingsResult.rows[0];
        
        const safeParse = (field) => {
          try {
            if (!field) return [];
            if (Array.isArray(field)) return field;
            if (typeof field === 'string') {
              if (field.trim() === '') return [];
              const parsed = JSON.parse(field);
              return Array.isArray(parsed) ? parsed : parsed;
            }
            return [];
          } catch (e) {
            console.warn(`解析字段失败:`, e.message);
            return [];
          }
        };
        
        // 处理 gateinrates，兼容旧数据结构
        let gateInRates = safeParse(row.gateinrates);
        
        // 如果 gateinrates 是旧结构，转换为新结构
        if (gateInRates.length > 0 && gateInRates[0] && !gateInRates[0].items) {
          console.log('🔄 检测到旧的 gateinrates 结构，正在转换...');
          gateInRates = gateInRates.map(oldRate => ({
            id: oldRate.id || `rate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            startDate: oldRate.startDate || '',
            endDate: oldRate.endDate || '',
            service: oldRate.service || '',
            contact: oldRate.contact || '',
            items: [{
              id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              pols: oldRate.pols || [],
              pods: oldRate.pods || [],
              containerTypes: oldRate.containerType ? [oldRate.containerType] : [],
              price: oldRate.price || 0
            }]
          }));
          console.log('✅ gateinrates 结构转换完成');
        }
        
        settings = {
          carriers: safeParse(row.carriers),
          clients: safeParse(row.clients),
          services: safeParse(row.services),
          pols: safeParse(row.pols),
          pods: safeParse(row.pods),
          containerTypes: safeParse(row.types),
          statuses: safeParse(row.status),
          jobs: safeParse(row.jobs),
          allocations: safeParse(row.allocations),
          remarks: safeParse(row.remarks),
          gateInRates: gateInRates // 使用转换后的数据
        };
      } else {
        console.log('⚠️ 未找到系统设置记录，使用默认设置');
        try {
          await pool.query(`
            INSERT INTO system_settings (id, status) 
            VALUES (1, $1::jsonb)
            ON CONFLICT (id) DO NOTHING
          `, [JSON.stringify(['PENDING', 'CONFIRMED', 'ROLLED'])]);
          console.log('✅ 已创建默认系统设置');
        } catch (insertError) {
          console.warn('⚠️ 创建默认设置失败:', insertError.message);
        }
      }
    } catch (settingsError) {
      console.error('❌ 加载系统设置失败:', settingsError.message);
    }
    
    const stats = {
      bookings: 0,
      quotations: 0,
      users: users.length,
      databases: databases.length
    };
    
    console.log('✅ 初始化数据完成');
    
    res.json({
      success: true,
      users,
      databases,
      settings,
      stats,
      message: '初始化数据加载完成',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ /api/init 全局错误:', error);
    
    res.status(500).json({
      success: false,
      users: [],
      databases: [],
      settings: {
        carriers: [],
        clients: [],
        services: [],
        pols: [],
        pods: [],
        containerTypes: [],
        statuses: ['PENDING', 'CONFIRMED', 'ROLLED'],
        jobs: [],
        allocations: [],
        remarks: [],
        gateInRates: []
      },
      stats: {
        bookings: 0,
        quotations: 0,
        users: 0,
        databases: 0
      },
      error: error.message,
      message: '初始化失败，但返回了基本数据结构'
    });
  }
});

// 3. 获取所有数据库 - 取消分页
app.get('/api/databases', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM databases ORDER BY created_at ASC'
    );
    
    const databases = await Promise.all(result.rows.map(async (db) => {
      const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM bookings WHERE database_id = $1',
        [db.id]
      );
      
      return {
        id: db.id,
        name: db.name,
        description: db.description || '',
        color: db.color || '#3B82F6',
        icon: db.icon || 'database',
        isActive: db.is_active || true,
        sortOrder: db.sort_order || 0,
        bookingsCount: parseInt(countResult.rows[0].count) || 0,
        createdAt: db.created_at,
        updatedAt: db.updated_at
      };
    }));
    
    res.json({
      success: true,
      databases
    });
    
  } catch (error) {
    console.error('❌ 获取数据库列表错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3.1 创建数据库 - 修改为使用相同名称
app.post('/api/databases', async (req, res) => {
  try {
    const { name, description, color = '#3B82F6', icon = 'database' } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: '数据库名称不能为空'
      });
    }
    
    // 使用相同的名称作为 id/name/description
    const databaseId = name.trim(); // id 直接使用名称
    const dbName = name.trim(); // name 使用名称
    const dbDescription = name.trim(); // description 也使用名称
    
    const result = await pool.query(
      `INSERT INTO databases (
        id, name, description, color, icon, is_active, 
        sort_order, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *`,
      [
        databaseId,
        dbName,
        dbDescription,
        color,
        icon,
        true,
        0
      ]
    );
    
    const database = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      description: result.rows[0].description || '',
      color: result.rows[0].color || '#3B82F6',
      icon: result.rows[0].icon || 'database',
      isActive: result.rows[0].is_active || true,
      sortOrder: result.rows[0].sort_order || 0,
      bookingsCount: 0,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };
    
    console.log('✅ 数据库创建成功:', {
      id: database.id,
      name: database.name,
      description: database.description
    });
    
    res.json({
      success: true,
      database,
      message: '数据库创建成功'
    });
    
  } catch (error) {
    console.error('❌ 创建数据库错误:', error);
    
    // 处理名称重复错误
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: '数据库名称已存在，请使用不同的名称'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3.2 重命名数据库
app.put('/api/databases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, icon, isActive, sortOrder } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: '数据库名称不能为空'
      });
    }
    
    const existing = await pool.query(
      'SELECT id FROM databases WHERE id = $1',
      [id]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '数据库不存在'
      });
    }
    
    const dbName = name.trim();
    const dbDescription = description && description.trim() !== '' 
      ? description.trim() 
      : dbName;
    
    const result = await pool.query(
      `UPDATE databases SET
        name = $1,
        description = $2,
        color = $3,
        icon = $4,
        is_active = $5,
        sort_order = $6,
        updated_at = NOW()
      WHERE id = $7
      RETURNING *`,
      [
        dbName,
        dbDescription,
        color || '#3B82F6',
        icon || 'database',
        isActive !== undefined ? isActive : true,
        sortOrder !== undefined ? sortOrder : 0,
        id
      ]
    );
    
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM bookings WHERE database_id = $1',
      [id]
    );
    
    const database = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      description: result.rows[0].description || '',
      color: result.rows[0].color || '#3B82F6',
      icon: result.rows[0].icon || 'database',
      isActive: result.rows[0].is_active || true,
      sortOrder: result.rows[0].sort_order || 0,
      bookingsCount: parseInt(countResult.rows[0].count) || 0,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };
    
    console.log('✅ 数据库更新成功:', {
      name: database.name,
      description: database.description
    });
    
    res.json({
      success: true,
      database,
      message: '数据库更新成功'
    });
    
  } catch (error) {
    console.error('❌ 更新数据库错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3.3 删除数据库
app.delete('/api/databases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await pool.query(
      'SELECT id, name FROM databases WHERE id = $1',
      [id]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '数据库不存在'
      });
    }
    
    const dbName = existing.rows[0].name;
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      await client.query(
        'DELETE FROM bookings WHERE database_id = $1',
        [id]
      );
      
      await client.query(
        'DELETE FROM databases WHERE id = $1',
        [id]
      );
      
      await client.query('COMMIT');
      
      console.log(`🗑️ 数据库删除成功: ${dbName} (ID: ${id})`);
      
      res.json({
        success: true,
        message: `数据库 "${dbName}" 删除成功`,
        deletedDatabase: {
          id,
          name: dbName
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ 删除数据库错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3.4 清空数据库数据（删除所有预订） - 修复版本
app.delete('/api/databases/:id/clear-data', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ 清空数据库数据请求: ${id}`);
    
    // 检查数据库是否存在
    const existing = await pool.query(
      'SELECT id, name FROM databases WHERE id = $1',
      [id]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '数据库不存在'
      });
    }
    
    const dbName = existing.rows[0].name;
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 方法1：先查询要删除的数量
      const countResult = await client.query(
        'SELECT COUNT(*) as count FROM bookings WHERE database_id = $1',
        [id]
      );
      
      const bookingsCount = parseInt(countResult.rows[0].count) || 0;
      
      // 删除该数据库下的所有预订
      await client.query(
        'DELETE FROM bookings WHERE database_id = $1',
        [id]
      );
      
      await client.query('COMMIT');
      
      console.log(`✅ 数据库数据清空成功: ${dbName} (ID: ${id}), 删除了 ${bookingsCount} 条预订`);
      
      res.json({
        success: true,
        message: `数据库 "${dbName}" 数据已清空，删除了 ${bookingsCount} 条预订`,
        deletedCount: bookingsCount,
        databaseId: id,
        databaseName: dbName
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ 清空数据库数据错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 4. 按数据库获取预订 - 取消分页
app.get('/api/databases/:dbId/bookings', async (req, res) => {
  const { dbId } = req.params;
  
  try {
    const dbCheck = await pool.query(
      'SELECT id, name FROM databases WHERE id = $1',
      [dbId]
    );
    
    if (dbCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '数据库不存在'
      });
    }
    
    const result = await pool.query(
      `SELECT * FROM bookings 
       WHERE database_id = $1 
       ORDER BY created_at DESC`,
      [dbId]
    );
    
    const bookings = result.rows.map(row => mapBookingRowToFrontend(row));
    
    res.json({
      success: true,
      database: {
        id: dbId,
        name: dbCheck.rows[0].name
      },
      bookings,
      metadata: {
        count: bookings.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error(`❌ 获取数据库 ${dbId} 预订错误:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 5. 获取所有预订 - 取消分页
app.get('/api/bookings', async (req, res) => {
  try {
    const { database_id, state, week, carrier, search } = req.query;
    
    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (database_id) {
      query += ` AND database_id = $${paramIndex}`;
      params.push(database_id);
      paramIndex++;
    }
    
    if (state) {
      query += ` AND status = $${paramIndex}`;
      params.push(state);
      paramIndex++;
    }
    
    if (week) {
      query += ` AND week = $${paramIndex}`;
      params.push(week);
      paramIndex++;
    }
    
    if (carrier) {
      query += ` AND data->>'carrier' = $${paramIndex}`;
      params.push(carrier);
      paramIndex++;
    }
    
    // 添加搜索功能，搜索 bookingref 字段
    if (search) {
      query += ` AND bookingref ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    const bookings = result.rows.map(row => mapBookingRowToFrontend(row));
    
    res.json({
      success: true,
      bookings,
      metadata: {
        count: bookings.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ 获取所有预订错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 6. 获取所有报价 - 取消分页
app.get('/api/quotations', async (req, res) => {
  try {
    const { carrier, region, pol, pod } = req.query;
    
    let query = 'SELECT * FROM quotations WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (carrier) {
      query += ` AND carrier = $${paramIndex}`;
      params.push(carrier);
      paramIndex++;
    }
    
    if (region) {
      query += ` AND region = $${paramIndex}`;
      params.push(region);
      paramIndex++;
    }
    
    if (pol) {
      query += ` AND pol = $${paramIndex}`;
      params.push(pol);
      paramIndex++;
    }
    
    if (pod) {
      query += ` AND pod = $${paramIndex}`;
      params.push(pod);
      paramIndex++;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    const quotations = result.rows.map(row => mapQuotationRowToFrontend(row));
    
    res.json({
      success: true,
      quotations,
      metadata: {
        count: quotations.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ 获取所有报价错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const mapQuotationRowToFrontend = (row) => {
  if (!row) return null;
  
  console.log('📥 映射报价数据库行到前端:', {
    id: row.id,
    hasData: !!row.data,
    dataType: typeof row.data
  });
  
  // 解析 data 字段
  let parsedData = {};
  if (row.data) {
    if (typeof row.data === 'string') {
      try {
        parsedData = JSON.parse(row.data);
      } catch (e) {
        console.warn('解析报价 data 字段失败:', e.message);
        parsedData = {};
      }
    } else if (typeof row.data === 'object') {
      parsedData = row.data;
    }
  }
  
  console.log('✅ 解析后的报价数据:', parsedData);
  
  return {
    id: row.id,
    carrier: row.carrier || parsedData.carrier || '',
    region: row.region || parsedData.region || '',
    pol: row.pol || parsedData.pol || '',
    pod: row.pod || parsedData.pod || '',
    service: parsedData.service || parsedData.si || '',  // 支持 si 字段
    containerType: parsedData.containerType || parsedData.container_type || parsedData.containerTypeValue || '',
    rate: Number(parsedData.rate) || Number(parsedData.availableFees) || 0,
    validity: parsedData.validity || parsedData.freeTime || '',
    remark: parsedData.remark || parsedData.remarks || '',
    vessel: row.vessel || parsedData.vessel || '',
    etd: formatSimpleDate(row.etd) || '',
    // 新增字段
    si: parsedData.si || parsedData.service || '',  // SI 字段
    transitTime: parsedData.transitTime || parsedData.tt || '',  // T/T 字段
    freeTime: parsedData.freeTime || parsedData.validity || '',  // FREETIME 字段
    availableFees: Number(parsedData.availableFees) || Number(parsedData.rate) || 0,  // AVAILABLE FEES 字段
    remarks: parsedData.remarks || parsedData.remark || '',  // REMARKS 字段
    // 其他可能需要的字段
    containerTypes: parsedData.containerTypes || {
      "20GP": parsedData["20GP"] || 0,
      "40GP": parsedData["40GP"] || 0,
      "40HQ": parsedData["40HQ"] || 0,
      "45HQ": parsedData["45HQ"] || 0,
      "40NOR": parsedData["40NOR"] || 0
    },
    etd: formatSimpleDate(row.etd) || '',  // 使用已有的 formatSimpleDate 函数
    
    // 保留完整的 data 字段供前端备用
    data: parsedData,
    
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

// 7.1 创建报价 - 修复ID冲突
app.post('/api/quotations', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      id,
      carrier,
      region,
      pol,
      pod,
      service,
      si,  // 新增
      containerType,
      container_type,
      rate,
      validity,
      freeTime,  // 新增
      remark,
      remarks,  // 新增
      vessel,
      etd,
      transitTime,  // 新增
      tt,  // 新增，T/T 的别名
      availableFees,  // 新增
      // 集装箱类型价格字段
      containerTypes,
      _20GP,
      _40GP,
      _40HQ,
      _45HQ,
      _40NOR
    } = req.body;
    
    console.log('📥 创建报价请求体:', JSON.stringify(req.body, null, 2));
    
    // 验证必填字段
    if (!carrier || !pol || !pod) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: '缺少必填字段：carrier、pol、pod',
        receivedData: req.body
      });
    }
    
    // 生成唯一ID - 使用更复杂的ID生成逻辑
    const generateUniqueId = () => {
      const timestamp = Date.now();
      const random = crypto.randomBytes(16).toString('hex');
      return `quote_${timestamp}_${random}`;
    };
    
    // 如果前端提供了ID，检查是否已存在
    let quotationId = id;
    let isUpdate = false;
    
    if (id) {
      // 检查ID是否已存在
      const existingResult = await client.query(
        'SELECT id FROM quotations WHERE id = $1',
        [id]
      );
      
      if (existingResult.rows.length > 0) {
        // ID已存在，执行更新操作
        console.log('🔄 ID已存在，执行更新操作:', id);
        isUpdate = true;
      } else {
        // ID不存在，但格式可能是时间戳，转换为quote_前缀格式
        quotationId = `quote_${id}`;
      }
    } else {
      // 没有提供ID，生成新的
      quotationId = generateUniqueId();
    }
    
    console.log('📝 使用的报价ID:', quotationId, '操作类型:', isUpdate ? '更新' : '创建');
    
    // 构建 data 字段的 JSON 数据
    // 构建 data 字段的 JSON 数据 - 修复版本，包含所有字段
    const dataJson = {
      service: service || si || '',
      si: si || service || '',  // 保存 SI
      containerType: containerType || container_type || '',
      container_type: containerType || container_type || '',
      rate: rate !== undefined ? Number(rate) : (availableFees !== undefined ? Number(availableFees) : 0),
      validity: validity || freeTime || '',
      remark: remark || remarks || '',
      carrier: carrier,
      region: region || '',
      pol: pol,
      pod: pod,
      vessel: vessel || '',
      etd: etd || '',
      // 新增字段
      transitTime: transitTime || tt || '',  // T/T 字段
      freeTime: freeTime || validity || '',  // FREETIME 字段
      availableFees: availableFees !== undefined ? Number(availableFees) : (rate !== undefined ? Number(rate) : 0),  // AVAILABLE FEES 字段
      remarks: remarks || remark || '',  // REMARKS 字段
      // 集装箱类型价格
      containerTypes: containerTypes || {
        "20GP": _20GP || 0,
        "40GP": _40GP || 0,
        "40HQ": _40HQ || 0,
        "45HQ": _45HQ || 0,
        "40NOR": _40NOR || 0
      },
      // 直接保存各字段（兼容前端直接传递的字段名）
      "20GP": _20GP || 0,
      "40GP": _40GP || 0,
      "40HQ": _40HQ || 0,
      "45HQ": _45HQ || 0,
      "40NOR": _40NOR || 0
    };
    
    let result;
    
    if (isUpdate) {
      // 更新现有报价
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      // 更新表字段
      if (carrier !== undefined) {
        updateFields.push(`carrier = $${paramIndex}`);
        updateValues.push(carrier);
        paramIndex++;
      }
      
      if (region !== undefined) {
        updateFields.push(`region = $${paramIndex}`);
        updateValues.push(region || '');
        paramIndex++;
      }
      
      if (pol !== undefined) {
        updateFields.push(`pol = $${paramIndex}`);
        updateValues.push(pol);
        paramIndex++;
      }
      
      if (pod !== undefined) {
        updateFields.push(`pod = $${paramIndex}`);
        updateValues.push(pod);
        paramIndex++;
      }
      
      if (vessel !== undefined) {
        updateFields.push(`vessel = $${paramIndex}`);
        updateValues.push(vessel || '');
        paramIndex++;
      }
      
      if (etd !== undefined) {
        updateFields.push(`etd = $${paramIndex}`);
        updateValues.push(etd ? formatDateForDatabase(etd) : null);
        paramIndex++;
      }
      
      // 更新 data 字段
      updateFields.push(`data = $${paramIndex}`);
      updateValues.push(JSON.stringify(dataJson));
      paramIndex++;
      
      // 更新时间戳
      updateFields.push(`updated_at = NOW()`);
      
      // 添加ID作为最后一个参数
      updateValues.push(id);
      
      const updateQuery = `
        UPDATE quotations 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      
      console.log('🔄 执行更新SQL:', updateQuery);
      
      result = await client.query(updateQuery, updateValues);
    } else {
      // 创建新报价
      console.log('📤 插入报价数据:', {
        quotationId,
        carrier,
        pol,
        pod,
        rate: dataJson.rate
      });
      
      result = await client.query(
        `INSERT INTO quotations (
          id, carrier, region, pol, pod, vessel, etd, data,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          carrier = EXCLUDED.carrier,
          region = EXCLUDED.region,
          pol = EXCLUDED.pol,
          pod = EXCLUDED.pod,
          vessel = EXCLUDED.vessel,
          etd = EXCLUDED.etd,
          data = EXCLUDED.data,
          updated_at = NOW()
        RETURNING *`,
        [
          quotationId,
          carrier,
          region || '',
          pol,
          pod,
          vessel || '',
          etd ? formatDateForDatabase(etd) : null,
          JSON.stringify(dataJson)
        ]
      );
    }
    
    await client.query('COMMIT');
    
    const formattedQuotation = mapQuotationRowToFrontend(result.rows[0]);
    
    console.log('✅ 报价操作成功:', {
      id: formattedQuotation.id,
      carrier: formattedQuotation.carrier,
      pol: formattedQuotation.pol,
      pod: formattedQuotation.pod,
      rate: formattedQuotation.rate,
      operation: isUpdate ? '更新' : '创建'
    });
    
    res.json({
      success: true,
      quotation: formattedQuotation,
      message: isUpdate ? '报价更新成功' : '报价创建成功'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 报价操作错误:', error);
    
    let errorMessage = error.message;
    if (error.code === '23505') {
      // 即使有ON CONFLICT，也可能有其他唯一约束冲突
      errorMessage = '报价ID冲突，请重试或刷新页面';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      code: error.code,
      details: '报价操作失败'
    });
  } finally {
    client.release();
  }
});

// 7.2 更新报价
app.put('/api/quotations/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const updates = req.body;
    
    console.log('✏️ 更新报价请求:', { 
      id, 
      updates: Object.keys(updates),
      hasRate: updates.rate !== undefined
    });
    
    // 检查报价是否存在
    const existingResult = await client.query(
      'SELECT * FROM quotations WHERE id = $1',
      [id]
    );
    
    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: '报价不存在'
      });
    }
    
    const existing = existingResult.rows[0];
    let existingData = existing.data || {};
    
    // 解析现有的 data 字段
    if (typeof existingData === 'string') {
      try {
        existingData = JSON.parse(existingData);
      } catch (e) {
        console.warn('解析现有 data 字段失败:', e.message);
        existingData = {};
      }
    } else if (typeof existingData !== 'object') {
      existingData = {};
    }
    
    // 构建更新后的 data 字段
    // 在更新报价接口中，修改 updatedData 构建
    const updatedData = {
      ...existingData,
      // 更新 data 字段中的信息
      service: updates.service !== undefined ? updates.service : 
              updates.si !== undefined ? updates.si : existingData.service,
      si: updates.si !== undefined ? updates.si : 
          updates.service !== undefined ? updates.service : existingData.si,
      containerType: updates.containerType !== undefined ? updates.containerType : 
                    updates.container_type !== undefined ? updates.container_type : existingData.containerType,
      container_type: updates.containerType !== undefined ? updates.containerType : 
                    updates.container_type !== undefined ? updates.container_type : existingData.container_type,
      rate: updates.rate !== undefined ? Number(updates.rate) : 
            updates.availableFees !== undefined ? Number(updates.availableFees) : existingData.rate,
      validity: updates.validity !== undefined ? updates.validity : 
                updates.freeTime !== undefined ? updates.freeTime : existingData.validity,
      remark: updates.remark !== undefined ? updates.remark : 
              updates.remarks !== undefined ? updates.remarks : existingData.remark,
      vessel: updates.vessel !== undefined ? updates.vessel : existingData.vessel,
      // 新增字段
      transitTime: updates.transitTime !== undefined ? updates.transitTime : 
                  updates.tt !== undefined ? updates.tt : existingData.transitTime,
      freeTime: updates.freeTime !== undefined ? updates.freeTime : 
                updates.validity !== undefined ? updates.validity : existingData.freeTime,
      availableFees: updates.availableFees !== undefined ? Number(updates.availableFees) : 
                    updates.rate !== undefined ? Number(updates.rate) : existingData.availableFees,
      remarks: updates.remarks !== undefined ? updates.remarks : 
              updates.remark !== undefined ? updates.remark : existingData.remarks,
      // 集装箱类型价格
      containerTypes: updates.containerTypes || existingData.containerTypes,
      "20GP": updates._20GP !== undefined ? Number(updates._20GP) : 
              updates["20GP"] !== undefined ? Number(updates["20GP"]) : existingData["20GP"] || 0,
      "40GP": updates._40GP !== undefined ? Number(updates._40GP) : 
              updates["40GP"] !== undefined ? Number(updates["40GP"]) : existingData["40GP"] || 0,
      "40HQ": updates._40HQ !== undefined ? Number(updates._40HQ) : 
              updates["40HQ"] !== undefined ? Number(updates["40HQ"]) : existingData["40HQ"] || 0,
      "45HQ": updates._45HQ !== undefined ? Number(updates._45HQ) : 
              updates["45HQ"] !== undefined ? Number(updates["45HQ"]) : existingData["45HQ"] || 0,
      "40NOR": updates._40NOR !== undefined ? Number(updates._40NOR) : 
              updates["40NOR"] !== undefined ? Number(updates["40NOR"]) : existingData["40NOR"] || 0
    };
    
    // 构建更新字段
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    // 表字段更新
    if (updates.carrier !== undefined) {
      updateFields.push(`carrier = $${paramIndex}`);
      updateValues.push(updates.carrier);
      paramIndex++;
    }
    
    if (updates.region !== undefined) {
      updateFields.push(`region = $${paramIndex}`);
      updateValues.push(updates.region);
      paramIndex++;
    }
    
    if (updates.pol !== undefined) {
      updateFields.push(`pol = $${paramIndex}`);
      updateValues.push(updates.pol);
      paramIndex++;
    }
    
    if (updates.pod !== undefined) {
      updateFields.push(`pod = $${paramIndex}`);
      updateValues.push(updates.pod);
      paramIndex++;
    }
    
    if (updates.vessel !== undefined) {
      updateFields.push(`vessel = $${paramIndex}`);
      updateValues.push(updates.vessel);
      paramIndex++;
    }
    
    if (updates.etd !== undefined) {
      updateFields.push(`etd = $${paramIndex}`);
      updateValues.push(formatDateForDatabase(updates.etd));
      paramIndex++;
    }
    
    // 更新 data 字段
    updateFields.push(`data = $${paramIndex}`);
    updateValues.push(JSON.stringify(updatedData));
    paramIndex++;
    
    // 添加更新时间戳
    updateFields.push(`updated_at = NOW()`);
    
    if (updateFields.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: '没有提供有效的更新字段'
      });
    }
    
    // 添加ID作为最后一个参数
    updateValues.push(id);
    
    const updateQuery = `
      UPDATE quotations 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    console.log('📤 执行更新SQL:', updateQuery);
    console.log('📤 更新参数:', updateValues);
    
    const result = await client.query(updateQuery, updateValues);
    
    await client.query('COMMIT');
    
    const updatedQuotation = mapQuotationRowToFrontend(result.rows[0]);
    
    console.log('✅ 报价更新成功:', updatedQuotation.id);
    
    res.json({
      success: true,
      quotation: updatedQuotation,
      message: '报价更新成功'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 更新报价错误:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: '更新报价失败'
    });
  } finally {
    client.release();
  }
});

// 7.3 删除报价
app.delete('/api/quotations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ 删除报价:', id);
    
    // 先获取报价信息用于返回
    const existingResult = await pool.query(
      'SELECT id, carrier, pol, pod FROM quotations WHERE id = $1',
      [id]
    );
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '报价不存在'
      });
    }
    
    const existing = existingResult.rows[0];
    
    // 删除报价
    await pool.query(
      'DELETE FROM quotations WHERE id = $1',
      [id]
    );
    
    console.log(`✅ 报价删除成功: ${id}`);
    
    res.json({
      success: true,
      message: '报价删除成功',
      deletedQuotation: {
        id: existing.id,
        carrier: existing.carrier,
        pol: existing.pol,
        pod: existing.pod
      }
    });
    
  } catch (error) {
    console.error('❌ 删除报价错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 7. 获取所有用户 - 取消分页
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, first_name, last_name, role, permissions, is_approved, avatar_url, is_active, last_login, database_access, created_at, updated_at 
       FROM users 
       ORDER BY created_at DESC`
    );
    
    const users = result.rows.map(u => ({
      id: u.id,
      username: u.username,
      firstName: u.first_name,
      lastName: u.last_name || '',
      role: u.role || 'USER',
      permissions: u.permissions || [],
      databaseAccess: u.database_access || [],
      isApproved: u.is_approved || false,
      avatarUrl: u.avatar_url || '',
      isActive: u.is_active || true,
      lastLogin: u.last_login,
      createdAt: u.created_at,
      updatedAt: u.updated_at
    }));
    
    res.json({
      success: true,
      users,
      metadata: {
        count: users.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ 获取用户列表错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 8. 获取系统设置
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM system_settings WHERE id = 1'
    );
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        settings: {
          carriers: [],
          clients: [],
          services: [],
          pols: [],
          pods: [],
          containerTypes: [],
          statuses: [],
          jobs: [],
          allocations: [],
          remarks: [],
          gateInRates: []
        }
      });
    }
    
    const row = result.rows[0];
    
    const safeParse = (jsonField) => {
      if (!jsonField) return [];
      if (Array.isArray(jsonField)) return jsonField;
      try {
        if (typeof jsonField === 'string') {
          const parsed = JSON.parse(jsonField);
          return Array.isArray(parsed) ? parsed : parsed;
        }
        return jsonField;
      } catch (e) {
        console.warn('解析JSON字段失败:', e.message);
        return [];
      }
    };
    
    // 处理 gateinrates，兼容旧数据结构
    let gateInRates = safeParse(row.gateinrates);
    
    // 如果 gateinrates 是旧结构，转换为新结构
    if (gateInRates.length > 0 && gateInRates[0] && !gateInRates[0].items) {
      console.log('🔄 检测到旧的 gateinrates 结构，正在转换...');
      gateInRates = gateInRates.map(oldRate => ({
        id: oldRate.id || `rate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        startDate: oldRate.startDate || '',
        endDate: oldRate.endDate || '',
        service: oldRate.service || '',
        contact: oldRate.contact || '',
        items: [{
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          pols: oldRate.pols || [],
          pods: oldRate.pods || [],
          containerTypes: oldRate.containerType ? [oldRate.containerType] : [],
          price: oldRate.price || 0
        }]
      }));
      console.log('✅ gateinrates 结构转换完成');
    }
    
    const settings = {
      carriers: safeParse(row.carriers),
      clients: safeParse(row.clients),
      services: safeParse(row.services),
      pols: safeParse(row.pols),
      pods: safeParse(row.pods),
      containerTypes: safeParse(row.types),
      statuses: safeParse(row.status),
      jobs: safeParse(row.jobs),
      allocations: safeParse(row.allocations),
      remarks: safeParse(row.remarks),
      gateInRates: gateInRates // 使用转换后的数据
    };
    
    console.log('📋 获取系统设置成功:', {
      carriers: settings.carriers.length,
      clients: settings.clients.length,
      containerTypes: settings.containerTypes.length,
      statuses: settings.statuses.length,
      jobs: settings.jobs.length,
      allocations: settings.allocations.length,
      gateInRates: settings.gateInRates.length
    });
    
    res.json({
      success: true,
      settings
    });
    
  } catch (error) {
    console.error('❌ 获取设置错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 数据库检查和修复接口
app.get('/api/check-db', async (req, res) => {
  try {
    console.log('🔍 检查数据库结构...');
    
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'system_settings'
      ) as exists;
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    
    let tableInfo = null;
    if (tableExists) {
      const structure = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'system_settings'
        ORDER BY ordinal_position
      `);
      
      const dataCheck = await pool.query('SELECT * FROM system_settings WHERE id = 1');
      
      tableInfo = {
        columns: structure.rows,
        rowCount: dataCheck.rows.length,
        firstRow: dataCheck.rows.length > 0 ? dataCheck.rows[0] : null
      };
    }
    
    const otherTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    res.json({
      success: true,
      system_settings: {
        exists: tableExists,
        info: tableInfo
      },
      allTables: otherTables.rows.map(r => r.table_name),
      database: {
        name: process.env.DB_NAME || 'oceanflow',
        host: process.env.DB_HOST || 'localhost',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ 数据库检查错误:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: '数据库检查失败'
    });
  }
});

// 修复数据库结构
app.post('/api/fix-db', async (req, res) => {
  try {
    console.log('🔧 修复数据库结构...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY,
        carriers JSONB DEFAULT '[]'::jsonb,
        clients JSONB DEFAULT '[]'::jsonb,
        services JSONB DEFAULT '[]'::jsonb,
        pols JSONB DEFAULT '[]'::jsonb,
        pods JSONB DEFAULT '[]'::jsonb,
        types JSONB DEFAULT '[]'::jsonb,
        status JSONB DEFAULT '["PENDING", "CONFIRMED", "ROLLED"]'::jsonb,
        jobs JSONB DEFAULT '[]'::jsonb,
        allocations JSONB DEFAULT '[]'::jsonb,
        remarks JSONB DEFAULT '[]'::jsonb,
        gateinrates JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await pool.query(`
      INSERT INTO system_settings (id, status)
      VALUES (1, '["PENDING", "CONFIRMED", "ROLLED"]'::jsonb)
      ON CONFLICT (id) DO UPDATE 
      SET status = EXCLUDED.status,
          updated_at = NOW()
      RETURNING *
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS databases (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        color VARCHAR(50) DEFAULT '#3B82F6',
        icon VARCHAR(50) DEFAULT 'database',
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    const dbCheck = await pool.query('SELECT COUNT(*) as count FROM databases');
    if (parseInt(dbCheck.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO databases (id, name, description)
        VALUES ($1, $2, $3)
      `, [
        `db_${Date.now()}`,
        '默认数据库',
        '系统自动创建的默认数据库'
      ]);
    }
    
    res.json({
      success: true,
      message: '数据库修复完成',
      actions: [
        '创建/检查 system_settings 表',
        '插入默认设置记录',
        '创建/检查 databases 表',
        '确保有默认数据库'
      ],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 数据库修复错误:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: '数据库修复失败'
    });
  }
});

// 初始化系统设置的接口
app.post('/api/settings/init', async (req, res) => {
  try {
    console.log('🔧 初始化系统设置...');
    
    const defaultSettings = {
      carriers: ['MAERSK', 'MSC', 'COSCO', 'ONE', 'EVERGREEN'],
      clients: ['客户A', '客户B', '客户C'],
      services: ['FCL', 'LCL', 'FAK'],
      pols: ['SHANGHAI', 'NINGBO', 'QINGDAO'],
      pods: ['LOS ANGELES', 'LONG BEACH', 'NEW YORK'],
      types: ['20GP', '40GP', '40HQ', '45HQ'],
      status: ['PENDING', 'CONFIRMED', 'CANCELLED', 'GATED_IN'],
      jobs: ['JOB001', 'JOB002', 'JOB003'],
      allocations: ['ALLOC001', 'ALLOC002'],
      remarks: ['普通', '加急', '特殊'],
      gateinrates: []
    };
    
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'system_settings'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.status(500).json({
        success: false,
        error: 'system_settings 表不存在'
      });
    }
    
    const existing = await pool.query('SELECT id FROM system_settings WHERE id = 1');
    
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE system_settings 
         SET carriers = $1,
             clients = $2,
             services = $3,
             pols = $4,
             pods = $5,
             types = $6,
             status = $7,
             jobs = $8,
             allocations = $9,
             remarks = $10,
             gateinrates = $11,
             updated_at = NOW()
         WHERE id = 1`,
        [
          JSON.stringify(defaultSettings.carriers),
          JSON.stringify(defaultSettings.clients),
          JSON.stringify(defaultSettings.services),
          JSON.stringify(defaultSettings.pols),
          JSON.stringify(defaultSettings.pods),
          JSON.stringify(defaultSettings.types),
          JSON.stringify(defaultSettings.status),
          JSON.stringify(defaultSettings.jobs),
          JSON.stringify(defaultSettings.allocations),
          JSON.stringify(defaultSettings.remarks),
          JSON.stringify(defaultSettings.gateinrates)
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO system_settings (
          id, carriers, clients, services, pols, pods, 
          types, status, jobs, allocations, 
          remarks, gateinrates, created_at, updated_at
        ) VALUES (
          1, $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, NOW(), NOW()
        )`,
        [
          JSON.stringify(defaultSettings.carriers),
          JSON.stringify(defaultSettings.clients),
          JSON.stringify(defaultSettings.services),
          JSON.stringify(defaultSettings.pols),
          JSON.stringify(defaultSettings.pods),
          JSON.stringify(defaultSettings.types),
          JSON.stringify(defaultSettings.status),
          JSON.stringify(defaultSettings.jobs),
          JSON.stringify(defaultSettings.allocations),
          JSON.stringify(defaultSettings.remarks),
          JSON.stringify(defaultSettings.gateinrates)
        ]
      );
    }
    
    console.log('✅ 系统设置初始化成功');
    
    res.json({
      success: true,
      message: '系统设置初始化成功',
      settings: defaultSettings
    });
    
  } catch (error) {
    console.error('❌ 初始化系统设置错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 9. 保存系统设置 - 修改以支持新的 GateInRate 结构
app.put('/api/settings', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      carriers = [],
      clients = [],
      services = [],
      pols = [],
      pods = [],
      containerTypes = [],
      statuses = [],
      jobs = [],
      allocations = [],
      remarks = [],
      gateInRates = []
    } = req.body;
    
    console.log('📝 保存系统设置（新结构）:', {
      gateInRatesCount: gateInRates.length,
      gateInRatesSample: gateInRates.length > 0 ? gateInRates[0] : null
    });
    
    // 转换 gateInRates 数据，确保每个项目都有 ID
    const processedGateInRates = gateInRates.map(rate => ({
      ...rate,
      id: rate.id || `rate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      items: (rate.items || []).map(item => ({
        ...item,
        id: item.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }))
    }));
    
    const settingsToSave = {
      carriers: Array.isArray(carriers) ? carriers : [],
      clients: Array.isArray(clients) ? clients : [],
      services: Array.isArray(services) ? services : [],
      pols: Array.isArray(pols) ? pols : [],
      pods: Array.isArray(pods) ? pods : [],
      types: Array.isArray(containerTypes) ? containerTypes : [],
      status: Array.isArray(statuses) ? statuses : [],
      jobs: Array.isArray(jobs) ? jobs : [],
      allocations: Array.isArray(allocations) ? allocations : [],
      remarks: Array.isArray(remarks) ? remarks : [],
      gateinrates: processedGateInRates // 使用新的数据结构
    };
    
    const existing = await client.query(
      'SELECT id FROM system_settings WHERE id = 1'
    );
    
    let result;
    if (existing.rows.length > 0) {
      result = await client.query(
        `UPDATE system_settings 
         SET carriers = $1,
             clients = $2,
             services = $3,
             pols = $4,
             pods = $5,
             types = $6,
             status = $7,  
             jobs = $8,
             allocations = $9,
             remarks = $10,
             gateinrates = $11,
             updated_at = NOW()
         WHERE id = 1
         RETURNING *`,
        [
          JSON.stringify(settingsToSave.carriers),
          JSON.stringify(settingsToSave.clients),
          JSON.stringify(settingsToSave.services),
          JSON.stringify(settingsToSave.pols),
          JSON.stringify(settingsToSave.pods),
          JSON.stringify(settingsToSave.types),
          JSON.stringify(settingsToSave.status),
          JSON.stringify(settingsToSave.jobs),
          JSON.stringify(settingsToSave.allocations),
          JSON.stringify(settingsToSave.remarks),
          JSON.stringify(settingsToSave.gateinrates)
        ]
      );
    } else {
      result = await client.query(
        `INSERT INTO system_settings (
          id, carriers, clients, services, pols, pods, 
          types, status, jobs, allocations, 
          remarks, gateinrates, created_at, updated_at
        ) VALUES (
          1, $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, NOW(), NOW()
        )
        RETURNING *`,
        [
          JSON.stringify(settingsToSave.carriers),
          JSON.stringify(settingsToSave.clients),
          JSON.stringify(settingsToSave.services),
          JSON.stringify(settingsToSave.pols),
          JSON.stringify(settingsToSave.pods),
          JSON.stringify(settingsToSave.types),
          JSON.stringify(settingsToSave.status),
          JSON.stringify(settingsToSave.jobs),
          JSON.stringify(settingsToSave.allocations),
          JSON.stringify(settingsToSave.remarks),
          JSON.stringify(settingsToSave.gateinrates)
        ]
      );
    }
    
    await client.query('COMMIT');
    
    console.log('✅ 系统设置保存成功');
    
    const verifyResult = await pool.query(
      'SELECT jsonb_array_length(status) as status_count FROM system_settings WHERE id = 1'
    );
    
    res.json({
      success: true,
      message: '系统设置保存成功',
      verification: verifyResult.rows.length > 0 ? verifyResult.rows[0] : null,
      updatedAt: result.rows[0].updated_at
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 保存设置错误:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: '保存系统设置失败'
    });
  } finally {
    client.release();
  }
});

// 10. 用户登录
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: '用户不存在'
      });
    }
    
    const user = result.rows[0];
    const validPassword = (password === user.password);
    
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: '密码错误'
      });
    }
    
    if (!user.is_approved) {
      return res.status(403).json({
        success: false,
        error: '账户等待管理员审核'
      });
    }
    
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );
    
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name || '',
        role: user.role,
        permissions: user.permissions || [],
        databaseAccess: user.database_access || [],
        isApproved: user.is_approved,
        avatarUrl: user.avatar_url || '',
        isActive: user.is_active || true,
        lastLogin: user.last_login,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      },
      token
    });
    
  } catch (error) {
    console.error('❌ 登录错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 11. 创建预订
app.post('/api/bookings', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { dbId, booking } = req.body;
    
    console.log('📥 创建预订请求:', {
      dbId,
      bookingId: booking.id,
      bookingRef: booking.bookingref,
      hasData: !!booking.data
    });
    
    if (!dbId || !booking) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }
    
    // 确保有唯一的ID
    let bookingId = booking.id;
    if (!bookingId || !bookingId.startsWith('booking_')) {
      const timestamp = Date.now();
      const random = crypto.randomBytes(8).toString('hex');
      bookingId = `booking_${timestamp}_${random}`;
    }
    
    const bookingRef = booking.bookingref || `BK${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const status = booking.statuse || 'PENDING';
    
    // 从booking.data中提取业务字段，如果没有则从booking对象中提取
    const dataJson = {
      client: booking.data?.client || booking.client || '',
      carrier: booking.data?.carrier || booking.carrier || '',
      service: booking.data?.service || booking.service || '',
      status: status,
      pol: booking.data?.pol || booking.pol || '',
      pod: booking.data?.pod || booking.pod || '',
      vessel: booking.data?.vessel || booking.vessel || '',
      type: booking.data?.type || booking.type || '',
      qty: Number(booking.data?.qty || booking.qty || 0),
      etd: formatDateForDatabase(booking.etd) || '',
      eta: formatDateForDatabase(booking.data?.eta || booking.eta || ''),
      etb: formatDateForDatabase(booking.data?.etb || booking.etb || ''),
      gateIn: formatDateForDatabase(booking.data?.gateIn || booking.gateIn || ''),
      job: booking.data?.job || booking.job || '',
      contact: booking.data?.contact || booking.contact || '', // 添加这一行
      allocation: booking.data?.allocation || booking.allocation || '',
      remark: booking.data?.remark || booking.remark || '',
      finance: booking.finance || {}
    };
    
    console.log('📤 插入预订数据:', {
      bookingId,
      bookingRef,
      status,
      dataJson: JSON.stringify(dataJson).substring(0, 200)
    });
    
    const result = await client.query(
      `INSERT INTO bookings (
        id, database_id, week, bookingref, etd, status, is_locked,
        finance, data, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *`,
      [
        bookingId,
        dbId,
        booking.week || '',
        bookingRef,
        dataJson.etd,
        status,
        booking.is_locked || false,
        JSON.stringify(booking.finance || {}),
        JSON.stringify(dataJson)
      ]
    );
    
    await client.query('COMMIT');
    
    const formattedBooking = mapBookingRowToFrontend(result.rows[0]);
    
    console.log('✅ 预订创建成功:', formattedBooking.id);
    
    res.json({
      success: true,
      booking: formattedBooking,
      message: '预订创建成功'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 创建预订错误:', error);
    
    let errorMessage = error.message;
    if (error.code === '23505') {
      errorMessage = '预订ID冲突，请重试';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      code: error.code,
      details: '创建预订失败'
    });
  } finally {
    client.release();
  }
});

// 11.1 用户注册
app.post('/api/register', async (req, res) => {
  const { username, password, firstName, lastName = '', role = 'USER', permissions = [] } = req.body;
  
  try {
    console.log('📝 用户注册请求:', { username, firstName, role });
    
    if (!username || !password || !firstName) {
      return res.status(400).json({
        success: false,
        error: '用户名、密码和姓名为必填字段'
      });
    }
    
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: '用户名已存在'
      });
    }
    
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let userPermissions = permissions;
    if (userPermissions.length === 0 && role === 'USER') {
      userPermissions = [
        'BOOKING_READ', 'BOOKING_CREATE', 'BOOKING_UPDATE',
        'QUOTATION_READ', 'QUOTATION_CREATE', 
        'FINANCE_READ'
      ];
    } else if (role === 'ADMIN') {
      userPermissions = [
        'BOOKING_READ', 'BOOKING_CREATE', 'BOOKING_UPDATE', 'BOOKING_DELETE', 'BOOKING_LOCK',
        'QUOTATION_READ', 'QUOTATION_CREATE', 'QUOTATION_UPDATE', 'QUOTATION_DELETE',
        'FINANCE_READ', 'FINANCE_UPDATE', 'FINANCE_LOCK',
        'SAF_FINANCE_READ', 'SAF_FINANCE_UPDATE', 'SAF_FINANCE_LOCK',
        'CMA_FINANCE_READ', 'CMA_FINANCE_UPDATE', 'CMA_FINANCE_LOCK',
        'CONCORD_FINANCE_READ', 'CONCORD_FINANCE_UPDATE', 'CONCORD_FINANCE_LOCK',
        'ADMIN_READ', 'ADMIN_UPDATE',
        'SETTINGS_READ', 'SETTINGS_UPDATE'
      ];
    }
    
    const result = await pool.query(
      `INSERT INTO users (
        id, username, password, first_name, last_name, role, permissions, 
        is_approved, avatar_url, is_active, database_access, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *`,
      [
        userId,
        username,
        password, 
        firstName,
        lastName,
        role,
        JSON.stringify(userPermissions),
        role === 'ADMIN', 
        '',
        true,
        JSON.stringify([])  // 初始化为空数组
      ]
    );
    
    const user = result.rows[0];
    
    console.log(`✅ 用户注册成功: ${username} (ID: ${userId})`);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name || '',
        role: user.role,
        permissions: userPermissions,
        databaseAccess: user.database_access || [],
        isApproved: user.is_approved,
        isActive: user.is_active || true,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      },
      message: role === 'ADMIN' ? '管理员账户创建成功' : '用户注册成功，等待管理员审核'
    });
    
  } catch (error) {
    console.error('❌ 用户注册错误:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: '注册过程中发生错误'
    });
  }
});

// 11.2 更新用户信息
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    console.log('📝 更新用户信息:', { 
      id, 
      updates: Object.keys(updates),
      hasDatabaseAccess: !!updates.databaseAccess,
      databaseAccessType: Array.isArray(updates.databaseAccess) ? 'array' : typeof updates.databaseAccess
    });
    
    // 清理更新对象：移除前端可能传递的错误字段名
    const cleanUpdates = { ...updates };
    delete cleanUpdates.updatedAt;
    delete cleanUpdates.createdAt;
    delete cleanUpdates.updatedat;
    delete cleanUpdates.createdat;
    delete cleanUpdates.id;
    
    console.log('✅ 清理后的更新字段:', Object.keys(cleanUpdates));
    
    const existing = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [id]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }
    
    // 构建更新字段和值
    const updatesList = [];
    const values = [];
    let paramIndex = 1;
    
    // 处理每个更新字段
    for (const [key, value] of Object.entries(cleanUpdates)) {
      console.log(`处理字段: ${key} = ${typeof value}`);
      
      // 根据前端字段名映射到数据库列名
      let dbColumn;
      let dbValue = value;
      
      switch (key) {
        case 'databaseAccess':
          dbColumn = 'database_access';
          if (Array.isArray(value)) {
            dbValue = JSON.stringify(value);
          } else if (typeof value === 'string') {
            try {
              JSON.parse(value);
              dbValue = value;
            } catch (e) {
              console.warn(`databaseAccess 字段无效，使用空数组: ${e.message}`);
              dbValue = '[]';
            }
          } else {
            console.warn(`databaseAccess 字段类型错误: ${typeof value}，使用空数组`);
            dbValue = '[]';
          }
          break;
          
        case 'permissions':
          dbColumn = 'permissions';
          if (Array.isArray(value)) {
            dbValue = JSON.stringify(value);
          } else {
            dbValue = value;
          }
          break;
          
        case 'firstName':
          dbColumn = 'first_name';
          break;
          
        case 'lastName':
          dbColumn = 'last_name';
          break;
          
        case 'isApproved':
          dbColumn = 'is_approved';
          break;
          
        case 'isActive':
          dbColumn = 'is_active';
          break;
          
        case 'avatarUrl':
          dbColumn = 'avatar_url';
          break;
          
        case 'role':
          dbColumn = 'role';
          break;
          
        default:
          dbColumn = key;
          break;
      }
      
      if (dbColumn) {
        updatesList.push(`${dbColumn} = $${paramIndex}`);
        values.push(dbValue);
        paramIndex++;
      }
    }
    
    if (updatesList.length === 0) {
      console.warn('⚠️ 没有提供有效的更新字段');
      return res.status(400).json({
        success: false,
        error: '没有提供有效的更新字段'
      });
    }
    
    // 添加更新时间戳
    updatesList.push(`updated_at = NOW()`);
    
    const query = `
      UPDATE users 
      SET ${updatesList.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    values.push(id);
    
    console.log('📤 执行SQL更新:', query);
    console.log('📤 参数值:', values);
    
    const result = await pool.query(query, values);
    const updatedUser = result.rows[0];
    
    console.log('✅ 用户更新成功:', updatedUser.username);
    
    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name || '',
        role: updatedUser.role,
        permissions: updatedUser.permissions || [],
        databaseAccess: updatedUser.database_access || [],
        isApproved: updatedUser.is_approved,
        isActive: updatedUser.is_active || true,
        lastLogin: updatedUser.last_login,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at
      },
      message: '用户信息更新成功'
    });
    
  } catch (error) {
    console.error('❌ 更新用户错误:', error);
    
    if (error.message.includes('column') && error.message.includes('does not exist')) {
      return res.status(500).json({
        success: false,
        error: '数据库字段不匹配，请检查数据库结构',
        details: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 11.3 删除用户
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [id]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }
    
    const username = existing.rows[0].username;
    
    if (username === 'admin') {
      return res.status(403).json({
        success: false,
        error: '不能删除管理员账户'
      });
    }
    
    await pool.query(
      'DELETE FROM users WHERE id = $1',
      [id]
    );
    
    console.log(`🗑️ 用户删除成功: ${username} (ID: ${id})`);
    
    res.json({
      success: true,
      message: `用户 "${username}" 删除成功`,
      deletedUserId: id
    });
    
  } catch (error) {
    console.error('❌ 删除用户错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 11.4 更新用户权限
app.put('/api/users/:id/permissions', async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    
    console.log('📝 更新用户权限:', { id, permissions: permissions?.length });
    
    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        error: '权限字段必须是数组'
      });
    }
    
    const existing = await pool.query(
      'SELECT id, username, role FROM users WHERE id = $1',
      [id]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }
    
    const user = existing.rows[0];
    
    if (user.role === 'ADMIN' || user.username.toLowerCase() === 'admin') {
      return res.status(403).json({
        success: false,
        error: '管理员权限不能修改'
      });
    }
    
    const result = await pool.query(
      `UPDATE users 
       SET permissions = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(permissions), id]
    );
    
    const updatedUser = result.rows[0];
    
    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        permissions: permissions,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at
      },
      message: '用户权限更新成功'
    });
    
  } catch (error) {
    console.error('❌ 更新用户权限错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 11.5 用户修改密码
app.put('/api/users/me/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '未授权访问'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const userId = decoded.id;
      
      console.log('🔐 修改密码请求:', { userId });
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: '当前密码和新密码不能为空'
        });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: '新密码长度至少为6位'
        });
      }
      
      const userResult = await pool.query(
        'SELECT id, username, password FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: '用户不存在'
        });
      }
      
      const user = userResult.rows[0];
      
      const isValidPassword = (currentPassword === user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: '当前密码错误'
        });
      }
      
      await pool.query(
        'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
        [newPassword, userId]
      );
      
      console.log(`✅ 密码修改成功: ${user.username}`);
      
      res.json({
        success: true,
        message: '密码修改成功',
        timestamp: new Date().toISOString()
      });
      
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: '无效的认证令牌'
      });
    }
    
  } catch (error) {
    console.error('❌ 修改密码错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 11.6 管理员重置用户密码
app.put('/api/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword, confirmByAdmin = false } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '未授权访问'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const adminId = decoded.id;
      
      console.log('🔐 管理员重置密码请求:', { adminId, targetUserId: id });
      
      if (!newPassword) {
        return res.status(400).json({
          success: false,
          error: '新密码不能为空'
        });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: '新密码长度至少为6位'
        });
      }
      
      if (!confirmByAdmin) {
        return res.status(400).json({
          success: false,
          error: '请确认您要重置此用户的密码'
        });
      }
      
      const adminResult = await pool.query(
        'SELECT role FROM users WHERE id = $1',
        [adminId]
      );
      
      if (adminResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: '管理员不存在'
        });
      }
      
      const admin = adminResult.rows[0];
      const isAdmin = admin.role === 'ADMIN' || admin.role === 'admin';
      
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: '仅管理员可以重置用户密码'
        });
      }
      
      const userResult = await pool.query(
        'SELECT username FROM users WHERE id = $1',
        [id]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: '目标用户不存在'
        });
      }
      
      await pool.query(
        'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
        [newPassword, id]
      );
      
      const targetUsername = userResult.rows[0].username;
      console.log(`✅ 管理员重置密码成功: ${targetUsername}`);
      
      res.json({
        success: true,
        message: `用户 "${targetUsername}" 的密码已重置`,
        timestamp: new Date().toISOString()
      });
      
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: '无效的认证令牌'
      });
    }
    
  } catch (error) {
    console.error('❌ 管理员重置密码错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3. 批量保存变更记录 - 修改版
app.post('/api/booking-change-records/batch', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { records } = req.body;
    
    if (!Array.isArray(records)) {
      throw new Error('records 参数必须是数组');
    }
    
    console.log(`📦 批量保存变更记录: ${records.length} 条`);
    
    let savedCount = 0;
    const savedIds = [];
    
    for (const record of records) {
      try {
        const changeId = `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const bookingref = record.booking_ref || record.bookingRef || record.bookinger || '';
        
        await client.query(
          `INSERT INTO booking_change_records (
            id, change_date, bookingref, database_id, database_name, change_type,
            previous_status, previous_client, previous_pol, previous_pod,
            new_status, new_client, new_pol, new_pod,
            carrier, etd, qty, type, week, service, vessel, allocation,
            previous_qty, new_qty, previous_type, new_type,
            previous_allocation, new_allocation,
            change_timestamp, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, NOW(), NOW())
          ON CONFLICT (bookingref, change_date, database_id) 
          DO UPDATE SET
            change_type = EXCLUDED.change_type,
            previous_status = EXCLUDED.previous_status,
            previous_client = EXCLUDED.previous_client,
            previous_pol = EXCLUDED.previous_pol,
            previous_pod = EXCLUDED.previous_pod,
            new_status = EXCLUDED.new_status,
            new_client = EXCLUDED.new_client,
            new_pol = EXCLUDED.new_pol,
            new_pod = EXCLUDED.new_pod,
            carrier = EXCLUDED.carrier,
            etd = EXCLUDED.etd,
            qty = EXCLUDED.qty,
            type = EXCLUDED.type,
            week = EXCLUDED.week,
            service = EXCLUDED.service,
            vessel = EXCLUDED.vessel,
            allocation = EXCLUDED.allocation,
            previous_qty = EXCLUDED.previous_qty,
            new_qty = EXCLUDED.new_qty,
            previous_type = EXCLUDED.previous_type,
            new_type = EXCLUDED.new_type,
            previous_allocation = EXCLUDED.previous_allocation,
            new_allocation = EXCLUDED.new_allocation,
            change_timestamp = EXCLUDED.change_timestamp,
            updated_at = EXCLUDED.updated_at`,
          [
            changeId,
            record.change_date,
            bookingref,
            record.database_id,
            record.database_name,
            record.change_type,
            record.previous_status,
            record.previous_client,
            record.previous_pol,
            record.previous_pod,
            record.new_status,
            record.new_client,
            record.new_pol,
            record.new_pod,
            record.carrier,
            record.etd,
            record.qty || 0,
            record.type || '',
            record.week || '',
            record.service || '',
            record.vessel || '',
            record.allocation || '',
            record.previous_qty || 0,
            record.qty || 0,
            record.previous_type || '',
            record.type || '',
            record.previous_allocation || '',
            record.allocation || '',
            record.change_timestamp || new Date().toISOString()
          ]
        );
        
        savedCount++;
        savedIds.push(changeId);
      } catch (error) {
        console.warn(`❌ 保存单条记录失败:`, error.message);
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`✅ 批量保存完成: ${savedCount}/${records.length} 条成功`);
    
    res.json({
      success: true,
      savedCount,
      totalCount: records.length,
      savedIds,
      message: `批量保存完成: ${savedCount}/${records.length} 条成功`
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 批量保存变更记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// 12. 更新预订
app.put('/api/bookings/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const updates = req.body;
    
    console.log('✏️ 更新预订请求:', { 
      id, 
      updates: Object.keys(updates),
      status: updates.status || updates.state,
      isUpdate: true
    });
    
    // 检查预订是否存在
    const existingResult = await client.query(
      'SELECT * FROM bookings WHERE id = $1',
      [id]
    );
    
    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: '预订不存在'
      });
    }
    
    const existing = existingResult.rows[0];
    let existingData = existing.data || {};
    
    // 解析现有的data字段
    if (typeof existingData === 'string') {
      try {
        existingData = JSON.parse(existingData);
      } catch (e) {
        console.warn('解析现有data字段失败:', e.message);
        existingData = {};
      }
    }
    
    // ==================== 构建更新数据 ====================
    // 注意：前端传递的是 state，但数据库字段是 status
    const newStatus = updates.state || updates.status || existingData.status || existing.status;
    
    // 构建更新后的 data 字段
    const updatedData = {
      ...existingData,
      // 业务字段
      client: updates.client !== undefined ? updates.client : existingData.client,
      carrier: updates.carrier !== undefined ? updates.carrier : existingData.carrier,
      service: updates.service !== undefined ? updates.service : existingData.service,
      status: newStatus, // 使用新的状态
      pol: updates.pol !== undefined ? updates.pol : existingData.pol,
      pod: updates.pod !== undefined ? updates.pod : existingData.pod,
      vessel: updates.vessel !== undefined ? updates.vessel : existingData.vessel,
      type: updates.type !== undefined ? updates.type : existingData.type,
      qty: updates.qty !== undefined ? Number(updates.qty) : existingData.qty,
      // 日期字段需要格式化
      eta: updates.eta !== undefined ? formatDateForDatabase(updates.eta) : existingData.eta,
      etb: updates.etb !== undefined ? formatDateForDatabase(updates.etb) : existingData.etb,
      gateIn: updates.gateIn !== undefined ? formatDateForDatabase(updates.gateIn) : existingData.gateIn,
      job: updates.job !== undefined ? updates.job : existingData.job,
      contact: updates.contact !== undefined ? updates.contact : existingData.contact, // 添加这一行
      allocation: updates.allocation !== undefined ? updates.allocation : existingData.allocation,
      remark: updates.remark !== undefined ? updates.remark : existingData.remark
    };
    
    // 构建更新字段
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    // 系统字段更新
    if (updates.week !== undefined) {
      updateFields.push(`week = $${paramIndex}`);
      updateValues.push(updates.week || '');
      paramIndex++;
    }
    
    if (updates.bookingRef !== undefined) {
      updateFields.push(`bookingref = $${paramIndex}`);
      updateValues.push(updates.bookingRef || '');
      paramIndex++;
    }
    
    // 处理ETD日期
    if (updates.etd !== undefined) {
      updateFields.push(`etd = $${paramIndex}`);
      updateValues.push(formatDateForDatabase(updates.etd));
      paramIndex++;
    }
    
    // 状态字段 - 关键修复：使用 state 或 status 字段
    updateFields.push(`status = $${paramIndex}`);
    updateValues.push(newStatus);
    paramIndex++;
    
    // is_locked 字段
    if (updates.isLocked !== undefined) {
      updateFields.push(`is_locked = $${paramIndex}`);
      updateValues.push(updates.isLocked || false);
      paramIndex++;
    }
    
    // finance 字段
    if (updates.finance !== undefined) {
      updateFields.push(`finance = $${paramIndex}`);
      updateValues.push(JSON.stringify(updates.finance || {}));
      paramIndex++;
    }
    
    // data 字段
    updateFields.push(`data = $${paramIndex}`);
    updateValues.push(JSON.stringify(updatedData));
    paramIndex++;
    
    // 更新时间戳
    updateFields.push(`updated_at = NOW()`);
    
    // 添加ID作为最后一个参数
    updateValues.push(id);
    
    const updateQuery = `
      UPDATE bookings 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    console.log('📤 执行更新SQL:', updateQuery);
    console.log('📤 更新参数:', updateValues);
    
    const result = await client.query(updateQuery, updateValues);
    
    await client.query('COMMIT');
    
    const updatedBooking = mapBookingRowToFrontend(result.rows[0]);
    
    console.log('✅ 预订更新成功:', updatedBooking.id);
    console.log('📋 更新后状态:', {
      id: updatedBooking.id,
      status: updatedBooking.status,
      state: updatedBooking.state,
      client: updatedBooking.client,
      carrier: updatedBooking.carrier
    });
    
    res.json({
      success: true,
      booking: updatedBooking,
      message: '预订更新成功'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 更新预订错误:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: '更新预订失败'
    });
  } finally {
    client.release();
  }
});

// 13. 删除预订
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM bookings WHERE id = $1 RETURNING id, bookingref, database_id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '预订不存在'
      });
    }
    
    res.json({
      success: true,
      message: '预订删除成功',
      deletedBooking: {
        id: result.rows[0].id,
        bookingRef: result.rows[0].bookingref,
        databaseId: result.rows[0].database_id
      }
    });
    
  } catch (error) {
    console.error('❌ 删除预订错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 14. Dashboard 统计 - 支持按数据库筛选
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const { databaseId } = req.query;
    
    console.log('📊 获取Dashboard统计，数据库筛选:', databaseId || '全部');
    
    // 基础查询
    let bookingsQuery = 'SELECT COUNT(*) as count FROM bookings';
    let usersQuery = 'SELECT COUNT(*) as count FROM users WHERE is_approved = true';
    let databasesQuery = 'SELECT COUNT(*) as count FROM databases';
    let quotationsQuery = 'SELECT COUNT(*) as count FROM quotations';
    
    const queryParams = [];
    
    // 如果指定了数据库ID，则添加筛选条件
    if (databaseId) {
      bookingsQuery += ' WHERE database_id = $1';
      queryParams.push(databaseId);
    }
    
    // 并行执行所有查询
    const [
      bookingsResult,
      quotationsResult,
      usersResult,
      databasesResult,
      detailedStatsResult
    ] = await Promise.allSettled([
      pool.query(bookingsQuery, queryParams),
      pool.query(quotationsQuery, []),
      pool.query(usersQuery, []),
      pool.query(databasesQuery, []),
      pool.query(`
        SELECT 
          d.id,
          d.name,
          COUNT(b.id) as bookings_count,
          SUM(CASE WHEN b.status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed_count,
          SUM(CASE WHEN b.status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
          SUM(CASE WHEN b.status = 'ROLLED' THEN 1 ELSE 0 END) as rolled_count
        FROM databases d
        LEFT JOIN bookings b ON d.id = b.database_id
        GROUP BY d.id, d.name
        ORDER BY d.created_at ASC
      `)
    ]);
    
    // 基础统计
    const stats = {
      bookings: bookingsResult.status === 'fulfilled' ? parseInt(bookingsResult.value.rows[0]?.count) || 0 : 0,
      quotations: quotationsResult.status === 'fulfilled' ? parseInt(quotationsResult.value.rows[0]?.count) || 0 : 0,
      users: usersResult.status === 'fulfilled' ? parseInt(usersResult.value.rows[0]?.count) || 0 : 0,
      databases: databasesResult.status === 'fulfilled' ? parseInt(databasesResult.value.rows[0]?.count) || 0 : 0,
    };
    
    // 详细统计 - 每个数据库的情况
    const databaseStats = detailedStatsResult.status === 'fulfilled' 
      ? detailedStatsResult.value.rows.map(row => ({
          id: row.id,
          name: row.name,
          bookingsCount: parseInt(row.bookings_count) || 0,
          confirmedCount: parseInt(row.confirmed_count) || 0,
          pendingCount: parseInt(row.pending_count) || 0,
          rolledCount: parseInt(row.rolled_count) || 0
        }))
      : [];
    
    // 周统计（最近8周）
    let weeklyQuery = `
      SELECT 
        week,
        COUNT(*) as count
      FROM bookings
      WHERE week IS NOT NULL AND week != ''
    `;
    
    if (databaseId) {
      weeklyQuery += ' AND database_id = $1';
    }
    
    weeklyQuery += `
      GROUP BY week
      ORDER BY week DESC
      LIMIT 8
    `;
    
    const weeklyResult = await pool.query(weeklyQuery, databaseId ? [databaseId] : []);
    const weeklyStats = weeklyResult.rows.map(row => ({
      week: row.week,
      count: parseInt(row.count) || 0
    }));
    
    // 状态分布
    let statusQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM bookings
      WHERE status IS NOT NULL
    `;
    
    if (databaseId) {
      statusQuery += ' AND database_id = $1';
    }
    
    statusQuery += ' GROUP BY status';
    
    const statusResult = await pool.query(statusQuery, databaseId ? [databaseId] : []);
    const statusStats = statusResult.rows.map(row => ({
      status: row.status,
      count: parseInt(row.count) || 0
    }));
    
    console.log('✅ Dashboard统计获取完成:', {
      databaseId: databaseId || '全部',
      totalBookings: stats.bookings,
      databaseCount: databaseStats.length,
      weeklyStatsCount: weeklyStats.length
    });
    
    res.json({
      success: true,
      stats,
      databaseStats,
      weeklyStats,
      statusStats,
      currentDatabase: databaseId || null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 获取 Dashboard 统计错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 调试接口
app.get('/api/debug/database', async (req, res) => {
  try {
    const bookingsColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      ORDER BY ordinal_position
    `);
    
    const settingsColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'system_settings'
      ORDER BY ordinal_position
    `);
    
    const recentBookings = await pool.query(`
      SELECT id, bookingref, status, etd, created_at
      FROM bookings
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    const settingsData = await pool.query(`
      SELECT 
        id,
        jsonb_array_length(carriers) as carriers_count,
        jsonb_array_length(clients) as clients_count,
        jsonb_array_length(services) as services_count,
        jsonb_array_length(pols) as pols_count,
        jsonb_array_length(pods) as pods_count,
        jsonb_array_length(types) as types_count,
        jsonb_array_length(status) as status_count,
        jsonb_array_length(jobs) as jobs_count,
        jsonb_array_length(allocations) as allocations_count,
        jsonb_array_length(remarks) as remarks_count,
        jsonb_array_length(gateinrates) as gateinrates_count
      FROM system_settings
      WHERE id = 1
    `);
    
    res.json({
      success: true,
      bookings_columns: bookingsColumns.rows,
      settings_columns: settingsColumns.rows,
      recent_bookings: recentBookings.rows,
      settings_data: settingsData.rows.length > 0 ? settingsData.rows[0] : null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 数据库调试错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/debug/db-structure', async (req, res) => {
  try {
    const bookingsStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      ORDER BY ordinal_position
    `);
    
    const settingsStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'system_settings'
      ORDER BY ordinal_position
    `);
    
    const recentBookings = await pool.query(`
      SELECT id, bookingref, status, etd, created_at
      FROM bookings
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    res.json({
      success: true,
      bookings_structure: bookingsStructure.rows,
      settings_structure: settingsStructure.rows,
      recent_bookings: recentBookings.rows,
      note: '检查字段名是否一致：status（不是statuse），types（集装箱类型）'
    });
    
  } catch (error) {
    console.error('❌ 数据库结构查询错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 调试接口：获取单个预订的完整数据
app.get('/api/debug/booking/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 调试预订数据:', id);
    
    const result = await pool.query(
      'SELECT * FROM bookings WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '预订不存在'
      });
    }
    
    const row = result.rows[0];
    
    // 解析 data 字段
    let data = row.data || {};
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        console.warn('解析失败:', e);
      }
    }
    
    res.json({
      success: true,
      booking: {
        id: row.id,
        database_id: row.database_id,
        week: row.week,
        bookingref: row.bookingref,
        etd: row.etd,
        status: row.status,
        is_locked: row.is_locked,
        finance: row.finance,
        data: data,
        data_raw: row.data,
        data_type: typeof row.data,
        created_at: row.created_at,
        updated_at: row.updated_at
      },
      mapping: mapBookingRowToFrontend(row)
    });
    
  } catch (error) {
    console.error('❌ 调试预订错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 调试接口：检查用户表结构
app.get('/api/debug/users-table', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    // 获取一些示例数据
    const sampleData = await pool.query(`
      SELECT * FROM users ORDER BY created_at DESC LIMIT 2
    `);
    
    res.json({
      success: true,
      columns: result.rows,
      sample_data: sampleData.rows,
      note: '检查用户表实际列名，特别是时间戳字段'
    });
    
  } catch (error) {
    console.error('❌ 检查用户表结构错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 初始化系统设置（重新设计，避免SQL语法错误）
app.post('/api/setup/init-db', async (req, res) => {
  try {
    console.log('🔧 初始化数据库设置...');
    
    // 1. 创建system_settings表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY,
        carriers JSONB DEFAULT '[]'::jsonb,
        clients JSONB DEFAULT '[]'::jsonb,
        services JSONB DEFAULT '[]'::jsonb,
        pols JSONB DEFAULT '[]'::jsonb,
        pods JSONB DEFAULT '[]'::jsonb,
        types JSONB DEFAULT '[]'::jsonb,
        status JSONB DEFAULT '["PENDING", "CONFIRMED", "ROLLED"]'::jsonb,
        jobs JSONB DEFAULT '[]'::jsonb,
        allocations JSONB DEFAULT '[]'::jsonb,
        remarks JSONB DEFAULT '[]'::jsonb,
        gateinrates JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // 2. 插入默认设置
    await pool.query(`
      INSERT INTO system_settings (id, carriers, clients, services, pols, pods, types, status, jobs, allocations, remarks, gateinrates)
      SELECT 1, 
        '["MAERSK", "MSC", "COSCO"]'::jsonb,
        '["客户A", "客户B", "客户C"]'::jsonb,
        '["FCL", "LCL"]'::jsonb,
        '["SHANGHAI", "NINGBO"]'::jsonb,
        '["LOS ANGELES", "LONG BEACH"]'::jsonb,
        '["20GP", "40GP", "40HQ"]'::jsonb,
        '["PENDING", "CONFIRMED", "ROLLED"]'::jsonb,
        '["JOB001", "JOB002"]'::jsonb,
        '["ALLOC001", "ALLOC002"]'::jsonb,
        '["普通", "加急"]'::jsonb,
        '[]'::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE id = 1)
    `);
    
    // 3. 创建默认数据库
    await pool.query(`
      INSERT INTO databases (id, name, description, color, icon, is_active, sort_order)
      SELECT 'db_default_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || FLOOR(RANDOM() * 1000)::TEXT,
        '默认数据库',
        '系统自动创建的默认数据库',
        '#3B82F6',
        'database',
        true,
        0
      WHERE NOT EXISTS (SELECT 1 FROM databases)
    `);
    
    const settingsCheck = await pool.query('SELECT * FROM system_settings WHERE id = 1');
    const dbCheck = await pool.query('SELECT * FROM databases');
    
    res.json({
      success: true,
      message: '数据库初始化完成',
      hasSettings: settingsCheck.rows.length > 0,
      hasDatabases: dbCheck.rows.length > 0,
      settings: settingsCheck.rows[0],
      databases: dbCheck.rows
    });
    
  } catch (error) {
    console.error('❌ 数据库初始化错误:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: '数据库初始化失败'
    });
  }
});

// ==================== 每日快照和变更记录API ====================

// ==================== 初始化快照和变更记录表 ====================
app.post('/api/migration/init-snapshots', async (req, res) => {
  try {
    console.log('🔧 初始化快照和变更记录表...');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. 创建每日预订快照表 - 使用 bookingref 而不是 booking_ref
      await client.query(`
        CREATE TABLE IF NOT EXISTS daily_booking_snapshots (
          id VARCHAR(255) PRIMARY KEY,
          snapshot_date DATE NOT NULL,
          bookingref VARCHAR(100) NOT NULL,
          database_id VARCHAR(255) NOT NULL,
          database_name VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL,
          client VARCHAR(255),
          pol VARCHAR(100),
          pod VARCHAR(100),
          carrier VARCHAR(100),
          service VARCHAR(100),
          etd DATE,
          vessel VARCHAR(255),
          qty INTEGER,
          type VARCHAR(50),
          week VARCHAR(20),
          allocation VARCHAR(100),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          CONSTRAINT unique_snapshot UNIQUE (snapshot_date, bookingref, database_id)
        )
      `);
      
      // 2. 创建预订变更记录表 - 使用 bookingref 而不是 booking_ref
      await client.query(`
        CREATE TABLE IF NOT EXISTS booking_change_records (
          id VARCHAR(255) PRIMARY KEY,
          change_date DATE NOT NULL,
          bookingref VARCHAR(100) NOT NULL,
          database_id VARCHAR(255) NOT NULL,
          database_name VARCHAR(255) NOT NULL,
          change_type VARCHAR(50) NOT NULL,
          previous_status VARCHAR(50),
          previous_client VARCHAR(255),
          previous_pol VARCHAR(100),
          previous_pod VARCHAR(100),
          new_status VARCHAR(50) NOT NULL,
          new_client VARCHAR(255),
          new_pol VARCHAR(100),
          new_pod VARCHAR(100),
          carrier VARCHAR(100),
          etd DATE,
          qty INTEGER,
          type VARCHAR(50),
          week VARCHAR(20),
          service VARCHAR(100),
          vessel VARCHAR(255),
          allocation VARCHAR(100),
          change_timestamp TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          CONSTRAINT unique_change_record UNIQUE (change_date, bookingref, database_id, change_type)
        )
      `);
      
      // 3. 创建索引以提高查询性能
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_snapshots_date ON daily_booking_snapshots(snapshot_date);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_snapshots_booking ON daily_booking_snapshots(bookingref);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_snapshots_database ON daily_booking_snapshots(database_id);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_changes_date ON booking_change_records(change_date);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_changes_booking ON booking_change_records(bookingref);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_changes_type ON booking_change_records(change_type);
      `);
      
      await client.query('COMMIT');
      
      // 检查现有数据
      const snapshotCount = await client.query('SELECT COUNT(*) as count FROM daily_booking_snapshots');
      const changeCount = await client.query('SELECT COUNT(*) as count FROM booking_change_records');
      
      console.log('✅ 快照和变更记录表初始化完成');
      
      res.json({
        success: true,
        message: '快照和变更记录表初始化完成',
        tables: {
          daily_booking_snapshots: {
            exists: true,
            rowCount: parseInt(snapshotCount.rows[0].count) || 0
          },
          booking_change_records: {
            exists: true,
            rowCount: parseInt(changeCount.rows[0].count) || 0
          }
        },
        indices: [
          'idx_snapshots_date',
          'idx_snapshots_booking',
          'idx_snapshots_database',
          'idx_changes_date',
          'idx_changes_booking',
          'idx_changes_type'
        ],
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ 初始化快照和变更记录表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: '初始化快照和变更记录表失败'
    });
  }
});

// 1. 生成每日快照
app.post('/api/snapshots/generate', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { date } = req.body;
    const snapshotDate = date || getCurrentDate();
    
    console.log('📸 生成每日快照（所有状态）:', snapshotDate);
    
    // 获取所有状态的预订
    const bookingsResult = await client.query(`
      SELECT 
        b.id,
        b.bookingref,
        b.database_id,
        d.name as database_name,
        b.status,
        b.data->>'client' as client,
        b.data->>'pol' as pol,
        b.data->>'pod' as pod,
        b.data->>'carrier' as carrier,
        b.data->>'service' as service,
        b.etd,
        b.data->>'vessel' as vessel,
        CAST(COALESCE(b.data->>'qty', '0') AS INTEGER) as qty,
        b.data->>'type' as type,
        b.week,
        b.data->>'allocation' as allocation
      FROM bookings b
      JOIN databases d ON b.database_id = d.id
      WHERE b.status IN ('PENDING', 'CONFIRMED', 'ROLLED', 'CANCELLED')
    `);
    
    console.log(`📊 找到 ${bookingsResult.rows.length} 个预订需要生成快照`);
    
    let insertedCount = 0;
    const now = new Date();
    
    // 生成快照记录
    for (const booking of bookingsResult.rows) {
      const snapshotId = `${booking.bookingref}_${snapshotDate}_${booking.database_id}`;
      
      try {
        await client.query(`
          INSERT INTO daily_booking_snapshots (
            id, snapshot_date, bookingref, database_id, database_name,
            status, client, pol, pod, carrier, service, etd,
            vessel, qty, type, week, allocation, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          ON CONFLICT (snapshot_date, bookingref, database_id) 
          DO UPDATE SET
            status = EXCLUDED.status,
            client = EXCLUDED.client,
            pol = EXCLUDED.pol,
            pod = EXCLUDED.pod,
            carrier = EXCLUDED.carrier,
            service = EXCLUDED.service,
            etd = EXCLUDED.etd,
            vessel = EXCLUDED.vessel,
            qty = EXCLUDED.qty,
            type = EXCLUDED.type,
            week = EXCLUDED.week,
            allocation = EXCLUDED.allocation,
            updated_at = EXCLUDED.updated_at
        `, [
          snapshotId,
          snapshotDate,
          booking.bookingref,
          booking.database_id,
          booking.database_name,
          booking.status,
          booking.client || '',
          booking.pol || '',
          booking.pod || '',
          booking.carrier || '',
          booking.service || '',
          booking.etd || '',
          booking.vessel || '',
          booking.qty || 0,
          booking.type || '',
          booking.week || '',
          booking.allocation || '',
          now,
          now
        ]);
        
        insertedCount++;
        
        if (insertedCount % 100 === 0) {
          console.log(`  已处理 ${insertedCount} 个预订...`);
        }
      } catch (insertError) {
        console.warn(`插入快照失败 ${booking.bookingref}:`, insertError.message);
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`✅ 快照生成完成: ${insertedCount} 条记录`);
    
    // 显示状态统计
    const statusStats = await client.query(`
      SELECT status, COUNT(*) as count 
      FROM daily_booking_snapshots 
      WHERE snapshot_date = $1 
      GROUP BY status
    `, [snapshotDate]);
    
    console.log('📊 快照状态统计:', statusStats.rows);
    
    res.json({
      success: true,
      message: `成功生成 ${insertedCount} 条快照记录`,
      snapshotDate,
      recordCount: insertedCount,
      statusStats: statusStats.rows,
      timestamp: now.toISOString()
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 生成快照失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// 2. 检测并记录变更 - 仅用于历史数据修复
app.post('/api/changes/detect', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { date } = req.body;
    const changeDate = date || getCurrentDate();  // 使用当前日期
    
    console.log('🔍 检测变更（修复历史数据）:', changeDate);
    
    // 获取该日期有更新的预订
    const updatedBookings = await client.query(`
      SELECT 
        b.id,
        b.bookingref,
        b.database_id,
        d.name as database_name,
        b.status,
        b.data->>'client' as client,
        b.data->>'pol' as pol,
        b.data->>'pod' as pod,
        b.data->>'carrier' as carrier,
        b.data->>'service' as service,
        b.etd,
        b.data->>'vessel' as vessel,
        CAST(COALESCE(b.data->>'qty', '0') AS INTEGER) as qty,
        b.data->>'type' as type,
        b.week,
        b.data->>'allocation' as allocation,
        b.updated_at
      FROM bookings b
      JOIN databases d ON b.database_id = d.id
      WHERE DATE(b.updated_at) = $1::date
      ORDER BY b.updated_at DESC
    `, [changeDate]);
    
    console.log(`📊 找到 ${updatedBookings.rows.length} 个在 ${changeDate} 更新的预订`);
    
    let detectedCount = 0;
    
    for (const booking of updatedBookings.rows) {
      // 检查是否已经有变更记录
      const existingChange = await client.query(`
        SELECT id FROM booking_change_records 
        WHERE bookingref = $1 AND change_date = $2
      `, [booking.bookingref, changeDate]);
      
      if (existingChange.rows.length === 0) {
        // 创建变更记录
        const changeId = `change_hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await client.query(`
          INSERT INTO booking_change_records (
            id, change_date, bookingref, database_id, database_name, change_type,
            carrier, etd, qty, type, week, service, vessel, allocation,
            change_timestamp, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `, [
          changeId,
          changeDate,
          booking.bookingref,
          booking.database_id,
          booking.database_name,
          'status_change', // 默认类型
          booking.carrier,
          booking.etd,
          booking.qty,
          booking.type,
          booking.week,
          booking.service,
          booking.vessel,
          booking.allocation,
          booking.updated_at
        ]);
        
        detectedCount++;
        console.log(`✅ 创建历史变更记录: ${booking.bookingref}`);
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`✅ 历史变更检测完成: ${detectedCount} 条新记录`);
    
    res.json({
      success: true,
      message: `检测到 ${detectedCount} 条历史变更记录`,
      changeDate,
      detectedCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 检测变更失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// 3. 获取变更记录（支持日期、数据库、变更类型等过滤）
app.get('/api/changes', async (req, res) => {
  try {
    const { 
      date, 
      database_id, 
      change_type, 
      booking_ref,
      page = 1, 
      limit = 100 
    } = req.query;
    
    console.log('📋 获取变更记录:', { date, database_id, change_type, booking_ref });
    
    // 构建查询条件
    let whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;
    
    if (date) {
      whereConditions.push(`change_date = $${paramIndex}`);
      queryParams.push(date);
      paramIndex++;
    }
    
    if (database_id) {
      whereConditions.push(`database_id = $${paramIndex}`);
      queryParams.push(database_id);
      paramIndex++;
    }
    
    if (change_type && change_type !== 'all') {
      whereConditions.push(`change_type = $${paramIndex}`);
      queryParams.push(change_type);
      paramIndex++;
    }
    
    if (booking_ref) {
      whereConditions.push(`bookingref ILIKE $${paramIndex}`);
      queryParams.push(`%${booking_ref}%`);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    // 计算总数
    const countResult = await pool.query(`
      SELECT COUNT(*) as total FROM booking_change_records ${whereClause}
    `, queryParams);
    
    const total = parseInt(countResult.rows[0].total) || 0;
    
    // 获取数据
    const offset = (page - 1) * limit;
    const dataResult = await pool.query(`
      SELECT * FROM booking_change_records 
      ${whereClause}
      ORDER BY change_timestamp DESC, created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, limit, offset]);
    
    const changes = dataResult.rows.map(row => ({
      id: row.id,
      changeDate: row.change_date,
      bookingRef: row.bookingref,
      databaseId: row.database_id,
      databaseName: row.database_name,
      changeType: row.change_type,
      previousStatus: row.previous_status,
      previousClient: row.previous_client,
      previousPol: row.previous_pol,
      previousPod: row.previous_pod,
      newStatus: row.new_status,
      newClient: row.new_client,
      newPol: row.new_pol,
      newPod: row.new_pod,
      carrier: row.carrier,
      etd: row.etd,
      qty: row.qty,
      type: row.type,
      week: row.week,
      service: row.service,
      vessel: row.vessel,
      allocation: row.allocation,
      changeTimestamp: row.change_timestamp,
      createdAt: row.created_at
    }));
    
    res.json({
      success: true,
      changes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      metadata: {
        date: date || '全部',
        database: database_id || '全部',
        changeType: change_type || '全部'
      }
    });
    
  } catch (error) {
    console.error('❌ 获取变更记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 4. 获取变更统计（按数据库、类型等）
app.get('/api/changes/stats', async (req, res) => {
  try {
    const { date } = req.query;
    const queryDate = date || getCurrentDate();
    
    console.log('📊 获取变更统计:', queryDate);
    
    // 按数据库统计
    const dbStatsResult = await pool.query(`
      SELECT 
        database_id,
        database_name,
        COUNT(*) as total_changes,
        SUM(CASE WHEN change_type = 'status_change' THEN 1 ELSE 0 END) as status_changes,
        SUM(CASE WHEN change_type = 'pol_change' THEN 1 ELSE 0 END) as pol_changes,
        SUM(CASE WHEN change_type = 'pod_change' THEN 1 ELSE 0 END) as pod_changes,
        SUM(CASE WHEN change_type = 'client_change' THEN 1 ELSE 0 END) as client_changes,
        SUM(CASE WHEN change_type = 'multiple' THEN 1 ELSE 0 END) as multiple_changes,
        SUM(qty) as total_qty
      FROM booking_change_records
      WHERE change_date = $1
      GROUP BY database_id, database_name
      ORDER BY total_changes DESC
    `, [queryDate]);
    
    // 总统计
    const totalStatsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_changes,
        SUM(CASE WHEN change_type = 'status_change' THEN 1 ELSE 0 END) as status_changes,
        SUM(CASE WHEN change_type = 'pol_change' THEN 1 ELSE 0 END) as pol_changes,
        SUM(CASE WHEN change_type = 'pod_change' THEN 1 ELSE 0 END) as pod_changes,
        SUM(CASE WHEN change_type = 'client_change' THEN 1 ELSE 0 END) as client_changes,
        SUM(CASE WHEN change_type = 'multiple' THEN 1 ELSE 0 END) as multiple_changes,
        SUM(qty) as total_qty
      FROM booking_change_records
      WHERE change_date = $1
    `, [queryDate]);
    
    // POL/POD/客户变更详情
    const changeDetailsResult = await pool.query(`
      SELECT 
        id,
        change_date,
        bookingref,  
        database_id,
        database_name,
        change_type,
        previous_status,
        previous_client,
        previous_pol,
        previous_pod,
        new_status,
        new_client,
        new_pol,
        new_pod,
        carrier,
        etd,
        qty,
        type,
        week,
        service,
        vessel,
        allocation,
        change_timestamp,
        created_at
      FROM booking_change_records
      WHERE change_date = $1
      ORDER BY change_timestamp DESC
    `, [queryDate]);
    
    const totalStats = totalStatsResult.rows[0] || {
      total_changes: 0,
      status_changes: 0,
      pol_changes: 0,
      pod_changes: 0,
      client_changes: 0,
      multiple_changes: 0,
      total_qty: 0
    };
    
    const changeDetails = changeDetailsResult.rows.map(row => ({
      id: row.id,
      changeDate: row.change_date,
      bookingRef: row.bookingref,
      databaseId: row.database_id,
      databaseName: row.database_name,
      changeType: row.change_type,
      previousStatus: row.previous_status,
      previousClient: row.previous_client,
      previousPol: row.previous_pol,
      previousPod: row.previous_pod,
      newStatus: row.new_status,
      newClient: row.new_client,
      newPol: row.new_pol,
      newPod: row.new_pod,
      carrier: row.carrier,
      etd: row.etd,
      qty: row.qty,
      type: row.type,
      week: row.week,
      service: row.service,
      vessel: row.vessel,
      allocation: row.allocation,
      changeTimestamp: row.change_timestamp,
      createdAt: row.created_at,
      currentStatus: row.new_status
    }));
    
    // 分析POL/POD/客户变更
    const analysis = {
      totalPolChanges: changeDetails.filter(d => d.previousPol !== d.newPol).length,
      totalPodChanges: changeDetails.filter(d => d.previousPod !== d.newPod).length,
      totalClientChanges: changeDetails.filter(d => d.previousClient !== d.newClient).length,
      bookingsWithPolChanges: [...new Set(changeDetails.filter(d => d.previousPol !== d.newPol).map(d => d.bookingRef))].length,
      bookingsWithPodChanges: [...new Set(changeDetails.filter(d => d.previousPod !== d.newPod).map(d => d.bookingRef))].length,
      bookingsWithClientChanges: [...new Set(changeDetails.filter(d => d.previousClient !== d.newClient).map(d => d.bookingRef))].length,
      polChangeDetails: changeDetails.filter(d => d.previousPol !== d.newPol).map(d => ({
        bookingRef: d.bookingRef,
        database: d.databaseName,
        previousPol: d.previousPol,
        newPol: d.newPol,
        changeType: d.changeType
      })),
      podChangeDetails: changeDetails.filter(d => d.previousPod !== d.newPod).map(d => ({
        bookingRef: d.bookingRef,
        database: d.databaseName,
        previousPod: d.previousPod,
        newPod: d.newPod,
        changeType: d.changeType
      })),
      clientChangeDetails: changeDetails.filter(d => d.previousClient !== d.newClient).map(d => ({
        bookingRef: d.bookingRef,
        database: d.databaseName,
        previousClient: d.previousClient,
        newClient: d.newClient,
        changeType: d.changeType
      }))
    };
    
    res.json({
      success: true,
      date: queryDate,
      totalStats: {
        totalChanges: parseInt(totalStats.total_changes) || 0,
        statusChanges: parseInt(totalStats.status_changes) || 0,
        polChanges: parseInt(totalStats.pol_changes) || 0,
        podChanges: parseInt(totalStats.pod_changes) || 0,
        clientChanges: parseInt(totalStats.client_changes) || 0,
        multipleChanges: parseInt(totalStats.multiple_changes) || 0,
        totalQty: parseInt(totalStats.total_qty) || 0
      },
      databaseStats: dbStatsResult.rows.map(row => ({
        databaseId: row.database_id,
        databaseName: row.database_name,
        changeCount: parseInt(row.total_changes) || 0,
        statusChanges: parseInt(row.status_changes) || 0,
        polChanges: parseInt(row.pol_changes) || 0,
        podChanges: parseInt(row.pod_changes) || 0,
        clientChanges: parseInt(row.client_changes) || 0,
        multipleChanges: parseInt(row.multiple_changes) || 0,
        totalQty: parseInt(row.total_qty) || 0
      })),
      changeAnalysis: analysis,
      changeDetails,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 获取变更统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 5. 获取快照列表
app.get('/api/snapshots', async (req, res) => {
  try {
    const { date, booking_ref, database_id, page = 1, limit = 100 } = req.query;
    
    console.log('📋 获取快照列表:', { date, booking_ref, database_id });
    
    // 构建查询条件
    let whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;
    
    if (date) {
      whereConditions.push(`snapshot_date = $${paramIndex}`);
      queryParams.push(date);
      paramIndex++;
    }
    
    if (booking_ref) {
      whereConditions.push(`bookingref = $${paramIndex}`);
      queryParams.push(booking_ref);
      paramIndex++;
    }
    
    if (database_id) {
      whereConditions.push(`database_id = $${paramIndex}`);
      queryParams.push(database_id);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    // 计算总数
    const countResult = await pool.query(`
      SELECT COUNT(*) as total FROM daily_booking_snapshots ${whereClause}
    `, queryParams);
    
    const total = parseInt(countResult.rows[0].total) || 0;
    
    // 获取数据
    const offset = (page - 1) * limit;
    const dataResult = await pool.query(`
      SELECT * FROM daily_booking_snapshots 
      ${whereClause}
      ORDER BY snapshot_date DESC, bookingref
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, limit, offset]);
    
    // 获取日期范围
    const dateRangeResult = await pool.query(`
      SELECT MIN(snapshot_date) as min_date, MAX(snapshot_date) as max_date
      FROM daily_booking_snapshots
    `);
    
    const snapshots = dataResult.rows.map(row => ({
      id: row.id,
      snapshotDate: row.snapshot_date,
      bookingRef: row.bookingref,
      databaseId: row.database_id,
      databaseName: row.database_name,
      status: row.status,
      client: row.client,
      pol: row.pol,
      pod: row.pod,
      carrier: row.carrier,
      service: row.service,
      etd: row.etd,
      vessel: row.vessel,
      qty: row.qty,
      type: row.type,
      week: row.week,
      allocation: row.allocation,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json({
      success: true,
      snapshots,
      dateRange: dateRangeResult.rows[0],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
    
  } catch (error) {
    console.error('❌ 获取快照列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 6. 批量操作：生成快照并检测变更
app.post('/api/daily-stats/refresh', async (req, res) => {
  try {
    const { date } = req.body;
    const targetDate = date || getCurrentDate();
    
    console.log('🔄 刷新每日统计:', targetDate);
    
    // 步骤1：生成快照
    const snapshotRes = await fetch(`http://localhost:${port}/api/snapshots/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: targetDate })
    });
    
    const snapshotData = await snapshotRes.json();
    
    if (!snapshotData.success) {
      throw new Error('生成快照失败');
    }
    
    // 步骤2：检测变更
    const changesRes = await fetch(`http://localhost:${port}/api/changes/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: targetDate })
    });
    
    const changesData = await changesRes.json();
    
    console.log('✅ 每日统计刷新完成');
    
    res.json({
      success: true,
      message: '每日统计刷新完成',
      date: targetDate,
      snapshot: snapshotData,
      changes: changesData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 刷新每日统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 新增的调试接口 ====================

// 检查快照表状态
app.get('/api/migration/check-snapshots', async (req, res) => {
  try {
    console.log('🔍 检查快照表状态...');
    
    // 检查表是否存在
    const snapshotCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'daily_booking_snapshots'
      ) as exists;
    `);
    
    const changeCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'booking_change_records'
      ) as exists;
    `);
    
    // 获取表数据统计
    const snapshotCount = await pool.query('SELECT COUNT(*) as count FROM daily_booking_snapshots');
    const changeCount = await pool.query('SELECT COUNT(*) as count FROM booking_change_records');
    
    // 获取最新的快照日期
    const latestSnapshot = await pool.query(`
      SELECT MAX(snapshot_date) as latest_date FROM daily_booking_snapshots
    `);
    
    // 获取最新的变更记录
    const latestChange = await pool.query(`
      SELECT MAX(change_date) as latest_date FROM booking_change_records
    `);
    
    res.json({
      success: true,
      tables: {
        daily_booking_snapshots: {
          exists: snapshotCheck.rows[0].exists,
          rowCount: parseInt(snapshotCount.rows[0].count) || 0,
          latestDate: latestSnapshot.rows[0]?.latest_date || null
        },
        booking_change_records: {
          exists: changeCheck.rows[0].exists,
          rowCount: parseInt(changeCount.rows[0].count) || 0,
          latestDate: latestChange.rows[0]?.latest_date || null
        }
      },
      recommendations: snapshotCheck.rows[0].exists && changeCheck.rows[0].exists ? 
        '快照表已存在，可以直接生成快照和检测变更' : 
        '快照表不存在，请先初始化'
    });
    
  } catch (error) {
    console.error('❌ 检查快照表状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 清除快照数据（用于测试）
app.delete('/api/migration/clear-snapshots', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🗑️ 清除快照数据...');
    
    // 清除变更记录
    const deleteChanges = await client.query('DELETE FROM booking_change_records RETURNING COUNT(*) as count');
    const changesDeleted = parseInt(deleteChanges.rows[0].count) || 0;
    
    // 清除快照
    const deleteSnapshots = await client.query('DELETE FROM daily_booking_snapshots RETURNING COUNT(*) as count');
    const snapshotsDeleted = parseInt(deleteSnapshots.rows[0].count) || 0;
    
    await client.query('COMMIT');
    
    console.log(`✅ 清除完成: ${snapshotsDeleted} 个快照, ${changesDeleted} 条变更记录`);
    
    res.json({
      success: true,
      message: `清除完成: ${snapshotsDeleted} 个快照, ${changesDeleted} 条变更记录`,
      cleared: {
        snapshots: snapshotsDeleted,
        changes: changesDeleted
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 清除快照数据失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// 调试接口：检查特定预订的快照状态
app.get('/api/debug/check-booking', async (req, res) => {
  try {
    const { booking_ref } = req.query;
    
    if (!booking_ref) {
      return res.status(400).json({
        success: false,
        error: '需要提供booking_ref参数'
      });
    }
    
    console.log('🔍 检查预订快照:', booking_ref);
    
    // 获取该预订的所有快照
    const snapshotsResult = await pool.query(`
      SELECT 
        snapshot_date, 
        bookingref,
        status, 
        client, 
        pol, 
        pod, 
        carrier, 
        etd, 
        qty, 
        type, 
        week, 
        database_name,
        database_id
      FROM daily_booking_snapshots 
      WHERE bookingref = $1
      ORDER BY snapshot_date DESC
    `, [booking_ref]);
    
    // 正确映射字段名
    const snapshots = snapshotsResult.rows.map(row => ({
      snapshotDate: row.snapshot_date,
      bookingRef: row.bookingref,
      status: row.status,
      client: row.client,
      pol: row.pol,
      pod: row.pod,
      carrier: row.carrier,
      etd: row.etd,
      qty: row.qty,
      type: row.type,
      week: row.week,
      databaseName: row.database_name,
      databaseId: row.database_id
    }));
    
    // 获取该预订的当前状态
    const bookingResult = await pool.query(`
      SELECT 
        b.id,
        b.bookingref,
        b.status, 
        b.etd, 
        b.week, 
        b.data->>'client' as client,
        b.data->>'carrier' as carrier, 
        b.data->>'pol' as pol, 
        b.data->>'pod' as pod, 
        b.data->>'qty' as qty, 
        b.data->>'type' as type,
        d.name as database_name,
        d.id as database_id
      FROM bookings b
      JOIN databases d ON b.database_id = d.id
      WHERE b.bookingref = $1
    `, [booking_ref]);
    
    // 获取该预订的变更记录
    const changesResult = await pool.query(`
      SELECT 
        change_date, 
        bookingref,
        change_type, 
        previous_status, 
        new_status,
        previous_client, 
        new_client, 
        previous_pol, 
        new_pol,
        previous_pod, 
        new_pod, 
        change_timestamp
      FROM booking_change_records
      WHERE bookingref = $1
      ORDER BY change_date DESC
    `, [booking_ref]);
    
    res.json({
      success: true,
      bookingRef: booking_ref,
      currentBooking: bookingResult.rows.length > 0 ? {
        id: bookingResult.rows[0].id,
        bookingRef: bookingResult.rows[0].bookingref,
        status: bookingResult.rows[0].status,
        databaseName: bookingResult.rows[0].database_name,
        databaseId: bookingResult.rows[0].database_id
      } : null,
      snapshots,
      changes: changesResult.rows.map(row => ({
        changeDate: row.change_date,
        bookingRef: row.bookingref,
        changeType: row.change_type,
        previousStatus: row.previous_status,
        newStatus: row.new_status,
        previousClient: row.previous_client,
        newClient: row.new_client,
        previousPol: row.previous_pol,
        newPol: row.new_pol,
        previousPod: row.previous_pod,
        newPod: row.new_pod,
        changeTimestamp: row.change_timestamp
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 检查预订失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 调试接口：执行SQL查询
app.get('/api/debug/snapshot-query', async (req, res) => {
  try {
    const { sql } = req.query;
    
    if (!sql) {
      return res.status(400).json({
        success: false,
        error: '需要提供SQL查询语句'
      });
    }
    
    console.log('🔍 执行SQL查询:', sql.substring(0, 200));
    
    const result = await pool.query(sql);
    
    res.json({
      success: true,
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields?.map(f => ({ name: f.name, dataTypeID: f.dataTypeID }))
    });
    
  } catch (error) {
    console.error('❌ SQL查询错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 手动检测特定预订的变更
app.post('/api/debug/detect-change', async (req, res) => {
  try {
    const { booking_ref, date } = req.body;
    
    if (!booking_ref || !date) {
      return res.status(400).json({
        success: false,
        error: '需要提供booking_ref和date参数'
      });
    }
    
    console.log('🔍 手动检测变更:', { booking_ref, date });
    
    // 获取昨天的日期
    const yesterdayDate = new Date(date);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
    
    // 获取昨天和今天的快照
    const todaySnapshot = await pool.query(`
      SELECT * FROM daily_booking_snapshots 
      WHERE bookingref = $1 AND snapshot_date = $2
    `, [booking_ref, date]);
    
    const yesterdaySnapshot = await pool.query(`
      SELECT * FROM daily_booking_snapshots 
      WHERE bookingref = $1 AND snapshot_date = $2
    `, [booking_ref, yesterdayStr]);
    
    const today = todaySnapshot.rows[0];
    const yesterday = yesterdaySnapshot.rows[0];
    
    if (!today) {
      return res.json({
        success: true,
        booking_ref,
        date,
        message: `今天(${date})没有找到该预订的快照`,
        changeType: 'none'
      });
    }
    
    if (!yesterday) {
      return res.json({
        success: true,
        booking_ref,
        date,
        message: `昨天(${yesterdayStr})没有找到该预订的快照`,
        changeType: 'none'
      });
    }
    
    // 检查状态变更
    const hasStatusChange = yesterday.status !== today.status;
    const hasPolChange = yesterday.pol !== today.pol;
    const hasPodChange = yesterday.pod !== today.pod;
    const hasClientChange = yesterday.client !== today.client;
    
    let changeType = 'none';
    const changes = [];
    
    if (hasStatusChange) changes.push(`状态: ${yesterday.status} -> ${today.status}`);
    if (hasPolChange) changes.push(`POL: ${yesterday.pol} -> ${today.pol}`);
    if (hasPodChange) changes.push(`POD: ${yesterday.pod} -> ${today.pod}`);
    if (hasClientChange) changes.push(`客户: ${yesterday.client} -> ${today.client}`);
    
    // 确定变更类型
    if (hasStatusChange && yesterday.status === 'PENDING' && today.status === 'CONFIRMED') {
      changeType = 'status_change';
    } else if (hasPolChange) {
      changeType = 'pol_change';
    } else if (hasPodChange) {
      changeType = 'pod_change';
    } else if (hasClientChange) {
      changeType = 'client_change';
    } else if (hasStatusChange) {
      changeType = 'status_change_other';
    }
    
    const changeCount = [hasPolChange, hasPodChange, hasClientChange].filter(Boolean).length;
    if (changeCount > 1 && changeType === 'status_change') {
      changeType = 'multiple';
    }
    
    // 如果有变更，记录到变更表
    if (changeType !== 'none' && changeType !== 'status_change_other') {
      const changeId = `${booking_ref}_${date}_${changeType}`;
      const now = new Date();
      
      try {
        await pool.query(`
          INSERT INTO booking_change_records (
            id, change_date, bookingref, database_id, database_name, change_type,
            previous_status, previous_client, previous_pol, previous_pod,
            new_status, new_client, new_pol, new_pod,
            carrier, etd, qty, type, week, service, vessel, allocation,
            change_timestamp, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
          ON CONFLICT (change_date, bookingref, database_id, change_type) 
          DO UPDATE SET
            previous_status = EXCLUDED.previous_status,
            previous_client = EXCLUDED.previous_client,
            previous_pol = EXCLUDED.previous_pol,
            previous_pod = EXCLUDED.previous_pod,
            new_status = EXCLUDED.new_status,
            new_client = EXCLUDED.new_client,
            new_pol = EXCLUDED.new_pol,
            new_pod = EXCLUDED.new_pod,
            updated_at = EXCLUDED.change_timestamp
        `, [
          changeId,
          date,
          today.bookingref,
          today.database_id,
          today.database_name,
          changeType,
          yesterday.status,
          yesterday.client,
          yesterday.pol,
          yesterday.pod,
          today.status,
          today.client,
          today.pol,
          today.pod,
          today.carrier,
          today.etd,
          today.qty,
          today.type,
          today.week,
          today.service,
          today.vessel,
          today.allocation,
          now,
          now
        ]);
        
        console.log(`✅ 已记录变更: ${booking_ref}, 类型: ${changeType}`);
      } catch (insertError) {
        console.error(`❌ 记录变更失败 ${booking_ref}:`, insertError.message);
      }
    }
    
    res.json({
      success: true,
      booking_ref,
      date,
      yesterday: yesterdayStr,
      todayStatus: today.status,
      yesterdayStatus: yesterday.status,
      hasStatusChange,
      hasPolChange,
      hasPodChange,
      hasClientChange,
      changeType,
      changes,
      isPendingToConfirmed: yesterday.status === 'PENDING' && today.status === 'CONFIRMED',
      message: changeType !== 'none' && changeType !== 'status_change_other' ? 
        `已检测到变更(${changeType})并记录` : 
        `没有检测到符合条件的变更(状态: ${yesterday.status} -> ${today.status})`,
      snapshotDetails: {
        today,
        yesterday
      }
    });
    
  } catch (error) {
    console.error('❌ 手动检测变更失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 修复变更记录表约束
app.post('/api/fix-change-constraints', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔧 修复变更记录表约束...');
    
    // 1. 检查表是否存在
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'booking_change_records'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      await client.query('ROLLBACK');
      return res.json({
        success: false,
        error: 'booking_change_records 表不存在'
      });
    }
    
    // 2. 删除旧的约束
    await client.query(`
      ALTER TABLE booking_change_records 
      DROP CONSTRAINT IF EXISTS unique_change_record,
      DROP CONSTRAINT IF EXISTS unique_booking_change
    `);
    
    console.log('✅ 旧约束已删除');
    
    // 3. 创建新的唯一约束
    await client.query(`
      ALTER TABLE booking_change_records 
      ADD CONSTRAINT unique_booking_change 
      UNIQUE (bookingref, change_date, database_id)
    `);
    
    console.log('✅ 新约束已创建: unique_booking_change (bookingref, change_date, database_id)');
    
    await client.query('COMMIT');
    
    // 4. 检查约束
    const constraintCheck = await client.query(`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'booking_change_records'
        AND tc.constraint_type = 'UNIQUE'
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `);
    
    res.json({
      success: true,
      message: '约束修复完成',
      constraints: constraintCheck.rows,
      newConstraint: {
        name: 'unique_booking_change',
        columns: ['bookingref', 'change_date', 'database_id'],
        description: '确保每个预订每天在每个数据库中只有一条变更记录'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 修复约束失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// 手动插入变更记录
app.post('/api/debug/manual-insert-change', async (req, res) => {
  try {
    const {
      booking_ref,
      date,
      previous_status,
      new_status,
      database_id,
      database_name,
      carrier = 'MAERSK',
      change_type = 'status_change'
    } = req.body;
    
    if (!booking_ref || !date || !previous_status || !new_status) {
      return res.status(400).json({
        success: false,
        error: '需要提供booking_ref、date、previous_status、new_status参数'
      });
    }
    
    console.log('🔧 手动插入变更记录:', { booking_ref, date, previous_status, new_status });
    
    const changeId = `${booking_ref}_${date}_${change_type}`;
    const now = new Date();
    
    // 获取快照中的其他信息
    const snapshotResult = await pool.query(`
      SELECT client, pol, pod, etd, qty, type, week, service, vessel, allocation, database_id, database_name
      FROM daily_booking_snapshots 
      WHERE bookingref = $1 AND snapshot_date = $2
    `, [booking_ref, date]);
    
    const snapshot = snapshotResult.rows[0] || {};
    
    await pool.query(`
      INSERT INTO booking_change_records (
        id, change_date, bookingref, database_id, database_name, change_type,
        previous_status, previous_client, previous_pol, previous_pod,
        new_status, new_client, new_pol, new_pod,
        carrier, etd, qty, type, week, service, vessel, allocation,
        change_timestamp, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      ON CONFLICT (change_date, bookingref, database_id, change_type) 
      DO UPDATE SET
        previous_status = EXCLUDED.previous_status,
        new_status = EXCLUDED.new_status,
        updated_at = EXCLUDED.change_timestamp
    `, [
      changeId,
      date,
      booking_ref,
      database_id || snapshot.database_id,
      database_name || snapshot.database_name,
      change_type,
      previous_status,
      snapshot.client,
      snapshot.pol,
      snapshot.pod,
      new_status,
      snapshot.client,
      snapshot.pol,
      carrier,
      snapshot.etd,
      snapshot.qty || 0,
      snapshot.type,
      snapshot.week,
      snapshot.service,
      snapshot.vessel,
      snapshot.allocation,
      now,
      now
    ]);
    
    console.log(`✅ 手动插入变更记录成功: ${booking_ref}`);
    
    res.json({
      success: true,
      message: `已手动插入变更记录: ${booking_ref} 从 ${previous_status} 变为 ${new_status}`,
      changeId,
      changeType: change_type
    });
    
  } catch (error) {
    console.error('❌ 手动插入变更记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 清理重复的变更记录（按 bookingref, change_date, database_id）
app.post('/api/clean-duplicate-changes', async (req, res) => {
  try {
    console.log('🧹 清理重复的变更记录（按预订/日期/数据库）...');
    
    // 查找重复记录
    const duplicates = await pool.query(`
      WITH duplicates AS (
        SELECT 
          id,
          bookingref,
          change_date,
          database_id,
          change_timestamp,
          ROW_NUMBER() OVER (
            PARTITION BY bookingref, change_date, database_id 
            ORDER BY change_timestamp DESC, created_at DESC
          ) as rn
        FROM booking_change_records
      )
      SELECT id, bookingref, change_date, database_id
      FROM duplicates 
      WHERE rn > 1
      ORDER BY bookingref, change_date, rn
    `);
    
    const duplicateCount = duplicates.rows.length;
    console.log(`📊 找到 ${duplicateCount} 条重复记录`);
    
    if (duplicateCount > 0) {
      // 删除重复记录（保留最新的一条）
      const deleteResult = await pool.query(`
        WITH duplicates AS (
          SELECT 
            id,
            ROW_NUMBER() OVER (
              PARTITION BY bookingref, change_date, database_id 
              ORDER BY change_timestamp DESC, created_at DESC
            ) as rn
          FROM booking_change_records
        )
        DELETE FROM booking_change_records 
        WHERE id IN (
          SELECT id FROM duplicates WHERE rn > 1
        )
        RETURNING id, bookingref, change_date, database_id
      `);
      
      const deletedCount = deleteResult.rowCount || 0;
      
      console.log(`✅ 清理完成，删除了 ${deletedCount} 条重复记录`);
      
      // 统计每个预订的重复情况
      const statsResult = await pool.query(`
        SELECT 
          bookingref,
          COUNT(*) as total_records,
          COUNT(DISTINCT change_date) as unique_dates
        FROM booking_change_records
        GROUP BY bookingref
        ORDER BY total_records DESC
        LIMIT 20
      `);
      
      res.json({
        success: true,
        message: `清理了 ${deletedCount} 条重复的变更记录`,
        deletedCount,
        duplicateStats: statsResult.rows,
        sampleDeleted: deleteResult.rows.slice(0, 10),
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: true,
        message: '没有找到重复记录',
        deletedCount: 0,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ 清理重复记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 新增：变更记录相关API（支持前端apiService.ts） ====================

// 1. 保存单个变更记录
// 找到 POST /api/booking-change-records 端点，修改为以下内容：
app.post('/api/booking-change-records', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      change_date,
      booking_ref,
      database_id,
      database_name,
      change_type,
      previous_status,
      previous_client,
      previous_pol,
      previous_pod,
      new_status,
      new_client,
      new_pol,
      new_pod,
      carrier,
      etd,
      qty,
      type,
      week,
      service,
      vessel,
      allocation,
      change_timestamp
    } = req.body;
    
    console.log('💾 保存变更记录请求:', { 
      change_date,
      booking_ref,
      change_type,
      previous_status,
      new_status
    });
    
    // 确保有唯一的ID
    const changeId = `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 使用正确的字段名：booking_ref 而不是 bookinger
    const bookingref = booking_ref;
    
    // 构建插入SQL，使用ON CONFLICT更新
    const result = await client.query(
      `INSERT INTO booking_change_records (
        id, change_date, bookingref, database_id, database_name, change_type,
        previous_status, previous_client, previous_pol, previous_pod,
        new_status, new_client, new_pol, new_pod,
        carrier, etd, qty, type, week, service, vessel, allocation,
        change_timestamp, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW())
      ON CONFLICT (bookingref, change_date, database_id) 
      DO UPDATE SET
        change_type = EXCLUDED.change_type,
        previous_status = EXCLUDED.previous_status,
        previous_client = EXCLUDED.previous_client,
        previous_pol = EXCLUDED.previous_pol,
        previous_pod = EXCLUDED.previous_pod,
        new_status = EXCLUDED.new_status,
        new_client = EXCLUDED.new_client,
        new_pol = EXCLUDED.new_pol,
        new_pod = EXCLUDED.new_pod,
        carrier = EXCLUDED.carrier,
        etd = EXCLUDED.etd,
        qty = EXCLUDED.qty,
        type = EXCLUDED.type,
        week = EXCLUDED.week,
        service = EXCLUDED.service,
        vessel = EXCLUDED.vessel,
        allocation = EXCLUDED.allocation,
        change_timestamp = EXCLUDED.change_timestamp,
        updated_at = NOW()
      RETURNING *`,
      [
        changeId,
        change_date,
        bookingref,
        database_id,
        database_name,
        change_type,
        previous_status,
        previous_client,
        previous_pol,
        previous_pod,
        new_status,
        new_client,
        new_pol,
        new_pod,
        carrier,
        etd,
        qty,
        type,
        week,
        service,
        vessel,
        allocation,
        change_timestamp || new Date().toISOString()
      ]
    );
    
    await client.query('COMMIT');
    
    const savedRecord = result.rows[0];
    
    res.json({
      success: true,
      record: {
        id: savedRecord.id,
        changeDate: savedRecord.change_date,
        bookingRef: savedRecord.bookingref,
        databaseId: savedRecord.database_id,
        databaseName: savedRecord.database_name,
        changeType: savedRecord.change_type,
        previousStatus: savedRecord.previous_status,
        previousClient: savedRecord.previous_client,
        previousPol: savedRecord.previous_pol,
        previousPod: savedRecord.previous_pod,
        newStatus: savedRecord.new_status,
        newClient: savedRecord.new_client,
        newPol: savedRecord.new_pol,
        newPod: savedRecord.new_pod,
        carrier: savedRecord.carrier,
        etd: savedRecord.etd,
        qty: savedRecord.qty,
        type: savedRecord.type,
        week: savedRecord.week,
        service: savedRecord.service,
        vessel: savedRecord.vessel,
        allocation: savedRecord.allocation,
        changeTimestamp: savedRecord.change_timestamp,
        createdAt: savedRecord.created_at
      },
      message: '变更记录保存成功'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 保存变更记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: '请检查数据库唯一约束'
    });
  } finally {
    client.release();
  }
});

// 2. 获取变更统计
app.get('/api/booking-change-records/stats', async (req, res) => {
  try {
    const { date } = req.query;
    
    console.log('📊 获取变更统计:', date);
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: '需要提供日期参数'
      });
    }
    
    // 按数据库统计
    const dbStatsResult = await pool.query(`
      SELECT 
        database_id,
        database_name,
        COUNT(*) as total_changes,
        SUM(CASE WHEN change_type = 'status_change' THEN 1 ELSE 0 END) as status_changes,
        SUM(CASE WHEN change_type = 'pol_change' THEN 1 ELSE 0 END) as pol_changes,
        SUM(CASE WHEN change_type = 'pod_change' THEN 1 ELSE 0 END) as pod_changes,
        SUM(CASE WHEN change_type = 'client_change' THEN 1 ELSE 0 END) as client_changes,
        SUM(CASE WHEN change_type = 'multiple' THEN 1 ELSE 0 END) as multiple_changes,
        SUM(CASE WHEN change_type = 'rollback' THEN 1 ELSE 0 END) as rollback_changes,
        SUM(qty) as total_qty
      FROM booking_change_records
      WHERE change_date = $1
      GROUP BY database_id, database_name
      ORDER BY total_changes DESC
    `, [date]);
    
    // 总统计
    const totalStatsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_changes,
        SUM(CASE WHEN change_type = 'status_change' THEN 1 ELSE 0 END) as status_changes,
        SUM(CASE WHEN change_type = 'pol_change' THEN 1 ELSE 0 END) as pol_changes,
        SUM(CASE WHEN change_type = 'pod_change' THEN 1 ELSE 0 END) as pod_changes,
        SUM(CASE WHEN change_type = 'client_change' THEN 1 ELSE 0 END) as client_changes,
        SUM(CASE WHEN change_type = 'multiple' THEN 1 ELSE 0 END) as multiple_changes,
        SUM(CASE WHEN change_type = 'rollback' THEN 1 ELSE 0 END) as rollback_changes,
        SUM(qty) as total_qty
      FROM booking_change_records
      WHERE change_date = $1
    `, [date]);
    
    const totalStats = totalStatsResult.rows[0] || {
      total_changes: 0,
      status_changes: 0,
      pol_changes: 0,
      pod_changes: 0,
      client_changes: 0,
      multiple_changes: 0,
      rollback_changes: 0,
      total_qty: 0
    };
    
    res.json({
      success: true,
      date,
      stats: {
        total: parseInt(totalStats.total_changes) || 0,
        statusChanges: parseInt(totalStats.status_changes) || 0,
        polChanges: parseInt(totalStats.pol_changes) || 0,
        podChanges: parseInt(totalStats.pod_changes) || 0,
        clientChanges: parseInt(totalStats.client_changes) || 0,
        multipleChanges: parseInt(totalStats.multiple_changes) || 0,
        rollback: parseInt(totalStats.rollback_changes) || 0,
        totalQty: parseInt(totalStats.total_qty) || 0
      },
      databaseStats: dbStatsResult.rows.map(row => ({
        databaseId: row.database_id,
        databaseName: row.database_name,
        changeCount: parseInt(row.total_changes) || 0,
        statusChanges: parseInt(row.status_changes) || 0,
        polChanges: parseInt(row.pol_changes) || 0,
        podChanges: parseInt(row.pod_changes) || 0,
        clientChanges: parseInt(row.client_changes) || 0,
        multipleChanges: parseInt(row.multiple_changes) || 0,
        rollbackChanges: parseInt(row.rollback_changes) || 0,
        totalQty: parseInt(row.total_qty) || 0
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 获取变更统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3. 批量保存变更记录
app.post('/api/booking-change-records/batch', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { records } = req.body;
    
    if (!Array.isArray(records)) {
      throw new Error('records 参数必须是数组');
    }
    
    console.log(`📦 批量保存变更记录: ${records.length} 条`);
    
    let savedCount = 0;
    const savedIds = [];
    
    for (const record of records) {
      try {
        const changeId = `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await client.query(
          `INSERT INTO booking_change_records (
            id, change_date, bookingref, database_id, database_name, change_type,
            previous_status, previous_client, previous_pol, previous_pod,
            new_status, new_client, new_pol, new_pod,
            carrier, etd, qty, type, week, service, vessel, allocation,
            change_timestamp, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW())
          ON CONFLICT (change_date, bookingref, database_id, change_type) 
          DO UPDATE SET
            previous_status = EXCLUDED.previous_status,
            new_status = EXCLUDED.new_status,
            previous_client = EXCLUDED.previous_client,
            new_client = EXCLUDED.new_client,
            previous_pol = EXCLUDED.previous_pol,
            new_pol = EXCLUDED.new_pol,
            previous_pod = EXCLUDED.previous_pod,
            new_pod = EXCLUDED.new_pod,
            updated_at = EXCLUDED.change_timestamp`,
          [
            changeId,
            record.change_date,
            record.booking_ref || record.bookingRef,
            record.database_id,
            record.database_name,
            record.change_type,
            record.previous_status,
            record.previous_client,
            record.previous_pol,
            record.previous_pod,
            record.new_status,
            record.new_client,
            record.new_pol,
            record.new_pod,
            record.carrier,
            record.etd,
            record.qty,
            record.type,
            record.week,
            record.service,
            record.vessel,
            record.allocation,
            record.change_timestamp || new Date().toISOString()
          ]
        );
        
        savedCount++;
        savedIds.push(changeId);
      } catch (error) {
        console.warn(`❌ 保存单条记录失败:`, error.message);
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`✅ 批量保存完成: ${savedCount}/${records.length} 条成功`);
    
    res.json({
      success: true,
      savedCount,
      totalCount: records.length,
      savedIds,
      message: `批量保存完成: ${savedCount}/${records.length} 条成功`
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 批量保存变更记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// 4. 根据预订ID获取变更历史
app.get('/api/booking-change-records/booking/:bookingRef', async (req, res) => {
  try {
    const { bookingRef } = req.params;
    
    console.log('📜 获取预订变更历史:', bookingRef);
    
    const result = await pool.query(`
      SELECT * FROM booking_change_records
      WHERE bookingref = $1
      ORDER BY change_timestamp DESC
    `, [bookingRef]);
    
    const records = result.rows.map(row => ({
      id: row.id,
      changeDate: row.change_date,
      bookingRef: row.bookingref,
      databaseId: row.database_id,
      databaseName: row.database_name,
      changeType: row.change_type,
      previousStatus: row.previous_status,
      previousClient: row.previous_client,
      previousPol: row.previous_pol,
      previousPod: row.previous_pod,
      newStatus: row.new_status,
      newClient: row.new_client,
      newPol: row.new_pol,
      newPod: row.new_pod,
      carrier: row.carrier,
      etd: row.etd,
      qty: row.qty,
      type: row.type,
      week: row.week,
      service: row.service,
      vessel: row.vessel,
      allocation: row.allocation,
      changeTimestamp: row.change_timestamp,
      createdAt: row.created_at
    }));
    
    res.json({
      success: true,
      records,
      message: `找到 ${records.length} 条变更记录`
    });
    
  } catch (error) {
    console.error('❌ 获取预订变更历史失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 5. 按日期范围获取变更记录
app.get('/api/booking-change-records/range', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    console.log('📅 按日期范围获取变更记录:', start, '至', end);
    
    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: '需要提供开始日期和结束日期'
      });
    }
    
    const result = await pool.query(`
      SELECT * FROM booking_change_records
      WHERE change_date >= $1 AND change_date <= $2
      ORDER BY change_date DESC, change_timestamp DESC
    `, [start, end]);
    
    const records = result.rows.map(row => ({
      id: row.id,
      changeDate: row.change_date,
      bookingRef: row.bookingref,
      databaseId: row.database_id,
      databaseName: row.database_name,
      changeType: row.change_type,
      previousStatus: row.previous_status,
      previousClient: row.previous_client,
      previousPol: row.previous_pol,
      previousPod: row.previous_pod,
      newStatus: row.new_status,
      newClient: row.new_client,
      newPol: row.new_pol,
      newPod: row.new_pod,
      carrier: row.carrier,
      etd: row.etd,
      qty: row.qty,
      type: row.type,
      week: row.week,
      service: row.service,
      vessel: row.vessel,
      allocation: row.allocation,
      changeTimestamp: row.change_timestamp,
      createdAt: row.created_at
    }));
    
    res.json({
      success: true,
      records,
      count: records.length,
      dateRange: { start, end },
      message: `找到 ${records.length} 条变更记录`
    });
    
  } catch (error) {
    console.error('❌ 按日期范围获取变更记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 6. 按数据库获取变更记录
app.get('/api/booking-change-records/database/:databaseId', async (req, res) => {
  try {
    const { databaseId } = req.params;
    const { date } = req.query;
    
    console.log('🏢 按数据库获取变更记录:', databaseId, '日期:', date);
    
    let query = 'SELECT * FROM booking_change_records WHERE database_id = $1';
    let params = [databaseId];
    
    if (date) {
      query += ' AND change_date = $2';
      params.push(date);
    }
    
    query += ' ORDER BY change_date DESC, change_timestamp DESC';
    
    const result = await pool.query(query, params);
    
    const records = result.rows.map(row => ({
      id: row.id,
      changeDate: row.change_date,
      bookingRef: row.bookingref,
      databaseId: row.database_id,
      databaseName: row.database_name,
      changeType: row.change_type,
      previousStatus: row.previous_status,
      previousClient: row.previous_client,
      previousPol: row.previous_pol,
      previousPod: row.previous_pod,
      newStatus: row.new_status,
      newClient: row.new_client,
      newPol: row.new_pol,
      newPod: row.new_pod,
      carrier: row.carrier,
      etd: row.etd,
      qty: row.qty,
      type: row.type,
      week: row.week,
      service: row.service,
      vessel: row.vessel,
      allocation: row.allocation,
      changeTimestamp: row.change_timestamp,
      createdAt: row.created_at
    }));
    
    res.json({
      success: true,
      records,
      count: records.length,
      databaseId,
      date: date || '全部',
      message: `找到 ${records.length} 条变更记录`
    });
    
  } catch (error) {
    console.error('❌ 按数据库获取变更记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 匹配前端 apiService.ts 调用的端点
app.get('/api/booking-change-records', async (req, res) => {
  try {
    const { date } = req.query;
    
    console.log('📋 获取变更记录（前端兼容端点）:', date);
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: '需要提供日期参数'
      });
    }
    
    const result = await pool.query(`
      SELECT * FROM booking_change_records
      WHERE change_date = $1
      ORDER BY change_timestamp DESC
    `, [date]);
    
    const records = result.rows.map(row => ({
      id: row.id,
      changeDate: row.change_date,
      bookingRef: row.bookingref,
      databaseId: row.database_id,
      databaseName: row.database_name,
      changeType: row.change_type,
      previousStatus: row.previous_status,
      previousClient: row.previous_client,
      previousPol: row.previous_pol,
      previousPod: row.previous_pod,
      newStatus: row.new_status,
      newClient: row.new_client,
      newPol: row.new_pol,
      newPod: row.new_pod,
      carrier: row.carrier,
      etd: row.etd,
      qty: row.qty,
      type: row.type,
      week: row.week,
      service: row.service,
      vessel: row.vessel,
      allocation: row.allocation,
      changeTimestamp: row.change_timestamp,
      createdAt: row.created_at
    }));
    
    res.json({
      success: true,
      records,
      message: `找到 ${records.length} 条变更记录`
    });
    
  } catch (error) {
    console.error('❌ 获取变更记录失败（前端兼容端点）:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 快速修复：创建变更记录表（如果不存在）
app.post('/api/fix-change-tables', async (req, res) => {
  try {
    console.log('🔧 修复变更记录表...');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 创建预订变更记录表 - 使用 bookingref 而不是 booking_ref
      await client.query(`
        CREATE TABLE IF NOT EXISTS booking_change_records (
          id VARCHAR(255) PRIMARY KEY,
          change_date DATE NOT NULL,
          bookingref VARCHAR(100) NOT NULL,
          database_id VARCHAR(255) NOT NULL,
          database_name VARCHAR(255) NOT NULL,
          change_type VARCHAR(50) NOT NULL,
          previous_status VARCHAR(50),
          previous_client VARCHAR(255),
          previous_pol VARCHAR(100),
          previous_pod VARCHAR(100),
          new_status VARCHAR(50) NOT NULL,
          new_client VARCHAR(255),
          new_pol VARCHAR(100),
          new_pod VARCHAR(100),
          carrier VARCHAR(100),
          etd DATE,
          qty INTEGER,
          type VARCHAR(50),
          week VARCHAR(20),
          service VARCHAR(100),
          vessel VARCHAR(255),
          allocation VARCHAR(100),
          change_timestamp TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          CONSTRAINT unique_change_record UNIQUE (change_date, bookingref, database_id, change_type)
        )
      `);
      
      // 创建索引
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_change_records_date ON booking_change_records(change_date);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_change_records_booking ON booking_change_records(bookingref);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_change_records_database ON booking_change_records(database_id);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_change_records_type ON booking_change_records(change_type);
      `);
      
      await client.query('COMMIT');
      
      const countResult = await client.query('SELECT COUNT(*) as count FROM booking_change_records');
      
      res.json({
        success: true,
        message: '变更记录表修复完成',
        tableCreated: true,
        rowCount: parseInt(countResult.rows[0].count) || 0,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ 修复变更记录表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 新增修复接口 ====================

// 清理重复的变更记录
app.post('/api/changes/clean-duplicates', async (req, res) => {
  try {
    console.log('🧹 清理重复的变更记录...');
    
    const result = await pool.query(`
      WITH duplicates AS (
        SELECT 
          id,
          change_date,
          bookingref,
          database_id,
          change_type,
          ROW_NUMBER() OVER (
            PARTITION BY change_date, bookingref, database_id, change_type 
            ORDER BY created_at DESC
          ) as rn
        FROM booking_change_records
      )
      DELETE FROM booking_change_records 
      WHERE id IN (
        SELECT id FROM duplicates WHERE rn > 1
      )
      RETURNING id, bookingref, change_date, change_type
    `);
    
    const deletedCount = result.rowCount || 0;
    
    console.log(`✅ 清理完成，删除了 ${deletedCount} 条重复记录`);
    
    res.json({
      success: true,
      message: `清理了 ${deletedCount} 条重复的变更记录`,
      deletedRecords: result.rows
    });
    
  } catch (error) {
    console.error('❌ 清理重复记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 强制修复变更记录日期不匹配
app.post('/api/changes/fix-date-mismatch', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { date } = req.body;
    const targetDate = date || getCurrentDate();
    
    console.log('🔧 强制修复变更记录日期不匹配:', targetDate);
    
    // 步骤1: 删除所有 change_date 与 updated_at 日期不一致的记录
    const deleteResult = await client.query(`
      DELETE FROM booking_change_records 
      WHERE change_date != DATE(change_timestamp) 
        AND change_date = $1
      RETURNING id, bookingref, change_date
    `, [targetDate]);
    
    const deletedCount = deleteResult.rowCount || 0;
    
    console.log(`🗑️ 删除了 ${deletedCount} 条日期不一致的记录`);
    
    // 步骤2: 重新从预订表中创建变更记录
    const recreatedRecords = await client.query(`
      INSERT INTO booking_change_records (
        id, change_date, bookingref, database_id, database_name, change_type,
        carrier, etd, qty, type, week, service, vessel, allocation,
        change_timestamp, created_at, updated_at
      )
      SELECT 
        'change_' || b.id || '_' || EXTRACT(EPOCH FROM b.updated_at) as id,
        DATE(b.updated_at) as change_date,
        b.bookingref,
        b.database_id,
        d.name as database_name,
        CASE 
          WHEN b.status = 'CONFIRMED' THEN 'status_change'
          ELSE 'status_change'
        END as change_type,
        b.data->>'carrier' as carrier,
        b.etd,
        CAST(COALESCE(b.data->>'qty', '0') AS INTEGER) as qty,
        b.data->>'type' as type,
        b.week,
        b.data->>'service' as service,
        b.data->>'vessel' as vessel,
        b.data->>'allocation' as allocation,
        b.updated_at as change_timestamp,
        NOW() as created_at,
        NOW() as updated_at
      FROM bookings b
      JOIN databases d ON b.database_id = d.id
      WHERE DATE(b.updated_at) = $1
        AND NOT EXISTS (
          SELECT 1 FROM booking_change_records c 
          WHERE c.bookingref = b.bookingref 
            AND c.change_date = DATE(b.updated_at)
        )
      ON CONFLICT (id) DO NOTHING
      RETURNING id, bookingref
    `, [targetDate]);
    
    const recreatedCount = recreatedRecords.rowCount || 0;
    
    await client.query('COMMIT');
    
    console.log(`✅ 修复完成: 删除了 ${deletedCount} 条, 重新创建了 ${recreatedCount} 条`);
    
    res.json({
      success: true,
      message: '日期不匹配问题已修复',
      details: {
        deletedRecords: deletedCount,
        recreatedRecords: recreatedCount,
        sampleDeleted: deleteResult.rows.slice(0, 5),
        sampleRecreated: recreatedRecords.rows.slice(0, 5)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 修复日期不匹配失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// 在 server.js 中添加调试接口
app.post('/api/debug/quotation-request', async (req, res) => {
  try {
    console.log('🔍 报价请求调试信息:');
    console.log('📦 完整请求体:', JSON.stringify(req.body, null, 2));
    console.log('📋 请求头:', req.headers);
    
    res.json({
      success: true,
      message: '报价请求调试信息',
      requestBody: req.body,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 调试报价请求失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 调试端点：查看报价请求格式
app.post('/api/debug/quotation-request', async (req, res) => {
  try {
    console.log('🔍 报价请求调试信息:');
    console.log('📦 完整请求体:', JSON.stringify(req.body, null, 2));
    console.log('📋 请求头:', req.headers);
    
    // 检查各个字段
    const fields = ['carrier', 'region', 'pol', 'pod', 'service', 'containerType', 'rate', 'validity', 'remark', 'vessel', 'etd'];
    const fieldStatus = {};
    
    fields.forEach(field => {
      fieldStatus[field] = {
        exists: req.body[field] !== undefined,
        value: req.body[field],
        type: typeof req.body[field]
      };
    });
    
    res.json({
      success: true,
      message: '报价请求调试信息',
      requestBody: req.body,
      fieldStatus,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 调试报价请求失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 调试接口：检查日期一致性
app.get('/api/debug/date-consistency', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || getCurrentDate();
    
    console.log('🔍 检查日期一致性:', targetDate);
    
    // 检查预订表的 updated_at 日期
    const bookingsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN DATE(updated_at) = $1::date THEN 1 END) as today_updated,
        MIN(updated_at) as earliest_update,
        MAX(updated_at) as latest_update
      FROM bookings
    `, [targetDate]);
    
    // 检查变更记录表的日期一致性
    const changesResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN change_date != DATE(change_timestamp) THEN 1 END) as date_mismatch,
        COUNT(CASE WHEN change_date = DATE(change_timestamp) THEN 1 END) as date_match,
        MIN(change_date) as earliest_change_date,
        MAX(change_date) as latest_change_date,
        MIN(change_timestamp) as earliest_change_time,
        MAX(change_timestamp) as latest_change_time
      FROM booking_change_records
      WHERE change_date = $1
    `, [targetDate]);
    
    // 检查预订与变更记录的关联
    const relationResult = await pool.query(`
      SELECT 
        b.bookingref,
        DATE(b.updated_at) as booking_updated_date,
        c.change_date,
        DATE(c.change_timestamp) as change_timestamp_date,
        CASE 
          WHEN DATE(b.updated_at) = c.change_date THEN '✅ 一致'
          WHEN DATE(b.updated_at) = DATE(c.change_timestamp) THEN '⚠️ 时间戳一致'
          ELSE '❌ 不一致'
        END as consistency
      FROM bookings b
      LEFT JOIN booking_change_records c ON b.bookingref = c.bookingref
      WHERE DATE(b.updated_at) = $1
        AND c.change_date IS NOT NULL
      ORDER BY b.updated_at DESC
      LIMIT 10
    `, [targetDate]);
    
    res.json({
      success: true,
      date: targetDate,
      bookings: bookingsResult.rows[0],
      changes: changesResult.rows[0],
      sampleRelations: relationResult.rows,
      recommendations: changesResult.rows[0]?.date_mismatch > 0 ? 
        '检测到日期不一致的记录，建议运行修复接口' : 
        '日期一致性良好'
    });
    
  } catch (error) {
    console.error('❌ 检查日期一致性失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 静态文件服务 ====================
const frontendPath = path.join(__dirname, '..', 'build');
if (fs.existsSync(path.join(frontendPath, 'index.html'))) {
  console.log('✅ 找到前端文件，启用静态文件服务');
  app.use(express.static(frontendPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  console.log('⚠️ 未找到前端文件，仅提供 API 服务');
}

// ==================== 错误处理 ====================
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'API端点不存在'
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

// ==================== 启动服务器 ====================
app.listen(port, () => {
  console.log(`🚀 服务器启动成功: http://0.0.0.0:${port}`);
  console.log(`📊 健康检查: http://0.0.0.0:${port}/api/health`);
  console.log(`📋 核心API端点:`);
  console.log(`  - /api/init (GET) - 初始化数据`);
  console.log(`  - /api/databases (GET) - 获取数据库列表`);
  console.log(`  - /api/users (GET) - 获取用户列表`);
  console.log(`  - /api/bookings (GET) - 获取所有预订`);
  console.log(`  - /api/quotations (GET) - 获取所有报价`);
  console.log(`  - /api/settings (GET) - 获取系统设置`);
  console.log(`  - /api/dashboard/stats (GET) - Dashboard统计`);
  console.log(`  - /api/debug/users-table (GET) - 调试用户表结构`);
  console.log(`  - /api/migration/check-snapshots (GET) - 检查快照表状态`);
  console.log(`  - /api/debug/check-booking (GET) - 检查特定预订状态`);
  console.log(`  - /api/booking-change-records (POST) - 保存变更记录`);
  console.log(`  - /api/booking-change-records/stats (GET) - 获取变更统计`);
  console.log(`  - /api/fix-change-tables (POST) - 修复变更记录表`);
  console.log(`  - /api/changes/clean-duplicates (POST) - 清理重复记录`);
  console.log(`  - /api/changes/fix-date-mismatch (POST) - 修复日期不匹配`);
  console.log(`  - /api/debug/date-consistency (GET) - 检查日期一致性`);
});