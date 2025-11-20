const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

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

// دالة إرسال كل الصور في رسالة واحدة باستخدام Media Group
async function sendToTelegram(files = []) {
  try {
    if (files.length === 0) return false;

    const message = `🛒 طلب جديد - متجر لهيب

⏰ الوقت: ${new Date().toLocaleString('ar-SA')}
🆔 رقم الطلب: #${Date.now()}

📸 تم رفع ${files.length} صورة`;

    // إذا كانت صورة واحدة فقط
    if (files.length === 1) {
      const formData = new FormData();
      formData.append('chat_id', CHAT_ID);
      formData.append('photo', files[0].buffer, {
        filename: 'image.jpg',
        contentType: files[0].mimetype
      });
      formData.append('caption', message);

      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, formData, {
        headers: formData.getHeaders()
      });
    } 
    // إذا كانت أكثر من صورة - نستخدم Media Group
    else {
      // تحضير الوسائط
      const media = files.map((file, index) => ({
        type: 'photo',
        media: `attach://image${index}`,
        caption: index === 0 ? message : ''
      }));

      const formData = new FormData();
      formData.append('chat_id', CHAT_ID);
      formData.append('media', JSON.stringify(media));

      // إضافة الصور
      files.forEach((file, index) => {
        formData.append(`image${index}`, file.buffer, {
          filename: `image${index}.jpg`,
          contentType: file.mimetype
        });
      });

      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`, formData, {
        headers: formData.getHeaders()
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ خطأ في الإرسال:', error.response?.data || error.message);
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
    const files = req.files;

    // تجميع الملفات
    const uploadedFiles = [];
    if (files.receipt) uploadedFiles.push(files.receipt[0]);
    if (files.receipt2) uploadedFiles.push(files.receipt2[0]);
    if (files.snap) uploadedFiles.push(files.snap[0]);

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
        message: 'فشل في إرسال الطلب إلى التليجرام' 
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ السيرفر شغال على البورت ${PORT}`);
});
