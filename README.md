# ATC Online Shop API

ระบบจัดการร้านค้าออนไลน์ (Online Shop Management System) สำหรับบริษัท ATC Next Gen Co., Ltd.

## 📋 สารบัญ
1. [ข้อมูลโปรเจค](#ข้อมูลโปรเจค)
2. [Middleware](#middleware)
3. [JWT Authentication](#jwt-authentication)
4. [Database Schema](#database-schema)
5. [การ Deploy](#การ-deploy)
6. [API Endpoints](#api-endpoints)

---

## ข้อมูลโปรเจค

### เทคโนโลยีที่ใช้
- **Node.js** - JavaScript Runtime
- **Express.js** - Web Framework
- **MongoDB** - NoSQL Database
- **Mongoose** - ODM for MongoDB
- **JWT** - JSON Web Token สำหรับ Authentication
- **bcryptjs** - สำหรับ Hash Password
- **Helmet** - เพื่อความปลอดภัย
- **CORS** - Cross-Origin Resource Sharing

### การติดตั้ง
```bash
npm install
```

### การรัน
```bash
npm start
```

---

## 1. Middleware

### หลักการทำงานของ Middleware

Middleware คือฟังก์ชันที่ทำงานระหว่าง Request และ Response ในระบบ Express.js โดยมีหน้าที่หลักในการประมวลผล ตรวจสอบ หรือแก้ไขข้อมูลก่อนที่จะส่งต่อไปยัง Route Handler

#### โครงสร้างของ Middleware
```javascript
const middleware = (req, res, next) => {
    // ทำงานกับ request
    console.log('Processing request...');
    
    // ส่งต่อไปยัง middleware หรือ route handler ตัวถัดไป
    next();
};
```

#### Middleware ที่ใช้ในโปรเจคนี้

1. **Built-in Middleware**
```javascript
app.use(express.json());  // แปลง JSON body
app.use(cors());          // อนุญาต Cross-Origin requests
app.use(helmet());        // เพิ่มความปลอดภัย HTTP headers
```

2. **Custom Middleware - Server Uptime Logger**
```javascript
const uptimeMiddleware = (req, res, next) => {
    const uptime = process.uptime();
    console.log(`Server uptime: ${uptime} seconds`);
    next();
};
```
- ทำงาน: บันทึกเวลาที่ server ทำงานไปแล้วทุกครั้งที่มี request เข้ามา
- ใช้งาน: ติดตามสถานะการทำงานของ server

3. **Authentication Middleware**
```javascript
const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};
```
- ทำงาน: ตรวจสอบ JWT token ก่อนอนุญาตให้เข้าถึง Protected Routes
- ใช้งาน: ป้องกัน unauthorized access

#### ลำดับการทำงานของ Middleware
```
Request → Middleware 1 → Middleware 2 → Route Handler → Response
```

#### ประโยชน์ของ Middleware
- **การแยกส่วน Logic**: แยก code ที่ต้องใช้ซ้ำๆ ออกมาเป็น middleware
- **ความปลอดภัย**: ตรวจสอบ authentication และ authorization
- **Logging**: บันทึกข้อมูล request/response
- **Error Handling**: จัดการ error แบบรวมศูนย์

---

## 2. JWT Authentication

### หลักการทำงานของ JWT (JSON Web Token)

JWT เป็นมาตรฐานสำหรับการสร้าง Token ที่ใช้ในการ Authentication และ Authorization โดยเป็นการเข้ารหัสข้อมูลในรูปแบบ JSON

#### โครงสร้างของ JWT
JWT ประกอบด้วย 3 ส่วน แบ่งด้วย `.` (dot):
```
xxxxx.yyyyy.zzzzz
```

1. **Header**: ข้อมูลประเภทของ token และ algorithm ที่ใช้
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

2. **Payload**: ข้อมูลที่ต้องการส่ง (Claims)
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "iat": 1516239022,
  "exp": 1516325422
}
```

3. **Signature**: ลายเซ็นดิจิทัลเพื่อยืนยันความถูกต้อง
```
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  secret
)
```

#### การใช้งาน JWT ในโปรเจค

**1. การสร้าง Token (Login)**
```javascript
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    // ตรวจสอบ user และ password
    const user = await User.findOne({ username });
    if (!user || password !== user.password) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    // สร้าง token
    const token = jwt.sign(
        { userId: user._id },           // Payload
        process.env.JWT_SECRET,         // Secret key
        { expiresIn: '24h' }           // Options
    );

    res.json({ token });
});
```

**2. การตรวจสอบ Token**
```javascript
const authenticateToken = (req, res, next) => {
    // ดึง token จาก Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    // ตรวจสอบและถอดรหัส token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Invalid token' });
        }
        req.user = decoded;
        next();
    });
};
```

**3. การใช้งาน Protected Routes**
```javascript
// Route ที่ต้องการ authentication
app.get('/api/products', authenticateToken, async (req, res) => {
    // เข้าถึงได้เฉพาะผู้ที่มี valid token
    const products = await Product.find();
    res.json(products);
});
```

#### ขั้นตอนการทำงานของ JWT

1. **User Login**: ส่ง username และ password
2. **Server Verify**: ตรวจสอบข้อมูล user
3. **Generate Token**: สร้าง JWT token
4. **Return Token**: ส่ง token กลับไปให้ client
5. **Client Store**: client เก็บ token (localStorage, cookie)
6. **Send Token**: ส่ง token ใน Authorization header ทุกครั้งที่ request
7. **Server Verify**: server ตรวจสอบ token ก่อนอนุญาตให้เข้าถึงข้อมูล

#### ข้อดีของ JWT
- **Stateless**: ไม่ต้องเก็บ session ใน server
- **Scalable**: สามารถขยายระบบได้ง่าย
- **Cross-domain**: ใช้ได้กับหลาย domain
- **Mobile-friendly**: เหมาะกับการทำ Mobile API

#### ข้อควรระวัง
- เก็บ JWT_SECRET ให้ปลอดภัย
- ตั้งเวลา expire ที่เหมาะสม
- ใช้ HTTPS เสมอ
- ไม่ควรเก็บข้อมูลสำคัญใน payload

---

## 3. Database Schema

### การเชื่อมต่อ MongoDB

#### การตั้งค่าการเชื่อมต่อ
```javascript
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));
```

#### MongoDB Atlas Configuration
```env
MONGO_URI=mongodb+srv://atc-shop_user:66xokJnRKxgF3XUr@cluster0.gwfkd29.mongodb.net/atcshop
```

**ส่วนประกอบของ Connection String:**
- `mongodb+srv://` - Protocol (SRV record)
- `atc-shop_user` - Username
- `66xokJnRKxgF3XUr` - Password
- `cluster0.gwfkd29.mongodb.net` - Cluster hostname
- `/atcshop` - Database name

### Schema Design

Mongoose Schema คือการกำหนดโครงสร้างของ Document ใน MongoDB Collection

#### 1. User Schema
```javascript
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    }
}, {
    timestamps: true  // เพิ่ม createdAt และ updatedAt อัตโนมัติ
});

const User = mongoose.model('User', userSchema);
```

**คุณสมบัติ:**
- `username`: ชื่อผู้ใช้ (ห้ามซ้ำ)
- `password`: รหัสผ่าน
- `timestamps`: บันทึกเวลาสร้างและแก้ไข

#### 2. Product Schema
```javascript
const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    stock: {
        type: Number,
        required: true,
        min: 0
    },
    description: String
}, {
    timestamps: true
});

const Product = mongoose.model('Product', productSchema);
```

**คุณสมบัติ:**
- `name`: ชื่อสินค้า
- `price`: ราคา
- `stock`: จำนวนสต็อก (ต้องไม่น้อยกว่า 0)
- `description`: รายละเอียดสินค้า

#### 3. Order Schema
```javascript
const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    products: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered'],
        default: 'pending'
    }
}, {
    timestamps: true
});

const Order = mongoose.model('Order', orderSchema);
```

**คุณสมบัติ:**
- `user`: อ้างอิงถึง User (ObjectId)
- `products`: รายการสินค้าในออเดอร์
  - `product`: อ้างอิงถึง Product
  - `quantity`: จำนวน
  - `price`: ราคา ณ เวลาที่สั่ง
- `totalAmount`: ยอดรวม
- `status`: สถานะออเดอร์ (4 สถานะ)

### การใช้งาน Schema

#### CREATE - เพิ่มข้อมูล
```javascript
const product = new Product({
    name: "Mechanical Keyboard",
    price: 1590,
    stock: 50
});
await product.save();
```

#### READ - อ่านข้อมูล
```javascript
// ดึงทั้งหมด
const products = await Product.find();

// ดึงตามเงื่อนไข
const lowStock = await Product.find({ stock: { $lt: 10 } });

// ดึง 1 รายการ
const product = await Product.findById(id);
```

#### UPDATE - แก้ไขข้อมูล
```javascript
const product = await Product.findByIdAndUpdate(
    id,
    { price: 1490, stock: 45 },
    { new: true }  // return document หลังอัปเดต
);
```

#### DELETE - ลบข้อมูล
```javascript
await Product.findByIdAndDelete(id);
```

### Advanced Queries

#### 1. Query สินค้าที่มี stock น้อย
```javascript
const lowStock = await Product.find({ stock: { $lt: 10 } });
```

#### 2. คำนวณมูลค่ารวมของสินค้า
```javascript
const result = await Product.aggregate([
    {
        $group: {
            _id: null,
            total: { $sum: { $multiply: ["$price", "$stock"] } }
        }
    }
]);
```

#### 3. Join ข้อมูล (Populate)
```javascript
const orders = await Order.find()
    .populate('user')
    .populate('products.product')
    .exec();
```

### ข้อดีของการใช้ Schema
- **Data Validation**: ตรวจสอบข้อมูลก่อนบันทึก
- **Type Casting**: แปลงชนิดข้อมูลอัตโนมัติ
- **Default Values**: กำหนดค่าเริ่มต้น
- **Middleware**: Hook สำหรับ pre/post save
- **Virtual Properties**: สร้าง property พิเศษ

---

## 4. การ Deploy

### ขั้นตอนการ Deploy บน Render.com

#### Step 1: เตรียมโปรเจค

**1.1 สร้างไฟล์ `.gitignore`**
```
node_modules
.env
npm-debug.log*
.DS_Store
```

**1.2 ตรวจสอบ `package.json`**
```json
{
  "name": "atc-online-shop-api",
  "version": "1.0.0",
  "engines": {
    "node": ">=14.0.0"
  },
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.19.3",
    "dotenv": "^16.6.1",
    "cors": "^2.8.5",
    "helmet": "^7.2.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3"
  }
}
```

#### Step 2: Push โค้ดขึ้น GitHub

**2.1 Initialize Git Repository**
```bash
git init
git add .
git commit -m "Initial commit"
```

**2.2 สร้าง Repository บน GitHub**
- ไปที่ GitHub.com
- คลิก "New repository"
- ตั้งชื่อ: `atc-online-shop-api`
- คลิก "Create repository"

**2.3 Push โค้ด**
```bash
git remote add origin https://github.com/YOUR_USERNAME/atc-online-shop-api.git
git branch -M main
git push -u origin main
```

หรือใช้ **GitHub Desktop**:
1. เปิด GitHub Desktop
2. File → Add Local Repository
3. เลือกโฟลเดอร์โปรเจค
4. Publish Repository
5. เลือก Account และตั้งชื่อ Repository
6. คลิก "Publish Repository"

#### Step 3: Deploy บน Render

**3.1 สร้างบัญชี Render**
- ไปที่ https://render.com
- คลิก "Sign Up"
- เลือก "Sign up with GitHub"

**3.2 สร้าง Web Service**
1. คลิก "New +" → "Web Service"
2. เชื่อมต่อกับ GitHub repository
3. เลือก repository: `atc-online-shop-api`

**3.3 ตั้งค่า Web Service**
```
Name: atc-online-shop-api
Environment: Node
Region: Singapore
Branch: main
Build Command: npm install
Start Command: node server.js
```

**3.4 เพิ่ม Environment Variables**
```
PORT = 3000
MONGO_URI = mongodb+srv://atc-shop_user:66xokJnRKxgF3XUr@cluster0.gwfkd29.mongodb.net/atcshop
JWT_SECRET = mysecretkey
```

**วิธีเพิ่ม Environment Variables:**
1. ในหน้า Create Web Service
2. เลื่อนลงมาหาส่วน "Environment Variables"
3. คลิก "Add Environment Variable"
4. ใส่ Key และ Value
5. ทำซ้ำสำหรับทุกตัวแปร

**3.5 Deploy**
1. คลิก "Create Web Service"
2. รอ Render build และ deploy (2-3 นาที)
3. เมื่อเสร็จจะได้ URL: `https://atc-online-shop-api.onrender.com`

#### Step 4: ทดสอบ API

**4.1 ทดสอบ Status Endpoint**
```
GET https://atc-online-shop-api.onrender.com/api/status
```

**4.2 ทดสอบ Register**
```
POST https://atc-online-shop-api.onrender.com/api/auth/register
Body: {
    "username": "testuser",
    "password": "testpass123"
}
```

**4.3 ทดสอบ Login**
```
POST https://atc-online-shop-api.onrender.com/api/auth/login
Body: {
    "username": "testuser",
    "password": "testpass123"
}
```

**4.4 ทดสอบ Products (ต้องมี Token)**
```
GET https://atc-online-shop-api.onrender.com/api/products
Headers: Authorization: Bearer <your_token>
```

### การอัปเดตโค้ด

**Method 1: Git Command Line**
```bash
git add .
git commit -m "Update code"
git push
```

**Method 2: GitHub Desktop**
1. GitHub Desktop จะแสดงไฟล์ที่เปลี่ยนแปลง
2. เขียน commit message
3. คลิก "Commit to main"
4. คลิก "Push origin"

Render จะ **Auto-deploy** เมื่อตรวจพบการเปลี่ยนแปลงใน GitHub!

### Troubleshooting

**ปัญหา: 502 Bad Gateway**
- ตรวจสอบ Logs ใน Render Dashboard
- ตรวจสอบ Environment Variables ครบถ้วน
- ตรวจสอบ MongoDB connection string

**ปัญหา: Build Failed**
- ตรวจสอบ `package.json` มี dependencies ครบ
- ตรวจสอบ Build Command ถูกต้อง
- ดู error logs ว่าติดตรงไหน

**ปัญหา: MongoDB Connection Error**
- ตรวจสอบ MongoDB Atlas Network Access (อนุญาต IP 0.0.0.0/0)
- ตรวจสอบ username/password ถูกต้อง
- ตรวจสอบ database name ใน connection string

### ข้อควรระวัง

⚠️ **Free Tier Limitations:**
- Render Free tier จะ spin down service เมื่อไม่มีการใช้งานเกิน 15 นาที
- Request แรกจะใช้เวลา 30-50 วินาทีในการ wake up
- จำกัด 750 ชั่วโมง/เดือน

💡 **Best Practices:**
- ใช้ `.gitignore` ป้องกัน `.env` ไม่ให้ขึ้น GitHub
- ใช้ Environment Variables สำหรับข้อมูลสำคัญ
- ใช้ HTTPS เสมอ
- ตั้ง rate limiting สำหรับ production

---

## 5. API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | สมัครสมาชิก | ❌ |
| POST | `/api/auth/login` | เข้าสู่ระบบ | ❌ |

### Products

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/products` | ดูสินค้าทั้งหมด | ✅ |
| GET | `/api/products/:id` | ดูสินค้า 1 รายการ | ✅ |
| POST | `/api/products` | เพิ่มสินค้าใหม่ | ✅ |
| PUT | `/api/products/:id` | แก้ไขสินค้า | ✅ |
| DELETE | `/api/products/:id` | ลบสินค้า | ✅ |
| GET | `/api/products/low-stock` | ดูสินค้า stock < 10 | ✅ |
| GET | `/api/products/total-value` | มูลค่ารวมสินค้า | ✅ |

### Orders

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/orders` | ดูออเดอร์ทั้งหมด | ✅ |
| GET | `/api/orders/:id` | ดูออเดอร์ 1 รายการ | ✅ |
| POST | `/api/orders` | สร้างออเดอร์ใหม่ | ✅ |

### Status

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/status` | ตรวจสอบสถานะ server | ❌ |

---

## 📝 ตัวอย่างการใช้งาน

### 1. Register
```bash
POST /api/auth/register
Content-Type: application/json

{
    "username": "johndoe",
    "password": "password123"
}
```

### 2. Login
```bash
POST /api/auth/login
Content-Type: application/json

{
    "username": "johndoe",
    "password": "password123"
}

Response:
{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3. Create Product
```bash
POST /api/products
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
    "name": "Mechanical Keyboard RGB",
    "price": 1590,
    "stock": 50,
    "description": "Gaming Mechanical Keyboard with RGB"
}
```

### 4. Get Low Stock Products
```bash
GET /api/products/low-stock
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🔐 Security

- **JWT Authentication**: ป้องกันการเข้าถึงโดยไม่ได้รับอนุญาต
- **Helmet**: เพิ่ม security headers
- **CORS**: จำกัดการเข้าถึงจาก domain อื่น
- **Environment Variables**: เก็บข้อมูลสำคัญอย่างปลอดภัย

---

## 📦 Project Structure

```
atc-online-shop-api/
├── config/
│   └── db.js              # MongoDB connection
├── controllers/
│   ├── authController.js  # Authentication logic
│   └── productController.js
├── middleware/
│   └── auth.js           # JWT authentication
├── models/
│   ├── User.js           # User schema
│   ├── Product.js        # Product schema
│   └── Order.js          # Order schema
├── routes/
│   ├── authRoutes.js     # Auth endpoints
│   └── productRoutes.js  # Product endpoints
├── .env                  # Environment variables
├── .gitignore
├── package.json
├── README.md
└── server.js             # Entry point
```

---

## 🚀 URL สำหรับการทดสอบ

**Local Development:**
```
http://localhost:3000
```

**Production (Render):**
```
https://atc-online-shop-api.onrender.com
```

---

## 👨‍💻 ผู้พัฒนา

- **Developer**: Narongsak Pengngan
- **Version**: 1.0.0
- **Last Updated**: November 9, 2025

---

## 📄 License

ISC

---

## 🙏 ขอบคุณ

โปรเจคนี้พัฒนาขึ้นสำหรับการสอบปฏิบัติ Backend Development
ขอบคุณทุกท่านที่สนับสนุน