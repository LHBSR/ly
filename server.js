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

// إعدادات التليجرام
const BOT_TOKEN = process.env.BOT_TOKEN || 'ضع_توكن_البوت_هنا';
const CHAT_ID = process.env.CHAT_ID || 'ضع_الـ_chat_id_هنا';

// تخزين الملفات في الذاكرة فقط
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// دالة إرسال للتليجرام - كل الصور في رسالة واحدة
async function sendToTelegram(files = []) {
  try {
    if (files.length === 0) return false;

    // إذا كانت صورة واحدة فقط
    if (files.length === 1) {
      const formData = new FormData();
      formData.append('chat_id', CHAT_ID);
      formData.append('photo', files[0].buffer, {
        filename: files[0].originalname,
        contentType: files[0].mimetype
      });
      formData.append('caption', `🛒 طلب جديد - متجر لهيب\n\n⏰ الوقت: ${new Date().toLocaleString('ar-SA')}\n🆔 رقم الطلب: #${Date.now()}\n📸 تم رفع ${files.length} صورة`);

      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, formData, {
        headers: formData.getHeaders()
      });
    } 
    // إذا كانت أكثر من صورة - نستخدم Media Group
    else {
      // أولاً نرسل الوسائط المتعددة
      const media = files.map((file, index) => ({
        type: 'photo',
        media: `attach://photo_${index}`,
        caption: index === 0 ? `🛒 طلب جديد - متجر لهيب\n\n⏰ الوقت: ${new Date().toLocaleString('ar-SA')}\n🆔 رقم الطلب: #${Date.now()}\n📸 تم رفع ${files.length} صورة` : undefined
      }));

      const formData = new FormData();
      formData.append('chat_id', CHAT_ID);
      formData.append('media', JSON.stringify(media));

      // إضافة كل الصور
      files.forEach((file, index) => {
        formData.append(`photo_${index}`, file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype
        });
      });

      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`, formData, {
        headers: formData.getHeaders()
      });
    }
    
    return true;
  } catch (error) {
    console.error('خطأ في الإرسال:', error.response?.data || error.message);
    
    // إذا فشل Media Group، نرسل كل صورة منفردة
    try {
      for (const [index, file] of files.entries()) {
        const formData = new FormData();
        formData.append('chat_id', CHAT_ID);
        formData.append('photo', file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype
        });
        
        if (index === 0) {
          formData.append('caption', `🛒 طلب جديد - متجر لهيب\n\n⏰ الوقت: ${new Date().toLocaleString('ar-SA')}\n🆔 رقم الطلب: #${Date.now()}\n📸 تم رفع ${files.length} صورة`);
        }

        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, formData, {
          headers: formData.getHeaders()
        });
      }
      return true;
    } catch (fallbackError) {
      console.error('فشل الإرسال الاحتياطي:', fallbackError.message);
      return false;
    }
  }
}

// استقبال الطلبات
app.post('/submit-order', upload.fields([
  { name: 'receipt', maxCount: 1 },
  { name: 'receipt2', maxCount: 1 },
  { name: 'snap', maxCount: 1 }
]), async (req, res) => {
  try {
    const files = req.files;

    console.log('📥 Received files:', files);

    // تجميع الملفات
    const uploadedFiles = [];
    if (files.receipt) uploadedFiles.push(...files.receipt);
    if (files.receipt2) uploadedFiles.push(...files.receipt2);
    if (files.snap) uploadedFiles.push(...files.snap);

    if (uploadedFiles.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'لم يتم رفع أي صور' 
      });
    }

    // الإرسال إلى التليجرام
    const sent = await sendToTelegram(uploadedFiles);

    if (sent) {
      res.json({ 
        success: true, 
        message: 'تم إرسال الطلب بنجاح!',
        orderId: '#' + Date.now()
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'فشل في إرسال الطلب ' 
      });
    }
  } catch (error) {
    console.error('❌ خطأ في السيرفر:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في الخادم' 
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

// صفحة الصحة
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Lheb Store Server',
    version: '2.0.0'
  });
});

// معالجة الأخطاء
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: 'حجم الملف كبير جداً'
    });
  }
  res.status(500).json({
    success: false,
    message: 'حدث خطأ غير متوقع'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ السيرفر شغال على البورت ${PORT}`);
  console.log(`🤖 Bot Token: ${BOT_TOKEN ? '✅ مُعين' : '❌ غير معين'}`);
  console.log(`💬 Chat ID: ${CHAT_ID ? '✅ مُعين' : '❌ غير معين'}`);
});
