const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// السماح بجميع ال origins للاستخدام
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// تكوين multer لرفع الملفات
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB حد أقصى
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('يسمح برفع الصور فقط!'), false);
    }
  }
});

// إعدادات بوت التليجرام
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'your_bot_token_here';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || 'your_chat_id_here';

// دالة لإرسال رسالة إلى التليجرام
async function sendToTelegram(message, images = []) {
  try {
    let sentMessages = [];

    // إرسال الرسالة النصية أولاً
    const textResponse = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    });
    sentMessages.push(textResponse.data.result.message_id);

    // إرسال الصور إذا وجدت
    for (const image of images) {
      const formData = new FormData();
      formData.append('chat_id', TELEGRAM_CHAT_ID);
      formData.append('photo', fs.createReadStream(image.path));
      formData.append('caption', `📸 ${image.fieldname} - ${path.basename(image.originalname)}`);

      const photoResponse = await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, 
        formData, 
        {
          headers: formData.getHeaders()
        }
      );
      sentMessages.push(photoResponse.data.result.message_id);

      // حذف الصورة من السيرفر بعد الإرسال
      setTimeout(() => {
        if (fs.existsSync(image.path)) {
          fs.unlinkSync(image.path);
        }
      }, 5000);
    }

    return true;
  } catch (error) {
    console.error('❌ Error sending to Telegram:', error.response?.data || error.message);
    return false;
  }
}

// روت الاستقبال من الموقع
app.post('/submit-order', upload.fields([
  { name: 'receipt', maxCount: 1 },
  { name: 'receipt2', maxCount: 1 },
  { name: 'snap', maxCount: 1 }
]), async (req, res) => {
  try {
    const { service_title, amount, phone_number } = req.body;
    const files = req.files;

    console.log('📥 Received order:', { service_title, amount, phone_number });
    console.log('📁 Files received:', files);

    // تجميع معلومات الملفات
    const uploadedImages = [];
    if (files.receipt) uploadedImages.push(...files.receipt);
    if (files.receipt2) uploadedImages.push(...files.receipt2);
    if (files.snap) uploadedImages.push(...files.snap);

    // إنشاء رسالة مفصلة للزبون
    const message = `🛒 <b>طلب اشتراك جديد!</b>

📋 <b>الخدمة:</b> ${service_title}
💰 <b>المبلغ:</b> ${amount}
📞 <b>رقم التحويل:</b> ${phone_number}

⏰ <b>الوقت:</b> ${new Date().toLocaleString('ar-SA')}
🆔 <b>رقم الطلب:</b> #${Date.now()}

📎 <b>تم رفع ${uploadedImages.length} صورة</b>`;

    // إرسال إلى التليجرام
    const sent = await sendToTelegram(message, uploadedImages);

    if (sent) {
      res.json({ 
        success: true, 
        message: 'تم استلام الطلب وإرساله إلى التليجرام بنجاح',
        orderId: '#' + Date.now()
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'حدث خطأ في إرسال الطلب إلى التليجرام' 
      });
    }
  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في الخادم: ' + error.message 
    });
  }
});

// روت للتحقق من أن السيرفر شغال
app.get('/', (req, res) => {
  res.json({ 
    status: '✅ OK', 
    message: 'سيرفر متجر لهيب يعمل بشكل طبيعي',
    timestamp: new Date().toISOString()
  });
});

// روت للصحة
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Lheb Store Server',
    version: '1.0.0'
  });
});

// معالجة الأخطاء
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'حجم الملف كبير جداً. الحد الأقصى 10MB'
      });
    }
  }
  res.status(500).json({
    success: false,
    message: 'حدث خطأ غير متوقع'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 السيرفر شغال على البورت ${PORT}`);
  console.log(`📧 Bot Token: ${TELEGRAM_BOT_TOKEN ? '✅ مُعين' : '❌ غير معين'}`);
  console.log(`💬 Chat ID: ${TELEGRAM_CHAT_ID ? '✅ مُعين' : '❌ غير معين'}`);
});