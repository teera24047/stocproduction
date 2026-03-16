import os
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pymysql

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

def get_db_connection():
    db_host = os.environ.get('DB_HOST', 'db')
    
    return pymysql.connect(
        host=db_host,
        port=3306,
        user='root',
        password='mysecretpassword',
        database='inventory_db',
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True # Autocommit เปิดใช้งานอยู่ แต่เราจะย้ำด้วย .commit() อีกรอบเพื่อความชัวร์
    )

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. สร้างตารางทั้งหมด
    cursor.execute('''CREATE TABLE IF NOT EXISTS products (product_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, quantity INT DEFAULT 0, serial_number VARCHAR(100) DEFAULT '-', asset_number VARCHAR(100) DEFAULT '-')''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS transactions (transaction_id INT AUTO_INCREMENT PRIMARY KEY, product_id INT, transaction_type VARCHAR(50) NOT NULL, amount INT NOT NULL, user_id INT DEFAULT NULL, status VARCHAR(20) DEFAULT 'APPROVED', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (product_id) REFERENCES products(product_id))''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS users (user_id INT AUTO_INCREMENT PRIMARY KEY, employee_id VARCHAR(50) DEFAULT '-', full_name VARCHAR(100) DEFAULT 'ไม่ระบุ', department VARCHAR(100) DEFAULT 'ไม่ระบุ', username VARCHAR(50) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'user')''')
    
    # 2. เพิ่มคอลัมน์สถานะ (is_active) สำหรับระบบระงับสิทธิ์
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE")
    except pymysql.err.OperationalError:
        pass

    # สร้างแอดมินตั้งต้น
    cursor.execute("SELECT COUNT(*) as count FROM users WHERE username = 'admin'")
    if cursor.fetchone()['count'] == 0:
        cursor.execute("INSERT INTO users (employee_id, full_name, department, username, password, role) VALUES (%s, %s, %s, %s, %s, %s)", ('EMP-001', 'ผู้ดูแลระบบ', 'IT', 'admin', 'password', 'admin'))
    
    conn.commit()
    conn.close()

init_db()

# --- Models ---
class LoginRequest(BaseModel): username: str; password: str
class UserCreateRequest(BaseModel): employee_id: str; full_name: str; department: str; username: str; password: str; role: str
class TransactionRequest(BaseModel): product_id: int; transaction_type: str; amount: int; user_id: int; role: str
class ProductRequest(BaseModel): name: str; serial_number: str = "-"; asset_number: str = "-"; quantity: int = 0
class ApprovalRequest(BaseModel): status: str
class UserStatusRequest(BaseModel): is_active: bool

# --- API Endpoints ---
@app.post("/login")
def login(req: LoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = %s AND password = %s", (req.username, req.password))
    user = cursor.fetchone()
    conn.close()
    
    if user:
        if not user.get('is_active', True): # เช็คว่าโดนระงับหรือไม่
            raise HTTPException(status_code=403, detail="บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อแอดมิน")
        return {"status": "success", "user": user}
    raise HTTPException(status_code=401, detail="รหัสผ่านไม่ถูกต้อง")

# API ดึงรายชื่อผู้ใช้ทั้งหมด (สำหรับหน้าจัดการพนักงาน)
@app.get("/users")
def get_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, employee_id, full_name, department, username, role, is_active FROM users ORDER BY user_id DESC")
    users = cursor.fetchall()
    conn.close()
    return users

@app.post("/users")
def create_user(req: UserCreateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (employee_id, full_name, department, username, password, role) VALUES (%s, %s, %s, %s, %s, %s)", (req.employee_id, req.full_name, req.department, req.username, req.password, req.role))
        conn.commit()
        conn.close()
        return {"status": "success"}
    except pymysql.err.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Username นี้มีในระบบแล้ว")

# API ระงับสิทธิ์ / ปลดระงับ
@app.put("/users/{user_id}/status")
def update_user_status(user_id: int, req: UserStatusRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET is_active = %s WHERE user_id = %s", (req.is_active, user_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

# API ลบผู้ใช้ (ถาวร)
@app.delete("/users/{user_id}")
def delete_user(user_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM users WHERE user_id = %s", (user_id,))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail="ไม่สามารถลบได้เนื่องจากพนักงานคนนี้มีประวัติการเบิกสินค้า (แนะนำให้ใช้การ 'ระงับสิทธิ์' แทน)")
    conn.close()
    return {"status": "success"}

@app.get("/products")
def get_stock():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products")
    products = cursor.fetchall()
    conn.close()
    return products

@app.post("/products")
def add_product(req: ProductRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO products (name, serial_number, asset_number, quantity) VALUES (%s, %s, %s, %s)", (req.name, req.serial_number, req.asset_number, req.quantity))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/transactions")
def get_transactions():
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT t.*, p.name as product_name, u.full_name, u.employee_id FROM transactions t LEFT JOIN products p ON t.product_id = p.product_id LEFT JOIN users u ON t.user_id = u.user_id ORDER BY t.transaction_id DESC"
    cursor.execute(query)
    txs = cursor.fetchall()
    conn.close()
    return txs

@app.post("/transactions")
def process_transaction(req: TransactionRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT quantity FROM products WHERE product_id = %s", (req.product_id,))
    product = cursor.fetchone()
    if not product:
        conn.close()
        raise HTTPException(status_code=404, detail="ไม่พบสินค้านี้")

    # [User] เบิก -> รออนุมัติ (สต็อกยังไม่ลด)
    if req.role == 'user' and req.transaction_type == 'WITHDRAW':
        if product['quantity'] < req.amount:
            conn.close()
            raise HTTPException(status_code=400, detail="สต็อกไม่เพียงพอสำหรับการเบิก")
        cursor.execute("INSERT INTO transactions (product_id, transaction_type, amount, user_id, status) VALUES (%s, %s, %s, %s, 'PENDING')", (req.product_id, req.transaction_type, req.amount, req.user_id))
        conn.commit()
        conn.close()
        return {"status": "pending", "message": "ส่งคำขอเบิกสินค้าแล้ว กรุณารอแอดมินอนุมัติ"}

    # [Admin] ทำรายการ -> อนุมัติและหักสต็อกทันที
    current_qty = product['quantity']
    if req.transaction_type == 'INBOUND': new_qty = current_qty + req.amount
    else: 
        if current_qty < req.amount:
            conn.close()
            raise HTTPException(status_code=400, detail="สต็อกไม่เพียงพอ")
        new_qty = current_qty - req.amount

    cursor.execute("UPDATE products SET quantity = %s WHERE product_id = %s", (new_qty, req.product_id))
    cursor.execute("INSERT INTO transactions (product_id, transaction_type, amount, user_id, status) VALUES (%s, %s, %s, %s, 'APPROVED')", (req.product_id, req.transaction_type, req.amount, req.user_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.put("/transactions/{tx_id}/status")
def update_tx_status(tx_id: int, req: ApprovalRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transactions WHERE transaction_id = %s", (tx_id,))
    tx = cursor.fetchone()
    
    if not tx or tx['status'] != 'PENDING':
        conn.close()
        raise HTTPException(status_code=400, detail="ไม่พบรายการรออนุมัติ")
        
    if req.status == 'APPROVED':
        # เช็คสต็อก ตัดสต็อกจริงจัง
        cursor.execute("SELECT quantity FROM products WHERE product_id = %s", (tx['product_id'],))
        product = cursor.fetchone()
        if product['quantity'] < tx['amount']:
             conn.close()
             raise HTTPException(status_code=400, detail="สต็อกปัจจุบันไม่พอให้อนุมัติรายการนี้แล้ว")
             
        new_qty = product['quantity'] - tx['amount']
        cursor.execute("UPDATE products SET quantity = %s WHERE product_id = %s", (new_qty, tx['product_id']))
        
    cursor.execute("UPDATE transactions SET status = %s WHERE transaction_id = %s", (req.status, tx_id))
    conn.commit() # เซฟข้อมูลการอนุมัติและตัดสต็อกลง DB
    conn.close()
    return {"status": "success"}