const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const app = express();

// middleware
app.use(express.json());
app.use(express.static('public'));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// إعدادات التليجرام - ضعها هنا مباشرة أو في Secrets
const BOT_TOKEN = process.env.BOT_TOKEN || 'ضع_توكن_البوت_هنا';
const CHAT_ID = process.env.CHAT_ID || 'ضع_الـ_chat_id_هنا';

// تخزين الملفات في الذاكرة فقط (مهم لـ Replit)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// دالة إرسال للتليجرام
async function sendToTelegram(message, files = []) {
  try {
    // إرسال الرسالة النصية
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    });

    // إرسال الصور
    for (const file of files) {
      const formData = new FormData();
      formData.append('chat_id', CHAT_ID);
      formData.append('photo', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });
      
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, formData, {
        headers: formData.getHeaders()
      });
    }
    
    return true;
  } catch (error) {
    console.error('خطأ في الإرسال:', error.message);
    return false;
  }
}

// استقبال الطلبات
app.post('/submit-order', upload.fields([
  { name: 'receipt', maxCount: 1 },
  { name: 'receipt2', maxCount: 1 },
  { name: 'snap', maxCount: 1 }
]), async (req, res) => {
  try {
    const { service_title, amount, phone_number } = req.body;
    const files = req.files;

    // تجميع الملفات
    const uploadedFiles = [];
    if (files.receipt) uploadedFiles.push(...files.receipt);
    if (files.receipt2) uploadedFiles.push(...files.receipt2);
    if (files.snap) uploadedFiles.push(...files.snap);

    // إنشاء الرسالة
    const message = `🛒 <b>طلب جديد - متجر لهيب</b>

📋 الخدمة: ${service_title}
💰 المبلغ: ${amount}
📞 الرقم: ${phone_number}

⏰ الوقت: ${new Date().toLocaleString('ar-SA')}
🆔 رقم الطلب: #${Date.now()}

📎 عدد الصور: ${uploadedFiles.length}`;

    // الإرسال
    const sent = await sendToTelegram(message, uploadedFiles);

    if (sent) {
      res.json({ 
        success: true, 
        message: 'تم الإرسال بنجاح!',
        orderId: '#' + Date.now()
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'فشل الإرسال' 
      });
    }
  } catch (error) {
    console.error('خطأ:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في السيرفر' 
    });
  }
});

// صفحة الاختبار
app.get('/', (req, res) => {
  res.json({ 
    status: 'شغال', 
    message: 'سيرفر متجر لهيب',
    timestamp: new Date().toISOString()
  });
});

// التشغيل
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ السيرفر شغال على البورت ${PORT}`);
});